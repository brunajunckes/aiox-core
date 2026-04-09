/**
 * Tests for Cron-like Scheduled Tasks
 *
 * @module tests/cli/cron
 * @story 15.3 — Cron-like Scheduled Tasks
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseCronField,
  parseCronExpression,
  cronMatches,
  getNextRun,
  getCronFilePath,
  parseCronFile,
  serializeCronFile,
  loadCronEntries,
  saveCronEntries,
  listCronTasks,
  addCronTask,
  removeCronTask,
  showNextRuns,
  executeCronTasks,
  startScheduler,
  getHelpText,
} = require('../../.aiox-core/cli/commands/cron/index.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-cron-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── parseCronField ──────────────────────────────────────────────────────────

describe('parseCronField', () => {
  test('parses wildcard *', () => {
    const result = parseCronField('*', 0, 59);
    expect(result).toHaveLength(60);
    expect(result[0]).toBe(0);
    expect(result[59]).toBe(59);
  });

  test('parses step */5', () => {
    const result = parseCronField('*/5', 0, 59);
    expect(result).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  });

  test('parses specific number', () => {
    expect(parseCronField('30', 0, 59)).toEqual([30]);
  });

  test('returns empty for out-of-range number', () => {
    expect(parseCronField('60', 0, 59)).toEqual([]);
  });

  test('returns empty for invalid step', () => {
    expect(parseCronField('*/0', 0, 59)).toEqual([]);
  });

  test('parses step for hours', () => {
    const result = parseCronField('*/6', 0, 23);
    expect(result).toEqual([0, 6, 12, 18]);
  });
});

// ── parseCronExpression ─────────────────────────────────────────────────────

describe('parseCronExpression', () => {
  test('parses every-minute expression', () => {
    const parsed = parseCronExpression('* * * * *');
    expect(parsed).not.toBeNull();
    expect(parsed.minute).toHaveLength(60);
    expect(parsed.hour).toHaveLength(24);
  });

  test('parses every-5-minutes expression', () => {
    const parsed = parseCronExpression('*/5 * * * *');
    expect(parsed.minute).toHaveLength(12);
  });

  test('parses specific time', () => {
    const parsed = parseCronExpression('0 9 * * 1');
    expect(parsed.minute).toEqual([0]);
    expect(parsed.hour).toEqual([9]);
    expect(parsed.dayOfWeek).toEqual([1]);
  });

  test('returns null for invalid expression', () => {
    expect(parseCronExpression(null)).toBeNull();
    expect(parseCronExpression('invalid')).toBeNull();
    expect(parseCronExpression('* * *')).toBeNull();
    expect(parseCronExpression('')).toBeNull();
  });

  test('returns null for too many fields', () => {
    expect(parseCronExpression('* * * * * *')).toBeNull();
  });
});

// ── cronMatches ─────────────────────────────────────────────────────────────

describe('cronMatches', () => {
  test('matches every minute', () => {
    const now = new Date(2026, 3, 8, 10, 30, 0);
    expect(cronMatches('* * * * *', now)).toBe(true);
  });

  test('matches specific minute', () => {
    const date = new Date(2026, 3, 8, 10, 30, 0);
    expect(cronMatches('30 * * * *', date)).toBe(true);
    expect(cronMatches('15 * * * *', date)).toBe(false);
  });

  test('matches hour and minute', () => {
    const date = new Date(2026, 3, 8, 9, 0, 0);
    expect(cronMatches('0 9 * * *', date)).toBe(true);
    expect(cronMatches('0 10 * * *', date)).toBe(false);
  });

  test('matches day of week', () => {
    // April 8, 2026 is a Wednesday (day 3)
    const date = new Date(2026, 3, 8, 9, 0, 0);
    expect(cronMatches('0 9 * * 3', date)).toBe(true);
    expect(cronMatches('0 9 * * 1', date)).toBe(false);
  });

  test('returns false for invalid expression', () => {
    expect(cronMatches('invalid', new Date())).toBe(false);
  });
});

// ── getNextRun ──────────────────────────────────────────────────────────────

describe('getNextRun', () => {
  test('gets next run for every-minute cron', () => {
    const after = new Date(2026, 3, 8, 10, 30, 0);
    const next = getNextRun('* * * * *', after);
    expect(next).not.toBeNull();
    expect(next.getMinutes()).toBe(31);
  });

  test('gets next hourly run', () => {
    const after = new Date(2026, 3, 8, 10, 15, 0);
    const next = getNextRun('0 * * * *', after);
    expect(next).not.toBeNull();
    expect(next.getMinutes()).toBe(0);
    expect(next.getHours()).toBe(11);
  });

  test('returns null for invalid expression', () => {
    expect(getNextRun('invalid')).toBeNull();
  });
});

// ── File I/O ────────────────────────────────────────────────────────────────

describe('cron file I/O', () => {
  test('getCronFilePath returns correct path', () => {
    expect(getCronFilePath(tmpDir)).toBe(path.join(tmpDir, '.aiox', 'cron.yaml'));
  });

  test('parseCronFile parses entries', () => {
    const content = `- id: 1\n  expression: "*/5 * * * *"\n  command: "echo hi"`;
    const entries = parseCronFile(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(1);
    expect(entries[0].expression).toBe('*/5 * * * *');
    expect(entries[0].command).toBe('echo hi');
  });

  test('parseCronFile returns empty for null', () => {
    expect(parseCronFile(null)).toEqual([]);
    expect(parseCronFile('')).toEqual([]);
  });

  test('serializeCronFile formats correctly', () => {
    const entries = [{ id: 1, expression: '* * * * *', command: 'echo test' }];
    const output = serializeCronFile(entries);
    expect(output).toContain('- id: 1');
    expect(output).toContain('expression: "* * * * *"');
  });

  test('serializeCronFile handles empty', () => {
    expect(serializeCronFile([])).toContain('No tasks scheduled');
  });

  test('loadCronEntries returns empty when no file', () => {
    expect(loadCronEntries(tmpDir)).toEqual([]);
  });

  test('saveCronEntries creates file', () => {
    saveCronEntries([{ id: 1, expression: '* * * * *', command: 'echo' }], tmpDir);
    expect(fs.existsSync(getCronFilePath(tmpDir))).toBe(true);
  });
});

// ── Subcommand Handlers ─────────────────────────────────────────────────────

describe('listCronTasks', () => {
  test('returns message when empty', () => {
    expect(listCronTasks(tmpDir)).toContain('No scheduled tasks');
  });

  test('lists entries after adding', () => {
    addCronTask('*/5 * * * *', 'echo heartbeat', tmpDir);
    const msg = listCronTasks(tmpDir);
    expect(msg).toContain('*/5 * * * *');
    expect(msg).toContain('echo heartbeat');
  });
});

describe('addCronTask', () => {
  test('adds a valid cron task', () => {
    const msg = addCronTask('* * * * *', 'echo test', tmpDir);
    expect(msg).toContain('added');
    expect(msg).toContain('id: 1');
  });

  test('auto-increments IDs', () => {
    addCronTask('* * * * *', 'echo 1', tmpDir);
    const msg = addCronTask('0 * * * *', 'echo 2', tmpDir);
    expect(msg).toContain('id: 2');
  });

  test('rejects invalid expression', () => {
    const msg = addCronTask('invalid', 'echo test', tmpDir);
    expect(msg).toContain('Error');
    expect(msg).toContain('Invalid');
  });

  test('rejects missing expression', () => {
    expect(addCronTask('', 'cmd', tmpDir)).toContain('Error');
  });

  test('rejects missing command', () => {
    expect(addCronTask('* * * * *', '', tmpDir)).toContain('Error');
  });
});

describe('removeCronTask', () => {
  test('removes existing task', () => {
    addCronTask('* * * * *', 'echo', tmpDir);
    const msg = removeCronTask(1, tmpDir);
    expect(msg).toContain('removed');
    expect(loadCronEntries(tmpDir)).toHaveLength(0);
  });

  test('returns error for nonexistent ID', () => {
    expect(removeCronTask(99, tmpDir)).toContain('Error');
  });

  test('returns error for missing ID', () => {
    expect(removeCronTask(undefined, tmpDir)).toContain('Error');
  });

  test('returns error for invalid ID', () => {
    expect(removeCronTask('abc', tmpDir)).toContain('Error');
  });
});

describe('showNextRuns', () => {
  test('returns message when empty', () => {
    expect(showNextRuns(tmpDir)).toContain('No scheduled tasks');
  });

  test('shows next run times', () => {
    addCronTask('0 * * * *', 'echo hourly', tmpDir);
    const msg = showNextRuns(tmpDir, new Date(2026, 3, 8, 10, 0, 0));
    expect(msg).toContain('NEXT RUN TIMES');
    expect(msg).toContain('echo hourly');
  });
});

// ── executeCronTasks ────────────────────────────────────────────────────────

describe('executeCronTasks', () => {
  test('executes matching tasks', () => {
    const mockExec = jest.fn().mockReturnValue('ok');
    const date = new Date(2026, 3, 8, 10, 0, 0);
    const entries = [{ id: 1, expression: '0 10 * * *', command: 'echo test' }];
    const results = executeCronTasks(date, entries, { execFn: mockExec });
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
  });

  test('skips non-matching tasks', () => {
    const mockExec = jest.fn();
    const date = new Date(2026, 3, 8, 10, 15, 0);
    const entries = [{ id: 1, expression: '0 10 * * *', command: 'echo test' }];
    const results = executeCronTasks(date, entries, { execFn: mockExec });
    expect(results).toHaveLength(0);
    expect(mockExec).not.toHaveBeenCalled();
  });

  test('handles execution failure', () => {
    const mockExec = jest.fn().mockImplementation(() => { throw new Error('fail'); });
    const date = new Date(2026, 3, 8, 10, 0, 0);
    const entries = [{ id: 1, expression: '0 10 * * *', command: 'bad' }];
    const results = executeCronTasks(date, entries, { execFn: mockExec });
    expect(results[0].success).toBe(false);
  });
});

// ── startScheduler ──────────────────────────────────────────────────────────

describe('startScheduler', () => {
  test('creates scheduler with stop function', () => {
    const scheduler = startScheduler({ cwd: tmpDir });
    expect(scheduler.stop).toBeInstanceOf(Function);
    expect(scheduler.tick).toBeInstanceOf(Function);
    scheduler.stop();
  });

  test('tick returns results', () => {
    addCronTask('* * * * *', 'echo tick', tmpDir);
    const mockExec = jest.fn().mockReturnValue('ok');
    const scheduler = startScheduler({ cwd: tmpDir, execFn: mockExec });
    const results = scheduler.tick();
    // May or may not match depending on current time
    expect(Array.isArray(results)).toBe(true);
    scheduler.stop();
  });
});

// ── getHelpText ─────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const help = getHelpText();
    expect(help).toContain('CRON');
    expect(help).toContain('aiox cron');
    expect(help).toContain('EXPRESSION');
  });
});
