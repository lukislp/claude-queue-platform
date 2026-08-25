import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DbService } from '../db/db.service';
import { toCamel, toCamelList } from '../db/mappers';
import { hashToken, randomToken } from '../common/crypto.util';

interface PendingPairing {
  userId: string;
  expiresAt: number;
}

const PAIRING_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class DevicesService {
  private pendingCodes = new Map<string, PendingPairing>();

  constructor(private readonly db: DbService) {}

  initPairing(userId: string) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.pendingCodes.set(code, { userId, expiresAt: Date.now() + PAIRING_TTL_MS });
    return { code, expiresInSeconds: PAIRING_TTL_MS / 1000 };
  }

  async confirmPairing(code: string, deviceName: string) {
    const pending = this.pendingCodes.get((code ?? '').toUpperCase());
    if (!pending || pending.expiresAt < Date.now()) {
      throw new BadRequestException('Pairing-Code ist ungültig oder abgelaufen.');
    }
    this.pendingCodes.delete(code.toUpperCase());

    const rawToken = randomToken();
    const id = uuid();
    await this.db.query(
      `INSERT INTO devices (id, user_id, name, device_token_hash, status)
       VALUES ($1, $2, $3, $4, 'OFFLINE')`,
      [id, pending.userId, deviceName || 'Unbenanntes Gerät', hashToken(rawToken)],
    );
    return { deviceId: id, deviceToken: rawToken, userId: pending.userId };
  }

  async list(userId: string) {
    const result = await this.db.query(
      `SELECT id, name, status, last_seen_at, created_at FROM devices
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return toCamelList(result.rows);
  }

  async remove(userId: string, deviceId: string) {
    const result = await this.db.query('SELECT * FROM devices WHERE id = $1', [deviceId]);
    const device = result.rows[0];
    if (!device) throw new NotFoundException();
    if (device.user_id !== userId) throw new ForbiddenException();
    await this.db.query('DELETE FROM devices WHERE id = $1', [deviceId]);
    return { success: true };
  }

  async findByToken(rawToken: string) {
    if (!rawToken) return null;
    const result = await this.db.query('SELECT * FROM devices WHERE device_token_hash = $1', [
      hashToken(rawToken),
    ]);
    return result.rows[0] ? toCamel<any>(result.rows[0]) : null;
  }

  async setStatus(deviceId: string, status: 'ONLINE' | 'OFFLINE') {
    await this.db.query(
      'UPDATE devices SET status = $1, last_seen_at = now() WHERE id = $2',
      [status, deviceId],
    );
  }
}
