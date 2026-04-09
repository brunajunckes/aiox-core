/**
 * Tests for Code Search Engine Command Module
 * @story 21.3 — Code Search Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-search-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/search/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/search/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('search command', () => {
  // ── collectFiles ──────────────────────────────────────────────────────────
  describe('collectFiles', () => {
    it('collects files recursively', () => {
      const subDir = path.join(tmpDir, 'src');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(subDir, 'b.js'), '');
      const files = mod.collectFiles(tmpDir, new Set(['node_modules', '.git']), null);
      expect(files.length).toBe(2);
    });

    it('skips ignored directories', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm, { recursive: true });
      fs.writeFileSync(path.join(nm, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), '');
      const files = mod.collectFiles(tmpDir, new Set(['node_modules']), null);
      expect(files.length).toBe(1);
    });

    it('filters by type', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), '');
      const files = mod.collectFiles(tmpDir, new Set(), 'js');
      expect(files.length).toBe(1);
      expect(files[0]).toContain('a.js');
    });

    it('skips binary files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.png'), '');
      const files = mod.collectFiles(tmpDir, new Set(), null);
      expect(files.length).toBe(1);
    });

    it('returns empty for non-existent dir', () => {
      expect(mod.collectFiles('/nonexistent-xyz', new Set(), null)).toEqual([]);
    });
  });

  // ── searchFile ────────────────────────────────────────────────────────────
  describe('searchFile', () => {
    it('finds matches in a file', () => {
      const filePath = path.join(tmpDir, 'test.js');
      fs.writeFileSync(filePath, 'hello world\nfoo bar\nhello again');
      const matches = mod.searchFile(filePath, /hello/g, 0);
      expect(matches.length).toBe(2);
      expect(matches[0].line).toBe(1);
      expect(matches[1].line).toBe(3);
    });

    it('returns empty for no matches', () => {
      const filePath = path.join(tmpDir, 'test.js');
      fs.writeFileSync(filePath, 'foo bar');
      const matches = mod.searchFile(filePath, /xyz/g, 0);
      expect(matches.length).toBe(0);
    });

    it('includes context lines', () => {
      const filePath = path.join(tmpDir, 'test.js');
      fs.writeFileSync(filePath, 'line1\nline2\nTARGET\nline4\nline5');
      const matches = mod.searchFile(filePath, /TARGET/g, 2);
      expect(matches.length).toBe(1);
      expect(matches[0].context.length).toBe(5);
    });

    it('returns empty for missing file', () => {
      expect(mod.searchFile('/nonexistent.js', /x/g, 0)).toEqual([]);
    });

    it('handles context at file boundaries', () => {
      const filePath = path.join(tmpDir, 'test.js');
      fs.writeFileSync(filePath, 'TARGET\nline2');
      const matches = mod.searchFile(filePath, /TARGET/g, 3);
      expect(matches[0].context.length).toBe(2);
    });
  });

  // ── searchProject ─────────────────────────────────────────────────────────
  describe('searchProject', () => {
    it('searches across multiple files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello world');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'hello again');
      const results = mod.searchProject('hello', { cwd: tmpDir });
      expect(results.totalMatches).toBe(2);
      expect(results.filesWithMatches).toBe(2);
    });

    it('filters by type', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello');
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), 'hello');
      const results = mod.searchProject('hello', { cwd: tmpDir, type: 'js' });
      expect(results.totalMatches).toBe(1);
    });

    it('respects ignore option', () => {
      const subDir = path.join(tmpDir, 'vendor');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'a.js'), 'hello');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'hello');
      const results = mod.searchProject('hello', { cwd: tmpDir, ignore: 'vendor' });
      expect(results.totalMatches).toBe(1);
    });

    it('returns error for invalid regex', () => {
      const results = mod.searchProject('[invalid', { cwd: tmpDir });
      expect(results.error).toBeTruthy();
    });

    it('reports filesSearched count', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'foo');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'bar');
      const results = mod.searchProject('foo', { cwd: tmpDir });
      expect(results.filesSearched).toBe(2);
    });

    it('includes context when requested', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'line1\nTARGET\nline3');
      const results = mod.searchProject('TARGET', { cwd: tmpDir, context: 1 });
      expect(results.matches[0].context).toBeDefined();
      expect(results.matches[0].context.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('shows error message', () => {
      const output = mod.formatText({ error: 'bad regex' }, tmpDir);
      expect(output).toContain('Error');
    });

    it('formats matches with file headers', () => {
      const results = {
        pattern: 'hello',
        totalMatches: 1,
        filesSearched: 1,
        filesWithMatches: 1,
        matches: [{ file: path.join(tmpDir, 'a.js'), line: 1, content: 'hello world' }],
      };
      const output = mod.formatText(results, tmpDir);
      expect(output).toContain('a.js');
      expect(output).toContain('hello world');
    });
  });

  // ── runSearch ─────────────────────────────────────────────────────────────
  describe('runSearch', () => {
    it('runs with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSearch(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });

    it('shows error when no pattern given', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSearch([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('pattern required'));
      spy.mockRestore();
      logSpy.mockRestore();
    });

    it('runs with --count', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello world');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSearch(['hello', '--count']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('match'));
      spy.mockRestore();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello world');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSearch(['hello', '--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('runs with --count --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'hello world');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSearch(['hello', '--count', '--format', 'json']);
      const output = spy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.totalMatches).toBe(1);
      spy.mockRestore();
    });
  });
});
