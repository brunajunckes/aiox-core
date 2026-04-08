/**
 * Tests for Command Execution Timer & Performance Logging Module
 *
 * @module tests/cli/perf
 * @story 10.2 — Command Execution Timer & Performance Logging
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-perf-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/perf/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function createLogFile(entries) {
  const logPath = path.join(tmpDir, '.aiox', 'perf-log.jsonl');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(logPath, content, 'utf8');
  return logPath;
}

// ── readPerfLog ────────────────────────────────────────────────────────────────

describe('readPerfLog', () => {
  test('reads entries from JSONL file', () => {
    const logPath = createLogFile([
      { command: 'help', duration_ms: 50, timestamp: '2026-01-01T00:00:00Z' },
      { command: 'status', duration_ms: 120, timestamp: '2026-01-01T00:01:00Z' },
    ]);
    const entries = mod.readPerfLog(logPath);
    expect(entries).toHaveLength(2);
    expect(entries[0].command).toBe('help');
  });

  test('returns empty array for missing file', () => {
    expect(mod.readPerfLog('/nonexistent/file')).toEqual([]);
  });

  test('skips invalid JSON lines', () => {
    const logPath = path.join(tmpDir, 'bad.jsonl');
    fs.writeFileSync(logPath, '{"command":"ok","duration_ms":1}\nnot json\n{"command":"ok2","duration_ms":2}\n');
    const entries = mod.readPerfLog(logPath);
    expect(entries).toHaveLength(2);
  });

  test('returns empty array for empty file', () => {
    const logPath = path.join(tmpDir, 'empty.jsonl');
    fs.writeFileSync(logPath, '');
    expect(mod.readPerfLog(logPath)).toEqual([]);
  });
});

// ── appendPerfEntry ────────────────────────────────────────────────────────────

describe('appendPerfEntry', () => {
  test('creates dir and appends entry', () => {
    const logFile = path.join(tmpDir, '.aiox', 'perf-log.jsonl');
    mod.appendPerfEntry('test-cmd', 42, { logFile });
    const content = fs.readFileSync(logFile, 'utf8');
    const entry = JSON.parse(content.trim());
    expect(entry.command).toBe('test-cmd');
    expect(entry.duration_ms).toBe(42);
  });

  test('appends multiple entries', () => {
    const logFile = path.join(tmpDir, '.aiox', 'perf-log.jsonl');
    mod.appendPerfEntry('cmd1', 10, { logFile });
    mod.appendPerfEntry('cmd2', 20, { logFile });
    const entries = mod.readPerfLog(logFile);
    expect(entries).toHaveLength(2);
  });

  test('uses custom timestamp', () => {
    const logFile = path.join(tmpDir, '.aiox', 'perf-log.jsonl');
    mod.appendPerfEntry('cmd', 5, { logFile, timestamp: '2026-06-01T00:00:00Z' });
    const entries = mod.readPerfLog(logFile);
    expect(entries[0].timestamp).toBe('2026-06-01T00:00:00Z');
  });
});

// ── clearPerfLog ───────────────────────────────────────────────────────────────

describe('clearPerfLog', () => {
  test('clears existing log', () => {
    const logPath = createLogFile([{ command: 'x', duration_ms: 1 }]);
    expect(mod.clearPerfLog(logPath)).toBe(true);
    expect(fs.readFileSync(logPath, 'utf8')).toBe('');
  });

  test('returns false for missing file', () => {
    expect(mod.clearPerfLog('/nonexistent/path')).toBe(false);
  });
});

// ── getLastEntries ─────────────────────────────────────────────────────────────

describe('getLastEntries', () => {
  test('returns last N entries', () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({ command: `cmd${i}`, duration_ms: i }));
    const last = mod.getLastEntries(entries, 5);
    expect(last).toHaveLength(5);
    expect(last[0].command).toBe('cmd15');
  });

  test('returns all if fewer than N', () => {
    const entries = [{ command: 'a', duration_ms: 1 }];
    expect(mod.getLastEntries(entries, 10)).toHaveLength(1);
  });
});

// ── getSlowestEntries ──────────────────────────────────────────────────────────

describe('getSlowestEntries', () => {
  test('returns top N slowest entries', () => {
    const entries = [
      { command: 'fast', duration_ms: 10 },
      { command: 'slow', duration_ms: 500 },
      { command: 'medium', duration_ms: 100 },
      { command: 'slowest', duration_ms: 1000 },
    ];
    const slowest = mod.getSlowestEntries(entries, 2);
    expect(slowest).toHaveLength(2);
    expect(slowest[0].command).toBe('slowest');
    expect(slowest[1].command).toBe('slow');
  });
});

// ── getAverages ────────────────────────────────────────────────────────────────

describe('getAverages', () => {
  test('computes average per command', () => {
    const entries = [
      { command: 'help', duration_ms: 10 },
      { command: 'help', duration_ms: 20 },
      { command: 'status', duration_ms: 100 },
    ];
    const avg = mod.getAverages(entries);
    expect(avg.help).toBe(15);
    expect(avg.status).toBe(100);
  });

  test('handles single entry per command', () => {
    const avg = mod.getAverages([{ command: 'solo', duration_ms: 42 }]);
    expect(avg.solo).toBe(42);
  });
});

// ── formatDuration ─────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  test('shows ms for small values', () => {
    expect(mod.formatDuration(50)).toBe('50ms');
  });

  test('shows seconds for >= 1000ms', () => {
    expect(mod.formatDuration(1500)).toBe('1.50s');
  });
});

// ── formatEntryTable ───────────────────────────────────────────────────────────

describe('formatEntryTable', () => {
  test('formats entries as table', () => {
    const entries = [{ command: 'help', duration_ms: 50, timestamp: '2026-01-01T00:00:00Z' }];
    const table = mod.formatEntryTable(entries);
    expect(table).toContain('help');
    expect(table).toContain('50ms');
    expect(table).toContain('Command');
  });

  test('returns message for empty entries', () => {
    expect(mod.formatEntryTable([])).toBe('No entries found.');
  });
});

// ── formatAverages ─────────────────────────────────────────────────────────────

describe('formatAverages', () => {
  test('formats averages as table', () => {
    const avg = { help: 15, status: 100 };
    const output = mod.formatAverages(avg);
    expect(output).toContain('help');
    expect(output).toContain('status');
  });

  test('returns message for empty averages', () => {
    expect(mod.formatAverages({})).toBe('No entries found.');
  });
});

// ── runPerf ────────────────────────────────────────────────────────────────────

describe('runPerf', () => {
  let consoleSpy;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('shows help with --help', () => {
    mod.runPerf(['--help']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  test('shows no data message when log empty', () => {
    mod.runPerf([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No performance data');
  });

  test('shows last 10 entries by default', () => {
    createLogFile(Array.from({ length: 15 }, (_, i) => ({
      command: `cmd${i}`, duration_ms: i * 10, timestamp: '2026-01-01T00:00:00Z',
    })));
    mod.runPerf([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Last 10');
  });

  test('shows slowest with --slow', () => {
    createLogFile([
      { command: 'fast', duration_ms: 10, timestamp: '2026-01-01' },
      { command: 'slow', duration_ms: 999, timestamp: '2026-01-01' },
    ]);
    mod.runPerf(['--slow']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Slowest');
  });

  test('clears log with --clear', () => {
    createLogFile([{ command: 'x', duration_ms: 1, timestamp: '2026-01-01' }]);
    mod.runPerf(['--clear']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('cleared');
  });

  test('shows averages with --avg', () => {
    createLogFile([
      { command: 'help', duration_ms: 10, timestamp: '2026-01-01' },
      { command: 'help', duration_ms: 20, timestamp: '2026-01-01' },
    ]);
    mod.runPerf(['--avg']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Average');
  });
});
