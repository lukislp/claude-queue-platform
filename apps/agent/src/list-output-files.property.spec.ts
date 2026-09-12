import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listOutputFiles } from './list-output-files';

/**
 * Property-based tests (fast-check) for the task output listing: generated directory trees
 * with arbitrary names, sizes and nesting must always come back as relative, forward-slash
 * paths, newest first, without anything from the ignored or hidden directories, capped at
 * the documented maximum.
 */
describe('listOutputFiles properties', () => {
  const IGNORED = ['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '__pycache__', '.venv'];

  // Portable file-name characters only: the property is about the walker, not the OS. Directory
  // and file names come from disjoint prefixes so a generated file can never collide with a
  // generated directory of the same name, and none of them can spell an ignored directory.
  const dirNameArb = fc.stringMatching(/^d[a-z0-9_-]{0,10}$/);
  const fileNameArb = fc.stringMatching(/^f[a-z0-9_-]{0,10}$/);
  const fileArb = fc.record({
    dirs: fc.array(dirNameArb, { maxLength: 3 }),
    name: fileNameArb,
    size: fc.nat({ max: 512 }),
  });

  function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-queue-agent-prop-'));
  }

  it('returns every visible file exactly once as a sorted, relative, forward-slash path', () => {
    fc.assert(
      fc.property(fc.array(fileArb, { maxLength: 25 }), (files) => {
        const root = makeTempDir();
        try {
          const expected = new Set<string>();
          for (const file of files) {
            const dir = path.join(root, ...file.dirs);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, file.name), 'x'.repeat(file.size));
            expected.add([...file.dirs, file.name].join('/'));
          }

          const listed = listOutputFiles(root);

          const paths = listed.map((f) => f.path);
          expect(new Set(paths)).toEqual(expected);
          expect(paths).toHaveLength(expected.size);
          for (const entry of listed) {
            expect(entry.path).not.toMatch(/\\/);
            expect(path.isAbsolute(entry.path)).toBe(false);
            expect(entry.size).toBe(fs.statSync(path.join(root, entry.path)).size);
          }
          for (let i = 1; i < listed.length; i++) {
            expect(listed[i - 1].mtimeMs).toBeGreaterThanOrEqual(listed[i].mtimeMs);
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 60 },
    );
  });

  it('never lists anything below an ignored or hidden directory', () => {
    fc.assert(
      fc.property(
        fc.array(fileArb, { maxLength: 10 }),
        fc.constantFrom(...IGNORED, '.hidden', '.cache'),
        fc.array(fileNameArb, { minLength: 1, maxLength: 5 }),
        (visible, skipped, hiddenFiles) => {
          const root = makeTempDir();
          try {
            for (const file of visible) {
              const dir = path.join(root, ...file.dirs);
              fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(path.join(dir, file.name), 'x'.repeat(file.size));
            }
            const skippedDir = path.join(root, skipped, 'deeper');
            fs.mkdirSync(skippedDir, { recursive: true });
            for (const name of hiddenFiles) fs.writeFileSync(path.join(skippedDir, name), 'secret');

            const listed = listOutputFiles(root);

            for (const entry of listed) {
              expect(entry.path.startsWith(`${skipped}/`)).toBe(false);
            }
          } finally {
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it('caps the listing at 100 files however many exist', () => {
    fc.assert(
      fc.property(fc.integer({ min: 101, max: 160 }), (count) => {
        const root = makeTempDir();
        try {
          for (let i = 0; i < count; i++) fs.writeFileSync(path.join(root, `f${i}.txt`), String(i));
          expect(listOutputFiles(root)).toHaveLength(100);
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 5 },
    );
  });
});
