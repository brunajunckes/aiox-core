/**
 * Tests for CLI Key-Value Store Command
 * @story 17.1 — Key-Value Store
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let kvModule;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-kv-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/kv/index.js');
  delete require.cache[modulePath];
  kvModule = require('../../.aiox-core/cli/commands/kv/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('kv command', () => {
  describe('loadStore', () => {
    it('returns empty object when file is absent', () => {
      expect(kvModule.loadStore()).toEqual({});
    });

    it('returns empty object when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '', 'utf8');
      expect(kvModule.loadStore()).toEqual({});
    });

    it('returns empty object for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), 'not-json', 'utf8');
      expect(kvModule.loadStore()).toEqual({});
    });

    it('returns empty object for array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '[1,2,3]', 'utf8');
      expect(kvModule.loadStore()).toEqual({});
    });

    it('parses valid JSON store', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '{"a":"1"}', 'utf8');
      expect(kvModule.loadStore()).toEqual({ a: '1' });
    });
  });

  describe('kvSet / kvGet', () => {
    it('sets and gets a string value', () => {
      kvModule.kvSet('name', 'AIOX');
      expect(kvModule.kvGet('name')).toBe('AIOX');
    });

    it('returns undefined for missing key', () => {
      expect(kvModule.kvGet('nonexistent')).toBeUndefined();
    });

    it('overwrites existing key', () => {
      kvModule.kvSet('key', 'v1');
      kvModule.kvSet('key', 'v2');
      expect(kvModule.kvGet('key')).toBe('v2');
    });

    it('creates .aiox directory if missing', () => {
      kvModule.kvSet('test', 'val');
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'kv-store.json'))).toBe(true);
    });
  });

  describe('kvDelete', () => {
    it('deletes an existing key and returns true', () => {
      kvModule.kvSet('x', '1');
      expect(kvModule.kvDelete('x')).toBe(true);
      expect(kvModule.kvGet('x')).toBeUndefined();
    });

    it('returns false for non-existent key', () => {
      expect(kvModule.kvDelete('nope')).toBe(false);
    });
  });

  describe('kvList', () => {
    it('returns empty object when store is empty', () => {
      expect(kvModule.kvList()).toEqual({});
    });

    it('returns all key-value pairs', () => {
      kvModule.kvSet('a', '1');
      kvModule.kvSet('b', '2');
      expect(kvModule.kvList()).toEqual({ a: '1', b: '2' });
    });
  });

  describe('kvClear', () => {
    it('clears all data', () => {
      kvModule.kvSet('a', '1');
      kvModule.kvSet('b', '2');
      kvModule.kvClear();
      expect(kvModule.kvList()).toEqual({});
    });
  });

  describe('kvExport', () => {
    it('exports empty store as JSON', () => {
      expect(JSON.parse(kvModule.kvExport())).toEqual({});
    });

    it('exports populated store as JSON', () => {
      kvModule.kvSet('x', 'y');
      const exported = JSON.parse(kvModule.kvExport());
      expect(exported).toEqual({ x: 'y' });
    });
  });

  describe('kvImport', () => {
    it('imports from a valid JSON file', () => {
      const importFile = path.join(tmpDir, 'import.json');
      fs.writeFileSync(importFile, '{"imported":"yes","count":"3"}', 'utf8');
      const result = kvModule.kvImport(importFile);
      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(kvModule.kvGet('imported')).toBe('yes');
    });

    it('returns error for non-existent file', () => {
      const result = kvModule.kvImport('/nonexistent/file.json');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imported).toBe(0);
    });

    it('returns error for invalid JSON', () => {
      const importFile = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(importFile, 'not-json', 'utf8');
      const result = kvModule.kvImport(importFile);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for array JSON', () => {
      const importFile = path.join(tmpDir, 'arr.json');
      fs.writeFileSync(importFile, '[1,2]', 'utf8');
      const result = kvModule.kvImport(importFile);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('merges into existing store', () => {
      kvModule.kvSet('existing', 'yes');
      const importFile = path.join(tmpDir, 'merge.json');
      fs.writeFileSync(importFile, '{"new":"val"}', 'utf8');
      kvModule.kvImport(importFile);
      expect(kvModule.kvGet('existing')).toBe('yes');
      expect(kvModule.kvGet('new')).toBe('val');
    });
  });

  describe('runKv', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      kvModule.runKv([]);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('KEY-VALUE STORE');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      kvModule.runKv(['--help']);
      expect(spy.mock.calls[0][0]).toContain('KEY-VALUE STORE');
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
      kvModule.runKv(['unknown']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown kv subcommand'));
      spy.mockRestore();
    });
  });
});
