/**
 * Tests for Development Log Command Module
 * @story 31.3 — Development Log
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-devlog-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/devlog/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/devlog/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('devlog command', () => {
  // ── loadEntries ────────────────────────────────────────────────────────
  describe('loadEntries', () => {
    it('returns empty array when file absent', () => {
      expect(mod.loadEntries()).toEqual([]);
    });

    it('returns empty for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'devlog.jsonl'), '', 'utf8');
      expect(mod.loadEntries()).toEqual([]);
    });

    it('parses JSONL entries', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'devlog.jsonl'), '{"message":"a"}\n{"message":"b"}\n', 'utf8');
      expect(mod.loadEntries().length).toBe(2);
    });

    it('skips invalid lines', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'devlog.jsonl'), '{"message":"a"}\nbad\n', 'utf8');
      expect(mod.loadEntries().length).toBe(1);
    });
  });

  // ── addEntry ───────────────────────────────────────────────────────────
  describe('addEntry', () => {
    it('adds an entry with message', () => {
      const entry = mod.addEntry('Fixed bug', []);
      expect(entry).toBeTruthy();
      expect(entry.message).toBe('Fixed bug');
      expect(entry.id).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
    });

    it('adds entry with tag', () => {
      const entry = mod.addEntry('New feature', ['--tag', 'feature']);
      expect(entry.tag).toBe('feature');
    });

    it('adds entry without tag (null)', () => {
      const entry = mod.addEntry('Plain entry', []);
      expect(entry.tag).toBeNull();
    });

    it('returns null for missing message', () => {
      const result = mod.addEntry(undefined, []);
      expect(result).toBeNull();
    });

    it('creates .aiox directory if absent', () => {
      mod.addEntry('Test', []);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'devlog.jsonl'))).toBe(true);
    });

    it('appends multiple entries', () => {
      mod.addEntry('First', []);
      mod.addEntry('Second', []);
      expect(mod.loadEntries().length).toBe(2);
    });
  });

  // ── listEntries ────────────────────────────────────────────────────────
  describe('listEntries', () => {
    it('lists all entries', () => {
      mod.addEntry('A', []);
      mod.addEntry('B', []);
      const list = mod.listEntries([]);
      expect(list.length).toBe(2);
    });

    it('filters by tag', () => {
      mod.addEntry('Bug fix', ['--tag', 'bug']);
      mod.addEntry('Feature', ['--tag', 'feature']);
      const list = mod.listEntries(['--tag', 'bug']);
      expect(list.length).toBe(1);
      expect(list[0].message).toBe('Bug fix');
    });

    it('returns empty when no entries', () => {
      expect(mod.listEntries([])).toEqual([]);
    });

    it('returns empty when tag has no matches', () => {
      mod.addEntry('Test', ['--tag', 'feature']);
      expect(mod.listEntries(['--tag', 'bug'])).toEqual([]);
    });
  });

  // ── searchEntries ──────────────────────────────────────────────────────
  describe('searchEntries', () => {
    it('finds entries by message', () => {
      mod.addEntry('Fixed auth bug', []);
      mod.addEntry('Added tests', []);
      const results = mod.searchEntries('auth');
      expect(results.length).toBe(1);
    });

    it('finds entries by tag', () => {
      mod.addEntry('Something', ['--tag', 'important']);
      const results = mod.searchEntries('important');
      expect(results.length).toBe(1);
    });

    it('is case insensitive', () => {
      mod.addEntry('UPPER CASE', []);
      const results = mod.searchEntries('upper');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.addEntry('Test', []);
      expect(mod.searchEntries('zzzzz')).toEqual([]);
    });

    it('returns empty for missing term', () => {
      expect(mod.searchEntries(undefined)).toEqual([]);
    });
  });

  // ── exportEntries ──────────────────────────────────────────────────────
  describe('exportEntries', () => {
    it('exports entries as JSON', () => {
      mod.addEntry('Export me', []);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.exportEntries();
      expect(result.length).toBe(1);
      expect(result[0].message).toBe('Export me');
      spy.mockRestore();
    });

    it('exports empty array when no entries', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.exportEntries();
      expect(result).toEqual([]);
      spy.mockRestore();
    });
  });

  // ── clearEntries ───────────────────────────────────────────────────────
  describe('clearEntries', () => {
    it('clears all entries', () => {
      mod.addEntry('Test', []);
      mod.clearEntries();
      expect(mod.loadEntries()).toEqual([]);
    });

    it('succeeds even when no file exists', () => {
      expect(mod.clearEntries()).toBe(true);
    });
  });

  // ── generateId ─────────────────────────────────────────────────────────
  describe('generateId', () => {
    it('returns 8-char hex', () => {
      expect(mod.generateId()).toMatch(/^[a-f0-9]{8}$/);
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 20 }, () => mod.generateId()));
      expect(ids.size).toBe(20);
    });
  });

  // ── runDevlog ──────────────────────────────────────────────────────────
  describe('runDevlog', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runDevlog(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runDevlog([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mod.runDevlog(['unknown']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('routes add subcommand', () => {
      const result = mod.runDevlog(['add', 'Test entry']);
      expect(result).toBeTruthy();
      expect(result.message).toBe('Test entry');
    });

    it('routes clear subcommand', () => {
      mod.addEntry('Test', []);
      const result = mod.runDevlog(['clear']);
      expect(result).toBe(true);
    });
  });

  // ── exports ────────────────────────────────────────────────────────────
  describe('exports', () => {
    it('exports HELP_TEXT', () => {
      expect(mod.HELP_TEXT).toContain('DEVELOPMENT LOG');
    });
  });
});
