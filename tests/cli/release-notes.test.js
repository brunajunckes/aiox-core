/**
 * Tests for Release Notes Generator Command Module
 *
 * @module tests/cli/release-notes
 * @story 10.1 — Version Bump & Release Notes Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const mod = require('../../.aiox-core/cli/commands/release-notes/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

let consoleSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

// ── parseConventionalCommit ────────────────────────────────────────────────────

describe('parseConventionalCommit', () => {
  test('parses a standard feat commit', () => {
    const result = mod.parseConventionalCommit('feat: add new feature');
    expect(result).toEqual({ type: 'feat', scope: null, description: 'add new feature', breaking: false });
  });

  test('parses a scoped fix commit', () => {
    const result = mod.parseConventionalCommit('fix(cli): resolve parsing bug');
    expect(result).toEqual({ type: 'fix', scope: 'cli', description: 'resolve parsing bug', breaking: false });
  });

  test('parses a breaking change commit', () => {
    const result = mod.parseConventionalCommit('feat!: remove old API');
    expect(result).toEqual({ type: 'feat', scope: null, description: 'remove old API', breaking: true });
  });

  test('parses a scoped breaking change', () => {
    const result = mod.parseConventionalCommit('refactor(core)!: rewrite engine');
    expect(result).toEqual({ type: 'refactor', scope: 'core', description: 'rewrite engine', breaking: true });
  });

  test('returns null type for non-conventional message', () => {
    const result = mod.parseConventionalCommit('just a random commit message');
    expect(result.type).toBeNull();
    expect(result.description).toBe('just a random commit message');
  });

  test('handles docs type', () => {
    const result = mod.parseConventionalCommit('docs: update README');
    expect(result.type).toBe('docs');
    expect(result.description).toBe('update README');
  });
});

// ── categorizeCommits ──────────────────────────────────────────────────────────

describe('categorizeCommits', () => {
  test('categorizes commits by type', () => {
    const commits = [
      { hash: 'aaa1111', message: 'feat: add feature A' },
      { hash: 'bbb2222', message: 'fix: fix bug B' },
      { hash: 'ccc3333', message: 'feat: add feature C' },
    ];
    const categories = mod.categorizeCommits(commits);
    expect(categories.feat).toHaveLength(2);
    expect(categories.fix).toHaveLength(1);
  });

  test('puts non-conventional commits in other', () => {
    const commits = [
      { hash: 'ddd4444', message: 'random commit' },
    ];
    const categories = mod.categorizeCommits(commits);
    expect(categories.other).toHaveLength(1);
  });

  test('handles empty array', () => {
    const categories = mod.categorizeCommits([]);
    expect(Object.keys(categories)).toHaveLength(0);
  });

  test('handles unknown conventional types in other', () => {
    const commits = [
      { hash: 'eee5555', message: 'custom: something special' },
    ];
    const categories = mod.categorizeCommits(commits);
    expect(categories.other).toHaveLength(1);
  });
});

// ── formatMarkdown ─────────────────────────────────────────────────────────────

describe('formatMarkdown', () => {
  test('generates markdown with sections', () => {
    const categories = {
      feat: [{ hash: 'aaa1111bbb', scope: null, description: 'add feature', breaking: false }],
      fix: [{ hash: 'ccc3333ddd', scope: 'cli', description: 'fix bug', breaking: false }],
    };
    const md = mod.formatMarkdown(categories);
    expect(md).toContain('# Release Notes');
    expect(md).toContain('## Features');
    expect(md).toContain('## Bug Fixes');
    expect(md).toContain('add feature');
    expect(md).toContain('**cli:**');
    expect(md).toContain('(aaa1111)');
  });

  test('includes since tag', () => {
    const md = mod.formatMarkdown({ feat: [{ hash: 'abc1234567', scope: null, description: 'test', breaking: false }] }, { since: 'v1.0.0' });
    expect(md).toContain('v1.0.0');
  });

  test('marks breaking changes', () => {
    const categories = {
      feat: [{ hash: 'xyz9876543', scope: null, description: 'break stuff', breaking: true }],
    };
    const md = mod.formatMarkdown(categories);
    expect(md).toContain('**BREAKING**');
  });
});

// ── formatJSON ─────────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('generates valid JSON', () => {
    const categories = {
      feat: [{ hash: 'aaa1111bbb', scope: null, description: 'add feature', breaking: false }],
    };
    const json = mod.formatJSON(categories);
    const parsed = JSON.parse(json);
    expect(parsed.categories.feat).toHaveLength(1);
    expect(parsed.date).toBeDefined();
  });

  test('includes since field', () => {
    const json = mod.formatJSON({}, { since: 'v2.0.0' });
    const parsed = JSON.parse(json);
    expect(parsed.since).toBe('v2.0.0');
  });

  test('truncates hashes to 7 chars', () => {
    const categories = {
      fix: [{ hash: 'abcdef1234567890', scope: null, description: 'fix', breaking: false }],
    };
    const json = mod.formatJSON(categories);
    const parsed = JSON.parse(json);
    expect(parsed.categories.fix[0].hash).toBe('abcdef1');
  });
});

// ── getLatestTag ───────────────────────────────────────────────────────────────

describe('getLatestTag', () => {
  test('returns tag when exec succeeds', () => {
    const mockExec = jest.fn().mockReturnValue('v1.2.3\n');
    const tag = mod.getLatestTag({ execFn: mockExec });
    expect(tag).toBe('v1.2.3');
  });

  test('returns null when no tags exist', () => {
    const mockExec = jest.fn().mockImplementation(() => { throw new Error('no tags'); });
    const tag = mod.getLatestTag({ execFn: mockExec });
    expect(tag).toBeNull();
  });

  test('returns null for empty output', () => {
    const mockExec = jest.fn().mockReturnValue('');
    const tag = mod.getLatestTag({ execFn: mockExec });
    expect(tag).toBeNull();
  });
});

// ── getGitLog ──────────────────────────────────────────────────────────────────

describe('getGitLog', () => {
  test('parses git log output', () => {
    const mockExec = jest.fn().mockReturnValue('abc123|feat: add stuff\ndef456|fix: fix stuff\n');
    const log = mod.getGitLog('v1.0.0', { execFn: mockExec });
    expect(log).toHaveLength(2);
    expect(log[0].hash).toBe('abc123');
    expect(log[0].message).toBe('feat: add stuff');
  });

  test('returns empty array on error', () => {
    const mockExec = jest.fn().mockImplementation(() => { throw new Error('fail'); });
    const log = mod.getGitLog(null, { execFn: mockExec });
    expect(log).toEqual([]);
  });

  test('handles null since parameter', () => {
    const mockExec = jest.fn().mockReturnValue('abc123|msg\n');
    mod.getGitLog(null, { execFn: mockExec });
    expect(mockExec.mock.calls[0][0]).toContain('HEAD');
    expect(mockExec.mock.calls[0][0]).not.toContain('..');
  });
});

// ── runReleaseNotes ────────────────────────────────────────────────────────────

describe('runReleaseNotes', () => {
  test('shows help with --help', () => {
    mod.runReleaseNotes(['--help']);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  test('shows no commits message when log is empty', () => {
    const mockExec = jest.fn().mockImplementation(() => { throw new Error('fail'); });
    mod.runReleaseNotes([], { execFn: mockExec });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No commits found');
  });

  test('generates markdown by default', () => {
    const mockExec = jest.fn().mockImplementation((cmd) => {
      if (cmd.includes('describe')) throw new Error('no tags');
      return 'abc1234|feat: add feature\ndef5678|fix: fix bug\n';
    });
    mod.runReleaseNotes([], { execFn: mockExec });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('# Release Notes');
  });

  test('generates JSON with --format json', () => {
    const mockExec = jest.fn().mockImplementation((cmd) => {
      if (cmd.includes('describe')) return 'v1.0.0\n';
      return 'abc1234|feat: something\n';
    });
    mod.runReleaseNotes(['--format', 'json'], { execFn: mockExec });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.categories.feat).toBeDefined();
  });

  test('uses --since argument', () => {
    const mockExec = jest.fn().mockImplementation((cmd) => {
      if (cmd.includes('describe')) return 'v2.0.0\n';
      return 'abc1234|feat: thing\n';
    });
    mod.runReleaseNotes(['--since', 'v1.0.0'], { execFn: mockExec });
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('v1.0.0..HEAD'),
      expect.anything()
    );
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('CONVENTIONAL_TYPES has expected types', () => {
    expect(mod.CONVENTIONAL_TYPES.feat).toBe('Features');
    expect(mod.CONVENTIONAL_TYPES.fix).toBe('Bug Fixes');
  });

  test('TYPE_ORDER is an array', () => {
    expect(Array.isArray(mod.TYPE_ORDER)).toBe(true);
    expect(mod.TYPE_ORDER).toContain('feat');
  });
});
