/**
 * Tests for Daily Journal Command Module
 * @story 31.4 — Daily Journal
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-journal-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/journal/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/journal/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('journal command', () => {
  // ── loadEntries ────────────────────────────────────────────────────────
  describe('loadEntries', () => {
    it('returns empty array when file absent', () => {
      expect(mod.loadEntries()).toEqual([]);
    });

    it('returns empty for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'journal.jsonl'), '', 'utf8');
      expect(mod.loadEntries()).toEqual([]);
    });

    it('parses JSONL entries', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'journal.jsonl'), '{"text":"a"}\n{"text":"b"}\n', 'utf8');
      expect(mod.loadEntries().length).toBe(2);
    });

    it('skips invalid lines', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'journal.jsonl'), '{"text":"a"}\nbad\n', 'utf8');
      expect(mod.loadEntries().length).toBe(1);
    });
  });

  // ── addJournalEntry ────────────────────────────────────────────────────
  describe('addJournalEntry', () => {
    it('adds an entry with text', () => {
      const entry = mod.addJournalEntry('Started sprint');
      expect(entry).toBeTruthy();
      expect(entry.text).toBe('Started sprint');
      expect(entry.id).toBeTruthy();
      expect(entry.date).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
    });

    it('sets date to today', () => {
      const entry = mod.addJournalEntry('Test');
      const today = new Date().toISOString().slice(0, 10);
      expect(entry.date).toBe(today);
    });

    it('returns null for missing text', () => {
      expect(mod.addJournalEntry(undefined)).toBeNull();
    });

    it('creates .aiox directory if absent', () => {
      mod.addJournalEntry('Test');
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'journal.jsonl'))).toBe(true);
    });

    it('appends multiple entries', () => {
      mod.addJournalEntry('First');
      mod.addJournalEntry('Second');
      expect(mod.loadEntries().length).toBe(2);
    });
  });

  // ── showToday ──────────────────────────────────────────────────────────
  describe('showToday', () => {
    it('shows today entries', () => {
      mod.addJournalEntry('Today entry');
      const result = mod.showToday();
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Today entry');
    });

    it('returns empty when no entries today', () => {
      expect(mod.showToday()).toEqual([]);
    });

    it('excludes entries from other dates', () => {
      // Manually add entry with different date
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const entry = { id: 'abc', text: 'Old', date: '2020-01-01', timestamp: '2020-01-01T00:00:00.000Z' };
      fs.writeFileSync(path.join(dir, 'journal.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
      expect(mod.showToday()).toEqual([]);
    });
  });

  // ── listEntries ────────────────────────────────────────────────────────
  describe('listEntries', () => {
    it('lists all entries grouped by date', () => {
      mod.addJournalEntry('A');
      mod.addJournalEntry('B');
      const result = mod.listEntries([]);
      expect(result.length).toBe(2);
    });

    it('filters by --date', () => {
      mod.addJournalEntry('Today');
      const today = new Date().toISOString().slice(0, 10);
      const result = mod.listEntries(['--date', today]);
      expect(result.length).toBe(1);
    });

    it('returns empty for date with no entries', () => {
      mod.addJournalEntry('Today');
      const result = mod.listEntries(['--date', '2000-01-01']);
      expect(result).toEqual([]);
    });

    it('returns empty when no entries', () => {
      expect(mod.listEntries([])).toEqual([]);
    });
  });

  // ── searchEntries ──────────────────────────────────────────────────────
  describe('searchEntries', () => {
    it('finds entries by text', () => {
      mod.addJournalEntry('Sprint 31 planning');
      mod.addJournalEntry('Code review');
      const results = mod.searchEntries('sprint');
      expect(results.length).toBe(1);
    });

    it('is case insensitive', () => {
      mod.addJournalEntry('UPPERCASE TEXT');
      expect(mod.searchEntries('uppercase').length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.addJournalEntry('Test');
      expect(mod.searchEntries('zzzzz')).toEqual([]);
    });

    it('returns empty for missing term', () => {
      expect(mod.searchEntries(undefined)).toEqual([]);
    });
  });

  // ── exportEntries ──────────────────────────────────────────────────────
  describe('exportEntries', () => {
    it('exports entries as JSON', () => {
      mod.addJournalEntry('Export me');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.exportEntries();
      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Export me');
      spy.mockRestore();
    });

    it('exports empty array when no entries', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.exportEntries();
      expect(result).toEqual([]);
      spy.mockRestore();
    });
  });

  // ── toDateStr ──────────────────────────────────────────────────────────
  describe('toDateStr', () => {
    it('formats date as YYYY-MM-DD', () => {
      const d = new Date('2026-04-08T12:00:00Z');
      expect(mod.toDateStr(d)).toBe('2026-04-08');
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

  // ── runJournal ─────────────────────────────────────────────────────────
  describe('runJournal', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runJournal(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runJournal([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mod.runJournal(['unknown']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('routes add subcommand', () => {
      const result = mod.runJournal(['add', 'Test entry']);
      expect(result).toBeTruthy();
      expect(result.text).toBe('Test entry');
    });

    it('routes today subcommand', () => {
      mod.addJournalEntry('Today');
      const result = mod.runJournal(['today']);
      expect(result.length).toBe(1);
    });
  });

  // ── exports ────────────────────────────────────────────────────────────
  describe('exports', () => {
    it('exports HELP_TEXT', () => {
      expect(mod.HELP_TEXT).toContain('DAILY JOURNAL');
    });
  });
});
