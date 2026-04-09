/**
 * Tests for Error Rate Monitor Command Module
 * @story 24.3 — Error Rate Monitor
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-error-rate-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/error-rate/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/error-rate/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('error-rate command', () => {
  // ── getDataPath ─────────────────────────────────────────────────────────
  describe('getDataPath', () => {
    it('returns path under .aiox directory', () => {
      const p = mod.getDataPath();
      expect(p).toContain('.aiox');
      expect(p).toContain('error-log.jsonl');
    });
  });

  // ── ensureDataDir ───────────────────────────────────────────────────────
  describe('ensureDataDir', () => {
    it('creates .aiox directory if missing', () => {
      mod.ensureDataDir();
      expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
    });
  });

  // ── readEntries / appendEntry ───────────────────────────────────────────
  describe('readEntries / appendEntry', () => {
    it('returns empty array when no file', () => {
      expect(mod.readEntries()).toEqual([]);
    });

    it('appends and reads entries', () => {
      const entry = { message: 'Test error', timestamp: '2026-01-01T00:00:00.000Z', source: 'test' };
      mod.appendEntry(entry);
      const entries = mod.readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test error');
    });

    it('handles multiple entries', () => {
      mod.appendEntry({ message: 'err1', timestamp: 't1', source: 's' });
      mod.appendEntry({ message: 'err2', timestamp: 't2', source: 's' });
      expect(mod.readEntries()).toHaveLength(2);
    });

    it('skips malformed lines', () => {
      mod.ensureDataDir();
      fs.writeFileSync(mod.getDataPath(), 'bad\n{"message":"ok","timestamp":"t","source":"s"}\n');
      expect(mod.readEntries()).toHaveLength(1);
    });
  });

  // ── clearEntries ────────────────────────────────────────────────────────
  describe('clearEntries', () => {
    it('clears all entries', () => {
      mod.appendEntry({ message: 'x', timestamp: 't', source: 's' });
      mod.clearEntries();
      expect(mod.readEntries()).toEqual([]);
    });

    it('does not fail when no file exists', () => {
      expect(() => mod.clearEntries()).not.toThrow();
    });
  });

  // ── recordError ─────────────────────────────────────────────────────────
  describe('recordError', () => {
    it('records an error with default source', () => {
      const entry = mod.recordError('Something broke');
      expect(entry.message).toBe('Something broke');
      expect(entry.source).toBe('manual');
      expect(entry.timestamp).toBeTruthy();
    });

    it('records an error with custom source', () => {
      const entry = mod.recordError('DB error', 'database');
      expect(entry.source).toBe('database');
    });

    it('persists the entry', () => {
      mod.recordError('test');
      expect(mod.readEntries()).toHaveLength(1);
    });
  });

  // ── parseDuration ──────────────────────────────────────────────────────
  describe('parseDuration', () => {
    it('parses hours', () => {
      expect(mod.parseDuration('24h')).toBe(24 * 3600 * 1000);
    });

    it('parses days', () => {
      expect(mod.parseDuration('7d')).toBe(7 * 86400 * 1000);
    });

    it('parses minutes', () => {
      expect(mod.parseDuration('30m')).toBe(30 * 60 * 1000);
    });

    it('returns 0 for invalid', () => {
      expect(mod.parseDuration('abc')).toBe(0);
    });
  });

  // ── filterBySince ──────────────────────────────────────────────────────
  describe('filterBySince', () => {
    it('filters entries by time window', () => {
      const now = Date.now();
      const entries = [
        { message: 'old', timestamp: new Date(now - 48 * 3600000).toISOString() },
        { message: 'recent', timestamp: new Date(now - 1000).toISOString() },
      ];
      const filtered = mod.filterBySince(entries, '24h');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].message).toBe('recent');
    });

    it('returns all for invalid duration', () => {
      const entries = [{ message: 'a', timestamp: new Date().toISOString() }];
      expect(mod.filterBySince(entries, 'xyz')).toHaveLength(1);
    });
  });

  // ── getTopErrors ───────────────────────────────────────────────────────
  describe('getTopErrors', () => {
    it('returns top N errors by frequency', () => {
      const entries = [
        { message: 'A' }, { message: 'A' }, { message: 'A' },
        { message: 'B' }, { message: 'B' },
        { message: 'C' },
      ];
      const top = mod.getTopErrors(entries, 2);
      expect(top).toHaveLength(2);
      expect(top[0].message).toBe('A');
      expect(top[0].count).toBe(3);
      expect(top[1].message).toBe('B');
    });

    it('returns empty for no entries', () => {
      expect(mod.getTopErrors([], 5)).toEqual([]);
    });
  });

  // ── computeStats ──────────────────────────────────────────────────────
  describe('computeStats', () => {
    it('returns zero stats for empty', () => {
      const stats = mod.computeStats([]);
      expect(stats.total).toBe(0);
      expect(stats.uniqueMessages).toBe(0);
    });

    it('computes total and unique', () => {
      const entries = [
        { message: 'A', timestamp: '2026-01-01T00:00:00.000Z' },
        { message: 'A', timestamp: '2026-01-01T01:00:00.000Z' },
        { message: 'B', timestamp: '2026-01-01T02:00:00.000Z' },
      ];
      const stats = mod.computeStats(entries);
      expect(stats.total).toBe(3);
      expect(stats.uniqueMessages).toBe(2);
    });

    it('computes rate string', () => {
      const entries = [
        { message: 'A', timestamp: '2026-01-01T00:00:00.000Z' },
        { message: 'B', timestamp: '2026-01-01T01:00:00.000Z' },
      ];
      const stats = mod.computeStats(entries);
      expect(stats.rate).toContain('/h');
    });
  });

  // ── formatTable ─────────────────────────────────────────────────────────
  describe('formatTable', () => {
    it('returns message for empty', () => {
      expect(mod.formatTable([])).toContain('No errors');
    });

    it('shows recent errors', () => {
      const entries = [{ message: 'Test error', timestamp: '2026-01-01T00:00:00.000Z', source: 'test' }];
      const output = mod.formatTable(entries);
      expect(output).toContain('Test error');
    });
  });

  // ── formatTopErrors ────────────────────────────────────────────────────
  describe('formatTopErrors', () => {
    it('returns message for empty', () => {
      expect(mod.formatTopErrors([])).toContain('No errors');
    });

    it('formats top errors with counts', () => {
      const top = [{ message: 'Error A', count: 5 }];
      const output = mod.formatTopErrors(top);
      expect(output).toContain('Error A');
      expect(output).toContain('5');
    });
  });

  // ── runErrorRate ────────────────────────────────────────────────────────
  describe('runErrorRate', () => {
    it('prints help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runErrorRate(['--help']);
      expect(spy.mock.calls[0][0]).toContain('Error Rate Monitor');
      spy.mockRestore();
    });

    it('clears with --clear', () => {
      mod.appendEntry({ message: 'x', timestamp: 't', source: 's' });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runErrorRate(['--clear']);
      expect(mod.readEntries()).toEqual([]);
      spy.mockRestore();
    });

    it('records with --record', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runErrorRate(['--record', 'test error']);
      expect(mod.readEntries()).toHaveLength(1);
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      mod.appendEntry({ message: 'err', timestamp: '2026-01-01T00:00:00.000Z', source: 's' });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runErrorRate(['--format', 'json']);
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed).toHaveProperty('total');
      spy.mockRestore();
    });
  });
});
