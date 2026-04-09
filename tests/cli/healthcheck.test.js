/**
 * Tests for Health Check Endpoint Command Module
 *
 * @module tests/cli/healthcheck
 * @story 16.4 — Health Check Endpoint
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-healthcheck-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/healthcheck/index.js');

// ── checkNodeVersion ─────────────────────────────────────────────────────────

describe('checkNodeVersion', () => {
  test('returns pass for current Node', () => {
    const result = mod.checkNodeVersion();
    expect(result.name).toBe('Node.js Version');
    expect(result.status).toBe('pass');
    expect(result.detail).toContain(process.version);
  });

  test('includes minimum version in detail', () => {
    const result = mod.checkNodeVersion();
    expect(result.detail).toContain('minimum: v18');
  });
});

// ── checkNpm ─────────────────────────────────────────────────────────────────

describe('checkNpm', () => {
  test('returns pass when npm is available', () => {
    const result = mod.checkNpm();
    expect(result.name).toBe('npm');
    expect(result.status).toBe('pass');
    expect(result.detail).toMatch(/^v\d+/);
  });
});

// ── checkGit ─────────────────────────────────────────────────────────────────

describe('checkGit', () => {
  test('returns pass when git is available', () => {
    const result = mod.checkGit();
    expect(result.name).toBe('git');
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('git version');
  });
});

// ── checkAioxCore ────────────────────────────────────────────────────────────

describe('checkAioxCore', () => {
  test('returns fail when .aiox-core missing', () => {
    const result = mod.checkAioxCore();
    expect(result.status).toBe('fail');
    expect(result.detail).toBe('not found');
  });

  test('returns pass when .aiox-core exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox-core'));
    const result = mod.checkAioxCore();
    expect(result.status).toBe('pass');
    expect(result.detail).toBe('found');
  });
});

// ── checkStoriesDir ──────────────────────────────────────────────────────────

describe('checkStoriesDir', () => {
  test('returns warn when stories dir missing', () => {
    const result = mod.checkStoriesDir();
    expect(result.status).toBe('warn');
  });

  test('returns pass with count when stories dir exists', () => {
    const dir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '1.1.story.md'), '# Test');
    fs.writeFileSync(path.join(dir, '1.2.story.md'), '# Test 2');
    const result = mod.checkStoriesDir();
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('2 stories');
  });
});

// ── checkTests ───────────────────────────────────────────────────────────────

describe('checkTests', () => {
  test('returns warn when no test config', () => {
    const result = mod.checkTests();
    expect(result.status).toBe('warn');
  });

  test('returns pass when jest.config.js exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'jest.config.js'), 'module.exports = {};');
    const result = mod.checkTests();
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('jest.config.js');
  });

  test('returns pass when package.json has test script', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'jest' } }),
    );
    const result = mod.checkTests();
    expect(result.status).toBe('pass');
  });
});

// ── checkDiskSpace ───────────────────────────────────────────────────────────

describe('checkDiskSpace', () => {
  test('returns an object with name and status', () => {
    const result = mod.checkDiskSpace();
    expect(result.name).toBe('Disk Space');
    expect(['pass', 'warn']).toContain(result.status);
    expect(result.detail).toBeDefined();
  });
});

// ── checkMemory ──────────────────────────────────────────────────────────────

describe('checkMemory', () => {
  test('returns memory stats', () => {
    const result = mod.checkMemory();
    expect(result.name).toBe('Memory');
    expect(['pass', 'warn']).toContain(result.status);
    expect(result.detail).toContain('GB free');
  });
});

// ── runAllChecks ─────────────────────────────────────────────────────────────

describe('runAllChecks', () => {
  test('returns checks array and summary', () => {
    const result = mod.runAllChecks();
    expect(result.checks).toBeDefined();
    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.checks.length).toBe(8);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.pass).toBe('number');
    expect(typeof result.summary.warn).toBe('number');
    expect(typeof result.summary.fail).toBe('number');
  });

  test('summary counts match checks', () => {
    const result = mod.runAllChecks();
    const total = result.summary.pass + result.summary.warn + result.summary.fail;
    expect(total).toBe(result.checks.length);
  });
});

// ── formatText ───────────────────────────────────────────────────────────────

describe('formatText', () => {
  test('formats text report', () => {
    const result = {
      checks: [
        { name: 'Test', status: 'pass', detail: 'ok' },
        { name: 'Test2', status: 'fail', detail: 'bad' },
      ],
      summary: { pass: 1, warn: 0, fail: 1 },
    };
    const text = mod.formatText(result);
    expect(text).toContain('AIOX HEALTH CHECK REPORT');
    expect(text).toContain('[PASS]');
    expect(text).toContain('[FAIL]');
    expect(text).toContain('Pass: 1');
    expect(text).toContain('Fail: 1');
    expect(text).toContain('FAILED');
  });

  test('shows all passed message', () => {
    const result = {
      checks: [{ name: 'A', status: 'pass', detail: 'ok' }],
      summary: { pass: 1, warn: 0, fail: 0 },
    };
    const text = mod.formatText(result);
    expect(text).toContain('All checks passed');
  });

  test('shows warnings message', () => {
    const result = {
      checks: [{ name: 'A', status: 'warn', detail: 'meh' }],
      summary: { pass: 0, warn: 1, fail: 0 },
    };
    const text = mod.formatText(result);
    expect(text).toContain('warnings');
  });
});

// ── formatJsonOutput ─────────────────────────────────────────────────────────

describe('formatJsonOutput', () => {
  test('returns valid JSON', () => {
    const result = {
      checks: [{ name: 'A', status: 'pass', detail: 'ok' }],
      summary: { pass: 1, warn: 0, fail: 0 },
    };
    const json = mod.formatJsonOutput(result);
    const parsed = JSON.parse(json);
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.checks).toHaveLength(1);
    expect(parsed.summary.pass).toBe(1);
  });
});

// ── HELP_TEXT ─────────────────────────────────────────────────────────────────

describe('HELP_TEXT', () => {
  test('is defined and contains usage info', () => {
    expect(mod.HELP_TEXT).toContain('HEALTH CHECK');
    expect(mod.HELP_TEXT).toContain('--json');
    expect(mod.HELP_TEXT).toContain('--ci');
  });
});
