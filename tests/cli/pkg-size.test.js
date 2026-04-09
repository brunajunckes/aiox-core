/**
 * Tests for Package Size Analyzer Command Module
 * @story 23.2 — Package Size Analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-pkg-size-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/pkg-size/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/pkg-size/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('pkg-size command', () => {
  // ── parseSize ─────────────────────────────────────────────────────────
  describe('parseSize', () => {
    it('parses bytes', () => {
      expect(mod.parseSize('100b')).toBe(100);
    });

    it('parses kilobytes', () => {
      expect(mod.parseSize('1kb')).toBe(1024);
    });

    it('parses megabytes', () => {
      expect(mod.parseSize('1mb')).toBe(1024 * 1024);
    });

    it('parses gigabytes', () => {
      expect(mod.parseSize('1gb')).toBe(1024 * 1024 * 1024);
    });

    it('handles decimal values', () => {
      expect(mod.parseSize('1.5kb')).toBe(Math.round(1.5 * 1024));
    });

    it('returns 0 for invalid input', () => {
      expect(mod.parseSize('')).toBe(0);
      expect(mod.parseSize(null)).toBe(0);
      expect(mod.parseSize('abc')).toBe(0);
    });

    it('is case insensitive', () => {
      expect(mod.parseSize('1MB')).toBe(1024 * 1024);
      expect(mod.parseSize('1Kb')).toBe(1024);
    });
  });

  // ── formatBytes ───────────────────────────────────────────────────────
  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(mod.formatBytes(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(mod.formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      const result = mod.formatBytes(1024);
      expect(result).toBe('1 KB');
    });

    it('formats megabytes', () => {
      const result = mod.formatBytes(1024 * 1024);
      expect(result).toBe('1 MB');
    });

    it('formats with decimals', () => {
      const result = mod.formatBytes(1536);
      expect(result).toBe('1.5 KB');
    });
  });

  // ── walkDir ───────────────────────────────────────────────────────────
  describe('walkDir', () => {
    it('counts files and sizes', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'world!');
      const result = { totalSize: 0, fileCount: 0, dirs: {} };
      mod.walkDir(tmpDir, new Set(), result, tmpDir);
      expect(result.fileCount).toBe(2);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    it('skips excluded directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.js'), 'data');
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'main');
      const result = { totalSize: 0, fileCount: 0, dirs: {} };
      mod.walkDir(tmpDir, new Set(['node_modules']), result, tmpDir);
      expect(result.fileCount).toBe(1);
    });

    it('tracks per-directory sizes', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'));
      fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'aaa');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'bb');
      const result = { totalSize: 0, fileCount: 0, dirs: {} };
      mod.walkDir(tmpDir, new Set(), result, tmpDir);
      expect(result.dirs['src']).toBeDefined();
      expect(result.dirs['.']).toBeDefined();
    });

    it('handles empty directory', () => {
      const result = { totalSize: 0, fileCount: 0, dirs: {} };
      mod.walkDir(tmpDir, new Set(), result, tmpDir);
      expect(result.fileCount).toBe(0);
    });
  });

  // ── analyzeSize ───────────────────────────────────────────────────────
  describe('analyzeSize', () => {
    it('returns all required fields', () => {
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'const x = 1;');
      const result = mod.analyzeSize({ cwd: tmpDir });
      expect(result).toHaveProperty('installSize');
      expect(result).toHaveProperty('installFileCount');
      expect(result).toHaveProperty('publishSize');
      expect(result).toHaveProperty('publishFileCount');
    });

    it('includes directories when details option set', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const result = mod.analyzeSize({ cwd: tmpDir, details: true });
      expect(result).toHaveProperty('directories');
    });

    it('includes limit check when limit option set', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const result = mod.analyzeSize({ cwd: tmpDir, limit: '1mb' });
      expect(result.limit).toBeDefined();
      expect(result.limit.exceeded).toBe(false);
    });

    it('detects exceeded limit', () => {
      // Create a file that exceeds 1 byte limit
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello world content');
      const result = mod.analyzeSize({ cwd: tmpDir, limit: '1b' });
      expect(result.limit.exceeded).toBe(true);
    });

    it('includes treemap data when treemap option set', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const result = mod.analyzeSize({ cwd: tmpDir, treemap: true });
      expect(result).toHaveProperty('treemapData');
    });
  });

  // ── generateTreemap ───────────────────────────────────────────────────
  describe('generateTreemap', () => {
    it('generates treemap for directories', () => {
      const dirs = { src: { size: 1000, count: 5 }, lib: { size: 500, count: 3 } };
      const result = mod.generateTreemap(dirs, 1500);
      expect(result).toContain('src');
      expect(result).toContain('lib');
      expect(result).toContain('#');
    });

    it('handles empty dirs', () => {
      const result = mod.generateTreemap({}, 0);
      expect(result).toContain('No files found');
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats basic result', () => {
      const result = {
        installSize: 1024, installFileCount: 5,
        publishSize: 512, publishFileCount: 3,
      };
      const text = mod.formatText(result);
      expect(text).toContain('Package Size Analysis');
      expect(text).toContain('Install size');
      expect(text).toContain('Publish size');
    });
  });

  // ── runPkgSize ────────────────────────────────────────────────────────
  describe('runPkgSize', () => {
    it('runs without error', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runPkgSize([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runPkgSize(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });
  });
});
