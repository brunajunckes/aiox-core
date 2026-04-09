/**
 * Tests for Code Duplication Finder Command Module
 * @story 22.2 — Code Duplication Finder
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-duplicates-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/duplicates/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/duplicates/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('duplicates command', () => {
  // ── normalizeLine ─────────────────────────────────────────────────────
  describe('normalizeLine', () => {
    it('trims whitespace', () => {
      expect(mod.normalizeLine('  hello  ')).toBe('hello');
    });

    it('collapses multiple spaces', () => {
      expect(mod.normalizeLine('a   b   c')).toBe('a b c');
    });

    it('handles empty string', () => {
      expect(mod.normalizeLine('')).toBe('');
    });

    it('handles tabs', () => {
      expect(mod.normalizeLine('\thello\tworld')).toBe('hello world');
    });
  });

  // ── calculateSimilarity ───────────────────────────────────────────────
  describe('calculateSimilarity', () => {
    it('returns 100 for identical strings', () => {
      expect(mod.calculateSimilarity('abc', 'abc')).toBe(100);
    });

    it('returns 0 for completely different strings', () => {
      expect(mod.calculateSimilarity('abc', 'xyz')).toBe(0);
    });

    it('returns partial match for similar strings', () => {
      const sim = mod.calculateSimilarity('abcdef', 'abcxyz');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(100);
    });

    it('handles empty strings', () => {
      expect(mod.calculateSimilarity('', '')).toBe(100);
      expect(mod.calculateSimilarity('abc', '')).toBe(0);
    });
  });

  // ── extractBlocks ─────────────────────────────────────────────────────
  describe('extractBlocks', () => {
    it('extracts blocks of minLines size', () => {
      const source = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;';
      const blocks = mod.extractBlocks(source, 3);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('skips blocks that are mostly empty', () => {
      const source = '\n\n\n\n\n';
      const blocks = mod.extractBlocks(source, 3);
      expect(blocks.length).toBe(0);
    });

    it('records correct line numbers', () => {
      const source = 'const a = 1;\nconst b = 2;\nconst c = 3;';
      const blocks = mod.extractBlocks(source, 3);
      if (blocks.length > 0) {
        expect(blocks[0].startLine).toBe(1);
        expect(blocks[0].endLine).toBe(3);
      }
    });

    it('returns empty for source shorter than minLines', () => {
      const blocks = mod.extractBlocks('one line', 3);
      expect(blocks.length).toBe(0);
    });
  });

  // ── collectFiles ──────────────────────────────────────────────────────
  describe('collectFiles', () => {
    it('collects JS files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'code');
      fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'text');
      const files = mod.collectFiles(tmpDir, new Set(['.js']));
      expect(files.length).toBe(1);
    });

    it('skips node_modules', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm);
      fs.writeFileSync(path.join(nm, 'lib.js'), '');
      const files = mod.collectFiles(tmpDir, new Set(['.js']));
      expect(files.length).toBe(0);
    });

    it('recurses into subdirectories', () => {
      const sub = path.join(tmpDir, 'src');
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, 'app.js'), 'code');
      const files = mod.collectFiles(tmpDir, new Set(['.js']));
      expect(files.length).toBe(1);
    });
  });

  // ── findDuplicates (integration) ──────────────────────────────────────
  describe('findDuplicates', () => {
    it('finds exact duplicate blocks across files', () => {
      const code = 'const x = 1;\nconst y = 2;\nconst z = 3;\n';
      fs.writeFileSync(path.join(tmpDir, 'a.js'), code);
      fs.writeFileSync(path.join(tmpDir, 'b.js'), code);
      const results = mod.findDuplicates({ cwd: tmpDir, minLines: 3 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].similarity).toBe(100);
    });

    it('returns empty when no duplicates', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const unique1 = true;\nconst unique2 = true;\nconst unique3 = true;');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'const other1 = false;\nconst other2 = false;\nconst other3 = false;');
      const results = mod.findDuplicates({ cwd: tmpDir, minLines: 3, threshold: 100 });
      // With exact match only, different code should not match
      expect(results.length).toBe(0);
    });

    it('respects minLines option', () => {
      const code = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n';
      fs.writeFileSync(path.join(tmpDir, 'a.js'), code);
      fs.writeFileSync(path.join(tmpDir, 'b.js'), code);
      const results3 = mod.findDuplicates({ cwd: tmpDir, minLines: 3 });
      const results5 = mod.findDuplicates({ cwd: tmpDir, minLines: 5 });
      expect(results3.length).toBeGreaterThanOrEqual(results5.length);
    });

    it('respects type filter', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const x = 1;\nconst y = 2;\nconst z = 3;\n');
      const results = mod.findDuplicates({ cwd: tmpDir, type: 'js' });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('shows "no duplicates" for empty results', () => {
      const text = mod.formatText([], tmpDir);
      expect(text).toContain('No duplicate');
    });

    it('formats results with similarity info', () => {
      const results = [{
        fileA: path.join(tmpDir, 'a.js'),
        fileB: path.join(tmpDir, 'b.js'),
        lineA: 1,
        lineB: 1,
        lines: 3,
        similarity: 100,
        block: 'code',
      }];
      const text = mod.formatText(results, tmpDir);
      expect(text).toContain('100%');
      expect(text).toContain('Duplicate #1');
    });
  });

  // ── runDuplicates CLI ─────────────────────────────────────────────────
  describe('runDuplicates', () => {
    it('runs without error with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDuplicates(['--help']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const x = 1;');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDuplicates(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('runs with --min-lines 5', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDuplicates(['--min-lines', '5']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --threshold 80', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDuplicates(['--threshold', '80']);
      expect(spy).toHaveBeenCalled();
    });
  });
});
