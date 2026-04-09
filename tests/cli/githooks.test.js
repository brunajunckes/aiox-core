/**
 * Tests for Git Hooks Manager Command Module
 *
 * @module tests/cli/githooks
 * @story 12.3 — Git Hooks Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-githooks-test-'));
  process.cwd = () => tmpDir;
  // Create .git/hooks directory
  fs.mkdirSync(path.join(tmpDir, '.git', 'hooks'), { recursive: true });
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/githooks/index.js');

// ── getHooksDir ────────────────────────────────────────────────────────────

describe('getHooksDir', () => {
  test('returns .git/hooks inside cwd', () => {
    expect(mod.getHooksDir(tmpDir)).toBe(path.join(tmpDir, '.git', 'hooks'));
  });

  test('uses process.cwd when no arg', () => {
    expect(mod.getHooksDir()).toBe(path.join(tmpDir, '.git', 'hooks'));
  });
});

// ── isAioxHook ─────────────────────────────────────────────────────────────

describe('isAioxHook', () => {
  test('detects AIOX-managed hook', () => {
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, `#!/bin/sh\n${mod.AIOX_MARKER}\necho test\n`);
    expect(mod.isAioxHook(hookPath)).toBe(true);
  });

  test('returns false for non-AIOX hook', () => {
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, '#!/bin/sh\necho custom hook\n');
    expect(mod.isAioxHook(hookPath)).toBe(false);
  });

  test('returns false for nonexistent file', () => {
    expect(mod.isAioxHook(path.join(tmpDir, 'nonexistent'))).toBe(false);
  });
});

// ── listHooks ──────────────────────────────────────────────────────────────

describe('listHooks', () => {
  test('lists all standard hook types', () => {
    const hooks = mod.listHooks(tmpDir);
    expect(hooks.length).toBeGreaterThanOrEqual(7);
    expect(hooks.find(h => h.name === 'pre-commit')).toBeDefined();
    expect(hooks.find(h => h.name === 'pre-push')).toBeDefined();
  });

  test('detects installed hooks', () => {
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, `#!/bin/sh\n${mod.AIOX_MARKER}\n`, { mode: 0o755 });
    const hooks = mod.listHooks(tmpDir);
    const preCommit = hooks.find(h => h.name === 'pre-commit');
    expect(preCommit.exists).toBe(true);
    expect(preCommit.isAiox).toBe(true);
  });

  test('marks non-AIOX hooks correctly', () => {
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hookPath, '#!/bin/sh\necho custom\n', { mode: 0o755 });
    const hooks = mod.listHooks(tmpDir);
    const preCommit = hooks.find(h => h.name === 'pre-commit');
    expect(preCommit.exists).toBe(true);
    expect(preCommit.isAiox).toBe(false);
  });
});

// ── installHooks ───────────────────────────────────────────────────────────

describe('installHooks', () => {
  test('installs pre-commit and pre-push hooks', () => {
    const result = mod.installHooks(tmpDir);
    expect(result.installed).toContain('pre-commit');
    expect(result.installed).toContain('pre-push');
    expect(result.errors).toHaveLength(0);
    // Verify files exist
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-push'))).toBe(true);
  });

  test('hooks contain AIOX marker', () => {
    mod.installHooks(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(content).toContain(mod.AIOX_MARKER);
  });

  test('skips existing non-AIOX hooks', () => {
    fs.writeFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\ncustom\n');
    const result = mod.installHooks(tmpDir);
    expect(result.skipped).toContain('pre-commit');
    expect(result.installed).toContain('pre-push');
  });

  test('overwrites existing AIOX hooks', () => {
    fs.writeFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), `#!/bin/sh\n${mod.AIOX_MARKER}\nold\n`);
    const result = mod.installHooks(tmpDir);
    expect(result.installed).toContain('pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf8');
    expect(content).toContain('lint');
  });

  test('creates hooks dir if missing', () => {
    fs.rmSync(path.join(tmpDir, '.git', 'hooks'), { recursive: true });
    const result = mod.installHooks(tmpDir);
    expect(result.installed.length).toBeGreaterThan(0);
  });
});

// ── removeHooks ────────────────────────────────────────────────────────────

describe('removeHooks', () => {
  test('removes AIOX hooks', () => {
    mod.installHooks(tmpDir);
    const result = mod.removeHooks(tmpDir);
    expect(result.removed).toContain('pre-commit');
    expect(result.removed).toContain('pre-push');
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false);
  });

  test('skips non-AIOX hooks', () => {
    fs.writeFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\ncustom\n');
    const result = mod.removeHooks(tmpDir);
    expect(result.skipped).toContain('pre-commit');
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(true);
  });

  test('skips nonexistent hooks', () => {
    const result = mod.removeHooks(tmpDir);
    expect(result.skipped).toContain('pre-commit');
    expect(result.skipped).toContain('pre-push');
  });
});

// ── getStatus ──────────────────────────────────────────────────────────────

describe('getStatus', () => {
  test('returns status for all AIOX hooks', () => {
    const statuses = mod.getStatus(tmpDir);
    expect(statuses).toHaveLength(2);
    expect(statuses[0].name).toBe('pre-commit');
    expect(statuses[1].name).toBe('pre-push');
  });

  test('shows installed status', () => {
    mod.installHooks(tmpDir);
    const statuses = mod.getStatus(tmpDir);
    expect(statuses[0].installed).toBe(true);
    expect(statuses[0].isAiox).toBe(true);
    expect(statuses[0].content).toContain(mod.AIOX_MARKER);
  });

  test('shows not-installed status', () => {
    const statuses = mod.getStatus(tmpDir);
    expect(statuses[0].installed).toBe(false);
    expect(statuses[0].isAiox).toBe(false);
  });

  test('includes description', () => {
    const statuses = mod.getStatus(tmpDir);
    expect(statuses[0].description).toContain('lint');
    expect(statuses[1].description).toContain('test');
  });
});

// ── formatListConsole ──────────────────────────────────────────────────────

describe('formatListConsole', () => {
  test('formats hook list', () => {
    const hooks = [
      { name: 'pre-commit', exists: true, isAiox: true, executable: true },
      { name: 'pre-push', exists: false, isAiox: false, executable: false },
    ];
    const output = mod.formatListConsole(hooks);
    expect(output).toContain('pre-commit: AIOX');
    expect(output).toContain('pre-push: not installed');
  });
});

// ── formatStatusConsole ────────────────────────────────────────────────────

describe('formatStatusConsole', () => {
  test('formats status output', () => {
    const statuses = [
      { name: 'pre-commit', installed: true, isAiox: true, description: 'Runs lint' },
    ];
    const output = mod.formatStatusConsole(statuses);
    expect(output).toContain('Active (AIOX)');
    expect(output).toContain('Runs lint');
  });
});

// ── runGithooks ────────────────────────────────────────────────────────────

describe('runGithooks', () => {
  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGithooks(['--help']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Git Hooks Manager'));
    spy.mockRestore();
  });

  test('errors on unknown subcommand', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGithooks(['unknown']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
    spy.mockRestore();
    logSpy.mockRestore();
  });

  test('errors on no subcommand', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGithooks([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('specify a subcommand'));
    spy.mockRestore();
    logSpy.mockRestore();
  });
});

// ── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  test('AIOX_MARKER is defined', () => {
    expect(mod.AIOX_MARKER).toBe('# AIOX-MANAGED-HOOK');
  });

  test('HOOK_DEFINITIONS has pre-commit and pre-push', () => {
    expect(mod.HOOK_DEFINITIONS).toHaveProperty('pre-commit');
    expect(mod.HOOK_DEFINITIONS).toHaveProperty('pre-push');
  });

  test('pre-commit hook mentions lint', () => {
    expect(mod.HOOK_DEFINITIONS['pre-commit'].script).toContain('lint');
  });

  test('pre-push hook mentions test', () => {
    expect(mod.HOOK_DEFINITIONS['pre-push'].script).toContain('test');
  });
});
