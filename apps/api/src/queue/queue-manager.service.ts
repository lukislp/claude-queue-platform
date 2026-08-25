import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from '../db/db.service';
import { toCamel } from '../db/mappers';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { decryptSecret } from '../common/crypto.util';

interface JobPayload {
  taskId: string;
}

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null as any,
  };
}

const DEFAULT_RATE_LIMIT_DELAY_MS = 60_000;

@Injectable()
export class QueueManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueManagerService.name);
  private queues = new Map<string, Queue<JobPayload>>();
  private workers = new Map<string, Worker<JobPayload>>();

  constructor(
    private readonly db: DbService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private getQueue(userId: string): Queue<JobPayload> {
    let queue = this.queues.get(userId);
    if (!queue) {
      queue = new Queue<JobPayload>(`claude-tasks-${userId}`, { connection: redisConnection() });
      this.queues.set(userId, queue);
    }
    return queue;
  }

  private ensureWorker(userId: string, concurrency: number) {
    let worker = this.workers.get(userId);
    if (!worker) {
      worker = new Worker<JobPayload>(
        `claude-tasks-${userId}`,
        (job) => this.process(userId, job),
        { connection: redisConnection(), concurrency },
      );
      worker.on('failed', (job, err) => {
        this.logger.error(`Task-Job fehlgeschlagen (${job?.id}): ${err.message}`);
      });
      this.workers.set(userId, worker);
    } else {
      worker.concurrency = concurrency;
    }
    return worker;
  }

  async enqueue(userId: string, taskId: string) {
    const result = await this.db.query(
      'SELECT concurrency_limit FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    const concurrency = result.rows[0]?.concurrency_limit ?? 2;
    this.ensureWorker(userId, concurrency);
    await this.getQueue(userId).add('run-task', { taskId });
  }

  syncConcurrency(userId: string, concurrency: number) {
    const worker = this.workers.get(userId);
    if (worker) worker.concurrency = concurrency;
  }

  private async process(userId: string, job: Job<JobPayload>) {
    const { taskId } = job.data;
    const taskResult = await this.db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];
    if (!task) return;
    // Vom Nutzer abgebrochene/pausierte Tasks nicht mehr ausführen.
    if (task.status === 'CANCELED' || task.status === 'PAUSED') return;

    const connResult = await this.db.query(
      'SELECT * FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    const connection = connResult.rows[0];
    if (!connection?.encrypted_api_key) {
      await this.markFailed(userId, taskId, 'Kein API-Key hinterlegt.');
      return;
    }

    await this.updateStatus(userId, taskId, "status = 'RUNNING', started_at = now()");

    const apiKey = decryptSecret(connection.encrypted_api_key);
    const client = new Anthropic({ apiKey });

    try {
      const response = await client.messages.create({
        model: task.model ?? 'claude-sonnet-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: task.prompt }],
      });
      const text = response.content
        .map((block: any) => (block.type === 'text' ? block.text : ''))
        .join('\n');
      await this.db.query(
        `UPDATE tasks SET status = 'COMPLETED', result = $1, completed_at = now() WHERE id = $2 AND status <> 'CANCELED'`,
        [text, taskId],
      );
      await this.emitUpdated(userId, taskId);
    } catch (err: any) {
      await this.handleExecutionError(userId, taskId, err);
    }
  }

  private async handleExecutionError(userId: string, taskId: string, err: any) {
    const status = err?.status ?? err?.response?.status;
    const isRateLimited = status === 429 || err?.error?.type === 'rate_limit_error';
    const isOverloaded = status === 529 || err?.error?.type === 'overloaded_error';

    if (isRateLimited || isOverloaded) {
      const retryAfterHeader =
        err?.headers?.['retry-after'] ?? err?.response?.headers?.['retry-after'];
      const delayMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : DEFAULT_RATE_LIMIT_DELAY_MS;
      const retryAt = new Date(Date.now() + delayMs);

      await this.db.query(
        `UPDATE tasks SET status = 'PAUSED_RATE_LIMIT', retry_at = $1 WHERE id = $2`,
        [retryAt, taskId],
      );
      await this.emitUpdated(userId, taskId);
      // Automatisch verzögert erneut einreihen - kein manuelles Eingreifen nötig.
      await this.getQueue(userId).add('run-task', { taskId }, { delay: delayMs });
      this.logger.log(`Task ${taskId} pausiert wegen Rate-/Usage-Limit, Retry in ${delayMs}ms`);
      return;
    }

    await this.markFailed(userId, taskId, err?.message ?? 'Unbekannter Fehler');
  }

  private async markFailed(userId: string, taskId: string, error: string) {
    await this.db.query(
      `UPDATE tasks SET status = 'FAILED', error = $1, completed_at = now() WHERE id = $2 AND status <> 'CANCELED'`,
      [error, taskId],
    );
    await this.emitUpdated(userId, taskId);
  }

  private async updateStatus(userId: string, taskId: string, setClause: string) {
    await this.db.query(`UPDATE tasks SET ${setClause} WHERE id = $1 AND status <> 'CANCELED'`, [taskId]);
    await this.emitUpdated(userId, taskId);
  }

  private async emitUpdated(userId: string, taskId: string) {
    const result = await this.db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = toCamel(result.rows[0]);
    this.realtime.server?.to(`user:${userId}`).emit('task:update', task);
  }

  async onModuleDestroy() {
    for (const worker of this.workers.values()) await worker.close();
    for (const queue of this.queues.values()) await queue.close();
  }
}
