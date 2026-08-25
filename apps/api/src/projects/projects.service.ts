import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DbService } from '../db/db.service';
import { toCamel, toCamelList } from '../db/mappers';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

/** Macht aus einem Projektnamen einen dateisystemtauglichen Ordnernamen. */
export function toFolderSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'projekt';
}

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DbService) {}

  async list(userId: string) {
    const result = await this.db.query(
      `SELECT p.*, COUNT(t.id)::int AS task_count
       FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [userId],
    );
    return toCamelList(result.rows);
  }

  async create(userId: string, dto: CreateProjectDto) {
    const id = uuid();
    // Ohne explizite Angabe bekommt jedes Projekt einen eigenen Unterordner im
    // baseDir des Agenten, damit sich Projekte nicht vermischen.
    let workingDirectory = dto.workingDirectory;
    if (!workingDirectory) {
      const base = toFolderSlug(dto.name);
      const existing = await this.db.query(
        'SELECT working_directory FROM projects WHERE user_id = $1',
        [userId],
      );
      const used = new Set(existing.rows.map((r: any) => r.working_directory));
      workingDirectory = base;
      for (let i = 2; used.has(workingDirectory); i++) {
        workingDirectory = `${base}-${i}`;
      }
    }
    const result = await this.db.query(
      `INSERT INTO projects (id, user_id, name, description, working_directory)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, dto.name, dto.description ?? null, workingDirectory],
    );
    return toCamel(result.rows[0]);
  }

  async getOwned(userId: string, projectId: string) {
    const result = await this.db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    const project = result.rows[0];
    if (!project) throw new NotFoundException('Projekt nicht gefunden.');
    if (project.user_id !== userId) throw new ForbiddenException();
    return toCamel(project);
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.getOwned(userId, projectId);
    const result = await this.db.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        working_directory = COALESCE($3, working_directory)
       WHERE id = $4 RETURNING *`,
      [dto.name ?? null, dto.description ?? null, dto.workingDirectory ?? null, projectId],
    );
    return toCamel(result.rows[0]);
  }

  async remove(userId: string, projectId: string) {
    await this.getOwned(userId, projectId);
    await this.db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    return { success: true };
  }
}
