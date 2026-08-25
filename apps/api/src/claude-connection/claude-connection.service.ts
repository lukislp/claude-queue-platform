import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from '../db/db.service';
import { toCamel } from '../db/mappers';
import { decryptSecret, encryptSecret } from '../common/crypto.util';
import { UpdateConnectionDto } from './dto/connection.dto';
import { QueueManagerService } from '../queue/queue-manager.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ClaudeConnectionService {
  constructor(
    private readonly db: DbService,
    private readonly queueManager: QueueManagerService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async get(userId: string) {
    const result = await this.db.query(
      'SELECT * FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    let row = result.rows[0];
    if (!row) {
      const insert = await this.db.query(
        `INSERT INTO claude_connections (id, user_id, type, concurrency_limit)
         VALUES ($1, $2, 'API_KEY', 2) RETURNING *`,
        [uuid(), userId],
      );
      row = insert.rows[0];
    }
    const camel = toCamel<any>(row);
    return { ...camel, encryptedApiKey: undefined, hasApiKey: !!row.encrypted_api_key };
  }

  /**
   * Verfügbare Modelle für den Nutzer - nie hartkodiert veraltend:
   * - API-Key-Modus: live von der Anthropic Models-API (GET /v1/models) mit dem Key des Nutzers.
   * - CLI-Modus: Aliase (opus/sonnet/haiku), die Claude Code selbst immer auf die
   *   jeweils aktuelle Modellversion auflöst.
   */
  async listModels(userId: string) {
    const result = await this.db.query(
      'SELECT * FROM claude_connections WHERE user_id = $1',
      [userId],
    );
    const row = result.rows[0];

    if (row?.type === 'API_KEY' && row.encrypted_api_key) {
      try {
        const client = new Anthropic({ apiKey: decryptSecret(row.encrypted_api_key) });
        const models: { id: string; displayName: string }[] = [];
        for await (const m of client.models.list()) {
          models.push({ id: m.id, displayName: m.display_name });
        }
        if (models.length > 0) return { source: 'api', models };
      } catch {
        // Liste nicht abrufbar (z.B. ungültiger Key) - Fallback auf Aliase unten.
      }
    }

    return {
      source: 'aliases',
      models: [
        { id: 'claude-fable-5', displayName: 'Fable 5' },
        { id: 'opus', displayName: 'Opus (jeweils aktuellste Version)' },
        { id: 'sonnet', displayName: 'Sonnet (jeweils aktuellste Version)' },
        { id: 'haiku', displayName: 'Haiku (jeweils aktuellste Version)' },
      ],
    };
  }

  async update(userId: string, dto: UpdateConnectionDto) {
    const encryptedApiKey = dto.type === 'API_KEY' && dto.apiKey ? encryptSecret(dto.apiKey) : null;

    const result = await this.db.query(
      `INSERT INTO claude_connections (id, user_id, type, encrypted_api_key, concurrency_limit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         type = EXCLUDED.type,
         encrypted_api_key = COALESCE($4, claude_connections.encrypted_api_key),
         concurrency_limit = EXCLUDED.concurrency_limit,
         updated_at = now()
       RETURNING *`,
      [uuid(), userId, dto.type, encryptedApiKey, dto.concurrencyLimit ?? 2],
    );
    const row = result.rows[0];

    if (row.type === 'API_KEY') {
      this.queueManager.syncConcurrency(userId, row.concurrency_limit);
    } else {
      await this.realtime.tryDispatchForUser(userId);
    }

    const camel = toCamel<any>(row);
    return { ...camel, encryptedApiKey: undefined, hasApiKey: !!row.encrypted_api_key };
  }
}
