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
 * Lists the files in a task's working directory - shallow enough not to explode on a large
 * repository: known build/dependency directories are skipped, so are hidden directories
 * (e.g. .git), and the list is sorted by last modification descending and capped at
 * MAX_FILES, so the most recently changed files (the actual task result) always come first.
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
          // The file disappeared between readdir and stat - skip it.
        }
      }
    }
  }

  walk(rootDir);
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results.slice(0, MAX_FILES);
}
