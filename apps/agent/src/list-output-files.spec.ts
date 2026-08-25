import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listOutputFiles } from './list-output-files';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-queue-agent-test-'));
}

describe('listOutputFiles', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists files with relative paths and sizes', () => {
    fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets', 'style.css'), 'body {}');

    const files = listOutputFiles(root);
    const paths = files.map((f) => f.path).sort();

    expect(paths).toEqual(['assets/style.css', 'index.html']);
    expect(files.find((f) => f.path === 'index.html')?.size).toBe('<html></html>'.length);
  });

  it('skips hidden directories and known dependency/build folders', () => {
    fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main');
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'node_modules', 'package.json'), '{}');
    fs.writeFileSync(path.join(root, 'real-output.txt'), 'hello');

    const files = listOutputFiles(root);

    expect(files.map((f) => f.path)).toEqual(['real-output.txt']);
  });

  it('sorts by most recently modified first', () => {
    const older = path.join(root, 'older.txt');
    const newer = path.join(root, 'newer.txt');
    fs.writeFileSync(older, 'a');
    fs.utimesSync(older, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    fs.writeFileSync(newer, 'b');

    const files = listOutputFiles(root);

    expect(files.map((f) => f.path)).toEqual(['newer.txt', 'older.txt']);
  });

  it('returns an empty list for a directory that does not exist', () => {
    expect(listOutputFiles(path.join(root, 'missing'))).toEqual([]);
  });
});
