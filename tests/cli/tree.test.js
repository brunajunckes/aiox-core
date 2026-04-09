/**
 * Tests for Directory Tree Viewer Command Module
 * @story 29.1 — Directory Tree Viewer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-tree-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/tree/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/tree/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('tree command', () => {
  describe('parseArgs', () => {
    it('returns defaults with no args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.depth).toBe(Infinity);
      expect(opts.format).toBe('ascii');
      expect(opts.stats).toBe(false);
      expect(opts.type).toBeNull();
    });

    it('parses --depth', () => {
      const opts = mod.parseArgs(['--depth', '3']);
      expect(opts.depth).toBe(3);
    });

    it('parses --ignore', () => {
      const opts = mod.parseArgs(['--ignore', 'dist,build']);
      expect(opts.ignore).toEqual(['dist', 'build']);
    });

    it('parses --type', () => {
      const opts = mod.parseArgs(['--type', 'js']);
      expect(opts.type).toBe('js');
    });

    it('strips leading dot from --type', () => {
      const opts = mod.parseArgs(['--type', '.ts']);
      expect(opts.type).toBe('ts');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --stats', () => {
      const opts = mod.parseArgs(['--stats']);
      expect(opts.stats).toBe(true);
    });

    it('parses positional dir', () => {
      const opts = mod.parseArgs(['/some/dir']);
      expect(opts.dir).toBe('/some/dir');
    });
  });

  describe('buildTree', () => {
    it('builds tree for empty directory', () => {
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      expect(tree.type).toBe('directory');
      expect(tree.children).toEqual([]);
    });

    it('includes files', () => {
      fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'world');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('hello.txt');
      expect(tree.children[0].type).toBe('file');
    });

    it('includes subdirectories', () => {
      fs.mkdirSync(path.join(tmpDir, 'sub'));
      fs.writeFileSync(path.join(tmpDir, 'sub', 'file.js'), '');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const sub = tree.children.find(c => c.name === 'sub');
      expect(sub).toBeDefined();
      expect(sub.type).toBe('directory');
      expect(sub.children.length).toBe(1);
    });

    it('respects depth limit', () => {
      fs.mkdirSync(path.join(tmpDir, 'a'));
      fs.mkdirSync(path.join(tmpDir, 'a', 'b'));
      fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'deep.js'), '');
      const tree = mod.buildTree(tmpDir, { depth: 1, ignore: [], type: null });
      const a = tree.children.find(c => c.name === 'a');
      expect(a.children).toEqual([]);
    });

    it('ignores specified patterns', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'index.js'), '');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: ['node_modules'], type: null });
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('index.js');
    });

    it('filters by type extension', () => {
      fs.writeFileSync(path.join(tmpDir, 'file.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), '');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: 'js' });
      expect(tree.children.length).toBe(1);
      expect(tree.children[0].name).toBe('file.js');
    });

    it('sorts entries alphabetically', () => {
      fs.writeFileSync(path.join(tmpDir, 'z.txt'), '');
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), '');
      fs.writeFileSync(path.join(tmpDir, 'm.txt'), '');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const names = tree.children.map(c => c.name);
      expect(names).toEqual(['a.txt', 'm.txt', 'z.txt']);
    });

    it('handles symlinks gracefully', () => {
      fs.writeFileSync(path.join(tmpDir, 'real.txt'), 'data');
      fs.symlinkSync(path.join(tmpDir, 'real.txt'), path.join(tmpDir, 'link.txt'));
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const link = tree.children.find(c => c.name === 'link.txt');
      expect(link).toBeDefined();
      expect(link.type).toBe('symlink');
    });
  });

  describe('computeStats', () => {
    it('counts files and size', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.txt'), '12345');
      fs.writeFileSync(path.join(tmpDir, 'b.txt'), '123');
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const stats = mod.computeStats(tree);
      expect(stats.files).toBe(2);
      expect(stats.totalSize).toBe(8);
    });

    it('counts subdirectories', () => {
      fs.mkdirSync(path.join(tmpDir, 'sub1'));
      fs.mkdirSync(path.join(tmpDir, 'sub2'));
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const stats = mod.computeStats(tree);
      expect(stats.dirs).toBeGreaterThanOrEqual(2);
    });

    it('returns zero for empty tree', () => {
      const tree = mod.buildTree(tmpDir, { depth: Infinity, ignore: [], type: null });
      const stats = mod.computeStats(tree);
      expect(stats.files).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(mod.formatBytes(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(mod.formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(mod.formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
      expect(mod.formatBytes(1048576)).toBe('1 MB');
    });
  });

  describe('renderAscii', () => {
    it('renders root directory', () => {
      const tree = { name: 'root', type: 'directory', children: [] };
      const lines = mod.renderAscii(tree);
      expect(lines[0]).toBe('root/');
    });

    it('renders files with connectors', () => {
      const tree = {
        name: 'root', type: 'directory', children: [
          { name: 'a.txt', type: 'file' },
          { name: 'b.txt', type: 'file' },
        ],
      };
      const lines = mod.renderAscii(tree);
      expect(lines.length).toBe(3);
      expect(lines[1]).toContain('a.txt');
      expect(lines[2]).toContain('b.txt');
    });

    it('renders nested directories', () => {
      const tree = {
        name: 'root', type: 'directory', children: [
          { name: 'sub', type: 'directory', children: [{ name: 'file.js', type: 'file' }] },
        ],
      };
      const lines = mod.renderAscii(tree);
      expect(lines.length).toBe(3);
      expect(lines[1]).toContain('sub/');
      expect(lines[2]).toContain('file.js');
    });
  });
});
