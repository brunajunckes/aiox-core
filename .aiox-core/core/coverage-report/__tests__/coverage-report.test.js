/**
 * Test Suite: Coverage Report Module
 *
 * Tests for coverage analysis, threshold checking, uncovered file detection,
 * and text/JSON report generation.
 *
 * @test coverage-report.test.js
 * @story 9.2 — Test Coverage Reporting & Enforcement
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseCoverageJson,
  calculateSummary,
  checkThresholds,
  getUncoveredFiles,
  generateTextReport,
  generateJsonReport,
  DEFAULT_THRESHOLDS,
} = require('../coverage-analyzer');

// ── Test Data ────────────────────────────────────────────────────────────────

const mockCoverageData = {
  'src/index.js': {
    statements: { pct: 85.5 },
    branches: { pct: 80.2 },
    functions: { pct: 90.0 },
    lines: { pct: 85.5 },
  },
  'src/utils.js': {
    statements: { pct: 65.0 },
    branches: { pct: 50.0 },
    functions: { pct: 70.0 },
    lines: { pct: 65.0 },
  },
  'src/legacy.js': {
    statements: { pct: 40.0 },
    branches: { pct: 30.0 },
    functions: { pct: 35.0 },
    lines: { pct: 40.0 },
  },
  'total': {
    statements: { pct: 63.5 },
    branches: { pct: 53.4 },
    functions: { pct: 65.0 },
    lines: { pct: 63.5 },
  },
};

const mockCoverageDataGood = {
  'src/index.js': {
    statements: { pct: 95.5 },
    branches: { pct: 92.2 },
    functions: { pct: 98.0 },
    lines: { pct: 95.5 },
  },
  'total': {
    statements: { pct: 95.5 },
    branches: { pct: 92.2 },
    functions: { pct: 98.0 },
    lines: { pct: 95.5 },
  },
};

const mockCoverageDataEmpty = {
  'total': {
    statements: { pct: 0 },
    branches: { pct: 0 },
    functions: { pct: 0 },
    lines: { pct: 0 },
  },
};

// ── Test Suites ──────────────────────────────────────────────────────────────

describe('coverage-analyzer', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ── parseCoverageJson ────────────────────────────────────────────────────

  describe('parseCoverageJson', () => {
    it('should parse a valid coverage JSON file', () => {
      const filePath = path.join(tempDir, 'coverage.json');
      fs.writeFileSync(filePath, JSON.stringify(mockCoverageData));

      const result = parseCoverageJson(filePath);
      expect(result).toEqual(mockCoverageData);
    });

    it('should return null if file does not exist', () => {
      const filePath = path.join(tempDir, 'nonexistent.json');
      const result = parseCoverageJson(filePath);
      expect(result).toBeNull();
    });

    it('should throw error on invalid JSON', () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, 'invalid json content');

      expect(() => {
        parseCoverageJson(filePath);
      }).toThrow('Failed to parse coverage JSON');
    });

    it('should handle empty JSON object', () => {
      const filePath = path.join(tempDir, 'empty.json');
      fs.writeFileSync(filePath, '{}');

      const result = parseCoverageJson(filePath);
      expect(result).toEqual({});
    });

    it('should parse coverage with all metrics present', () => {
      const filePath = path.join(tempDir, 'full.json');
      fs.writeFileSync(filePath, JSON.stringify(mockCoverageDataGood));

      const result = parseCoverageJson(filePath);
      expect(result.total.statements.pct).toBe(95.5);
      expect(result.total.branches.pct).toBe(92.2);
      expect(result.total.functions.pct).toBe(98.0);
      expect(result.total.lines.pct).toBe(95.5);
    });
  });

  // ── calculateSummary ─────────────────────────────────────────────────────

  describe('calculateSummary', () => {
    it('should extract total coverage from coverage data', () => {
      const summary = calculateSummary(mockCoverageData);
      expect(summary).toEqual({
        statements: 63.5,
        branches: 53.4,
        functions: 65.0,
        lines: 63.5,
      });
    });

    it('should return zero values when total is missing', () => {
      const data = { 'src/index.js': mockCoverageData['src/index.js'] };
      const summary = calculateSummary(data);
      expect(summary).toEqual({
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      });
    });

    it('should handle null/undefined input', () => {
      const summary = calculateSummary(null);
      expect(summary).toEqual({
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      });
    });

    it('should handle missing metrics in total', () => {
      const data = {
        'total': {
          statements: { pct: 80.0 },
          // branches, functions, lines missing
        },
      };
      const summary = calculateSummary(data);
      expect(summary.statements).toBe(80.0);
      expect(summary.branches).toBe(0);
      expect(summary.functions).toBe(0);
      expect(summary.lines).toBe(0);
    });

    it('should handle zero coverage', () => {
      const summary = calculateSummary(mockCoverageDataEmpty);
      expect(summary).toEqual({
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      });
    });

    it('should handle high coverage', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      expect(summary.statements).toBeGreaterThan(90);
      expect(summary.branches).toBeGreaterThan(90);
      expect(summary.functions).toBeGreaterThan(90);
      expect(summary.lines).toBeGreaterThan(90);
    });
  });

  // ── checkThresholds ──────────────────────────────────────────────────────

  describe('checkThresholds', () => {
    it('should return passed: false when below default thresholds', () => {
      const summary = calculateSummary(mockCoverageData);
      const result = checkThresholds(summary);
      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
    });

    it('should return passed: true when above default thresholds', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      const result = checkThresholds(summary);
      expect(result.passed).toBe(true);
      expect(result.failures.length).toBe(0);
    });

    it('should check all four metrics', () => {
      const summary = calculateSummary(mockCoverageData);
      const result = checkThresholds(summary);
      const metrics = result.failures.map(f => f.metric);
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should identify specific failed metrics', () => {
      const summary = calculateSummary(mockCoverageData);
      const result = checkThresholds(summary);
      const failedMetrics = result.failures.map(f => f.metric);
      expect(failedMetrics).toContain('statements');
      expect(failedMetrics).toContain('branches');
    });

    it('should use custom thresholds', () => {
      const summary = { statements: 75, branches: 70, functions: 75, lines: 75 };
      const customThresholds = { statements: 80, branches: 70, functions: 75, lines: 75 };
      const result = checkThresholds(summary, customThresholds);
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'statements')).toBe(true);
    });

    it('should pass with custom thresholds at boundary', () => {
      const summary = { statements: 75, branches: 70, functions: 75, lines: 75 };
      const customThresholds = { statements: 75, branches: 70, functions: 75, lines: 75 };
      const result = checkThresholds(summary, customThresholds);
      expect(result.passed).toBe(true);
    });

    it('should include failure details', () => {
      const summary = calculateSummary(mockCoverageData);
      const result = checkThresholds(summary);
      const failure = result.failures[0];
      expect(failure).toHaveProperty('metric');
      expect(failure).toHaveProperty('actual');
      expect(failure).toHaveProperty('threshold');
    });

    it('should handle zero coverage', () => {
      const summary = calculateSummary(mockCoverageDataEmpty);
      const result = checkThresholds(summary);
      expect(result.passed).toBe(false);
      expect(result.failures.length).toBe(4); // All metrics fail
    });
  });

  // ── getUncoveredFiles ────────────────────────────────────────────────────

  describe('getUncoveredFiles', () => {
    it('should identify files below default threshold', () => {
      const uncovered = getUncoveredFiles(mockCoverageData, 70, 'lines');
      expect(uncovered.length).toBeGreaterThan(0);
      expect(uncovered.some(f => f.file.includes('utils.js'))).toBe(true);
      expect(uncovered.some(f => f.file.includes('legacy.js'))).toBe(true);
    });

    it('should exclude total entry', () => {
      const uncovered = getUncoveredFiles(mockCoverageData, 70, 'lines');
      expect(uncovered.every(f => f.file !== 'total')).toBe(true);
    });

    it('should sort by coverage ascending', () => {
      const uncovered = getUncoveredFiles(mockCoverageData, 70, 'lines');
      for (let i = 0; i < uncovered.length - 1; i++) {
        expect(uncovered[i].coverage).toBeLessThanOrEqual(uncovered[i + 1].coverage);
      }
    });

    it('should use custom threshold', () => {
      const uncovered = getUncoveredFiles(mockCoverageData, 80, 'lines');
      expect(uncovered.length).toBeGreaterThan(
        getUncoveredFiles(mockCoverageData, 50, 'lines').length
      );
    });

    it('should check different metrics', () => {
      const uncoveredLines = getUncoveredFiles(mockCoverageData, 70, 'lines');
      const uncoveredBranches = getUncoveredFiles(mockCoverageData, 70, 'branches');
      expect(uncoveredLines.length).toBeLessThanOrEqual(uncoveredBranches.length);
    });

    it('should handle empty coverage data', () => {
      const uncovered = getUncoveredFiles({}, 70, 'lines');
      expect(uncovered).toEqual([]);
    });

    it('should return empty array if no files below threshold', () => {
      const uncovered = getUncoveredFiles(mockCoverageDataGood, 90, 'lines');
      expect(uncovered.length).toBe(0);
    });

    it('should include coverage percentage in result', () => {
      const uncovered = getUncoveredFiles(mockCoverageData, 70, 'lines');
      expect(uncovered[0]).toHaveProperty('file');
      expect(uncovered[0]).toHaveProperty('coverage');
      expect(typeof uncovered[0].coverage).toBe('number');
    });
  });

  // ── generateTextReport ───────────────────────────────────────────────────

  describe('generateTextReport', () => {
    it('should generate a text report with all metrics', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(report).toContain('statements');
      expect(report).toContain('branches');
      expect(report).toContain('functions');
      expect(report).toContain('lines');
    });

    it('should show PASS status for metrics above threshold', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      const report = generateTextReport(summary);
      expect(report).toContain('PASS');
    });

    it('should show FAIL status for metrics below threshold', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(report).toContain('FAIL');
    });

    it('should include threshold values', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(report).toContain('70');
      expect(report).toContain('60');
    });

    it('should include actual coverage values', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(report).toContain('63.5');
      expect(report).toContain('53.4');
    });

    it('should use custom thresholds in report', () => {
      const summary = { statements: 75, branches: 70, functions: 75, lines: 75 };
      const customThresholds = { statements: 80, branches: 70, functions: 75, lines: 75 };
      const report = generateTextReport(summary, customThresholds);
      expect(report).toContain('80');
      expect(report).toContain('FAIL'); // statements should fail
    });

    it('should format percentages correctly', () => {
      const summary = { statements: 85.5, branches: 90.2, functions: 87.123, lines: 89.999 };
      const report = generateTextReport(summary);
      expect(report).toMatch(/85\.\d%/);
    });

    it('should include result summary message', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      const report = generateTextReport(summary);
      expect(report).toContain('All thresholds met');
    });

    it('should report when thresholds are not met', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(report).toMatch(/\d+ threshold.*below/);
    });

    it('should return a string', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateTextReport(summary);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  // ── generateJsonReport ───────────────────────────────────────────────────

  describe('generateJsonReport', () => {
    it('should generate JSON with timestamp', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      expect(report).toHaveProperty('timestamp');
      expect(typeof report.timestamp).toBe('string');
    });

    it('should include summary metrics', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      expect(report.summary).toEqual(summary);
    });

    it('should include thresholds', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      expect(report.thresholds).toEqual(DEFAULT_THRESHOLDS);
    });

    it('should include passed status', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      const report = generateJsonReport(summary);
      expect(report.passed).toBe(true);
    });

    it('should include failures array', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      expect(Array.isArray(report.failures)).toBe(true);
    });

    it('should use custom thresholds', () => {
      const summary = { statements: 75, branches: 70, functions: 75, lines: 75 };
      const customThresholds = { statements: 80, branches: 70, functions: 75, lines: 75 };
      const report = generateJsonReport(summary, customThresholds);
      expect(report.thresholds).toEqual(customThresholds);
    });

    it('should be valid JSON serializable', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      const json = JSON.stringify(report);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(report);
    });

    it('should include failure details when failed', () => {
      const summary = calculateSummary(mockCoverageData);
      const report = generateJsonReport(summary);
      if (report.failures.length > 0) {
        const failure = report.failures[0];
        expect(failure).toHaveProperty('metric');
        expect(failure).toHaveProperty('actual');
        expect(failure).toHaveProperty('threshold');
      }
    });

    it('should have empty failures when passed', () => {
      const summary = calculateSummary(mockCoverageDataGood);
      const report = generateJsonReport(summary);
      expect(report.failures.length).toBe(0);
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle coverage data with missing pct fields', () => {
      const data = {
        'src/index.js': {
          statements: {},
          branches: { pct: 80 },
        },
        'total': {
          statements: { pct: 0 },
          branches: { pct: 80 },
        },
      };
      const summary = calculateSummary(data);
      expect(summary.statements).toBe(0);
      expect(summary.branches).toBe(80);
    });

    it('should handle NaN values gracefully', () => {
      const summary = { statements: NaN, branches: 70, functions: 75, lines: 75 };
      const report = generateTextReport(summary);
      expect(typeof report).toBe('string');
    });

    it('should handle very high coverage values', () => {
      const summary = { statements: 99.99, branches: 99.99, functions: 100, lines: 100 };
      const result = checkThresholds(summary);
      expect(result.passed).toBe(true);
    });

    it('should handle very low coverage values', () => {
      const summary = { statements: 0.01, branches: 0.01, functions: 0, lines: 0 };
      const result = checkThresholds(summary);
      expect(result.passed).toBe(false);
    });

    it('should handle mixed high and low coverage', () => {
      const summary = { statements: 95, branches: 35, functions: 85, lines: 95 };
      const result = checkThresholds(summary);
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.metric === 'branches')).toBe(true);
    });

    it('should maintain precision in floating point calculations', () => {
      const summary = { statements: 70.0, branches: 70.0, functions: 70.0, lines: 70.0 };
      const result = checkThresholds(summary, { statements: 70, branches: 70, functions: 70, lines: 70 });
      expect(result.passed).toBe(true);
    });
  });

  // ── Integration Tests ────────────────────────────────────────────────────

  describe('integration', () => {
    it('should process full coverage workflow', () => {
      const filePath = path.join(tempDir, 'coverage.json');
      fs.writeFileSync(filePath, JSON.stringify(mockCoverageData));

      const data = parseCoverageJson(filePath);
      const summary = calculateSummary(data);
      const result = checkThresholds(summary);
      const uncovered = getUncoveredFiles(data);

      expect(data).toBeTruthy();
      expect(summary).toBeTruthy();
      expect(result).toBeTruthy();
      expect(uncovered).toBeTruthy();
    });

    it('should generate consistent reports', () => {
      const summary = calculateSummary(mockCoverageData);
      const report1 = generateJsonReport(summary);
      const report2 = generateJsonReport(summary);

      expect(report1.summary).toEqual(report2.summary);
      expect(report1.thresholds).toEqual(report2.thresholds);
      expect(report1.passed).toBe(report2.passed);
      expect(report1.failures.length).toBe(report2.failures.length);
    });

    it('should handle entire coverage workflow with good coverage', () => {
      const filePath = path.join(tempDir, 'coverage.json');
      fs.writeFileSync(filePath, JSON.stringify(mockCoverageDataGood));

      const data = parseCoverageJson(filePath);
      const summary = calculateSummary(data);
      const result = checkThresholds(summary);

      expect(result.passed).toBe(true);
    });
  });
});
