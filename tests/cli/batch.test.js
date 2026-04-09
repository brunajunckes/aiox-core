/**
 * Tests for Batch File Operations
 *
 * @module tests/cli/batch
 * @story 15.4 — Batch File Operations
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  shouldIgnoreDir,
  collectFiles,
  matchGlob,
  findFilesByType,
  findFilesByGlob,
  batchRename,
  batchFind,
  batchReplace,
  batchCount,
  formatRenameResults,
  formatFindResults,
  formatReplaceResults,
  formatCountResults,
  parseBatchArgs,
  getHelpText,
  IGNORE_DIRS,
} = require('../../.aiox-core/cli/commands/batch/index.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-batch-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createFile(relPath, content = '') {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ── shouldIgnoreDir ─────────────────────────────────────────────────────────

describe('shouldIgnoreDir', () => {
  test('ignores node_modules', () => {
    expect(shouldIgnoreDir('node_modules')).toBe(true);
  });

  test('ignores .git', () => {
    expect(shouldIgnoreDir('.git')).toBe(true);
  });

  test('does not ignore src', () => {
    expect(shouldIgnoreDir('src')).toBe(false);
  });

  test('ignores all dirs in IGNORE_DIRS', () => {
    for (const dir of IGNORE_DIRS) {
      expect(shouldIgnoreDir(dir)).toBe(true);
    }
  });
});

// ── matchGlob ───────────────────────────────────────────────────────────────

describe('matchGlob', () => {
  test('matches *.js files', () => {
    expect(matchGlob('file.js', '*.js')).toBe(true);
    expect(matchGlob('file.ts', '*.js')).toBe(false);
  });

  test('matches *.test.js files', () => {
    expect(matchGlob('foo.test.js', '*.test.js')).toBe(true);
    expect(matchGlob('foo.js', '*.test.js')).toBe(false);
  });

  test('handles path with directories', () => {
    expect(matchGlob('src/foo.js', '*.js')).toBe(true);
  });
});

// ── collectFiles ────────────────────────────────────────────────────────────

describe('collectFiles', () => {
  test('collects files matching filter', () => {
    createFile('a.js', 'x');
    createFile('b.ts', 'y');
    const files = collectFiles(tmpDir, (fp, name) => name.endsWith('.js'));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('a.js');
  });

  test('collects recursively', () => {
    createFile('src/a.js', 'x');
    createFile('src/sub/b.js', 'y');
    const files = collectFiles(tmpDir, () => true);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  test('skips node_modules', () => {
    createFile('node_modules/pkg/index.js', 'x');
    createFile('src/a.js', 'y');
    const files = collectFiles(tmpDir, () => true);
    const inNodeModules = files.filter(f => f.includes('node_modules'));
    expect(inNodeModules).toHaveLength(0);
  });
});

// ── findFilesByType ─────────────────────────────────────────────────────────

describe('findFilesByType', () => {
  test('finds .js files', () => {
    createFile('a.js');
    createFile('b.ts');
    createFile('c.js');
    const files = findFilesByType(tmpDir, 'js');
    expect(files).toHaveLength(2);
  });

  test('finds files with dot prefix', () => {
    createFile('a.md');
    const files = findFilesByType(tmpDir, '.md');
    expect(files).toHaveLength(1);
  });
});

// ── findFilesByGlob ─────────────────────────────────────────────────────────

describe('findFilesByGlob', () => {
  test('finds files by glob', () => {
    createFile('a.test.js');
    createFile('b.test.js');
    createFile('c.js');
    const files = findFilesByGlob(tmpDir, '*.test.js');
    expect(files).toHaveLength(2);
  });
});

// ── batchRename ─────────────────────────────────────────────────────────────

describe('batchRename', () => {
  test('renames with prefix', () => {
    createFile('a.test.js');
    createFile('b.test.js');
    const results = batchRename(tmpDir, '*.test.js', { prefix: 'unit-' });
    expect(results).toHaveLength(2);
    expect(results.every(r => r.done)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'unit-a.test.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'unit-b.test.js'))).toBe(true);
  });

  test('renames with suffix', () => {
    createFile('app.js', 'content');
    const results = batchRename(tmpDir, '*.js', { suffix: '.bak' });
    expect(results).toHaveLength(1);
    expect(results[0].done).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'app.bak.js'))).toBe(true);
  });

  test('dry-run does not rename', () => {
    createFile('x.js');
    const results = batchRename(tmpDir, '*.js', { prefix: 'old-', dryRun: true });
    expect(results).toHaveLength(1);
    expect(results[0].done).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'x.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'old-x.js'))).toBe(false);
  });

  test('returns empty for no matches', () => {
    const results = batchRename(tmpDir, '*.xyz', { prefix: 'a-' });
    expect(results).toEqual([]);
  });
});

// ── batchFind ───────────────────────────────────────────────────────────────

describe('batchFind', () => {
  test('finds pattern in files', () => {
    createFile('a.js', 'line1\n// TODO fix this\nline3');
    createFile('b.js', 'no match here');
    const results = batchFind(tmpDir, 'TODO', 'js');
    expect(results).toHaveLength(1);
    expect(results[0].line).toBe(2);
    expect(results[0].content).toContain('TODO');
  });

  test('finds multiple matches in same file', () => {
    createFile('a.js', 'TODO one\nline\nTODO two');
    const results = batchFind(tmpDir, 'TODO', 'js');
    expect(results).toHaveLength(2);
  });

  test('returns empty when no matches', () => {
    createFile('a.js', 'clean code');
    const results = batchFind(tmpDir, 'HACK', 'js');
    expect(results).toEqual([]);
  });
});

// ── batchReplace ────────────────────────────────────────────────────────────

describe('batchReplace', () => {
  test('replaces text in files', () => {
    createFile('a.js', 'const old = 1;\nconst old = 2;');
    const results = batchReplace(tmpDir, 'old', 'newVar', '*.js');
    expect(results).toHaveLength(1);
    expect(results[0].replacements).toBe(2);
    expect(results[0].done).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'a.js'), 'utf8');
    expect(content).toContain('newVar');
    expect(content).not.toContain('old');
  });

  test('dry-run does not modify files', () => {
    createFile('a.js', 'const old = 1;');
    const results = batchReplace(tmpDir, 'old', 'new', '*.js', { dryRun: true });
    expect(results).toHaveLength(1);
    expect(results[0].done).toBe(false);
    const content = fs.readFileSync(path.join(tmpDir, 'a.js'), 'utf8');
    expect(content).toContain('old');
  });

  test('returns empty when no replacements needed', () => {
    createFile('a.js', 'clean code');
    const results = batchReplace(tmpDir, 'missing', 'new', '*.js');
    expect(results).toEqual([]);
  });
});

// ── batchCount ──────────────────────────────────────────────────────────────

describe('batchCount', () => {
  test('counts files by type', () => {
    createFile('a.js');
    createFile('b.js');
    createFile('c.ts');
    const result = batchCount(tmpDir, 'js');
    expect(result.count).toBe(2);
    expect(result.files).toHaveLength(2);
  });

  test('returns 0 for no matches', () => {
    const result = batchCount(tmpDir, 'py');
    expect(result.count).toBe(0);
  });
});

// ── Formatters ──────────────────────────────────────────────────────────────

describe('formatters', () => {
  test('formatRenameResults with results', () => {
    const results = [{ from: '/a/b.js', to: '/a/new-b.js', done: true }];
    const output = formatRenameResults(results, false);
    expect(output).toContain('1 files');
    expect(output).toContain('OK');
  });

  test('formatRenameResults with dry-run', () => {
    const results = [{ from: '/a/b.js', to: '/a/new-b.js', done: false }];
    const output = formatRenameResults(results, true);
    expect(output).toContain('DRY-RUN');
    expect(output).toContain('PREVIEW');
  });

  test('formatRenameResults with empty', () => {
    expect(formatRenameResults([], false)).toContain('No files matched');
  });

  test('formatFindResults with matches', () => {
    const results = [{ file: '/a/b.js', line: 5, content: '// TODO' }];
    const output = formatFindResults(results);
    expect(output).toContain('1 matches');
    expect(output).toContain('TODO');
  });

  test('formatFindResults empty', () => {
    expect(formatFindResults([])).toContain('No matches');
  });

  test('formatReplaceResults with results', () => {
    const results = [{ file: '/a/b.js', replacements: 3, done: true }];
    const output = formatReplaceResults(results, false);
    expect(output).toContain('3 replacements');
    expect(output).toContain('OK');
  });

  test('formatReplaceResults empty', () => {
    expect(formatReplaceResults([], false)).toContain('No replacements');
  });

  test('formatCountResults', () => {
    const output = formatCountResults({ count: 5, files: [] }, 'js');
    expect(output).toContain('5');
    expect(output).toContain('.js');
  });
});

// ── parseBatchArgs ──────────────────────────────────────────────────────────

describe('parseBatchArgs', () => {
  test('returns help for empty args', () => {
    expect(parseBatchArgs([]).help).toBe(true);
  });

  test('parses --dry-run flag', () => {
    const result = parseBatchArgs(['--dry-run', 'rename', '*.js', '--prefix', 'old-']);
    expect(result.dryRun).toBe(true);
    expect(result.sub).toBe('rename');
  });

  test('parses --prefix', () => {
    const result = parseBatchArgs(['rename', '*.js', '--prefix', 'test-']);
    expect(result.prefix).toBe('test-');
  });

  test('parses --type', () => {
    const result = parseBatchArgs(['count', '--type', 'js']);
    expect(result.type).toBe('js');
  });

  test('parses --glob', () => {
    const result = parseBatchArgs(['replace', 'old', 'new', '--glob', '*.js']);
    expect(result.glob).toBe('*.js');
  });

  test('parses subcommand and args', () => {
    const result = parseBatchArgs(['find', 'TODO', '--type', 'js']);
    expect(result.sub).toBe('find');
    expect(result.args).toEqual(['TODO']);
  });
});

// ── getHelpText ─────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const help = getHelpText();
    expect(help).toContain('BATCH FILE OPERATIONS');
    expect(help).toContain('aiox batch');
    expect(help).toContain('rename');
    expect(help).toContain('find');
    expect(help).toContain('replace');
    expect(help).toContain('count');
  });
});
