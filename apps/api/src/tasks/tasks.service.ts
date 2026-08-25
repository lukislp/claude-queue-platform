import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DbService } from '../db/db.service';
import { toCamel, toCamelList } from '../db/mappers';
import { QueueManagerService } from '../queue/queue-manager.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DbService,
    private readonly queueManager: QueueManagerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const projectResult = await this.db.query('SELECT * FROM projects WHERE id = $1', [
      dto.projectId,
    ]);
    const project = projectResult.rows[0];
    if (!project) throw new NotFoundException('Projekt nicht gefunden.');
    if (project.user_id !== userId) throw new ForbiddenException();

    const id = uuid();
    const taskResult = await this.db.query(
      `INSERT INTO tasks (id, project_id, user_id, prompt, status, model)
       VALUES ($1, $2, $3, $4, 'QUEUED', $5) RETURNING *`,
      [id, dto.projectId, userId, dto.prompt, dto.model ?? null],
    );
    const task = toCamel(taskResult.rows[0]);

    const connResult = await this.db.query(
      'SELECT type FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    if (connResult.rows[0]?.type === 'LOCAL_CLI') {
      await this.realtime.tryDispatchForUser(userId);
    } else {
      await this.queueManager.enqueue(userId, id);
    }

    return task;
  }

  async listByProject(userId: string, projectId: string) {
    const projectResult = await this.db.query('SELECT * FROM projects WHERE id = $1', [
      projectId,
    ]);
    const project = projectResult.rows[0];
    if (!project) throw new NotFoundException();
    if (project.user_id !== userId) throw new ForbiddenException();
    const result = await this.db.query(
      `SELECT t.*, d.name AS assigned_device_name FROM tasks t
       LEFT JOIN devices d ON d.id = t.assigned_device_id
       WHERE t.project_id = $1 ORDER BY t.created_at ASC`,
      [projectId],
    );
    return toCamelList(result.rows);
  }

  async getWithLogs(userId: string, taskId: string) {
    const taskResult = await this.db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];
    if (!task) throw new NotFoundException();
    if (task.user_id !== userId) throw new ForbiddenException();
    const logsResult = await this.db.query(
      'SELECT * FROM task_logs WHERE task_id = $1 ORDER BY "timestamp" ASC',
      [taskId],
    );
    return { ...toCamel(task), logs: toCamelList(logsResult.rows) };
  }

  private async loadOwned(userId: string, taskId: string) {
    const taskResult = await this.db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];
    if (!task) throw new NotFoundException();
    if (task.user_id !== userId) throw new ForbiddenException();
    return task;
  }

  /** Bricht einen Task endgültig ab; ein laufender Prozess wird auf dem Gerät beendet. */
  async cancel(userId: string, taskId: string) {
    const task = await this.loadOwned(userId, taskId);
    if (['COMPLETED', 'FAILED', 'CANCELED'].includes(task.status)) {
      throw new BadRequestException('Task ist bereits beendet.');
    }
    if (task.assigned_device_id) {
      this.realtime.sendAbortToDevice(task.assigned_device_id, taskId, 'cancel');
    }
    const result = await this.db.query(
      `UPDATE tasks SET status = 'CANCELED', retry_at = NULL, completed_at = now()
       WHERE id = $1 RETURNING *`,
      [taskId],
    );
    const updated = toCamel(result.rows[0]);
    this.realtime.emitTaskUpdate(userId, updated);
    await this.realtime.tryDispatchForUser(userId);
    return updated;
  }

  /** Pausiert einen Task; die Claude-Session bleibt erhalten und kann fortgesetzt werden. */
  async pause(userId: string, taskId: string) {
    const task = await this.loadOwned(userId, taskId);
    if (!['QUEUED', 'RUNNING', 'PAUSED_RATE_LIMIT'].includes(task.status)) {
      throw new BadRequestException('Nur wartende oder laufende Tasks können pausiert werden.');
    }
    if (task.assigned_device_id && task.status !== 'QUEUED') {
      this.realtime.sendAbortToDevice(task.assigned_device_id, taskId, 'pause');
    }
    const result = await this.db.query(
      `UPDATE tasks SET status = 'PAUSED', retry_at = NULL WHERE id = $1 RETURNING *`,
      [taskId],
    );
    const updated = toCamel(result.rows[0]);
    this.realtime.emitTaskUpdate(userId, updated);
    await this.realtime.tryDispatchForUser(userId);
    return updated;
  }

  /** Setzt einen pausierten Task fort (Wiedereinreihung, ggf. mit Session-Resume). */
  async resume(userId: string, taskId: string) {
    const task = await this.loadOwned(userId, taskId);
    if (task.status !== 'PAUSED') {
      throw new BadRequestException('Nur pausierte Tasks können fortgesetzt werden.');
    }
    const result = await this.db.query(
      `UPDATE tasks SET status = 'QUEUED', assigned_device_id = NULL WHERE id = $1 RETURNING *`,
      [taskId],
    );
    const updated = toCamel(result.rows[0]);
    this.realtime.emitTaskUpdate(userId, updated);

    const connResult = await this.db.query(
      'SELECT type FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    if (connResult.rows[0]?.type === 'LOCAL_CLI') {
      await this.realtime.tryDispatchForUser(userId);
    } else {
      await this.queueManager.enqueue(userId, taskId);
    }
    return updated;
  }

  async remove(userId: string, taskId: string) {
    const taskResult = await this.db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const task = taskResult.rows[0];
    if (!task) throw new NotFoundException();
    if (task.user_id !== userId) throw new ForbiddenException();
    await this.db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    return { success: true };
  }
}
