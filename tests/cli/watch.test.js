/**
 * Tests for Watch Mode for File Changes
 *
 * @module tests/cli/watch
 * @story 15.2 — Watch Mode for File Changes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseWatchArgs,
  matchesPattern,
  shouldIgnore,
  getWatchDirs,
  debounce,
  executeWatchCommand,
  startWatch,
  getHelpText,
  DEFAULT_DEBOUNCE,
  DEFAULT_COMMAND,
  DEFAULT_PATTERN,
  IGNORE_DIRS,
} = require('../../.aiox-core/cli/commands/watch/index.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-watch-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── parseWatchArgs ──────────────────────────────────────────────────────────

describe('parseWatchArgs', () => {
  test('returns defaults for empty args', () => {
    const result = parseWatchArgs([]);
    expect(result.command).toBe(DEFAULT_COMMAND);
    expect(result.pattern).toBe(DEFAULT_PATTERN);
    expect(result.debounce).toBe(DEFAULT_DEBOUNCE);
    expect(result.help).toBe(false);
  });

  test('parses --command', () => {
    const result = parseWatchArgs(['--command', 'npm run lint']);
    expect(result.command).toBe('npm run lint');
  });

  test('parses --pattern', () => {
    const result = parseWatchArgs(['--pattern', 'src/**/*.ts']);
    expect(result.pattern).toBe('src/**/*.ts');
  });

  test('parses --debounce', () => {
    const result = parseWatchArgs(['--debounce', '500']);
    expect(result.debounce).toBe(500);
  });

  test('sets help flag', () => {
    expect(parseWatchArgs(['--help']).help).toBe(true);
    expect(parseWatchArgs(['-h']).help).toBe(true);
  });

  test('ignores invalid debounce', () => {
    const result = parseWatchArgs(['--debounce', 'abc']);
    expect(result.debounce).toBe(DEFAULT_DEBOUNCE);
  });

  test('parses multiple flags', () => {
    const result = parseWatchArgs(['--command', 'lint', '--pattern', '*.ts', '--debounce', '200']);
    expect(result.command).toBe('lint');
    expect(result.pattern).toBe('*.ts');
    expect(result.debounce).toBe(200);
  });

  test('returns defaults for null', () => {
    const result = parseWatchArgs(null);
    expect(result.command).toBe(DEFAULT_COMMAND);
  });
});

// ── matchesPattern ──────────────────────────────────────────────────────────

describe('matchesPattern', () => {
  test('matches *.js pattern', () => {
    expect(matchesPattern('file.js', '*.js')).toBe(true);
    expect(matchesPattern('file.ts', '*.js')).toBe(false);
  });

  test('matches **/*.js pattern', () => {
    expect(matchesPattern('src/file.js', '**/*.js')).toBe(true);
    expect(matchesPattern('file.js', '**/*.js')).toBe(true);
  });

  test('handles backslash paths', () => {
    expect(matchesPattern('src\\file.js', '**/*.js')).toBe(true);
  });

  test('returns false for non-matching', () => {
    expect(matchesPattern('file.css', '*.js')).toBe(false);
  });
});

// ── shouldIgnore ────────────────────────────────────────────────────────────

describe('shouldIgnore', () => {
  test('ignores node_modules', () => {
    expect(shouldIgnore('node_modules/foo/bar.js')).toBe(true);
  });

  test('ignores .git', () => {
    expect(shouldIgnore('.git/objects/abc')).toBe(true);
  });

  test('does not ignore regular paths', () => {
    expect(shouldIgnore('src/index.js')).toBe(false);
  });

  test('ignores coverage dir', () => {
    expect(shouldIgnore('coverage/report.html')).toBe(true);
  });
});

// ── getWatchDirs ────────────────────────────────────────────────────────────

describe('getWatchDirs', () => {
  test('returns root dir for empty project', () => {
    const dirs = getWatchDirs(tmpDir);
    expect(dirs).toContain(tmpDir);
  });

  test('includes subdirectories', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.mkdirSync(path.join(tmpDir, 'lib'));
    const dirs = getWatchDirs(tmpDir);
    expect(dirs).toContain(path.join(tmpDir, 'src'));
    expect(dirs).toContain(path.join(tmpDir, 'lib'));
  });

  test('excludes node_modules', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    const dirs = getWatchDirs(tmpDir);
    expect(dirs).not.toContain(path.join(tmpDir, 'node_modules'));
  });

  test('handles nonexistent directory', () => {
    const dirs = getWatchDirs(path.join(tmpDir, 'nonexistent'));
    expect(dirs).toEqual([]);
  });
});

// ── debounce ────────────────────────────────────────────────────────────────

describe('debounce', () => {
  test('delays execution', (done) => {
    let called = 0;
    const fn = debounce(() => { called++; }, 50);
    fn();
    fn();
    fn();
    expect(called).toBe(0);
    setTimeout(() => {
      expect(called).toBe(1);
      done();
    }, 100);
  });

  test('cancel prevents execution', (done) => {
    let called = 0;
    const fn = debounce(() => { called++; }, 50);
    fn();
    fn.cancel();
    setTimeout(() => {
      expect(called).toBe(0);
      done();
    }, 100);
  });

  test('pending returns correct state', (done) => {
    const fn = debounce(() => {}, 50);
    expect(fn.pending()).toBe(false);
    fn();
    expect(fn.pending()).toBe(true);
    setTimeout(() => {
      expect(fn.pending()).toBe(false);
      done();
    }, 100);
  });
});

// ── executeWatchCommand ─────────────────────────────────────────────────────

describe('executeWatchCommand', () => {
  test('returns success for passing command', () => {
    const mockExec = jest.fn().mockReturnValue('output\n');
    const result = executeWatchCommand('echo hi', { execFn: mockExec });
    expect(result.success).toBe(true);
    expect(result.output).toBe('output\n');
  });

  test('returns failure for failing command', () => {
    const mockExec = jest.fn().mockImplementation(() => {
      const err = new Error('fail');
      err.stderr = 'error';
      throw err;
    });
    const result = executeWatchCommand('bad', { execFn: mockExec });
    expect(result.success).toBe(false);
    expect(result.error).toContain('error');
  });
});

// ── startWatch ──────────────────────────────────────────────────────────────

describe('startWatch', () => {
  test('creates watchers and stop function', () => {
    const mockWatcher = { close: jest.fn() };
    const mockWatchFn = jest.fn().mockReturnValue(mockWatcher);

    const { watchers, stop } = startWatch(
      { command: 'echo test', pattern: '**/*.js', debounce: 50 },
      { cwd: tmpDir, watchFn: mockWatchFn },
    );

    expect(watchers.length).toBeGreaterThanOrEqual(1);
    stop();
    expect(mockWatcher.close).toHaveBeenCalled();
  });

  test('stop clears all watchers', () => {
    const closeFn = jest.fn();
    const mockWatchFn = jest.fn().mockReturnValue({ close: closeFn });

    const { stop } = startWatch(
      { command: 'echo', pattern: '*.js', debounce: 50 },
      { cwd: tmpDir, watchFn: mockWatchFn },
    );

    stop();
    // Each watcher should have close called
    expect(closeFn).toHaveBeenCalled();
  });
});

// ── getHelpText ─────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const help = getHelpText();
    expect(help).toContain('WATCH MODE');
    expect(help).toContain('aiox watch');
    expect(help).toContain('--command');
    expect(help).toContain('--pattern');
    expect(help).toContain('--debounce');
  });
});

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  test('exports default values', () => {
    expect(DEFAULT_DEBOUNCE).toBe(300);
    expect(DEFAULT_COMMAND).toBe('npm test');
    expect(DEFAULT_PATTERN).toBe('**/*.js');
    expect(Array.isArray(IGNORE_DIRS)).toBe(true);
    expect(IGNORE_DIRS).toContain('node_modules');
  });
});
