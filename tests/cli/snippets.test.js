/**
 * Tests for Code Snippet Manager Command Module
 * @story 21.4 — Code Snippet Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-snippets-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/snippets/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/snippets/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('snippets command', () => {
  // ── loadSnippets / saveSnippets ───────────────────────────────────────────
  describe('loadSnippets', () => {
    it('returns empty object when file missing', () => {
      expect(mod.loadSnippets({ cwd: tmpDir })).toEqual({});
    });

    it('loads saved snippets', () => {
      const snippetsDir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(snippetsDir, { recursive: true });
      fs.writeFileSync(path.join(snippetsDir, 'snippets.json'), JSON.stringify({ test: { content: 'hello' } }));
      const snippets = mod.loadSnippets({ cwd: tmpDir });
      expect(snippets.test.content).toBe('hello');
    });
  });

  describe('saveSnippets', () => {
    it('creates directory structure and saves', () => {
      mod.saveSnippets({ foo: { content: 'bar' } }, { cwd: tmpDir });
      const filePath = path.join(tmpDir, '.aiox', 'snippets.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.foo.content).toBe('bar');
    });
  });

  // ── addSnippet ────────────────────────────────────────────────────────────
  describe('addSnippet', () => {
    it('adds a snippet with content', () => {
      const snippet = mod.addSnippet('greet', { content: 'console.log("hi")' }, { cwd: tmpDir });
      expect(snippet.content).toBe('console.log("hi")');
      expect(snippet.createdAt).toBeDefined();
    });

    it('detects language from source path', () => {
      const snippet = mod.addSnippet('test', { content: 'code', source: 'foo.js' }, { cwd: tmpDir });
      expect(snippet.language).toBe('javascript');
    });

    it('stores tags', () => {
      const snippet = mod.addSnippet('tagged', { content: 'x', tags: ['util', 'core'] }, { cwd: tmpDir });
      expect(snippet.tags).toEqual(['util', 'core']);
    });

    it('overwrites existing snippet', () => {
      mod.addSnippet('item', { content: 'v1' }, { cwd: tmpDir });
      mod.addSnippet('item', { content: 'v2' }, { cwd: tmpDir });
      const snippet = mod.getSnippet('item', { cwd: tmpDir });
      expect(snippet.content).toBe('v2');
    });
  });

  // ── getSnippet ────────────────────────────────────────────────────────────
  describe('getSnippet', () => {
    it('returns snippet by name', () => {
      mod.addSnippet('hello', { content: 'world' }, { cwd: tmpDir });
      const snippet = mod.getSnippet('hello', { cwd: tmpDir });
      expect(snippet.content).toBe('world');
    });

    it('returns null for missing snippet', () => {
      expect(mod.getSnippet('nonexistent', { cwd: tmpDir })).toBeNull();
    });
  });

  // ── removeSnippet ─────────────────────────────────────────────────────────
  describe('removeSnippet', () => {
    it('removes existing snippet', () => {
      mod.addSnippet('temp', { content: 'data' }, { cwd: tmpDir });
      expect(mod.removeSnippet('temp', { cwd: tmpDir })).toBe(true);
      expect(mod.getSnippet('temp', { cwd: tmpDir })).toBeNull();
    });

    it('returns false for missing snippet', () => {
      expect(mod.removeSnippet('nonexistent', { cwd: tmpDir })).toBe(false);
    });
  });

  // ── listSnippets ──────────────────────────────────────────────────────────
  describe('listSnippets', () => {
    it('lists all snippets', () => {
      mod.addSnippet('a', { content: 'aa' }, { cwd: tmpDir });
      mod.addSnippet('b', { content: 'bb' }, { cwd: tmpDir });
      const list = mod.listSnippets({ cwd: tmpDir });
      expect(list.length).toBe(2);
      expect(list.map((s) => s.name)).toContain('a');
      expect(list.map((s) => s.name)).toContain('b');
    });

    it('returns empty array when no snippets', () => {
      expect(mod.listSnippets({ cwd: tmpDir })).toEqual([]);
    });

    it('includes content length', () => {
      mod.addSnippet('test', { content: 'hello' }, { cwd: tmpDir });
      const list = mod.listSnippets({ cwd: tmpDir });
      expect(list[0].contentLength).toBe(5);
    });
  });

  // ── searchSnippets ────────────────────────────────────────────────────────
  describe('searchSnippets', () => {
    it('searches by name', () => {
      mod.addSnippet('myHelper', { content: 'code' }, { cwd: tmpDir });
      mod.addSnippet('other', { content: 'stuff' }, { cwd: tmpDir });
      const results = mod.searchSnippets('helper', { cwd: tmpDir });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('myHelper');
    });

    it('searches by content', () => {
      mod.addSnippet('a', { content: 'console.log("hello")' }, { cwd: tmpDir });
      mod.addSnippet('b', { content: 'return 42' }, { cwd: tmpDir });
      const results = mod.searchSnippets('console', { cwd: tmpDir });
      expect(results.length).toBe(1);
    });

    it('searches by tags', () => {
      mod.addSnippet('tagged', { content: 'x', tags: ['utility'] }, { cwd: tmpDir });
      const results = mod.searchSnippets('utility', { cwd: tmpDir });
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.addSnippet('a', { content: 'code' }, { cwd: tmpDir });
      expect(mod.searchSnippets('zzzzz', { cwd: tmpDir })).toEqual([]);
    });

    it('is case-insensitive', () => {
      mod.addSnippet('MyUtil', { content: 'CODE' }, { cwd: tmpDir });
      const results = mod.searchSnippets('myutil', { cwd: tmpDir });
      expect(results.length).toBe(1);
    });
  });

  // ── extractFileLines ──────────────────────────────────────────────────────
  describe('extractFileLines', () => {
    it('extracts specific line range', () => {
      const filePath = path.join(tmpDir, 'source.js');
      fs.writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5');
      const content = mod.extractFileLines(filePath, '2-4', tmpDir);
      expect(content).toBe('line2\nline3\nline4');
    });

    it('returns full file when no range', () => {
      const filePath = path.join(tmpDir, 'source.js');
      fs.writeFileSync(filePath, 'line1\nline2');
      const content = mod.extractFileLines(filePath, null, tmpDir);
      expect(content).toBe('line1\nline2');
    });

    it('throws for missing file', () => {
      expect(() => mod.extractFileLines('/nonexistent.js', null, tmpDir)).toThrow();
    });
  });

  // ── detectLanguage ────────────────────────────────────────────────────────
  describe('detectLanguage', () => {
    it('detects JavaScript', () => {
      expect(mod.detectLanguage('file.js')).toBe('javascript');
    });

    it('detects TypeScript', () => {
      expect(mod.detectLanguage('file.ts')).toBe('typescript');
    });

    it('detects Python', () => {
      expect(mod.detectLanguage('file.py')).toBe('python');
    });

    it('returns text for unknown', () => {
      expect(mod.detectLanguage('file.xyz')).toBe('text');
    });

    it('returns text for empty string', () => {
      expect(mod.detectLanguage('')).toBe('text');
    });
  });

  // ── runSnippets ───────────────────────────────────────────────────────────
  describe('runSnippets', () => {
    it('runs with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });

    it('runs list subcommand', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['list']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No snippets'));
      spy.mockRestore();
    });

    it('runs add with --content', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['add', 'test', '--content', 'hello world']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('saved'));
      spy.mockRestore();
    });

    it('runs get for existing snippet', () => {
      mod.addSnippet('mycode', { content: 'the content' }, { cwd: tmpDir });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['get', 'mycode']);
      expect(spy).toHaveBeenCalledWith('the content');
      spy.mockRestore();
    });

    it('runs remove', () => {
      mod.addSnippet('toremove', { content: 'x' }, { cwd: tmpDir });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['remove', 'toremove']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('removed'));
      spy.mockRestore();
    });

    it('runs search', () => {
      mod.addSnippet('helper', { content: 'code' }, { cwd: tmpDir });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['search', 'helper']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('runs export', () => {
      mod.addSnippet('a', { content: 'b' }, { cwd: tmpDir });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['export']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('shows error for unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      mod.runSnippets(['invalid']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
      spy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
