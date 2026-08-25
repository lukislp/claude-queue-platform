import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';
import { toCamel } from '../db/mappers';
import { DevicesService } from '../devices/devices.service';

interface SocketData {
  mode: 'dashboard' | 'agent';
  userId: string;
  deviceId?: string;
}

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:3000'], credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Verkettet Status-Updates pro Task, damit zwei schnell hintereinander eintreffende
  // Nachrichten (z.B. RUNNING gefolgt von FAILED) garantiert in der richtigen
  // Reihenfolge in der DB landen und sich nicht durch unterschiedliche DB-Latenz
  // gegenseitig überschreiben können.
  private taskUpdateChains = new Map<string, Promise<any>>();

  private runSerialized(taskId: string, fn: () => Promise<void>) {
    const previous = this.taskUpdateChains.get(taskId) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    this.taskUpdateChains.set(taskId, next);
    return next;
  }

  // Same pattern, keyed by user: with multiple devices, two dispatch triggers (e.g. two
  // agents reconnecting at once) can otherwise interleave their occupancy checks and
  // both believe a device has a free slot, over-committing past concurrency_limit.
  private dispatchChains = new Map<string, Promise<any>>();

  private runDispatchSerialized(userId: string, fn: () => Promise<void>) {
    const previous = this.dispatchChains.get(userId) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    this.dispatchChains.set(userId, next);
    return next;
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DbService,
    private readonly devicesService: DevicesService,
  ) {}

  async handleConnection(client: Socket) {
    const { mode, token, deviceToken } = client.handshake.auth as {
      mode: 'dashboard' | 'agent';
      token?: string;
      deviceToken?: string;
    };

    try {
      if (mode === 'dashboard') {
        const cookieHeader = client.handshake.headers.cookie ?? '';
        const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
        const cookieToken = match ? decodeURIComponent(match[1]) : undefined;
        const payload = await this.jwtService.verifyAsync(cookieToken ?? token ?? '', {
          secret: process.env.JWT_SECRET,
        });
        (client.data as SocketData) = { mode: 'dashboard', userId: payload.sub };
        client.join(`user:${payload.sub}`);
        return;
      }

      if (mode === 'agent') {
        const device = await this.devicesService.findByToken(deviceToken ?? '');
        if (!device) throw new Error('unknown device token');
        (client.data as SocketData) = { mode: 'agent', userId: device.userId, deviceId: device.id };
        client.join(`user:${device.userId}`);
        client.join(`device:${device.id}`);
        await this.devicesService.setStatus(device.id, 'ONLINE');
        this.emitTaskListRefresh(device.userId);
        await this.tryDispatchForUser(device.userId);
        return;
      }

      throw new Error('unknown mode');
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as SocketData;
    if (data?.mode === 'agent' && data.deviceId) {
      await this.devicesService.setStatus(data.deviceId, 'OFFLINE');
      // Laufende/pausierte Tasks dieses Geräts zurück in die Warteschlange legen,
      // damit sie automatisch (auf diesem oder einem anderen Gerät) fortgesetzt werden.
      await this.db.query(
        `UPDATE tasks SET status = 'QUEUED', assigned_device_id = NULL
         WHERE assigned_device_id = $1 AND status IN ('RUNNING','PAUSED_RATE_LIMIT')`,
        [data.deviceId],
      );
      this.emitTaskListRefresh(data.userId);
    }
  }

  @SubscribeMessage('agent:log')
  async onAgentLog(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { taskId: string; message: string },
  ) {
    const data = client.data as SocketData;
    if (data?.mode !== 'agent') return;
    const { v4: uuid } = await import('uuid');
    await this.db.query(
      'INSERT INTO task_logs (id, task_id, message) VALUES ($1, $2, $3)',
      [uuid(), body.taskId, body.message],
    );
    this.server.to(`user:${data.userId}`).emit('task:log', body);
  }

  @SubscribeMessage('agent:status')
  async onAgentStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      taskId: string;
      status: 'RUNNING' | 'PAUSED_RATE_LIMIT' | 'PAUSED' | 'COMPLETED' | 'FAILED';
      result?: string;
      error?: string;
      claudeSessionId?: string;
      retryAt?: string;
      files?: { path: string; size: number; mtimeMs: number }[];
    },
  ) {
    const data = client.data as SocketData;
    if (data?.mode !== 'agent') return;

    await this.runSerialized(body.taskId, async () => {
      const completedAt = body.status === 'COMPLETED' || body.status === 'FAILED' ? new Date() : null;

      const result = await this.db.query(
        `UPDATE tasks SET
          status = $1,
          result = COALESCE($2, result),
          error = COALESCE($3, error),
          claude_session_id = COALESCE($4, claude_session_id),
          retry_at = $5,
          completed_at = COALESCE($6, completed_at),
          output_files = COALESCE($7::jsonb, output_files)
         WHERE id = $8 AND status <> 'CANCELED' RETURNING *`,
        [
          body.status,
          body.result ?? null,
          body.error ?? null,
          body.claudeSessionId ?? null,
          body.retryAt ? new Date(body.retryAt) : null,
          completedAt,
          body.files ? JSON.stringify(body.files) : null,
          body.taskId,
        ],
      );
      // Bereits vom Nutzer abgebrochene Tasks nicht mehr überschreiben.
      if (!result.rows[0]) return;
      const task = toCamel(result.rows[0]);
      if (task.assignedDeviceId) {
        const deviceResult = await this.db.query('SELECT name FROM devices WHERE id = $1', [
          task.assignedDeviceId,
        ]);
        task.assignedDeviceName = deviceResult.rows[0]?.name ?? null;
      }
      this.server.to(`user:${data.userId}`).emit('task:update', task);

      if (body.status === 'COMPLETED' || body.status === 'FAILED') {
        await this.tryDispatchForUser(data.userId);
      }
    });
  }

  /**
   * Weist so viele wartende Tasks wie möglich freien, online-Geräten des Nutzers zu.
   * Mehrere Geräte gleichzeitig sind erlaubt (jedes mit eigenem Pairing/Token); die
   * eigentliche Zuweisung ist eine einzige atomare UPDATE...FOR UPDATE SKIP LOCKED-Anweisung,
   * damit derselbe Task niemals an zwei Geräte gleichzeitig geht, selbst wenn mehrere
   * Dispatch-Läufe für denselben Nutzer überlappen.
   */
  async tryDispatchForUser(userId: string) {
    return this.runDispatchSerialized(userId, () => this.dispatchForUser(userId));
  }

  private async dispatchForUser(userId: string) {
    const connResult = await this.db.query(
      'SELECT * FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    const connection = connResult.rows[0];
    if (!connection || connection.type !== 'LOCAL_CLI') return;

    const devicesResult = await this.db.query(
      "SELECT * FROM devices WHERE user_id = $1 AND status = 'ONLINE'",
      [userId],
    );
    const onlineDevices = devicesResult.rows;
    if (onlineDevices.length === 0) return;

    let assignedSomething = true;
    while (assignedSomething) {
      assignedSomething = false;
      for (const device of onlineDevices) {
        const occupiedResult = await this.db.query(
          `SELECT COUNT(*)::int AS count FROM tasks
           WHERE assigned_device_id = $1 AND status IN ('RUNNING','PAUSED_RATE_LIMIT')`,
          [device.id],
        );
        const occupied = occupiedResult.rows[0].count;
        if (occupied >= connection.concurrency_limit) continue;

        // Atomic claim: SKIP LOCKED means a concurrent claim for another device (or another
        // process) never sees this row while it's mid-update, so exactly one device wins it.
        const claimResult = await this.db.query(
          `UPDATE tasks SET status = 'RUNNING', assigned_device_id = $1, started_at = now()
           WHERE id = (
             SELECT id FROM tasks
             WHERE user_id = $2 AND status = 'QUEUED'
             ORDER BY created_at ASC LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           RETURNING *`,
          [device.id, userId],
        );
        const claimed = claimResult.rows[0];
        if (!claimed) return;

        const projectResult = await this.db.query(
          'SELECT working_directory FROM projects WHERE id = $1',
          [claimed.project_id],
        );
        const updated = toCamel(claimed);
        updated.assignedDeviceName = device.name;

        this.server.to(`device:${device.id}`).emit('task:assign', {
          taskId: updated.id,
          prompt: updated.prompt,
          workingDirectory: projectResult.rows[0]?.working_directory ?? '.',
          resumeSessionId: updated.claudeSessionId ?? undefined,
          model: updated.model ?? undefined,
        });
        this.server.to(`user:${userId}`).emit('task:update', updated);
        assignedSomething = true;
      }
    }
  }

  emitTaskListRefresh(userId: string) {
    this.server.to(`user:${userId}`).emit('task:refresh');
  }

  emitTaskUpdate(userId: string, task: any) {
    this.server.to(`user:${userId}`).emit('task:update', task);
  }

  /** Fordert das Gerät auf, einen Task abzubrechen (cancel) oder zu pausieren (pause). */
  sendAbortToDevice(deviceId: string, taskId: string, reason: 'cancel' | 'pause') {
    this.server.to(`device:${deviceId}`).emit('task:abort', { taskId, reason });
  }
}
