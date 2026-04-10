/**
 * Coverage Analyzer Module
 *
 * Parses Jest coverage JSON files, calculates summaries, checks thresholds,
 * and identifies uncovered files.
 *
 * @module core/coverage-report/coverage-analyzer
 * @version 1.0.0
 * @story 9.2 — Test Coverage Reporting & Enforcement
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = {
  statements: 70,
  branches: 60,
  functions: 70,
  lines: 70,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if a value is a valid percentage number.
 * @param {*} val
 * @returns {boolean}
 */
function isValidPct(val) {
  return typeof val === 'number' && !isNaN(val) && val >= 0 && val <= 100;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse Jest coverage JSON file.
 *
 * Reads and parses a coverage-summary.json file, extracting module-level
 * coverage percentages for statements, branches, functions, and lines.
 *
 * @param {string} jsonPath - Path to coverage-summary.json
 * @returns {object|null} Parsed coverage data or null if file not found/parse error
 *
 * @example
 * const data = parseCoverageJson('./coverage/coverage-summary.json');
 * // Returns: {
 * //   'src/index.js': { statements: { pct: 85.5 }, ... },
 * //   'src/utils.js': { statements: { pct: 92.0 }, ... },
 * //   'total': { statements: { pct: 87.2 }, ... }
 * // }
 */
function parseCoverageJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse coverage JSON: ${error.message}`);
  }
}

/**
 * Calculate coverage summary from parsed coverage data.
 *
 * Extracts the 'total' coverage metrics and returns a summary object
 * with statements, branches, functions, and lines percentages.
 *
 * @param {object} coverageData - Output from parseCoverageJson()
 * @returns {object} Summary with structure: { statements: %, branches: %, functions: %, lines: % }
 *
 * @example
 * const summary = calculateSummary(coverageData);
 * // Returns: { statements: 87.2, branches: 82.1, functions: 90.5, lines: 87.5 }
 */
function calculateSummary(coverageData) {
  if (!coverageData || !coverageData.total) {
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };
  }

  const total = coverageData.total;
  return {
    statements: total.statements ? total.statements.pct : 0,
    branches: total.branches ? total.branches.pct : 0,
    functions: total.functions ? total.functions.pct : 0,
    lines: total.lines ? total.lines.pct : 0,
  };
}

/**
 * Check coverage summary against thresholds.
 *
 * Returns an object with passed/failed status and a list of any failures.
 *
 * @param {object} summary - Output from calculateSummary()
 * @param {object} [thresholds] - Custom thresholds (defaults to DEFAULT_THRESHOLDS)
 * @returns {object} Result object: { passed: bool, failures: [{metric, actual, threshold}] }
 *
 * @example
 * const result = checkThresholds(summary, { statements: 80, branches: 75 });
 * // Returns: { passed: false, failures: [{ metric: 'statements', actual: 70, threshold: 80 }] }
 */
function checkThresholds(summary, thresholds = DEFAULT_THRESHOLDS) {
  const failures = [];

  for (const [metric, threshold] of Object.entries(thresholds)) {
    const actual = summary[metric] || 0;
    if (actual < threshold) {
      failures.push({
        metric,
        actual: parseFloat(actual.toFixed(2)),
        threshold,
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Get list of files below coverage thresholds.
 *
 * Scans the coverage data and returns files that are below the specified
 * threshold for any metric (defaults to lines coverage).
 *
 * @param {object} coverageData - Output from parseCoverageJson()
 * @param {number} [threshold=70] - Minimum coverage percentage
 * @param {string} [metric='lines'] - Which metric to check (statements|branches|functions|lines)
 * @returns {Array<{file: string, coverage: number}>} Array of files below threshold
 *
 * @example
 * const uncovered = getUncoveredFiles(coverageData, 80, 'statements');
 * // Returns: [
 * //   { file: 'src/util.js', coverage: 65.2 },
 * //   { file: 'src/legacy.js', coverage: 45.0 }
 * // ]
 */
function getUncoveredFiles(coverageData, threshold = 70, metric = 'lines') {
  if (!coverageData) {
    return [];
  }

  const uncovered = [];

  for (const [file, data] of Object.entries(coverageData)) {
    // Skip 'total' entry
    if (file === 'total') continue;

    const metricData = data[metric];
    if (!metricData) continue;

    const pct = metricData.pct || 0;
    if (pct < threshold) {
      uncovered.push({
        file,
        coverage: parseFloat(pct.toFixed(2)),
      });
    }
  }

  // Sort by coverage (ascending)
  uncovered.sort((a, b) => a.coverage - b.coverage);

  return uncovered;
}

/**
 * Generate ASCII text report from coverage summary.
 *
 * Creates a formatted table showing all metrics and pass/fail indicators
 * against the default thresholds.
 *
 * @param {object} summary - Output from calculateSummary()
 * @param {object} [thresholds] - Custom thresholds (defaults to DEFAULT_THRESHOLDS)
 * @returns {string} Formatted ASCII table
 *
 * @example
 * const report = generateTextReport(summary);
 * console.log(report);
 * // Outputs:
 * // ─────────────────────────────────────────────────────
 * // Metric       Threshold   Actual   Status
 * // ─────────────────────────────────────────────────────
 * // Statements      70%      87.2%    PASS
 * // ...
 */
function generateTextReport(summary, thresholds = DEFAULT_THRESHOLDS) {
  const result = checkThresholds(summary, thresholds);

  let report = '\nCoverage Report\n';
  report += '─'.repeat(60) + '\n';
  report += 'Metric'.padEnd(15) +
    'Threshold'.padStart(12) +
    'Actual'.padStart(10) +
    'Status'.padStart(20) + '\n';
  report += '─'.repeat(60) + '\n';

  for (const [metric, threshold] of Object.entries(thresholds)) {
    const actual = summary[metric] || 0;
    const status = actual >= threshold ? 'PASS' : 'FAIL';
    const statusFormatted = status === 'PASS' ? '✓ PASS' : '✗ FAIL';

    report += metric.padEnd(15) +
      `${threshold}%`.padStart(12) +
      `${actual.toFixed(1)}%`.padStart(10) +
      statusFormatted.padStart(20) + '\n';
  }

  report += '─'.repeat(60) + '\n';
  if (result.passed) {
    report += 'Result: All thresholds met.\n';
  } else {
    report += `Result: ${result.failures.length} threshold(s) below target.\n`;
  }

  return report;
}

/**
 * Generate JSON report from coverage summary.
 *
 * Creates a structured JSON object suitable for CI/CD pipelines and tooling
 * integration. Includes summary, thresholds, and pass/fail status.
 *
 * @param {object} summary - Output from calculateSummary()
 * @param {object} [thresholds] - Custom thresholds (defaults to DEFAULT_THRESHOLDS)
 * @returns {object} JSON report object
 *
 * @example
 * const report = generateJsonReport(summary);
 * // Returns: {
 * //   timestamp: '2026-04-09T12:34:56.789Z',
 * //   summary: { statements: 87.2, branches: 82.1, ... },
 * //   thresholds: { statements: 70, branches: 60, ... },
 * //   passed: true,
 * //   failures: []
 * // }
 */
function generateJsonReport(summary, thresholds = DEFAULT_THRESHOLDS) {
  const result = checkThresholds(summary, thresholds);

  return {
    timestamp: new Date().toISOString(),
    summary,
    thresholds,
    passed: result.passed,
    failures: result.failures,
  };
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  parseCoverageJson,
  calculateSummary,
  checkThresholds,
  getUncoveredFiles,
  generateTextReport,
  generateJsonReport,
  DEFAULT_THRESHOLDS,
};
