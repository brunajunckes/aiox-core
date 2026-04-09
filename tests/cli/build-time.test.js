/**
 * Tests for Build Time Tracker Command Module
 * @story 24.2 — Build Time Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-build-time-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/build-time/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/build-time/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('build-time command', () => {
  // ── getDataPath ─────────────────────────────────────────────────────────
  describe('getDataPath', () => {
    it('returns path under .aiox directory', () => {
      const p = mod.getDataPath();
      expect(p).toContain('.aiox');
      expect(p).toContain('build-times.jsonl');
    });
  });

  // ── ensureDataDir ───────────────────────────────────────────────────────
  describe('ensureDataDir', () => {
    it('creates .aiox directory if missing', () => {
      mod.ensureDataDir();
      expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
    });

    it('does not fail if directory already exists', () => {
      fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
      expect(() => mod.ensureDataDir()).not.toThrow();
    });
  });

  // ── readEntries / appendEntry ───────────────────────────────────────────
  describe('readEntries / appendEntry', () => {
    it('returns empty array when no file', () => {
      expect(mod.readEntries()).toEqual([]);
    });

    it('appends and reads entries', () => {
      const entry = { command: 'npm test', durationMs: 1500, timestamp: '2026-01-01T00:00:00.000Z', exitCode: 0 };
      mod.appendEntry(entry);
      const entries = mod.readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].command).toBe('npm test');
    });

    it('handles multiple entries', () => {
      mod.appendEntry({ command: 'a', durationMs: 100, timestamp: '2026-01-01T00:00:00.000Z', exitCode: 0 });
      mod.appendEntry({ command: 'b', durationMs: 200, timestamp: '2026-01-01T00:01:00.000Z', exitCode: 0 });
      expect(mod.readEntries()).toHaveLength(2);
    });

    it('skips malformed lines', () => {
      mod.ensureDataDir();
      fs.writeFileSync(mod.getDataPath(), 'not-json\n{"command":"ok","durationMs":1,"timestamp":"t","exitCode":0}\n');
      const entries = mod.readEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].command).toBe('ok');
    });
  });

  // ── clearEntries ────────────────────────────────────────────────────────
  describe('clearEntries', () => {
    it('clears all entries', () => {
      mod.appendEntry({ command: 'x', durationMs: 1, timestamp: 't', exitCode: 0 });
      mod.clearEntries();
      expect(mod.readEntries()).toEqual([]);
    });

    it('does not fail if file does not exist', () => {
      expect(() => mod.clearEntries()).not.toThrow();
    });
  });

  // ── formatDuration ──────────────────────────────────────────────────────
  describe('formatDuration', () => {
    it('formats milliseconds', () => {
      expect(mod.formatDuration(500)).toBe('500ms');
    });

    it('formats seconds', () => {
      expect(mod.formatDuration(3500)).toBe('3.5s');
    });

    it('formats minutes', () => {
      expect(mod.formatDuration(90000)).toBe('1m 30.0s');
    });
  });

  // ── computeAverage ──────────────────────────────────────────────────────
  describe('computeAverage', () => {
    it('returns 0 for empty', () => {
      expect(mod.computeAverage([])).toBe(0);
    });

    it('computes average correctly', () => {
      const entries = [
        { durationMs: 100 },
        { durationMs: 200 },
        { durationMs: 300 },
      ];
      expect(mod.computeAverage(entries)).toBe(200);
    });
  });

  // ── getTrend ────────────────────────────────────────────────────────────
  describe('getTrend', () => {
    it('returns last N entries', () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({ command: `cmd-${i}`, durationMs: i * 100 }));
      const trend = mod.getTrend(entries, 10);
      expect(trend).toHaveLength(10);
      expect(trend[0].command).toBe('cmd-10');
    });

    it('returns all if fewer than N', () => {
      const entries = [{ command: 'a', durationMs: 100 }];
      expect(mod.getTrend(entries, 10)).toHaveLength(1);
    });
  });

  // ── formatTrend ─────────────────────────────────────────────────────────
  describe('formatTrend', () => {
    it('returns message for empty', () => {
      expect(mod.formatTrend([])).toContain('No build records');
    });

    it('includes bar chart for entries', () => {
      const entries = [
        { command: 'npm test', durationMs: 2000 },
        { command: 'npm build', durationMs: 5000 },
      ];
      const output = mod.formatTrend(entries);
      expect(output).toContain('█');
      expect(output).toContain('Trend');
    });
  });

  // ── formatTable ─────────────────────────────────────────────────────────
  describe('formatTable', () => {
    it('returns message for empty', () => {
      expect(mod.formatTable([])).toContain('No build records');
    });

    it('formats entries as table', () => {
      const entries = [{ command: 'npm test', durationMs: 1500, exitCode: 0, timestamp: 't' }];
      const output = mod.formatTable(entries);
      expect(output).toContain('npm test');
      expect(output).toContain('Build Time');
    });
  });

  // ── recordCommand ───────────────────────────────────────────────────────
  describe('recordCommand', () => {
    it('records a successful command', () => {
      const entry = mod.recordCommand('echo hello');
      expect(entry.exitCode).toBe(0);
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
      expect(entry.command).toBe('echo hello');
    });

    it('records a failed command', () => {
      const entry = mod.recordCommand('exit 1');
      expect(entry.exitCode).not.toBe(0);
    });

    it('persists the entry to file', () => {
      mod.recordCommand('echo test');
      const entries = mod.readEntries();
      expect(entries).toHaveLength(1);
    });
  });

  // ── runBuildTime ────────────────────────────────────────────────────────
  describe('runBuildTime', () => {
    it('prints help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runBuildTime(['--help']);
      expect(spy.mock.calls[0][0]).toContain('Build Time Tracker');
      spy.mockRestore();
    });

    it('clears with --clear', () => {
      mod.appendEntry({ command: 'x', durationMs: 1, timestamp: 't', exitCode: 0 });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runBuildTime(['--clear']);
      expect(mod.readEntries()).toEqual([]);
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      mod.appendEntry({ command: 'npm test', durationMs: 1000, timestamp: '2026-01-01T00:00:00.000Z', exitCode: 0 });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runBuildTime(['--format', 'json']);
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(Array.isArray(parsed)).toBe(true);
      spy.mockRestore();
    });

    it('shows average with --avg', () => {
      mod.appendEntry({ command: 'a', durationMs: 100, timestamp: 't', exitCode: 0 });
      mod.appendEntry({ command: 'b', durationMs: 300, timestamp: 't', exitCode: 0 });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runBuildTime(['--avg']);
      expect(spy.mock.calls[0][0]).toContain('Average');
      spy.mockRestore();
    });
  });
});
