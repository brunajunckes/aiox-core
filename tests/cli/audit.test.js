/**
 * Tests for Dependency Audit & Security Scanner CLI command
 *
 * @story 7.2 — Dependency Audit & Security Scanner
 */

'use strict';

const { execSync } = require('child_process');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const {
  runNpmAudit,
  checkOutdated,
  runAuditFix,
  formatAuditReport,
  formatConsoleOutput,
  runAudit,
} = require('../../.aiox-core/cli/commands/audit/index.js');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const AUDIT_JSON_WITH_VULNS = JSON.stringify({
  vulnerabilities: {
    'lodash': {
      severity: 'high',
      range: '<=4.17.20',
      fixAvailable: true,
      via: [{ title: 'Prototype Pollution', url: 'https://npmjs.com/advisories/1673' }],
    },
    'minimist': {
      severity: 'critical',
      range: '<1.2.6',
      fixAvailable: true,
      via: [{ title: 'Prototype Pollution' }],
    },
    'debug': {
      severity: 'moderate',
      range: '<=2.6.8',
      fixAvailable: false,
      via: ['Regular Expression DoS'],
    },
  },
  metadata: {
    vulnerabilities: {
      critical: 1,
      high: 1,
      moderate: 1,
      low: 0,
      info: 0,
      total: 3,
    },
  },
});

const AUDIT_JSON_CLEAN = JSON.stringify({
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
  },
});

const OUTDATED_JSON = JSON.stringify({
  'express': { current: '4.17.1', wanted: '4.17.3', latest: '4.18.2', type: 'dependencies' },
  'jest': { current: '28.0.0', wanted: '28.1.3', latest: '29.7.0', type: 'devDependencies' },
  'chalk': { current: '4.1.0', wanted: '4.1.2', latest: '5.3.0', type: 'dependencies' },
});

const OUTDATED_JSON_EMPTY = JSON.stringify({});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockExecSync(cmdResponses) {
  execSync.mockImplementation((cmd) => {
    for (const [pattern, response] of Object.entries(cmdResponses)) {
      if (cmd.includes(pattern)) {
        if (response instanceof Error) {
          throw response;
        }
        return response;
      }
    }
    return '{}';
  });
}

function makeExecError(stdout) {
  const err = new Error('Command failed');
  err.stdout = stdout;
  err.status = 1;
  return err;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('audit command', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ── runNpmAudit ──────────────────────────────────────────────────────────

  describe('runNpmAudit', () => {
    test('parses clean audit output', () => {
      execSync.mockReturnValue(AUDIT_JSON_CLEAN);
      const result = runNpmAudit('/tmp');
      expect(result.severityCounts.critical).toBe(0);
      expect(result.severityCounts.high).toBe(0);
      expect(result.total).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('parses audit output with vulnerabilities', () => {
      execSync.mockReturnValue(AUDIT_JSON_WITH_VULNS);
      const result = runNpmAudit('/tmp');
      expect(result.severityCounts.critical).toBe(1);
      expect(result.severityCounts.high).toBe(1);
      expect(result.severityCounts.moderate).toBe(1);
      expect(result.total).toBe(3);
      expect(result.details).toHaveLength(3);
    });

    test('handles npm audit non-zero exit (vulnerabilities found)', () => {
      execSync.mockImplementation(() => {
        throw makeExecError(AUDIT_JSON_WITH_VULNS);
      });
      const result = runNpmAudit('/tmp');
      expect(result.severityCounts.critical).toBe(1);
      expect(result.details.length).toBeGreaterThan(0);
    });

    test('handles completely broken output gracefully', () => {
      execSync.mockImplementation(() => {
        throw makeExecError('not json at all');
      });
      const result = runNpmAudit('/tmp');
      expect(result.severityCounts.critical).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('handles empty stdout on error', () => {
      const err = new Error('ENOENT');
      err.stdout = '';
      err.output = [null, null];
      execSync.mockImplementation(() => { throw err; });
      const result = runNpmAudit('/tmp');
      expect(result.total).toBe(0);
    });

    test('sorts details by severity order', () => {
      execSync.mockReturnValue(AUDIT_JSON_WITH_VULNS);
      const result = runNpmAudit('/tmp');
      const sevs = result.details.map((d) => d.severity);
      expect(sevs).toEqual(['critical', 'high', 'moderate']);
    });

    test('extracts advisory titles from via objects', () => {
      execSync.mockReturnValue(AUDIT_JSON_WITH_VULNS);
      const result = runNpmAudit('/tmp');
      const critical = result.details.find((d) => d.name === 'minimist');
      expect(critical.advisories).toContain('Prototype Pollution');
    });

    test('uses cwd as default when no argument provided', () => {
      execSync.mockReturnValue(AUDIT_JSON_CLEAN);
      runNpmAudit();
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: process.cwd() })
      );
    });

    test('falls back to counting vulnerabilities when metadata missing', () => {
      const noMeta = JSON.stringify({
        vulnerabilities: {
          pkg1: { severity: 'high', range: '*', via: [] },
          pkg2: { severity: 'low', range: '*', via: [] },
        },
      });
      execSync.mockReturnValue(noMeta);
      const result = runNpmAudit('/tmp');
      expect(result.severityCounts.high).toBe(1);
      expect(result.severityCounts.low).toBe(1);
    });
  });

  // ── checkOutdated ────────────────────────────────────────────────────────

  describe('checkOutdated', () => {
    test('parses outdated packages', () => {
      execSync.mockReturnValue(OUTDATED_JSON);
      const result = checkOutdated('/tmp');
      expect(result.total).toBe(3);
      expect(result.packages[0].name).toBe('express');
      expect(result.packages[0].current).toBe('4.17.1');
      expect(result.packages[0].latest).toBe('4.18.2');
    });

    test('handles no outdated packages', () => {
      execSync.mockReturnValue(OUTDATED_JSON_EMPTY);
      const result = checkOutdated('/tmp');
      expect(result.total).toBe(0);
      expect(result.packages).toHaveLength(0);
    });

    test('handles non-zero exit from npm outdated', () => {
      execSync.mockImplementation(() => {
        throw makeExecError(OUTDATED_JSON);
      });
      const result = checkOutdated('/tmp');
      expect(result.total).toBe(3);
    });

    test('handles broken JSON from npm outdated', () => {
      execSync.mockImplementation(() => {
        throw makeExecError('invalid json');
      });
      const result = checkOutdated('/tmp');
      expect(result.total).toBe(0);
    });

    test('handles missing fields in outdated data', () => {
      const partial = JSON.stringify({
        'some-pkg': { current: '1.0.0' },
      });
      execSync.mockReturnValue(partial);
      const result = checkOutdated('/tmp');
      expect(result.packages[0].wanted).toBe('N/A');
      expect(result.packages[0].latest).toBe('N/A');
    });

    test('uses cwd default when no argument', () => {
      execSync.mockReturnValue(OUTDATED_JSON_EMPTY);
      checkOutdated();
      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: process.cwd() })
      );
    });
  });

  // ── runAuditFix ──────────────────────────────────────────────────────────

  describe('runAuditFix', () => {
    test('returns success on clean fix', () => {
      execSync.mockReturnValue('fixed 2 of 3 vulnerabilities');
      const result = runAuditFix('/tmp');
      expect(result.success).toBe(true);
      expect(result.output).toContain('fixed');
    });

    test('returns failure on error', () => {
      const err = new Error('audit fix failed');
      err.stdout = 'some partial output';
      execSync.mockImplementation(() => { throw err; });
      const result = runAuditFix('/tmp');
      expect(result.success).toBe(false);
      expect(result.output).toContain('some partial output');
    });

    test('handles error without stdout', () => {
      execSync.mockImplementation(() => { throw new Error('ENOENT'); });
      const result = runAuditFix('/tmp');
      expect(result.success).toBe(false);
      expect(result.output).toContain('ENOENT');
    });
  });

  // ── formatAuditReport ────────────────────────────────────────────────────

  describe('formatAuditReport', () => {
    test('generates markdown report with vulnerabilities and outdated', () => {
      const results = {
        audit: {
          severityCounts: { critical: 1, high: 2, moderate: 0, low: 0, info: 0 },
          details: [
            { name: 'pkg-a', severity: 'critical', range: '<1.0', fixAvailable: true, advisories: ['CVE-2026-001'] },
            { name: 'pkg-b', severity: 'high', range: '<2.0', fixAvailable: false, advisories: [] },
          ],
          total: 3,
        },
        outdated: {
          packages: [
            { name: 'express', current: '4.17.1', wanted: '4.17.3', latest: '4.18.2', type: 'dependencies' },
          ],
          total: 1,
        },
      };

      const report = formatAuditReport(results);
      expect(report).toContain('# AIOX Dependency Audit Report');
      expect(report).toContain('CRITICAL');
      expect(report).toContain('pkg-a');
      expect(report).toContain('CVE-2026-001');
      expect(report).toContain('express');
      expect(report).toContain('4.18.2');
      expect(report).toContain('Recommendations');
    });

    test('generates clean report when no issues', () => {
      const results = {
        audit: {
          severityCounts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          details: [],
          total: 0,
        },
        outdated: { packages: [], total: 0 },
      };

      const report = formatAuditReport(results);
      expect(report).toContain('No issues found');
      expect(report).not.toContain('Vulnerability Details');
    });

    test('includes date in report', () => {
      const results = {
        audit: { severityCounts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }, details: [], total: 0 },
        outdated: { packages: [], total: 0 },
      };
      const report = formatAuditReport(results);
      const today = new Date().toISOString().slice(0, 10);
      expect(report).toContain(today);
    });

    test('shows recommendations for critical and high vulns', () => {
      const results = {
        audit: {
          severityCounts: { critical: 2, high: 3, moderate: 0, low: 0, info: 0 },
          details: [],
          total: 5,
        },
        outdated: { packages: [], total: 0 },
      };
      const report = formatAuditReport(results);
      expect(report).toContain('2 critical vulnerabilities');
      expect(report).toContain('3 high-severity');
    });
  });

  // ── formatConsoleOutput ──────────────────────────────────────────────────

  describe('formatConsoleOutput', () => {
    test('shows vulnerability summary', () => {
      const results = {
        audit: {
          severityCounts: { critical: 1, high: 2, moderate: 3, low: 0, info: 0 },
          details: [
            { name: 'pkg-a', severity: 'critical', range: '<1.0', fixAvailable: true, advisories: ['CVE-X'] },
          ],
          total: 6,
        },
        outdated: { packages: [], total: 0 },
      };
      const output = formatConsoleOutput(results);
      expect(output).toContain('AIOX Security Audit');
      expect(output).toContain('1 critical');
      expect(output).toContain('2 high');
      expect(output).toContain('3 moderate');
    });

    test('shows none when no vulnerabilities', () => {
      const results = {
        audit: {
          severityCounts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          details: [],
          total: 0,
        },
        outdated: { packages: [], total: 0 },
      };
      const output = formatConsoleOutput(results);
      expect(output).toContain('None found');
    });

    test('shows outdated packages with counts', () => {
      const results = {
        audit: {
          severityCounts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          details: [],
          total: 0,
        },
        outdated: {
          packages: [
            { name: 'express', current: '4.17.1', wanted: '4.17.3', latest: '4.18.2', type: 'dependencies' },
          ],
          total: 1,
        },
      };
      const output = formatConsoleOutput(results);
      expect(output).toContain('1 package');
      expect(output).toContain('express: 4.17.1 -> 4.18.2');
    });

    test('truncates outdated list at 10 and shows remainder', () => {
      const packages = Array.from({ length: 15 }, (_, i) => ({
        name: `pkg-${i}`,
        current: '1.0.0',
        wanted: '1.1.0',
        latest: '2.0.0',
        type: 'dependencies',
      }));
      const results = {
        audit: {
          severityCounts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
          details: [],
          total: 0,
        },
        outdated: { packages, total: 15 },
      };
      const output = formatConsoleOutput(results);
      expect(output).toContain('... and 5 more');
    });

    test('shows details for critical and high only', () => {
      const results = {
        audit: {
          severityCounts: { critical: 1, high: 0, moderate: 1, low: 0, info: 0 },
          details: [
            { name: 'critical-pkg', severity: 'critical', range: '<1.0', fixAvailable: true, advisories: [] },
            { name: 'moderate-pkg', severity: 'moderate', range: '<2.0', fixAvailable: false, advisories: [] },
          ],
          total: 2,
        },
        outdated: { packages: [], total: 0 },
      };
      const output = formatConsoleOutput(results);
      expect(output).toContain('[CRITICAL] critical-pkg');
      expect(output).not.toContain('[MODERATE] moderate-pkg');
    });
  });

  // ── runAudit (CLI handler) ───────────────────────────────────────────────

  describe('runAudit', () => {
    test('--help shows help text', () => {
      runAudit(['--help']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AIOX Dependency Audit'));
    });

    test('-h shows help text', () => {
      runAudit(['-h']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });

    test('--fix runs npm audit fix on success', () => {
      execSync.mockReturnValue('fixed 0 vulnerabilities');
      runAudit(['--fix']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
    });

    test('--fix reports failure', () => {
      execSync.mockImplementation(() => { throw new Error('fix failed'); });
      runAudit(['--fix']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('encountered issues'));
    });

    test('--json outputs JSON', () => {
      mockExecSync({
        'npm audit': AUDIT_JSON_CLEAN,
        'npm outdated': OUTDATED_JSON_EMPTY,
      });
      runAudit(['--json']);
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('audit');
      expect(parsed).toHaveProperty('outdated');
    });

    test('report subcommand outputs markdown', () => {
      mockExecSync({
        'npm audit': AUDIT_JSON_CLEAN,
        'npm outdated': OUTDATED_JSON_EMPTY,
      });
      runAudit(['report']);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('# AIOX Dependency Audit Report'));
    });

    test('default (no args) outputs console format', () => {
      mockExecSync({
        'npm audit': AUDIT_JSON_CLEAN,
        'npm outdated': OUTDATED_JSON_EMPTY,
      });
      runAudit([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AIOX Security Audit'));
    });

    test('handles null argv', () => {
      mockExecSync({
        'npm audit': AUDIT_JSON_CLEAN,
        'npm outdated': OUTDATED_JSON_EMPTY,
      });
      runAudit(null);
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('handles undefined argv', () => {
      mockExecSync({
        'npm audit': AUDIT_JSON_CLEAN,
        'npm outdated': OUTDATED_JSON_EMPTY,
      });
      runAudit();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
