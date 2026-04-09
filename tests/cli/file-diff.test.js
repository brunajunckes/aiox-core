/**
 * Tests for File Diff Tool Command Module
 * @story 29.2 — File Diff Tool
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-file-diff-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/file-diff/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/file-diff/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('file-diff command', () => {
  describe('parseArgs', () => {
    it('returns defaults with no args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.file1).toBeNull();
      expect(opts.file2).toBeNull();
      expect(opts.format).toBe('text');
      expect(opts.stats).toBe(false);
      expect(opts.context).toBe(3);
    });

    it('parses two positional files', () => {
      const opts = mod.parseArgs(['a.txt', 'b.txt']);
      expect(opts.file1).toBe('a.txt');
      expect(opts.file2).toBe('b.txt');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['a.txt', 'b.txt', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --stats', () => {
      const opts = mod.parseArgs(['a.txt', 'b.txt', '--stats']);
      expect(opts.stats).toBe(true);
    });

    it('parses --context', () => {
      const opts = mod.parseArgs(['a.txt', 'b.txt', '--context', '5']);
      expect(opts.context).toBe(5);
    });
  });

  describe('computeDiff', () => {
    it('returns empty for two empty arrays', () => {
      const diff = mod.computeDiff([], []);
      expect(diff).toEqual([]);
    });

    it('detects all added lines', () => {
      const diff = mod.computeDiff([], ['a', 'b']);
      expect(diff.length).toBe(2);
      expect(diff.every(d => d.type === 'added')).toBe(true);
    });

    it('detects all removed lines', () => {
      const diff = mod.computeDiff(['a', 'b'], []);
      expect(diff.length).toBe(2);
      expect(diff.every(d => d.type === 'removed')).toBe(true);
    });

    it('detects unchanged lines', () => {
      const diff = mod.computeDiff(['a', 'b'], ['a', 'b']);
      expect(diff.length).toBe(2);
      expect(diff.every(d => d.type === 'unchanged')).toBe(true);
    });

    it('detects mixed changes', () => {
      const diff = mod.computeDiff(['a', 'b', 'c'], ['a', 'x', 'c']);
      const types = diff.map(d => d.type);
      expect(types).toContain('unchanged');
      expect(types.some(t => t === 'added' || t === 'removed')).toBe(true);
    });

    it('handles single line difference', () => {
      const diff = mod.computeDiff(['hello'], ['world']);
      expect(diff.length).toBe(2);
      const removed = diff.find(d => d.type === 'removed');
      const added = diff.find(d => d.type === 'added');
      expect(removed.value).toBe('hello');
      expect(added.value).toBe('world');
    });

    it('handles appended lines', () => {
      const diff = mod.computeDiff(['a'], ['a', 'b']);
      expect(diff.length).toBe(2);
      expect(diff[0].type).toBe('unchanged');
      expect(diff[1].type).toBe('added');
    });
  });

  describe('computeStats', () => {
    it('counts added, removed, unchanged', () => {
      const diff = [
        { type: 'unchanged', value: 'a' },
        { type: 'removed', value: 'b' },
        { type: 'added', value: 'c' },
        { type: 'added', value: 'd' },
      ];
      const stats = mod.computeStats(diff);
      expect(stats.added).toBe(2);
      expect(stats.removed).toBe(1);
      expect(stats.unchanged).toBe(1);
    });

    it('handles empty diff', () => {
      const stats = mod.computeStats([]);
      expect(stats.added).toBe(0);
      expect(stats.removed).toBe(0);
      expect(stats.unchanged).toBe(0);
    });
  });

  describe('formatUnified', () => {
    it('shows identical files message', () => {
      const diff = [{ type: 'unchanged', value: 'same' }];
      const output = mod.formatUnified(diff, 'a.txt', 'b.txt', 3);
      expect(output).toContain('Files are identical');
    });

    it('shows unified diff header', () => {
      const diff = [
        { type: 'removed', value: 'old' },
        { type: 'added', value: 'new' },
      ];
      const output = mod.formatUnified(diff, 'a.txt', 'b.txt', 3);
      expect(output).toContain('--- a.txt');
      expect(output).toContain('+++ b.txt');
    });

    it('shows + and - markers', () => {
      const diff = [
        { type: 'unchanged', value: 'context' },
        { type: 'removed', value: 'old' },
        { type: 'added', value: 'new' },
      ];
      const output = mod.formatUnified(diff, 'a.txt', 'b.txt', 3);
      expect(output).toContain('-old');
      expect(output).toContain('+new');
    });

    it('includes @@ hunk headers', () => {
      const diff = [
        { type: 'removed', value: 'a' },
        { type: 'added', value: 'b' },
      ];
      const output = mod.formatUnified(diff, 'a.txt', 'b.txt', 3);
      expect(output).toContain('@@');
    });
  });

  describe('integration with files', () => {
    it('diffs two files with different content', () => {
      const f1 = path.join(tmpDir, 'a.txt');
      const f2 = path.join(tmpDir, 'b.txt');
      fs.writeFileSync(f1, 'line1\nline2\nline3');
      fs.writeFileSync(f2, 'line1\nchanged\nline3');

      const content1 = fs.readFileSync(f1, 'utf8').split('\n');
      const content2 = fs.readFileSync(f2, 'utf8').split('\n');
      const diff = mod.computeDiff(content1, content2);
      const stats = mod.computeStats(diff);
      expect(stats.unchanged).toBeGreaterThanOrEqual(2);
    });

    it('diffs identical files', () => {
      const f1 = path.join(tmpDir, 'same1.txt');
      const f2 = path.join(tmpDir, 'same2.txt');
      fs.writeFileSync(f1, 'same content');
      fs.writeFileSync(f2, 'same content');

      const content1 = fs.readFileSync(f1, 'utf8').split('\n');
      const content2 = fs.readFileSync(f2, 'utf8').split('\n');
      const diff = mod.computeDiff(content1, content2);
      expect(diff.every(d => d.type === 'unchanged')).toBe(true);
    });

    it('diffs empty files', () => {
      const f1 = path.join(tmpDir, 'empty1.txt');
      const f2 = path.join(tmpDir, 'empty2.txt');
      fs.writeFileSync(f1, '');
      fs.writeFileSync(f2, '');

      const diff = mod.computeDiff([''], ['']);
      expect(diff.length).toBe(1);
      expect(diff[0].type).toBe('unchanged');
    });
  });
});
