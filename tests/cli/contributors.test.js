/**
 * Tests for Contributor Stats
 *
 * @module tests/cli/contributors
 * @story 14.3 — Contributor Stats
 */

'use strict';

const {
  parsePeriod,
  getContributors,
  parseShortlog,
  applyTop,
  formatContributors,
  runContributors,
  getHelpText,
  PERIOD_MAP,
} = require('../../.aiox-core/cli/commands/contributors/index.js');

// ── parsePeriod ──────────────────────────────────────────────────────────────

describe('parsePeriod', () => {
  test('parses 30d', () => {
    expect(parsePeriod('30d')).toBe('30.days.ago');
  });

  test('parses 4w', () => {
    expect(parsePeriod('4w')).toBe('4.weeks.ago');
  });

  test('parses 6m', () => {
    expect(parsePeriod('6m')).toBe('6.months.ago');
  });

  test('parses 1y', () => {
    expect(parsePeriod('1y')).toBe('1.years.ago');
  });

  test('returns null for invalid period', () => {
    expect(parsePeriod('abc')).toBeNull();
  });

  test('returns null for null', () => {
    expect(parsePeriod(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parsePeriod('')).toBeNull();
  });

  test('returns null for non-string', () => {
    expect(parsePeriod(123)).toBeNull();
  });
});

// ── parseShortlog ────────────────────────────────────────────────────────────

describe('parseShortlog', () => {
  test('parses standard shortlog output', () => {
    const output = '   10\tAlice\n    5\tBob\n    3\tCharlie';
    const result = parseShortlog(output);
    expect(result).toEqual([
      { commits: 10, name: 'Alice' },
      { commits: 5, name: 'Bob' },
      { commits: 3, name: 'Charlie' },
    ]);
  });

  test('handles single contributor', () => {
    const result = parseShortlog('   42\tDev User');
    expect(result).toEqual([{ commits: 42, name: 'Dev User' }]);
  });

  test('returns empty for empty string', () => {
    expect(parseShortlog('')).toEqual([]);
  });

  test('returns empty for null', () => {
    expect(parseShortlog(null)).toEqual([]);
  });

  test('skips empty lines', () => {
    const result = parseShortlog('   5\tAlice\n\n   3\tBob');
    expect(result.length).toBe(2);
  });
});

// ── getContributors ──────────────────────────────────────────────────────────

describe('getContributors', () => {
  test('calls git shortlog and parses output', () => {
    const mockExec = () => '   10\tAlice\n    5\tBob';
    const result = getContributors({ execFn: mockExec });
    expect(result).toEqual([
      { commits: 10, name: 'Alice' },
      { commits: 5, name: 'Bob' },
    ]);
  });

  test('passes --since when provided', () => {
    let capturedCmd = '';
    const mockExec = (cmd) => { capturedCmd = cmd; return '   1\tX'; };
    getContributors({ execFn: mockExec, since: '30.days.ago' });
    expect(capturedCmd).toContain('--since="30.days.ago"');
  });

  test('returns empty on error', () => {
    const mockExec = () => { throw new Error('fail'); };
    expect(getContributors({ execFn: mockExec })).toEqual([]);
  });

  test('returns empty for empty output', () => {
    const mockExec = () => '';
    expect(getContributors({ execFn: mockExec })).toEqual([]);
  });
});

// ── applyTop ─────────────────────────────────────────────────────────────────

describe('applyTop', () => {
  test('limits to top N', () => {
    const contributors = [
      { commits: 10, name: 'A' },
      { commits: 5, name: 'B' },
      { commits: 3, name: 'C' },
    ];
    expect(applyTop(contributors, 2).length).toBe(2);
  });

  test('returns all when N is null', () => {
    const contributors = [{ commits: 1, name: 'A' }];
    expect(applyTop(contributors, null)).toEqual(contributors);
  });

  test('returns all when N is 0', () => {
    const contributors = [{ commits: 1, name: 'A' }];
    expect(applyTop(contributors, 0)).toEqual(contributors);
  });

  test('returns all when N exceeds length', () => {
    const contributors = [{ commits: 1, name: 'A' }];
    expect(applyTop(contributors, 10)).toEqual(contributors);
  });
});

// ── formatContributors ───────────────────────────────────────────────────────

describe('formatContributors', () => {
  test('formats contributor list', () => {
    const contributors = [
      { commits: 10, name: 'Alice' },
      { commits: 5, name: 'Bob' },
    ];
    const output = formatContributors(contributors);
    expect(output).toContain('CONTRIBUTOR STATS');
    expect(output).toContain('Alice');
    expect(output).toContain('Bob');
    expect(output).toContain('15 commits');
  });

  test('handles empty list', () => {
    expect(formatContributors([])).toContain('No contributors found');
  });
});

// ── runContributors ──────────────────────────────────────────────────────────

describe('runContributors', () => {
  test('--help shows help', () => {
    const output = [];
    runContributors(['--help'], { log: m => output.push(m) });
    expect(output[0]).toContain('CONTRIBUTOR STATS');
  });

  test('--format json outputs JSON', () => {
    const output = [];
    runContributors(['--format', 'json'], {
      log: m => output.push(m),
      execFn: () => '   5\tDev',
    });
    const parsed = JSON.parse(output[0]);
    expect(parsed[0].name).toBe('Dev');
  });

  test('--since passes period to git', () => {
    let captured = '';
    const output = [];
    runContributors(['--since', '30d'], {
      log: m => output.push(m),
      execFn: (cmd) => { captured = cmd; return '   1\tX'; },
    });
    expect(captured).toContain('--since="30.days.ago"');
  });

  test('--top limits output', () => {
    const output = [];
    runContributors(['--top', '1', '--format', 'json'], {
      log: m => output.push(m),
      execFn: () => '   10\tA\n   5\tB\n   3\tC',
    });
    const parsed = JSON.parse(output[0]);
    expect(parsed.length).toBe(1);
  });

  test('default outputs formatted text', () => {
    const output = [];
    runContributors([], {
      log: m => output.push(m),
      execFn: () => '   7\tDev User',
    });
    expect(output[0]).toContain('CONTRIBUTOR STATS');
  });
});

// ── PERIOD_MAP ───────────────────────────────────────────────────────────────

describe('PERIOD_MAP', () => {
  test('contains expected units', () => {
    expect(PERIOD_MAP.d).toBe('days');
    expect(PERIOD_MAP.w).toBe('weeks');
    expect(PERIOD_MAP.m).toBe('months');
    expect(PERIOD_MAP.y).toBe('years');
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    expect(getHelpText()).toContain('CONTRIBUTOR STATS');
  });
});
