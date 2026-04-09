/**
 * Tests for Environment Info & Diagnostics Export Command Module
 *
 * @module tests/cli/env
 * @story 11.4 — Environment Info & Diagnostics Export
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-env-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/env/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getReportPath', () => {
  test('returns env-report.json path', () => {
    expect(mod.getReportPath()).toBe(path.join(tmpDir, '.aiox', 'env-report.json'));
  });
});

// ── Data Collectors ─────────────────────────────────────────────────────────

describe('getNodeVersion', () => {
  test('returns process.version', () => {
    expect(mod.getNodeVersion()).toBe(process.version);
  });
});

describe('getNpmVersion', () => {
  test('returns a version string or null', () => {
    const result = mod.getNpmVersion();
    if (result !== null) {
      expect(result).toMatch(/\d+\.\d+/);
    }
  });
});

describe('getGitVersion', () => {
  test('returns a version string or null', () => {
    const result = mod.getGitVersion();
    if (result !== null) {
      expect(result).toMatch(/\d+\.\d+\.\d+/);
    }
  });
});

describe('getOsInfo', () => {
  test('returns platform, release, arch', () => {
    const info = mod.getOsInfo();
    expect(info.platform).toBe(os.platform());
    expect(info.release).toBe(os.release());
    expect(info.arch).toBe(os.arch());
  });
});

describe('getShell', () => {
  test('returns a string', () => {
    expect(typeof mod.getShell()).toBe('string');
  });
});

describe('getAioxVersion', () => {
  test('returns null when no package.json', () => {
    expect(mod.getAioxVersion()).toBeNull();
  });

  test('reads version from package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '5.0.0' }), 'utf8');
    expect(mod.getAioxVersion()).toBe('5.0.0');
  });
});

describe('getPluginCount', () => {
  test('returns 0 when no plugins dir', () => {
    expect(mod.getPluginCount()).toBe(0);
  });

  test('counts plugin directories', () => {
    const dir = path.join(tmpDir, '.aiox', 'plugins', 'foo');
    fs.mkdirSync(dir, { recursive: true });
    expect(mod.getPluginCount()).toBe(1);
  });
});

describe('getStoryCount', () => {
  test('returns 0 when no stories dir', () => {
    expect(mod.getStoryCount()).toBe(0);
  });

  test('counts .story.md files', () => {
    const dir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '1.1.story.md'), '', 'utf8');
    fs.writeFileSync(path.join(dir, '1.2.story.md'), '', 'utf8');
    fs.writeFileSync(path.join(dir, 'readme.md'), '', 'utf8');
    expect(mod.getStoryCount()).toBe(2);
  });
});

describe('collectEnvInfo', () => {
  test('returns all expected keys', () => {
    const info = mod.collectEnvInfo();
    expect(info).toHaveProperty('node');
    expect(info).toHaveProperty('npm');
    expect(info).toHaveProperty('git');
    expect(info).toHaveProperty('os');
    expect(info).toHaveProperty('shell');
    expect(info).toHaveProperty('aioxVersion');
    expect(info).toHaveProperty('pluginCount');
    expect(info).toHaveProperty('storyCount');
    expect(info).toHaveProperty('cwd');
    expect(info).toHaveProperty('timestamp');
  });
});

// ── Health Checks ───────────────────────────────────────────────────────────

describe('checkNodeVersion', () => {
  test('passes for current Node (>= 18)', () => {
    const result = mod.checkNodeVersion();
    const major = parseInt(process.version.slice(1).split('.')[0], 10);
    expect(result.ok).toBe(major >= 18);
  });
});

describe('checkGitAvailable', () => {
  test('returns ok with message', () => {
    const result = mod.checkGitAvailable();
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });
});

describe('checkNpmAvailable', () => {
  test('returns ok with message', () => {
    const result = mod.checkNpmAvailable();
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });
});

describe('checkAioxCore', () => {
  test('fails when .aiox-core missing', () => {
    const result = mod.checkAioxCore();
    expect(result.ok).toBe(false);
  });

  test('passes when .aiox-core exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox-core'), { recursive: true });
    const result = mod.checkAioxCore();
    expect(result.ok).toBe(true);
  });
});

describe('runHealthChecks', () => {
  test('returns array of check results', () => {
    const checks = mod.runHealthChecks();
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBe(4);
    for (const check of checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('ok');
      expect(check).toHaveProperty('message');
    }
  });
});

describe('runCheck', () => {
  test('catches errors in check function', () => {
    const result = mod.runCheck('fail', () => { throw new Error('boom'); });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('boom');
  });
});

// ── Display Helpers ─────────────────────────────────────────────────────────

describe('formatEnvInfo', () => {
  test('includes key labels', () => {
    const info = mod.collectEnvInfo();
    const str = mod.formatEnvInfo(info);
    expect(str).toContain('Node.js');
    expect(str).toContain('npm');
    expect(str).toContain('git');
    expect(str).toContain('OS');
    expect(str).toContain('Shell');
    expect(str).toContain('AIOX Version');
    expect(str).toContain('Plugins');
    expect(str).toContain('Stories');
  });
});

describe('formatHealthChecks', () => {
  test('shows PASS/FAIL and summary', () => {
    const checks = [
      { name: 'a', ok: true, message: 'good' },
      { name: 'b', ok: false, message: 'bad' },
    ];
    const str = mod.formatHealthChecks(checks);
    expect(str).toContain('[PASS]');
    expect(str).toContain('[FAIL]');
    expect(str).toContain('Some checks failed.');
  });

  test('shows all passed when all ok', () => {
    const checks = [{ name: 'a', ok: true, message: 'ok' }];
    const str = mod.formatHealthChecks(checks);
    expect(str).toContain('All checks passed.');
  });
});

// ── runEnv ──────────────────────────────────────────────────────────────────

describe('runEnv', () => {
  test('default shows env info', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEnv([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Node.js'));
    spy.mockRestore();
  });

  test('--export outputs JSON', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEnv(['--export']);
    const output = spy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('node');
    spy.mockRestore();
  });

  test('--check shows health checks', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEnv(['--check']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Health Checks'));
    spy.mockRestore();
  });

  test('--report creates report file', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runEnv(['--report']);
    expect(fs.existsSync(mod.getReportPath())).toBe(true);
    const report = JSON.parse(fs.readFileSync(mod.getReportPath(), 'utf8'));
    expect(report).toHaveProperty('node');
    expect(report).toHaveProperty('healthChecks');
    spy.mockRestore();
  });
});
