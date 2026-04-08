/**
 * Tests for Hooks Command Module
 *
 * @story 6.3 - Plugin Hook System
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Test helpers ─────────────────────────────────────────────────────────────

let tmpDir;
let originalCwd;

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-hooks-test-'));
}

beforeEach(() => {
  tmpDir = makeTmpDir();
  originalCwd = process.cwd();
  process.chdir(tmpDir);
  // Reset process.exitCode
  process.exitCode = undefined;
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Fresh require to pick up new cwd each time
function loadModule() {
  // Clear require cache so getHooksFile() re-evaluates process.cwd()
  const modPath = require.resolve('../../.aiox-core/cli/commands/hooks/index.js');
  delete require.cache[modPath];
  return require(modPath);
}

// ── EVENTS constant ──────────────────────────────────────────────────────────

describe('EVENTS', () => {
  test('exports all 6 expected events', () => {
    const mod = loadModule();
    expect(mod.EVENTS).toEqual([
      'pre-command',
      'post-command',
      'pre-commit',
      'post-test',
      'pre-push',
      'post-install',
    ]);
  });
});

// ── getHooksFile ─────────────────────────────────────────────────────────────

describe('getHooksFile', () => {
  test('returns path under .aiox/hooks.json in cwd', () => {
    const mod = loadModule();
    const result = mod.getHooksFile();
    expect(result).toBe(path.join(tmpDir, '.aiox', 'hooks.json'));
  });
});

// ── readHooks ────────────────────────────────────────────────────────────────

describe('readHooks', () => {
  test('returns empty hooks array when file missing', () => {
    const mod = loadModule();
    expect(mod.readHooks()).toEqual({ hooks: [] });
  });

  test('returns empty hooks array when file contains invalid JSON', () => {
    const mod = loadModule();
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hooks.json'), 'not json', 'utf8');
    expect(mod.readHooks()).toEqual({ hooks: [] });
  });

  test('returns empty hooks when JSON lacks hooks array', () => {
    const mod = loadModule();
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'hooks.json'), '{"hooks":"not-array"}', 'utf8');
    expect(mod.readHooks()).toEqual({ hooks: [] });
  });

  test('reads valid hooks file', () => {
    const mod = loadModule();
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    const data = { hooks: [{ id: 'hook-1', event: 'pre-push', command: 'echo hi', enabled: true }] };
    fs.writeFileSync(path.join(dir, 'hooks.json'), JSON.stringify(data), 'utf8');
    expect(mod.readHooks()).toEqual(data);
  });
});

// ── writeHooks ───────────────────────────────────────────────────────────────

describe('writeHooks', () => {
  test('creates .aiox directory and writes hooks file', () => {
    const mod = loadModule();
    const data = { hooks: [{ id: 'hook-x', event: 'pre-push', command: 'ls' }] };
    mod.writeHooks(data);
    const filePath = mod.getHooksFile();
    expect(fs.existsSync(filePath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(written).toEqual(data);
  });

  test('overwrites existing hooks file', () => {
    const mod = loadModule();
    mod.writeHooks({ hooks: [{ id: 'a' }] });
    mod.writeHooks({ hooks: [{ id: 'b' }] });
    const written = JSON.parse(fs.readFileSync(mod.getHooksFile(), 'utf8'));
    expect(written.hooks).toHaveLength(1);
    expect(written.hooks[0].id).toBe('b');
  });
});

// ── addHook ──────────────────────────────────────────────────────────────────

describe('addHook', () => {
  test('adds a hook with valid event and command', () => {
    const mod = loadModule();
    const result = mod.addHook('post-test', 'echo done');
    expect(result.ok).toBe(true);
    expect(result.hook).toBeDefined();
    expect(result.hook.event).toBe('post-test');
    expect(result.hook.command).toBe('echo done');
    expect(result.hook.enabled).toBe(true);
    expect(result.hook.id).toMatch(/^hook-\d+$/);
    expect(result.hook.createdAt).toBeDefined();
  });

  test('persists hook to disk', () => {
    const mod = loadModule();
    mod.addHook('pre-commit', 'npm run lint');
    const data = mod.readHooks();
    expect(data.hooks).toHaveLength(1);
    expect(data.hooks[0].command).toBe('npm run lint');
  });

  test('rejects empty event', () => {
    const mod = loadModule();
    expect(mod.addHook('', 'echo')).toEqual({ ok: false, error: 'Event is required.' });
    expect(mod.addHook(null, 'echo')).toEqual({ ok: false, error: 'Event is required.' });
  });

  test('rejects invalid event', () => {
    const mod = loadModule();
    const result = mod.addHook('bad-event', 'echo');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid event');
    expect(result.error).toContain('bad-event');
  });

  test('rejects empty command', () => {
    const mod = loadModule();
    expect(mod.addHook('pre-push', '').ok).toBe(false);
    expect(mod.addHook('pre-push', '   ').ok).toBe(false);
    expect(mod.addHook('pre-push', null).ok).toBe(false);
  });

  test('trims command whitespace', () => {
    const mod = loadModule();
    const result = mod.addHook('post-test', '  echo hello  ');
    expect(result.hook.command).toBe('echo hello');
  });

  test('respects enabled option set to false', () => {
    const mod = loadModule();
    const result = mod.addHook('pre-push', 'echo', { enabled: false });
    expect(result.hook.enabled).toBe(false);
  });

  test('adds multiple hooks', () => {
    const mod = loadModule();
    mod.addHook('pre-push', 'echo 1');
    mod.addHook('post-test', 'echo 2');
    mod.addHook('pre-command', 'echo 3');
    expect(mod.readHooks().hooks).toHaveLength(3);
  });
});

// ── removeHook ───────────────────────────────────────────────────────────────

describe('removeHook', () => {
  test('removes existing hook by ID', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('post-test', 'echo');
    expect(mod.removeHook(hook.id)).toEqual({ ok: true });
    expect(mod.readHooks().hooks).toHaveLength(0);
  });

  test('returns error for non-existent ID', () => {
    const mod = loadModule();
    const result = mod.removeHook('hook-nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('returns error for empty ID', () => {
    const mod = loadModule();
    expect(mod.removeHook('').ok).toBe(false);
    expect(mod.removeHook(null).ok).toBe(false);
  });

  test('only removes the targeted hook', () => {
    const mod = loadModule();
    const { hook: h1 } = mod.addHook('pre-push', 'echo 1');
    mod.addHook('post-test', 'echo 2');
    mod.removeHook(h1.id);
    const remaining = mod.readHooks().hooks;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].command).toBe('echo 2');
  });
});

// ── enableHook / disableHook ─────────────────────────────────────────────────

describe('enableHook', () => {
  test('enables a disabled hook', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('pre-push', 'echo', { enabled: false });
    expect(mod.enableHook(hook.id)).toEqual({ ok: true });
    const hooks = mod.readHooks().hooks;
    expect(hooks[0].enabled).toBe(true);
  });

  test('returns error for non-existent ID', () => {
    const mod = loadModule();
    expect(mod.enableHook('hook-nope').ok).toBe(false);
  });

  test('returns error for empty ID', () => {
    const mod = loadModule();
    expect(mod.enableHook('').ok).toBe(false);
  });
});

describe('disableHook', () => {
  test('disables an enabled hook', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('post-test', 'echo');
    expect(mod.disableHook(hook.id)).toEqual({ ok: true });
    const hooks = mod.readHooks().hooks;
    expect(hooks[0].enabled).toBe(false);
  });

  test('returns error for non-existent ID', () => {
    const mod = loadModule();
    expect(mod.disableHook('hook-nope').ok).toBe(false);
  });

  test('returns error for empty ID', () => {
    const mod = loadModule();
    expect(mod.disableHook('').ok).toBe(false);
  });
});

// ── listHooks ────────────────────────────────────────────────────────────────

describe('listHooks', () => {
  test('returns empty array when no hooks', () => {
    const mod = loadModule();
    expect(mod.listHooks()).toEqual([]);
  });

  test('returns all hooks', () => {
    const mod = loadModule();
    mod.addHook('pre-push', 'echo 1');
    mod.addHook('post-test', 'echo 2');
    expect(mod.listHooks()).toHaveLength(2);
  });

  test('filters by event', () => {
    const mod = loadModule();
    mod.addHook('pre-push', 'echo 1');
    mod.addHook('post-test', 'echo 2');
    mod.addHook('pre-push', 'echo 3');
    const filtered = mod.listHooks({ event: 'pre-push' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((h) => h.event === 'pre-push')).toBe(true);
  });

  test('returns empty array when event filter has no matches', () => {
    const mod = loadModule();
    mod.addHook('pre-push', 'echo');
    expect(mod.listHooks({ event: 'post-install' })).toHaveLength(0);
  });
});

// ── formatHooksList ──────────────────────────────────────────────────────────

describe('formatHooksList', () => {
  test('shows "No hooks" for empty list', () => {
    const mod = loadModule();
    expect(mod.formatHooksList([])).toBe('No hooks registered.');
  });

  test('formats hooks with status, event, command', () => {
    const mod = loadModule();
    const hooks = [
      { id: 'hook-1', event: 'pre-push', command: 'npm run lint', enabled: true, createdAt: '2026-04-08T16:00:00Z' },
      { id: 'hook-2', event: 'post-test', command: 'echo done', enabled: false, createdAt: '2026-04-08T17:00:00Z' },
    ];
    const output = mod.formatHooksList(hooks);
    expect(output).toContain('hook-1');
    expect(output).toContain('[enabled]');
    expect(output).toContain('pre-push');
    expect(output).toContain('npm run lint');
    expect(output).toContain('hook-2');
    expect(output).toContain('[disabled]');
  });
});

// ── formatEventsList ─────────────────────────────────────────────────────────

describe('formatEventsList', () => {
  test('lists all events', () => {
    const mod = loadModule();
    const output = mod.formatEventsList();
    expect(output).toContain('pre-command');
    expect(output).toContain('post-command');
    expect(output).toContain('pre-commit');
    expect(output).toContain('post-test');
    expect(output).toContain('pre-push');
    expect(output).toContain('post-install');
  });
});

// ── showHelp ─────────────────────────────────────────────────────────────────

describe('showHelp', () => {
  test('returns usage text with all subcommands', () => {
    const mod = loadModule();
    const help = mod.showHelp();
    expect(help).toContain('aiox hooks list');
    expect(help).toContain('aiox hooks add');
    expect(help).toContain('aiox hooks remove');
    expect(help).toContain('aiox hooks enable');
    expect(help).toContain('aiox hooks disable');
    expect(help).toContain('aiox hooks events');
  });
});

// ── runHooks CLI handler ─────────────────────────────────────────────────────

describe('runHooks', () => {
  let consoleSpy;
  let errorSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('shows help with no arguments', () => {
    const mod = loadModule();
    mod.runHooks([]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AIOX Hooks'));
  });

  test('shows help with --help', () => {
    const mod = loadModule();
    mod.runHooks(['--help']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('shows help with -h', () => {
    const mod = loadModule();
    mod.runHooks(['-h']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('list subcommand works', () => {
    const mod = loadModule();
    mod.runHooks(['list']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No hooks'));
  });

  test('add subcommand creates hook', () => {
    const mod = loadModule();
    mod.runHooks(['add', 'post-test', 'echo', 'done']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hook added'));
    expect(mod.readHooks().hooks).toHaveLength(1);
    expect(mod.readHooks().hooks[0].command).toBe('echo done');
  });

  test('add subcommand with missing args sets exitCode', () => {
    const mod = loadModule();
    mod.runHooks(['add']);
    expect(process.exitCode).toBe(1);
  });

  test('add subcommand with invalid event sets exitCode', () => {
    const mod = loadModule();
    mod.runHooks(['add', 'invalid-event', 'echo']);
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid event'));
  });

  test('remove subcommand removes hook', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('pre-push', 'echo');
    mod.runHooks(['remove', hook.id]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hook removed'));
    expect(mod.readHooks().hooks).toHaveLength(0);
  });

  test('remove subcommand with missing id sets exitCode', () => {
    const mod = loadModule();
    mod.runHooks(['remove']);
    expect(process.exitCode).toBe(1);
  });

  test('enable subcommand enables hook', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('pre-push', 'echo', { enabled: false });
    mod.runHooks(['enable', hook.id]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hook enabled'));
  });

  test('enable subcommand with missing id sets exitCode', () => {
    const mod = loadModule();
    mod.runHooks(['enable']);
    expect(process.exitCode).toBe(1);
  });

  test('disable subcommand disables hook', () => {
    const mod = loadModule();
    const { hook } = mod.addHook('pre-push', 'echo');
    mod.runHooks(['disable', hook.id]);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hook disabled'));
  });

  test('disable subcommand with missing id sets exitCode', () => {
    const mod = loadModule();
    mod.runHooks(['disable']);
    expect(process.exitCode).toBe(1);
  });

  test('events subcommand lists events', () => {
    const mod = loadModule();
    mod.runHooks(['events']);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('pre-command'));
  });

  test('unknown subcommand shows error and help', () => {
    const mod = loadModule();
    mod.runHooks(['bogus']);
    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown hooks subcommand'));
  });
});
