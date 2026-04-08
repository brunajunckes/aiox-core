/**
 * Tests for CLI Session Replay & History Command Module
 *
 * @module tests/cli/history
 * @story 10.4 — CLI Session Replay & History
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-history-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/history/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function createHistoryFile(entries) {
  const histPath = path.join(tmpDir, '.aiox', 'command-history.jsonl');
  fs.mkdirSync(path.dirname(histPath), { recursive: true });
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(histPath, content, 'utf8');
  return histPath;
}

// ── readHistory ────────────────────────────────────────────────────────────────

describe('readHistory', () => {
  test('reads entries from JSONL file', () => {
    const histPath = createHistoryFile([
      { command: 'help', args: [], timestamp: '2026-01-01T00:00:00Z' },
      { command: 'status', args: ['--json'], timestamp: '2026-01-01T00:01:00Z' },
    ]);
    const entries = mod.readHistory(histPath);
    expect(entries).toHaveLength(2);
    expect(entries[0].command).toBe('help');
  });

  test('returns empty array for missing file', () => {
    expect(mod.readHistory('/nonexistent/file')).toEqual([]);
  });

  test('skips invalid JSON lines', () => {
    const histPath = path.join(tmpDir, 'bad.jsonl');
    fs.writeFileSync(histPath, '{"command":"ok"}\nnot json\n{"command":"ok2"}\n');
    const entries = mod.readHistory(histPath);
    expect(entries).toHaveLength(2);
  });

  test('returns empty for empty file', () => {
    const histPath = path.join(tmpDir, 'empty.jsonl');
    fs.writeFileSync(histPath, '');
    expect(mod.readHistory(histPath)).toEqual([]);
  });
});

// ── appendHistory ──────────────────────────────────────────────────────────────

describe('appendHistory', () => {
  test('creates dir and appends entry', () => {
    const histFile = path.join(tmpDir, '.aiox', 'command-history.jsonl');
    mod.appendHistory('test-cmd', ['--flag'], { historyFile: histFile });
    const content = fs.readFileSync(histFile, 'utf8');
    const entry = JSON.parse(content.trim());
    expect(entry.command).toBe('test-cmd');
    expect(entry.args).toEqual(['--flag']);
  });

  test('appends multiple entries', () => {
    const histFile = path.join(tmpDir, '.aiox', 'command-history.jsonl');
    mod.appendHistory('cmd1', [], { historyFile: histFile });
    mod.appendHistory('cmd2', ['a'], { historyFile: histFile });
    const entries = mod.readHistory(histFile);
    expect(entries).toHaveLength(2);
  });

  test('uses custom timestamp', () => {
    const histFile = path.join(tmpDir, '.aiox', 'command-history.jsonl');
    mod.appendHistory('cmd', [], { historyFile: histFile, timestamp: '2026-06-01T00:00:00Z' });
    const entries = mod.readHistory(histFile);
    expect(entries[0].timestamp).toBe('2026-06-01T00:00:00Z');
  });

  test('defaults args to empty array', () => {
    const histFile = path.join(tmpDir, '.aiox', 'command-history.jsonl');
    mod.appendHistory('cmd', undefined, { historyFile: histFile });
    const entries = mod.readHistory(histFile);
    expect(entries[0].args).toEqual([]);
  });
});

// ── clearHistory ───────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  test('clears existing file', () => {
    const histPath = createHistoryFile([{ command: 'x', args: [] }]);
    expect(mod.clearHistory(histPath)).toBe(true);
    expect(fs.readFileSync(histPath, 'utf8')).toBe('');
  });

  test('returns false for missing file', () => {
    expect(mod.clearHistory('/nonexistent/path')).toBe(false);
  });
});

// ── getLastEntries ─────────────────────────────────────────────────────────────

describe('getLastEntries', () => {
  test('returns last N entries', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({ command: `cmd${i}` }));
    const last = mod.getLastEntries(entries, 5);
    expect(last).toHaveLength(5);
    expect(last[0].command).toBe('cmd25');
  });

  test('returns all if fewer than N', () => {
    const entries = [{ command: 'a' }];
    expect(mod.getLastEntries(entries, 20)).toHaveLength(1);
  });

  test('uses default limit of 20', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({ command: `cmd${i}` }));
    const last = mod.getLastEntries(entries);
    expect(last).toHaveLength(20);
  });
});

// ── searchHistory ──────────────────────────────────────────────────────────────

describe('searchHistory', () => {
  test('filters by command name', () => {
    const entries = [
      { command: 'help', args: [] },
      { command: 'status', args: [] },
      { command: 'help', args: ['--detail'] },
    ];
    const results = mod.searchHistory(entries, 'help');
    expect(results).toHaveLength(2);
  });

  test('filters by args', () => {
    const entries = [
      { command: 'config', args: ['--json'] },
      { command: 'status', args: ['--verbose'] },
    ];
    const results = mod.searchHistory(entries, 'json');
    expect(results).toHaveLength(1);
    expect(results[0].command).toBe('config');
  });

  test('is case insensitive', () => {
    const entries = [{ command: 'Help', args: [] }];
    expect(mod.searchHistory(entries, 'help')).toHaveLength(1);
  });

  test('returns empty for no match', () => {
    const entries = [{ command: 'status', args: [] }];
    expect(mod.searchHistory(entries, 'nonexistent')).toHaveLength(0);
  });
});

// ── formatHistoryTable ─────────────────────────────────────────────────────────

describe('formatHistoryTable', () => {
  test('formats entries as table', () => {
    const entries = [{ command: 'help', args: ['--detail'], timestamp: '2026-01-01T00:00:00Z' }];
    const table = mod.formatHistoryTable(entries);
    expect(table).toContain('help');
    expect(table).toContain('--detail');
    expect(table).toContain('Command');
  });

  test('returns message for empty entries', () => {
    expect(mod.formatHistoryTable([])).toBe('No history entries found.');
  });
});

// ── exportHistory ──────────────────────────────────────────────────────────────

describe('exportHistory', () => {
  test('exports as valid JSON', () => {
    const entries = [{ command: 'x', args: [], timestamp: 't' }];
    const json = mod.exportHistory(entries);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].command).toBe('x');
  });

  test('exports empty array', () => {
    const json = mod.exportHistory([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});

// ── runHistory ─────────────────────────────────────────────────────────────────

describe('runHistory', () => {
  let consoleSpy;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('shows help with --help', () => {
    mod.runHistory(['--help']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  test('shows no history message when empty', () => {
    mod.runHistory([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No command history');
  });

  test('shows last 20 entries by default', () => {
    createHistoryFile(Array.from({ length: 25 }, (_, i) => ({
      command: `cmd${i}`, args: [], timestamp: '2026-01-01',
    })));
    mod.runHistory([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Last 20');
  });

  test('respects --limit', () => {
    createHistoryFile(Array.from({ length: 10 }, (_, i) => ({
      command: `cmd${i}`, args: [], timestamp: '2026-01-01',
    })));
    mod.runHistory(['--limit', '3']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Last 3');
  });

  test('searches with --search', () => {
    createHistoryFile([
      { command: 'help', args: [], timestamp: '2026-01-01' },
      { command: 'status', args: [], timestamp: '2026-01-01' },
    ]);
    mod.runHistory(['--search', 'help']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Search results');
    expect(output).toContain('help');
  });

  test('clears history with --clear', () => {
    createHistoryFile([{ command: 'x', args: [], timestamp: '2026-01-01' }]);
    mod.runHistory(['--clear']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('cleared');
  });

  test('exports with --export', () => {
    createHistoryFile([{ command: 'test', args: ['a'], timestamp: '2026-01-01' }]);
    mod.runHistory(['--export']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
  });

  test('export with empty history outputs empty array', () => {
    mod.runHistory(['--export']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed).toEqual([]);
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('DEFAULT_HISTORY_FILE is defined', () => {
    expect(mod.DEFAULT_HISTORY_FILE).toBeDefined();
  });

  test('DEFAULT_LIMIT is 20', () => {
    expect(mod.DEFAULT_LIMIT).toBe(20);
  });
});
