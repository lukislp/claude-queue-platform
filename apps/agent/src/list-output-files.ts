import * as fs from 'fs';
import * as path from 'path';

export interface OutputFile {
  path: string;
  size: number;
  mtimeMs: number;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '__pycache__',
  '.venv',
]);
const MAX_FILES = 100;

/**
 * Listet Dateien im Arbeitsverzeichnis eines Tasks - flach genug, um auf einer großen
 * Repo nicht zu explodieren: bekannte Build-/Abhängigkeitsordner werden übersprungen,
 * versteckte Ordner (z.B. .git) auch, und die Liste wird nach letzter Änderung
 * absteigend sortiert und auf MAX_FILES gekappt, damit zuletzt geänderte Dateien
 * (das eigentliche Task-Ergebnis) immer vorne stehen.
 */
export function listOutputFiles(rootDir: string): OutputFile[] {
  const results: OutputFile[] = [];

  function walk(dir: string) {
    if (results.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          results.push({ path: path.relative(rootDir, full).split(path.sep).join('/'), size: stat.size, mtimeMs: stat.mtimeMs });
        } catch {
          // Datei zwischen readdir und stat verschwunden - überspringen.
        }
      }
    }
  }

  walk(rootDir);
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results.slice(0, MAX_FILES);
}
