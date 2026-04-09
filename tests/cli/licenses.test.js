/**
 * Tests for Dependency License Checker Command Module
 *
 * @module tests/cli/licenses
 * @story 12.2 — Dependency License Checker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-licenses-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/licenses/index.js');

// ── Helper to create mock packages ─────────────────────────────────────────

function createMockPackage(name, license, version) {
  version = version || '1.0.0';
  const pkgDir = path.join(tmpDir, 'node_modules', name);
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
    name,
    version,
    license,
  }));
}

function createPackageJson(deps, devDeps) {
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: deps || {},
    devDependencies: devDeps || {},
  }));
}

// ── readPackageJson ────────────────────────────────────────────────────────

describe('readPackageJson', () => {
  test('reads dependencies from package.json', () => {
    createPackageJson({ lodash: '^4.0.0' }, { jest: '^29.0.0' });
    const result = mod.readPackageJson(tmpDir);
    expect(result.dependencies).toEqual({ lodash: '^4.0.0' });
    expect(result.devDependencies).toEqual({ jest: '^29.0.0' });
  });

  test('returns empty objects when no package.json', () => {
    const result = mod.readPackageJson(tmpDir);
    expect(result.dependencies).toEqual({});
    expect(result.devDependencies).toEqual({});
  });

  test('handles missing dependency fields', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const result = mod.readPackageJson(tmpDir);
    expect(result.dependencies).toEqual({});
    expect(result.devDependencies).toEqual({});
  });
});

// ── getPackageLicense ──────────────────────────────────────────────────────

describe('getPackageLicense', () => {
  test('reads MIT license', () => {
    createMockPackage('lodash', 'MIT', '4.17.21');
    const result = mod.getPackageLicense('lodash', tmpDir);
    expect(result).toEqual({ name: 'lodash', license: 'MIT', version: '4.17.21' });
  });

  test('handles object license format', () => {
    const pkgDir = path.join(tmpDir, 'node_modules', 'old-pkg');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: 'old-pkg',
      version: '1.0.0',
      license: { type: 'ISC', url: 'https://example.com' },
    }));
    const result = mod.getPackageLicense('old-pkg', tmpDir);
    expect(result.license).toBe('ISC');
  });

  test('returns UNKNOWN for missing package', () => {
    const result = mod.getPackageLicense('nonexistent', tmpDir);
    expect(result.license).toBe('UNKNOWN');
  });

  test('returns UNKNOWN for missing license field', () => {
    const pkgDir = path.join(tmpDir, 'node_modules', 'no-license');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'no-license', version: '1.0.0' }));
    const result = mod.getPackageLicense('no-license', tmpDir);
    expect(result.license).toBe('UNKNOWN');
  });
});

// ── collectLicenses ────────────────────────────────────────────────────────

describe('collectLicenses', () => {
  test('collects all dependency licenses', () => {
    createPackageJson({ lodash: '*', express: '*' });
    createMockPackage('lodash', 'MIT');
    createMockPackage('express', 'MIT');
    const licenses = mod.collectLicenses(tmpDir);
    expect(licenses).toHaveLength(2);
    expect(licenses[0].name).toBe('express');
    expect(licenses[1].name).toBe('lodash');
  });

  test('includes devDependencies', () => {
    createPackageJson({}, { jest: '*' });
    createMockPackage('jest', 'MIT');
    const licenses = mod.collectLicenses(tmpDir);
    expect(licenses).toHaveLength(1);
    expect(licenses[0].name).toBe('jest');
  });

  test('returns empty for no deps', () => {
    createPackageJson();
    expect(mod.collectLicenses(tmpDir)).toHaveLength(0);
  });
});

// ── checkLicenses ──────────────────────────────────────────────────────────

describe('checkLicenses', () => {
  test('passes for all MIT licenses', () => {
    const licenses = [
      { name: 'a', license: 'MIT', version: '1.0.0' },
      { name: 'b', license: 'ISC', version: '1.0.0' },
    ];
    const result = mod.checkLicenses(licenses);
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('fails for GPL license', () => {
    const licenses = [
      { name: 'a', license: 'MIT', version: '1.0.0' },
      { name: 'b', license: 'GPL-3.0', version: '1.0.0' },
    ];
    const result = mod.checkLicenses(licenses);
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].name).toBe('b');
  });

  test('skips UNKNOWN licenses', () => {
    const licenses = [
      { name: 'a', license: 'UNKNOWN', version: '1.0.0' },
    ];
    const result = mod.checkLicenses(licenses);
    expect(result.ok).toBe(true);
  });

  test('uses custom allowed list', () => {
    const licenses = [
      { name: 'a', license: 'MIT', version: '1.0.0' },
      { name: 'b', license: 'ISC', version: '1.0.0' },
    ];
    const result = mod.checkLicenses(licenses, ['MIT']);
    expect(result.ok).toBe(false);
    expect(result.violations[0].name).toBe('b');
  });
});

// ── isNonPermissive ────────────────────────────────────────────────────────

describe('isNonPermissive', () => {
  test('GPL-3.0 is non-permissive', () => {
    expect(mod.isNonPermissive('GPL-3.0')).toBe(true);
  });

  test('AGPL-3.0 is non-permissive', () => {
    expect(mod.isNonPermissive('AGPL-3.0')).toBe(true);
  });

  test('MIT is permissive', () => {
    expect(mod.isNonPermissive('MIT')).toBe(false);
  });

  test('Apache-2.0 is permissive', () => {
    expect(mod.isNonPermissive('Apache-2.0')).toBe(false);
  });
});

// ── formatConsole ──────────────────────────────────────────────────────────

describe('formatConsole', () => {
  test('shows no deps message', () => {
    expect(mod.formatConsole([])).toContain('No dependencies');
  });

  test('lists licenses', () => {
    const licenses = [{ name: 'lodash', license: 'MIT', version: '4.17.21' }];
    const output = mod.formatConsole(licenses);
    expect(output).toContain('lodash@4.17.21');
    expect(output).toContain('MIT');
  });

  test('flags non-permissive', () => {
    const licenses = [{ name: 'gpl-pkg', license: 'GPL-3.0', version: '1.0.0' }];
    const output = mod.formatConsole(licenses);
    expect(output).toContain('NON-PERMISSIVE');
  });
});

// ── formatJSON ─────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('returns valid JSON', () => {
    const result = JSON.parse(mod.formatJSON([]));
    expect(result.totalDependencies).toBe(0);
    expect(result).toHaveProperty('checkedAt');
  });

  test('includes check result when provided', () => {
    const check = { ok: true, violations: [] };
    const result = JSON.parse(mod.formatJSON([], check));
    expect(result.check).toEqual(check);
  });
});

// ── runLicenses ────────────────────────────────────────────────────────────

describe('runLicenses', () => {
  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runLicenses(['--help']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('License Checker'));
    spy.mockRestore();
  });

  test('lists licenses', () => {
    createPackageJson({ lodash: '*' });
    createMockPackage('lodash', 'MIT');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runLicenses([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('lodash'));
    spy.mockRestore();
  });

  test('check mode exits 1 on violation', () => {
    createPackageJson({ 'gpl-pkg': '*' });
    createMockPackage('gpl-pkg', 'GPL-3.0');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = 0;
    mod.runLicenses(['--check']);
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });
});

// ── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  test('DEFAULT_ALLOWED includes MIT', () => {
    expect(mod.DEFAULT_ALLOWED).toContain('MIT');
  });

  test('NON_PERMISSIVE includes GPL variants', () => {
    expect(mod.NON_PERMISSIVE).toContain('GPL-3.0');
    expect(mod.NON_PERMISSIVE).toContain('AGPL-3.0');
  });
});
