/**
 * Tests for Governance Report Generator Command Module
 *
 * @module tests/cli/governance
 * @story 12.4 — Governance Report Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-governance-test-'));
  process.cwd = () => tmpDir;
  execSync.mockReset();
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/governance/index.js');

// ── getCodeOwnership ───────────────────────────────────────────────────────

describe('getCodeOwnership', () => {
  test('parses git log output', () => {
    execSync.mockReturnValue('  10 Alice\n   5 Bob\n   2 Charlie\n');
    const result = mod.getCodeOwnership(tmpDir);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ author: 'Alice', commits: 10 });
    expect(result[1]).toEqual({ author: 'Bob', commits: 5 });
  });

  test('returns empty array on git error', () => {
    execSync.mockImplementation(() => { throw new Error('not a git repo'); });
    const result = mod.getCodeOwnership(tmpDir);
    expect(result).toEqual([]);
  });

  test('handles empty output', () => {
    execSync.mockReturnValue('');
    const result = mod.getCodeOwnership(tmpDir);
    expect(result).toEqual([]);
  });
});

// ── getDependencyCount ─────────────────────────────────────────────────────

describe('getDependencyCount', () => {
  test('counts dependencies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { a: '1', b: '2' },
      devDependencies: { c: '1' },
    }));
    const result = mod.getDependencyCount(tmpDir);
    expect(result).toEqual({ dependencies: 2, devDependencies: 1, total: 3 });
  });

  test('returns zeros for missing package.json', () => {
    const result = mod.getDependencyCount(tmpDir);
    expect(result).toEqual({ dependencies: 0, devDependencies: 0, total: 0 });
  });

  test('handles no deps fields', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const result = mod.getDependencyCount(tmpDir);
    expect(result.total).toBe(0);
  });
});

// ── getCoverageSummary ─────────────────────────────────────────────────────

describe('getCoverageSummary', () => {
  test('reads coverage-summary.json', () => {
    const coverageDir = path.join(tmpDir, 'coverage');
    fs.mkdirSync(coverageDir, { recursive: true });
    fs.writeFileSync(path.join(coverageDir, 'coverage-summary.json'), JSON.stringify({
      total: {
        lines: { pct: 85.5 },
        branches: { pct: 72.3 },
        functions: { pct: 90.1 },
        statements: { pct: 88.0 },
      },
    }));
    const result = mod.getCoverageSummary(tmpDir);
    expect(result.lines).toBe(85.5);
    expect(result.branches).toBe(72.3);
    expect(result.functions).toBe(90.1);
    expect(result.statements).toBe(88.0);
  });

  test('returns null when no coverage report', () => {
    expect(mod.getCoverageSummary(tmpDir)).toBeNull();
  });
});

// ── getSecretScanSummary ───────────────────────────────────────────────────

describe('getSecretScanSummary', () => {
  test('returns scan results', () => {
    // Create a file with a secret for scanning
    fs.writeFileSync(path.join(tmpDir, 'config.js'), 'API_KEY = "sk_live_testkey12345678"\n');
    const result = mod.getSecretScanSummary(tmpDir);
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  test('returns clean for no secrets', () => {
    fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const x = 1;\n');
    const result = mod.getSecretScanSummary(tmpDir);
    expect(result.totalFindings).toBe(0);
  });
});

// ── getLicenseCompliance ───────────────────────────────────────────────────

describe('getLicenseCompliance', () => {
  test('returns compliant for MIT deps', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { lodash: '*' },
    }));
    const pkgDir = path.join(tmpDir, 'node_modules', 'lodash');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: 'lodash', version: '4.0.0', license: 'MIT',
    }));
    const result = mod.getLicenseCompliance(tmpDir);
    expect(result.compliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('returns non-compliant for GPL deps', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { 'gpl-pkg': '*' },
    }));
    const pkgDir = path.join(tmpDir, 'node_modules', 'gpl-pkg');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: 'gpl-pkg', version: '1.0.0', license: 'GPL-3.0',
    }));
    const result = mod.getLicenseCompliance(tmpDir);
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

// ── generateReport ─────────────────────────────────────────────────────────

describe('generateReport', () => {
  test('generates complete report', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { a: '1' },
    }));
    const pkgDir = path.join(tmpDir, 'node_modules', 'a');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: 'a', version: '1.0.0', license: 'MIT',
    }));
    fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const x = 1;\n');

    const report = mod.generateReport(tmpDir);
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('ownership');
    expect(report).toHaveProperty('dependencies');
    expect(report).toHaveProperty('coverage');
    expect(report).toHaveProperty('secrets');
    expect(report).toHaveProperty('licenses');
    expect(report).toHaveProperty('checks');
    expect(report).toHaveProperty('allPassing');
  });

  test('allPassing is true when everything is clean', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    // Create coverage
    const coverageDir = path.join(tmpDir, 'coverage');
    fs.mkdirSync(coverageDir, { recursive: true });
    fs.writeFileSync(path.join(coverageDir, 'coverage-summary.json'), JSON.stringify({
      total: { lines: { pct: 80 }, branches: { pct: 70 }, functions: { pct: 90 }, statements: { pct: 85 } },
    }));

    const report = mod.generateReport(tmpDir);
    expect(report.allPassing).toBe(true);
  });

  test('allPassing is false when secrets found', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    fs.writeFileSync(path.join(tmpDir, 'config.js'), 'API_KEY = "sk_live_testkey12345678"\n');

    const report = mod.generateReport(tmpDir);
    expect(report.checks.secretsClean).toBe(false);
    expect(report.allPassing).toBe(false);
  });
});

// ── formatConsole ──────────────────────────────────────────────────────────

describe('formatConsole', () => {
  test('includes all sections', () => {
    const report = {
      ownership: [{ author: 'Dev', commits: 10 }],
      dependencies: { dependencies: 5, devDependencies: 3, total: 8 },
      coverage: { lines: 80, branches: 70, functions: 90, statements: 85 },
      secrets: { totalFindings: 0, clean: true },
      licenses: { totalDependencies: 5, violations: [], compliant: true },
      checks: { secretsClean: true, licensesCompliant: true, hasCoverage: true, hasContributors: true },
      allPassing: true,
    };
    const output = mod.formatConsole(report);
    expect(output).toContain('Code Ownership');
    expect(output).toContain('Dependencies');
    expect(output).toContain('Test Coverage');
    expect(output).toContain('Security Scan');
    expect(output).toContain('License Compliance');
    expect(output).toContain('ALL PASSING');
  });

  test('shows no coverage message', () => {
    const report = {
      ownership: [],
      dependencies: { dependencies: 0, devDependencies: 0, total: 0 },
      coverage: null,
      secrets: { totalFindings: 0, clean: true },
      licenses: { totalDependencies: 0, violations: [], compliant: true },
      checks: { secretsClean: true, licensesCompliant: true, hasCoverage: false, hasContributors: false },
      allPassing: false,
    };
    const output = mod.formatConsole(report);
    expect(output).toContain('No coverage report');
  });

  test('shows ISSUES FOUND when not passing', () => {
    const report = {
      ownership: [],
      dependencies: { dependencies: 0, devDependencies: 0, total: 0 },
      coverage: null,
      secrets: { totalFindings: 2, clean: false },
      licenses: { totalDependencies: 0, violations: [], compliant: true },
      checks: { secretsClean: false, licensesCompliant: true, hasCoverage: false, hasContributors: false },
      allPassing: false,
    };
    const output = mod.formatConsole(report);
    expect(output).toContain('ISSUES FOUND');
  });
});

// ── formatJSON ─────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('returns valid JSON', () => {
    const report = { generatedAt: '2026-01-01', allPassing: true };
    const result = JSON.parse(mod.formatJSON(report));
    expect(result.allPassing).toBe(true);
  });
});

// ── runGovernance ──────────────────────────────────────────────────────────

describe('runGovernance', () => {
  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGovernance(['--help']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Governance Report'));
    spy.mockRestore();
  });

  test('generates text report', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGovernance([]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Governance Report'));
    spy.mockRestore();
  });

  test('exports to file', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGovernance(['--export']);
    const exportPath = path.join(tmpDir, '.aiox', 'governance-report.json');
    expect(fs.existsSync(exportPath)).toBe(true);
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    expect(exported).toHaveProperty('allPassing');
    spy.mockRestore();
  });

  test('ci mode exits 1 on failures', () => {
    execSync.mockReturnValue('');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    fs.writeFileSync(path.join(tmpDir, 'config.js'), 'API_KEY = "sk_live_testkey12345678"\n');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.exitCode = 0;
    mod.runGovernance(['--ci']);
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
    process.exitCode = 0;
  });

  test('json format outputs valid JSON', () => {
    execSync.mockReturnValue('  5 Dev\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runGovernance(['--format', 'json']);
    const output = spy.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
    spy.mockRestore();
  });
});

// ── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  test('HELP_TEXT is defined', () => {
    expect(mod.HELP_TEXT).toContain('Governance');
  });
});
