/**
 * Tests for Changelog Auto-Generator
 *
 * @module tests/cli/auto-changelog
 * @story 14.4 — Changelog Auto-Generator
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  getLatestTag,
  getCommitsSince,
  parseCommit,
  groupCommits,
  formatChangelog,
  formatJSON,
  writeChangelog,
  runAutoChangelog,
  getHelpText,
  CATEGORY_MAP,
  DISPLAY_ORDER,
} = require('../../.aiox-core/cli/commands/auto-changelog/index.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'auto-changelog-test-'));
}

// ── getLatestTag ─────────────────────────────────────────────────────────────

describe('getLatestTag', () => {
  test('returns tag from git', () => {
    const result = getLatestTag({ execFn: () => 'v1.0.0\n' });
    expect(result).toBe('v1.0.0');
  });

  test('returns null on error', () => {
    const result = getLatestTag({ execFn: () => { throw new Error('no tags'); } });
    expect(result).toBeNull();
  });

  test('returns null for empty output', () => {
    const result = getLatestTag({ execFn: () => '' });
    expect(result).toBeNull();
  });
});

// ── getCommitsSince ──────────────────────────────────────────────────────────

describe('getCommitsSince', () => {
  test('parses commit output', () => {
    const mockExec = () => 'abc123|feat: add feature\ndef456|fix: resolve bug';
    const result = getCommitsSince('v1.0.0', { execFn: mockExec });
    expect(result).toEqual([
      { hash: 'abc123', message: 'feat: add feature' },
      { hash: 'def456', message: 'fix: resolve bug' },
    ]);
  });

  test('uses HEAD range when since is null', () => {
    let captured = '';
    const mockExec = (cmd) => { captured = cmd; return ''; };
    getCommitsSince(null, { execFn: mockExec });
    expect(captured).toContain('HEAD');
    expect(captured).not.toContain('..');
  });

  test('uses since..HEAD range when since is provided', () => {
    let captured = '';
    const mockExec = (cmd) => { captured = cmd; return ''; };
    getCommitsSince('v1.0.0', { execFn: mockExec });
    expect(captured).toContain('v1.0.0..HEAD');
  });

  test('returns empty on error', () => {
    const result = getCommitsSince('v1', { execFn: () => { throw new Error(); } });
    expect(result).toEqual([]);
  });

  test('returns empty for empty output', () => {
    const result = getCommitsSince('v1', { execFn: () => '' });
    expect(result).toEqual([]);
  });
});

// ── parseCommit ──────────────────────────────────────────────────────────────

describe('parseCommit', () => {
  test('parses feat commit', () => {
    expect(parseCommit('feat: add feature')).toEqual({
      type: 'feat', scope: null, description: 'add feature', breaking: false,
    });
  });

  test('parses fix with scope', () => {
    expect(parseCommit('fix(cli): resolve bug')).toEqual({
      type: 'fix', scope: 'cli', description: 'resolve bug', breaking: false,
    });
  });

  test('parses breaking change', () => {
    expect(parseCommit('feat!: breaking change')).toEqual({
      type: 'feat', scope: null, description: 'breaking change', breaking: true,
    });
  });

  test('returns null type for non-conventional', () => {
    expect(parseCommit('random commit message')).toEqual({
      type: null, scope: null, description: 'random commit message', breaking: false,
    });
  });

  test('handles null message', () => {
    expect(parseCommit(null)).toEqual({
      type: null, scope: null, description: '', breaking: false,
    });
  });

  test('parses docs commit', () => {
    expect(parseCommit('docs: update readme')).toEqual({
      type: 'docs', scope: null, description: 'update readme', breaking: false,
    });
  });

  test('parses test commit', () => {
    expect(parseCommit('test: add unit tests')).toEqual({
      type: 'test', scope: null, description: 'add unit tests', breaking: false,
    });
  });
});

// ── groupCommits ─────────────────────────────────────────────────────────────

describe('groupCommits', () => {
  test('groups by category', () => {
    const commits = [
      { hash: 'a', message: 'feat: feature A' },
      { hash: 'b', message: 'fix: bug B' },
      { hash: 'c', message: 'feat: feature C' },
      { hash: 'd', message: 'random commit' },
    ];
    const groups = groupCommits(commits);
    expect(groups['Features'].length).toBe(2);
    expect(groups['Bug Fixes'].length).toBe(1);
    expect(groups['Other'].length).toBe(1);
  });

  test('handles empty commits', () => {
    expect(groupCommits([])).toEqual({});
  });
});

// ── formatChangelog ──────────────────────────────────────────────────────────

describe('formatChangelog', () => {
  test('formats groups as markdown', () => {
    const groups = {
      'Features': [{ hash: 'abc1234', scope: null, description: 'add X', breaking: false }],
      'Bug Fixes': [{ hash: 'def5678', scope: 'cli', description: 'fix Y', breaking: false }],
    };
    const output = formatChangelog(groups, { since: 'v1.0.0', date: '2026-04-08' });
    expect(output).toContain('# Changelog (since v1.0.0)');
    expect(output).toContain('## Features');
    expect(output).toContain('add X');
    expect(output).toContain('## Bug Fixes');
    expect(output).toContain('**cli:**');
  });

  test('shows no commits message when empty', () => {
    const output = formatChangelog({});
    expect(output).toContain('No conventional commits found');
  });

  test('marks breaking changes', () => {
    const groups = {
      'Features': [{ hash: 'a', scope: null, description: 'break it', breaking: true }],
    };
    const output = formatChangelog(groups);
    expect(output).toContain('[BREAKING]');
  });
});

// ── formatJSON ───────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('produces structured JSON', () => {
    const groups = { 'Features': [{ description: 'x' }] };
    const result = formatJSON(groups, { since: 'v1', date: '2026-01-01' });
    expect(result.since).toBe('v1');
    expect(result.date).toBe('2026-01-01');
    expect(result.categories).toBe(groups);
  });

  test('defaults since to null', () => {
    const result = formatJSON({});
    expect(result.since).toBeNull();
  });
});

// ── writeChangelog ───────────────────────────────────────────────────────────

describe('writeChangelog', () => {
  test('writes new changelog file', () => {
    let written = '';
    writeChangelog('/tmp/CHANGELOG.md', 'new content', {
      existsSync: () => false,
      writeFile: (_p, c) => { written = c; },
      readFile: () => '',
    });
    expect(written).toContain('new content');
  });

  test('prepends to existing changelog', () => {
    let written = '';
    writeChangelog('/tmp/CHANGELOG.md', 'new', {
      existsSync: () => true,
      readFile: () => 'old content',
      writeFile: (_p, c) => { written = c; },
    });
    expect(written).toContain('new');
    expect(written).toContain('old content');
  });
});

// ── runAutoChangelog ──────────────────────────────────────────────────────────

describe('runAutoChangelog', () => {
  test('--help shows help', () => {
    const output = [];
    runAutoChangelog(['--help'], { log: m => output.push(m) });
    expect(output[0]).toContain('CHANGELOG AUTO-GENERATOR');
  });

  test('--format json outputs JSON', () => {
    const output = [];
    runAutoChangelog(['--format', 'json'], {
      log: m => output.push(m),
      execFn: (cmd) => {
        if (cmd.includes('describe')) return 'v1.0.0\n';
        return 'abc|feat: feature X';
      },
    });
    const parsed = JSON.parse(output[0]);
    expect(parsed.categories['Features']).toBeDefined();
  });

  test('--since uses specific tag', () => {
    let capturedCmd = '';
    const output = [];
    runAutoChangelog(['--since', 'v5.0.0'], {
      log: m => output.push(m),
      execFn: (cmd) => {
        if (cmd.includes('log')) { capturedCmd = cmd; return ''; }
        return '';
      },
    });
    expect(capturedCmd).toContain('v5.0.0..HEAD');
  });

  test('--write writes to CHANGELOG.md', () => {
    const tmp = makeTmpDir();
    const output = [];
    runAutoChangelog(['--write'], {
      log: m => output.push(m),
      projectRoot: tmp,
      execFn: (cmd) => {
        if (cmd.includes('describe')) throw new Error('no tags');
        return 'abc|feat: added X';
      },
    });
    expect(output[0]).toContain('Changelog written to');
    expect(fs.existsSync(path.join(tmp, 'CHANGELOG.md'))).toBe(true);
  });

  test('default outputs markdown', () => {
    const output = [];
    runAutoChangelog([], {
      log: m => output.push(m),
      execFn: (cmd) => {
        if (cmd.includes('describe')) return 'v1\n';
        return 'a|fix: bug fix';
      },
    });
    expect(output[0]).toContain('Changelog');
  });
});

// ── CATEGORY_MAP ─────────────────────────────────────────────────────────────

describe('CATEGORY_MAP', () => {
  test('maps feat to Features', () => {
    expect(CATEGORY_MAP.feat).toBe('Features');
  });

  test('maps fix to Bug Fixes', () => {
    expect(CATEGORY_MAP.fix).toBe('Bug Fixes');
  });

  test('maps docs to Documentation', () => {
    expect(CATEGORY_MAP.docs).toBe('Documentation');
  });
});

// ── DISPLAY_ORDER ────────────────────────────────────────────────────────────

describe('DISPLAY_ORDER', () => {
  test('starts with Features', () => {
    expect(DISPLAY_ORDER[0]).toBe('Features');
  });

  test('contains Bug Fixes', () => {
    expect(DISPLAY_ORDER).toContain('Bug Fixes');
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    expect(getHelpText()).toContain('CHANGELOG AUTO-GENERATOR');
  });
});
