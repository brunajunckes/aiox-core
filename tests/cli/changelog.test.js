/**
 * Changelog & Release Notes Generator — Tests
 *
 * @story 5.2 - Changelog & Release Notes Generator
 */

'use strict';

const {
  getLatestTag,
  getGitLog,
  parseConventionalCommit,
  groupByType,
  formatChangelog,
  formatJSON,
  runChangelog,
  getHelpText,
  CONVENTIONAL_TYPES,
  TYPE_ORDER,
} = require('../../.aiox-core/cli/commands/changelog/index.js');

// ── parseConventionalCommit ──────────────────────────────────────────────────

describe('parseConventionalCommit', () => {
  test('parses feat commit', () => {
    const result = parseConventionalCommit('feat: add changelog generator');
    expect(result).toEqual({
      type: 'feat',
      scope: null,
      description: 'add changelog generator',
      breaking: false,
    });
  });

  test('parses fix commit', () => {
    const result = parseConventionalCommit('fix: resolve null pointer');
    expect(result).toEqual({
      type: 'fix',
      scope: null,
      description: 'resolve null pointer',
      breaking: false,
    });
  });

  test('parses docs commit', () => {
    const result = parseConventionalCommit('docs: update README');
    expect(result).toEqual({
      type: 'docs',
      scope: null,
      description: 'update README',
      breaking: false,
    });
  });

  test('parses commit with scope', () => {
    const result = parseConventionalCommit('feat(cli): add palette command');
    expect(result).toEqual({
      type: 'feat',
      scope: 'cli',
      description: 'add palette command',
      breaking: false,
    });
  });

  test('parses breaking change with bang', () => {
    const result = parseConventionalCommit('feat!: remove legacy API');
    expect(result).toEqual({
      type: 'feat',
      scope: null,
      description: 'remove legacy API',
      breaking: true,
    });
  });

  test('parses breaking change with scope and bang', () => {
    const result = parseConventionalCommit('refactor(core)!: restructure modules');
    expect(result).toEqual({
      type: 'refactor',
      scope: 'core',
      description: 'restructure modules',
      breaking: true,
    });
  });

  test('parses breaking change in description', () => {
    const result = parseConventionalCommit('feat: BREAKING CHANGE drop Node 14');
    expect(result).toEqual({
      type: 'feat',
      scope: null,
      description: 'BREAKING CHANGE drop Node 14',
      breaking: true,
    });
  });

  test('returns null type for non-conventional commit', () => {
    const result = parseConventionalCommit('Update something');
    expect(result).toEqual({
      type: null,
      scope: null,
      description: 'Update something',
      breaking: false,
    });
  });

  test('returns null type for unknown conventional type', () => {
    const result = parseConventionalCommit('yolo: do something wild');
    expect(result).toEqual({
      type: null,
      scope: null,
      description: 'do something wild',
      breaking: false,
    });
  });

  test('handles empty string', () => {
    const result = parseConventionalCommit('');
    expect(result).toEqual({
      type: null,
      scope: null,
      description: '',
      breaking: false,
    });
  });

  test('handles null input', () => {
    const result = parseConventionalCommit(null);
    expect(result).toEqual({
      type: null,
      scope: null,
      description: '',
      breaking: false,
    });
  });

  test('handles undefined input', () => {
    const result = parseConventionalCommit(undefined);
    expect(result).toEqual({
      type: null,
      scope: null,
      description: '',
      breaking: false,
    });
  });

  test('parses all known conventional types', () => {
    const types = Object.keys(CONVENTIONAL_TYPES);
    for (const type of types) {
      const result = parseConventionalCommit(`${type}: test message`);
      expect(result.type).toBe(type);
    }
  });

  test('normalizes type to lowercase', () => {
    const result = parseConventionalCommit('FEAT: uppercase type');
    // Our regex uses \w+ then toLowerCase
    expect(result.type).toBe('feat');
    expect(result.description).toBe('uppercase type');
  });
});

// ── groupByType ──────────────────────────────────────────────────────────────

describe('groupByType', () => {
  test('groups commits by type', () => {
    const commits = [
      { hash: 'aaa', message: 'feat: feature one' },
      { hash: 'bbb', message: 'fix: bug fix' },
      { hash: 'ccc', message: 'feat: feature two' },
    ];
    const groups = groupByType(commits);
    expect(groups.feat).toHaveLength(2);
    expect(groups.fix).toHaveLength(1);
  });

  test('puts non-conventional commits under other', () => {
    const commits = [
      { hash: 'aaa', message: 'random message' },
      { hash: 'bbb', message: 'feat: proper commit' },
    ];
    const groups = groupByType(commits);
    expect(groups.other).toHaveLength(1);
    expect(groups.feat).toHaveLength(1);
  });

  test('handles empty array', () => {
    const groups = groupByType([]);
    expect(groups).toEqual({});
  });

  test('handles non-array input', () => {
    const groups = groupByType(null);
    expect(groups).toEqual({});
  });

  test('preserves hash and scope', () => {
    const commits = [
      { hash: 'abc123def', message: 'feat(cli): add command' },
    ];
    const groups = groupByType(commits);
    expect(groups.feat[0]).toEqual({
      hash: 'abc123def',
      scope: 'cli',
      description: 'add command',
      breaking: false,
    });
  });

  test('preserves breaking flag', () => {
    const commits = [
      { hash: 'abc', message: 'feat!: breaking feature' },
    ];
    const groups = groupByType(commits);
    expect(groups.feat[0].breaking).toBe(true);
  });
});

// ── formatChangelog ──────────────────────────────────────────────────────────

describe('formatChangelog', () => {
  test('formats markdown with sections', () => {
    const groups = {
      feat: [
        { hash: 'aaa', scope: null, description: 'add changelog', breaking: false },
      ],
      fix: [
        { hash: 'bbb', scope: null, description: 'resolve crash', breaking: false },
      ],
    };
    const md = formatChangelog(groups);
    expect(md).toContain('# Changelog');
    expect(md).toContain('## Features');
    expect(md).toContain('- add changelog');
    expect(md).toContain('## Bug Fixes');
    expect(md).toContain('- resolve crash');
  });

  test('includes scope as bold prefix', () => {
    const groups = {
      feat: [
        { hash: 'aaa', scope: 'cli', description: 'add command', breaking: false },
      ],
    };
    const md = formatChangelog(groups);
    expect(md).toContain('- **cli:** add command');
  });

  test('includes hash when option enabled', () => {
    const groups = {
      feat: [
        { hash: 'abcdef1234567', scope: null, description: 'feature', breaking: false },
      ],
    };
    const md = formatChangelog(groups, { includeHash: true });
    expect(md).toContain('(abcdef1)');
  });

  test('includes since reference in subtitle', () => {
    const groups = {
      feat: [
        { hash: 'aaa', scope: null, description: 'feature', breaking: false },
      ],
    };
    const md = formatChangelog(groups, { since: 'v1.0.0' });
    expect(md).toContain('Changes since `v1.0.0`');
  });

  test('shows no changes message for empty groups', () => {
    const md = formatChangelog({});
    expect(md).toContain('No changes found.');
  });

  test('uses custom title', () => {
    const md = formatChangelog({}, { title: 'Release Notes' });
    expect(md).toContain('# Release Notes');
  });

  test('marks breaking changes', () => {
    const groups = {
      feat: [
        { hash: 'aaa', scope: null, description: 'drop Node 14', breaking: true },
      ],
    };
    const md = formatChangelog(groups);
    expect(md).toContain('- **BREAKING** drop Node 14');
  });

  test('orders sections by TYPE_ORDER', () => {
    const groups = {
      fix: [{ hash: 'b', scope: null, description: 'fix', breaking: false }],
      feat: [{ hash: 'a', scope: null, description: 'feat', breaking: false }],
      docs: [{ hash: 'c', scope: null, description: 'docs', breaking: false }],
    };
    const md = formatChangelog(groups);
    const featIdx = md.indexOf('## Features');
    const fixIdx = md.indexOf('## Bug Fixes');
    const docsIdx = md.indexOf('## Documentation');
    expect(featIdx).toBeLessThan(fixIdx);
    expect(fixIdx).toBeLessThan(docsIdx);
  });

  test('puts other section last', () => {
    const groups = {
      other: [{ hash: 'x', scope: null, description: 'misc', breaking: false }],
      feat: [{ hash: 'a', scope: null, description: 'feat', breaking: false }],
    };
    const md = formatChangelog(groups);
    const featIdx = md.indexOf('## Features');
    const otherIdx = md.indexOf('## Other');
    expect(featIdx).toBeLessThan(otherIdx);
  });
});

// ── formatJSON ───────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('returns valid JSON string', () => {
    const groups = {
      feat: [{ hash: 'aaa', scope: null, description: 'feature', breaking: false }],
    };
    const json = formatJSON(groups);
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
    expect(parsed.sections).toBeDefined();
  });

  test('maps type keys to display names', () => {
    const groups = {
      feat: [{ hash: 'a', scope: null, description: 'x', breaking: false }],
      fix: [{ hash: 'b', scope: null, description: 'y', breaking: false }],
    };
    const parsed = JSON.parse(formatJSON(groups));
    expect(parsed.sections['Features']).toHaveLength(1);
    expect(parsed.sections['Bug Fixes']).toHaveLength(1);
  });

  test('includes since ref', () => {
    const parsed = JSON.parse(formatJSON({}, { since: 'v2.0.0' }));
    expect(parsed.since).toBe('v2.0.0');
  });

  test('includes generated timestamp', () => {
    const parsed = JSON.parse(formatJSON({}));
    expect(parsed.generated).toBeDefined();
    expect(new Date(parsed.generated).getTime()).not.toBeNaN();
  });

  test('includes commit details', () => {
    const groups = {
      feat: [{ hash: 'abc123', scope: 'cli', description: 'add cmd', breaking: true }],
    };
    const parsed = JSON.parse(formatJSON(groups));
    const item = parsed.sections['Features'][0];
    expect(item.hash).toBe('abc123');
    expect(item.scope).toBe('cli');
    expect(item.description).toBe('add cmd');
    expect(item.breaking).toBe(true);
  });
});

// ── getGitLog ────────────────────────────────────────────────────────────────

describe('getGitLog', () => {
  test('parses git log output', () => {
    const mockExec = () => 'abc123|feat: add feature\ndef456|fix: resolve bug\n';
    const result = getGitLog('v1.0.0', { execFn: mockExec });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ hash: 'abc123', message: 'feat: add feature' });
    expect(result[1]).toEqual({ hash: 'def456', message: 'fix: resolve bug' });
  });

  test('returns empty array on error', () => {
    const mockExec = () => { throw new Error('not a git repo'); };
    const result = getGitLog('v1.0.0', { execFn: mockExec });
    expect(result).toEqual([]);
  });

  test('returns empty array for empty output', () => {
    const mockExec = () => '';
    const result = getGitLog('v1.0.0', { execFn: mockExec });
    expect(result).toEqual([]);
  });

  test('handles messages with pipe characters', () => {
    const mockExec = () => 'abc123|feat: add x | y support\n';
    const result = getGitLog(null, { execFn: mockExec });
    expect(result[0].message).toBe('feat: add x | y support');
  });

  test('passes since ref in git command', () => {
    let capturedCmd = '';
    const mockExec = (cmd) => { capturedCmd = cmd; return ''; };
    getGitLog('v1.0.0', { execFn: mockExec });
    expect(capturedCmd).toContain('v1.0.0..HEAD');
  });

  test('uses HEAD when since is null', () => {
    let capturedCmd = '';
    const mockExec = (cmd) => { capturedCmd = cmd; return ''; };
    getGitLog(null, { execFn: mockExec });
    expect(capturedCmd).toContain(' HEAD');
    expect(capturedCmd).not.toContain('..HEAD');
  });
});

// ── getLatestTag ─────────────────────────────────────────────────────────────

describe('getLatestTag', () => {
  test('returns tag from git describe', () => {
    const mockExec = () => 'v2.1.0\n';
    expect(getLatestTag({ execFn: mockExec })).toBe('v2.1.0');
  });

  test('returns null when no tags', () => {
    const mockExec = () => { throw new Error('no tags'); };
    expect(getLatestTag({ execFn: mockExec })).toBeNull();
  });

  test('returns null for empty output', () => {
    const mockExec = () => '';
    expect(getLatestTag({ execFn: mockExec })).toBeNull();
  });
});

// ── runChangelog ──────────────────────────────────────────────────────────────

describe('runChangelog', () => {
  const mockGitLog = 'abc123|feat: add feature\ndef456|fix: resolve bug\nghi789|docs: update README\n';

  function makeMockExec(tagOutput, logOutput) {
    return (cmd) => {
      if (cmd.includes('describe --tags')) {
        if (tagOutput === null) throw new Error('no tags');
        return tagOutput;
      }
      return logOutput || '';
    };
  }

  test('generates markdown by default', () => {
    let output = '';
    const log = (msg) => { output = msg; };
    const execFn = makeMockExec('v1.0.0\n', mockGitLog);

    runChangelog([], { execFn, log });
    expect(output).toContain('# Changelog');
    expect(output).toContain('## Features');
    expect(output).toContain('## Bug Fixes');
  });

  test('generates JSON with --format json', () => {
    let output = '';
    const log = (msg) => { output = msg; };
    const execFn = makeMockExec('v1.0.0\n', mockGitLog);

    runChangelog(['--format', 'json'], { execFn, log });
    const parsed = JSON.parse(output);
    expect(parsed.sections).toBeDefined();
    expect(parsed.sections['Features']).toBeDefined();
  });

  test('uses --since ref', () => {
    let capturedCmd = '';
    const execFn = (cmd) => {
      if (cmd.includes('git log')) capturedCmd = cmd;
      return mockGitLog;
    };
    const log = () => {};

    runChangelog(['--since', 'v0.5.0'], { execFn, log });
    expect(capturedCmd).toContain('v0.5.0..HEAD');
  });

  test('falls back to all commits when no tag exists', () => {
    let capturedCmd = '';
    const execFn = (cmd) => {
      if (cmd.includes('describe --tags')) throw new Error('no tags');
      if (cmd.includes('git log')) { capturedCmd = cmd; return mockGitLog; }
      return '';
    };
    const log = () => {};

    runChangelog([], { execFn, log });
    expect(capturedCmd).toContain(' HEAD');
    expect(capturedCmd).not.toContain('..HEAD');
  });

  test('includes hashes with --hash flag', () => {
    let output = '';
    const log = (msg) => { output = msg; };
    const execFn = makeMockExec('v1.0.0\n', mockGitLog);

    runChangelog(['--hash'], { execFn, log });
    expect(output).toContain('(abc123)');
  });

  test('shows help with --help', () => {
    let output = '';
    const log = (msg) => { output = msg; };

    runChangelog(['--help'], { log });
    expect(output).toContain('AIOX Changelog Generator');
    expect(output).toContain('--since');
  });

  test('shows help with -h', () => {
    let output = '';
    const log = (msg) => { output = msg; };

    runChangelog(['-h'], { log });
    expect(output).toContain('AIOX Changelog Generator');
  });

  test('returns output string', () => {
    const execFn = makeMockExec('v1.0.0\n', mockGitLog);
    const result = runChangelog([], { execFn, log: () => {} });
    expect(typeof result).toBe('string');
    expect(result).toContain('# Changelog');
  });

  test('handles empty git history gracefully', () => {
    let output = '';
    const log = (msg) => { output = msg; };
    const execFn = makeMockExec('v1.0.0\n', '');

    runChangelog([], { execFn, log });
    expect(output).toContain('No changes found.');
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('CONVENTIONAL_TYPES has all expected types', () => {
    expect(CONVENTIONAL_TYPES.feat).toBe('Features');
    expect(CONVENTIONAL_TYPES.fix).toBe('Bug Fixes');
    expect(CONVENTIONAL_TYPES.docs).toBe('Documentation');
    expect(CONVENTIONAL_TYPES.refactor).toBe('Refactoring');
    expect(CONVENTIONAL_TYPES.test).toBe('Tests');
    expect(CONVENTIONAL_TYPES.chore).toBe('Chores');
    expect(CONVENTIONAL_TYPES.perf).toBe('Performance');
    expect(CONVENTIONAL_TYPES.ci).toBe('CI/CD');
  });

  test('TYPE_ORDER contains all CONVENTIONAL_TYPES keys', () => {
    for (const key of TYPE_ORDER) {
      expect(CONVENTIONAL_TYPES[key]).toBeDefined();
    }
  });

  test('getHelpText returns non-empty string', () => {
    expect(getHelpText().length).toBeGreaterThan(50);
  });
});
