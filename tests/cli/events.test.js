/**
 * Tests for System Event Logger Command Module
 *
 * @module tests/cli/events
 * @story 11.1 — System Event Logger
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-events-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/events/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getEventsFile', () => {
  test('returns events.jsonl inside .aiox', () => {
    expect(mod.getEventsFile()).toBe(path.join(tmpDir, '.aiox', 'events.jsonl'));
  });
});

// ── logEvent ────────────────────────────────────────────────────────────────

describe('logEvent', () => {
  test('creates event file and appends event', () => {
    const event = mod.logEvent('info', 'test', 'hello world');
    expect(event.level).toBe('info');
    expect(event.source).toBe('test');
    expect(event.message).toBe('hello world');
    expect(event.timestamp).toBeDefined();
    expect(fs.existsSync(mod.getEventsFile())).toBe(true);
  });

  test('appends multiple events', () => {
    mod.logEvent('info', 'a', 'first');
    mod.logEvent('warn', 'b', 'second');
    const events = mod.readEvents();
    expect(events).toHaveLength(2);
    expect(events[0].message).toBe('first');
    expect(events[1].message).toBe('second');
  });

  test('includes data when provided', () => {
    const event = mod.logEvent('error', 'src', 'msg', { code: 42 });
    expect(event.data).toEqual({ code: 42 });
  });

  test('omits data key when not provided', () => {
    const event = mod.logEvent('info', 'src', 'msg');
    expect(event).not.toHaveProperty('data');
  });

  test('throws on invalid level', () => {
    expect(() => mod.logEvent('debug', 'src', 'msg')).toThrow('Invalid level');
  });

  test('throws on missing source', () => {
    expect(() => mod.logEvent('info', '', 'msg')).toThrow('Source is required');
  });

  test('throws on missing message', () => {
    expect(() => mod.logEvent('info', 'src', '')).toThrow('Message is required');
  });
});

// ── readEvents ──────────────────────────────────────────────────────────────

describe('readEvents', () => {
  test('returns empty array when file missing', () => {
    expect(mod.readEvents()).toEqual([]);
  });

  test('returns empty array for empty file', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getEventsFile(), '', 'utf8');
    expect(mod.readEvents()).toEqual([]);
  });

  test('skips malformed lines', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getEventsFile(), '{"level":"info"}\nnot-json\n{"level":"warn"}\n', 'utf8');
    const events = mod.readEvents();
    expect(events).toHaveLength(2);
  });
});

// ── parseSince ──────────────────────────────────────────────────────────────

describe('parseSince', () => {
  test('parses hours', () => {
    expect(mod.parseSince('2h')).toBe(7200000);
  });

  test('parses minutes', () => {
    expect(mod.parseSince('30m')).toBe(1800000);
  });

  test('parses days', () => {
    expect(mod.parseSince('1d')).toBe(86400000);
  });

  test('throws on invalid format', () => {
    expect(() => mod.parseSince('abc')).toThrow('Invalid --since format');
  });
});

// ── filterByLevel ───────────────────────────────────────────────────────────

describe('filterByLevel', () => {
  const events = [
    { level: 'info', message: 'a' },
    { level: 'warn', message: 'b' },
    { level: 'error', message: 'c' },
    { level: 'info', message: 'd' },
  ];

  test('filters by info', () => {
    const result = mod.filterByLevel(events, 'info');
    expect(result).toHaveLength(2);
  });

  test('filters by error', () => {
    const result = mod.filterByLevel(events, 'error');
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('c');
  });

  test('throws on invalid level', () => {
    expect(() => mod.filterByLevel(events, 'debug')).toThrow('Invalid level');
  });
});

// ── filterBySince ───────────────────────────────────────────────────────────

describe('filterBySince', () => {
  test('filters events by time window', () => {
    const now = Date.now();
    const events = [
      { timestamp: new Date(now - 3600000 * 3).toISOString(), message: 'old' },
      { timestamp: new Date(now - 3600000).toISOString(), message: 'recent' },
      { timestamp: new Date(now).toISOString(), message: 'now' },
    ];
    const result = mod.filterBySince(events, '2h');
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe('recent');
  });
});

// ── clearEvents ─────────────────────────────────────────────────────────────

describe('clearEvents', () => {
  test('returns false when file does not exist', () => {
    expect(mod.clearEvents()).toBe(false);
  });

  test('clears existing file', () => {
    mod.logEvent('info', 'src', 'msg');
    expect(mod.clearEvents()).toBe(true);
    expect(mod.readEvents()).toEqual([]);
  });
});

// ── formatEvent ─────────────────────────────────────────────────────────────

describe('formatEvent', () => {
  test('formats event without data', () => {
    const str = mod.formatEvent({ timestamp: '2026-01-01T00:00:00Z', level: 'info', source: 'cli', message: 'started' });
    expect(str).toContain('[2026-01-01T00:00:00Z]');
    expect(str).toContain('INFO');
    expect(str).toContain('[cli]');
    expect(str).toContain('started');
  });

  test('formats event with data', () => {
    const str = mod.formatEvent({ timestamp: '2026-01-01T00:00:00Z', level: 'error', source: 'x', message: 'fail', data: { k: 1 } });
    expect(str).toContain('{"k":1}');
  });
});

// ── watchEvents ─────────────────────────────────────────────────────────────

describe('watchEvents', () => {
  test('detects new events appended to file', (done) => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getEventsFile(), '', 'utf8');

    const received = [];
    const watcher = mod.watchEvents({
      interval: 50,
      onEvent(event) {
        received.push(event);
      },
    });

    setTimeout(() => {
      fs.appendFileSync(mod.getEventsFile(), JSON.stringify({ level: 'info', message: 'test' }) + '\n');
    }, 80);

    setTimeout(() => {
      watcher.stop();
      expect(received).toHaveLength(1);
      expect(received[0].message).toBe('test');
      done();
    }, 300);
  });
});

// ── runEvents ───────────────────────────────────────────────────────────────

describe('runEvents', () => {
  test('shows "No events found." when empty', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEvents([]);
    expect(spy).toHaveBeenCalledWith('No events found.');
    spy.mockRestore();
  });

  test('shows events when present', () => {
    mod.logEvent('info', 'src', 'hello');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEvents([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('1 event(s)'));
    spy.mockRestore();
  });

  test('--clear clears events', () => {
    mod.logEvent('info', 'src', 'msg');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEvents(['--clear']);
    expect(spy).toHaveBeenCalledWith('Event log cleared.');
    expect(mod.readEvents()).toEqual([]);
    spy.mockRestore();
  });
});
