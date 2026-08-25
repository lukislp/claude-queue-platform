import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  readonly pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async onModuleInit() {
    await this.pool.query('SELECT 1');
    await this.runMigrations();
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(text: string, params: any[] = []) {
    return this.pool.query<T>(text, params);
  }

  private async runMigrations() {
    // Sucht das Migrationsverzeichnis relativ zum Projekt-Root (funktioniert in
    // Dev (ts-node) genauso wie im gebauten dist/-Ordner und im Docker-Image).
    const candidates = [
      path.join(__dirname, '..', '..', '..', '..', 'migrations'),
      path.join(process.cwd(), '..', '..', 'migrations'),
      path.join(process.cwd(), 'migrations'),
      '/app/migrations',
    ];
    const dir = candidates.find((c) => fs.existsSync(c));
    if (!dir) {
      this.logger.warn('Migrationsverzeichnis nicht gefunden - überspringe Migration.');
      return;
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await this.pool.query(sql);
      this.logger.log(`Migration angewendet: ${file}`);
    }
  }
}
