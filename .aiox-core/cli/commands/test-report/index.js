/**
 * Test Report Dashboard Command Module
 *
 * Generates test reports from Jest run output.
 *
 * Subcommands:
 *   aiox test-report                     — generate report from last Jest run
 *   aiox test-report --format json       — output as JSON
 *   aiox test-report --output report.md  — write markdown report to file
 *   aiox test-report --compare <file>    — compare with previous report, show delta
 *   aiox test-report --help              — show help
 *
 * @module cli/commands/test-report
 * @version 1.0.0
 * @story 18.4 — Test Report Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
TEST REPORT DASHBOARD

USAGE:
  aiox test-report                      Generate test report from last Jest run
  aiox test-report --format json        Output as JSON
  aiox test-report --output <file>      Write markdown report to file
  aiox test-report --compare <file>     Compare with previous report JSON
  aiox test-report --help               Show this help

EXAMPLES:
  aiox test-report
  aiox test-report --format json
  aiox test-report --output report.md
  aiox test-report --compare previous-report.json
`.trim();

const RESULTS_CANDIDATES = [
  'coverage/test-results.json',
  'test-results.json',
  '.aiox/test-results.json',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get project root.
 * @returns {string}
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Find and load test results JSON.
 * @returns {object|null}
 */
function loadTestResults() {
  const root = getProjectRoot();
  for (const candidate of RESULTS_CANDIDATES) {
    const absPath = path.join(root, candidate);
    if (fs.existsSync(absPath)) {
      try {
        return JSON.parse(fs.readFileSync(absPath, 'utf8'));
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Parse Jest test results into a report summary.
 * @param {object} data - Raw Jest JSON output
 * @returns {object} Report summary
 */
function buildReport(data) {
  const suites = data.testResults || [];
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let totalDuration = 0;
  const suiteSummaries = [];

  for (const suite of suites) {
    const sName = suite.testFilePath || suite.name || 'unknown';
    const numPass = suite.numPassingTests || 0;
    const numFail = suite.numFailingTests || 0;
    const numSkip = suite.numPendingTests || 0;
    const duration = (suite.perfStats && suite.perfStats.end && suite.perfStats.start)
      ? suite.perfStats.end - suite.perfStats.start
      : (suite.duration || 0);

    totalTests += numPass + numFail + numSkip;
    passed += numPass;
    failed += numFail;
    skipped += numSkip;
    totalDuration += duration;

    suiteSummaries.push({
      name: path.basename(sName),
      passed: numPass,
      failed: numFail,
      skipped: numSkip,
      duration,
    });
  }

  // Sort by duration desc for slowest
  const slowest = [...suiteSummaries].sort((a, b) => b.duration - a.duration).slice(0, 5);

  return {
    timestamp: new Date().toISOString(),
    totalSuites: suites.length,
    totalTests,
    passed,
    failed,
    skipped,
    duration: totalDuration,
    slowest,
    suites: suiteSummaries,
    passRate: totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0,
  };
}

/**
 * Compare two reports and return deltas.
 * @param {object} current - Current report
 * @param {object} previous - Previous report
 * @returns {object} Delta object
 */
function compareReports(current, previous) {
  return {
    totalTests: current.totalTests - (previous.totalTests || 0),
    passed: current.passed - (previous.passed || 0),
    failed: current.failed - (previous.failed || 0),
    skipped: current.skipped - (previous.skipped || 0),
    duration: current.duration - (previous.duration || 0),
    passRate: current.passRate - (previous.passRate || 0),
  };
}

/**
 * Format a report as markdown.
 * @param {object} report - Report object
 * @param {object} [delta] - Optional delta from comparison
 * @returns {string} Markdown string
 */
function formatMarkdown(report, delta) {
  const lines = [];
  lines.push('# Test Report');
  lines.push('');
  lines.push(`Generated: ${report.timestamp}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Suites | ${report.totalSuites} |`);
  lines.push(`| Total Tests | ${report.totalTests} |`);
  lines.push(`| Passed | ${report.passed} |`);
  lines.push(`| Failed | ${report.failed} |`);
  lines.push(`| Skipped | ${report.skipped} |`);
  lines.push(`| Pass Rate | ${report.passRate}% |`);
  lines.push(`| Duration | ${report.duration}ms |`);

  if (delta) {
    lines.push('');
    lines.push('## Delta (vs Previous)');
    lines.push('');
    lines.push(`| Metric | Delta |`);
    lines.push(`|--------|-------|`);
    const fmt = (v) => v >= 0 ? `+${v}` : `${v}`;
    lines.push(`| Tests | ${fmt(delta.totalTests)} |`);
    lines.push(`| Passed | ${fmt(delta.passed)} |`);
    lines.push(`| Failed | ${fmt(delta.failed)} |`);
    lines.push(`| Skipped | ${fmt(delta.skipped)} |`);
    lines.push(`| Pass Rate | ${fmt(delta.passRate)}% |`);
    lines.push(`| Duration | ${fmt(delta.duration)}ms |`);
  }

  if (report.slowest && report.slowest.length > 0) {
    lines.push('');
    lines.push('## Slowest Suites');
    lines.push('');
    lines.push(`| Suite | Duration |`);
    lines.push(`|-------|----------|`);
    for (const s of report.slowest) {
      lines.push(`| ${s.name} | ${s.duration}ms |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a report as plain text for console.
 * @param {object} report - Report object
 * @param {object} [delta] - Optional delta
 * @returns {string}
 */
function formatText(report, delta) {
  const lines = [];
  lines.push('TEST REPORT');
  lines.push('===========');
  lines.push('');
  lines.push(`Suites:   ${report.totalSuites}`);
  lines.push(`Tests:    ${report.totalTests}`);
  lines.push(`Passed:   ${report.passed}`);
  lines.push(`Failed:   ${report.failed}`);
  lines.push(`Skipped:  ${report.skipped}`);
  lines.push(`Pass Rate: ${report.passRate}%`);
  lines.push(`Duration: ${report.duration}ms`);

  if (delta) {
    lines.push('');
    lines.push('DELTA (vs Previous):');
    const fmt = (v) => v >= 0 ? `+${v}` : `${v}`;
    lines.push(`  Tests:     ${fmt(delta.totalTests)}`);
    lines.push(`  Passed:    ${fmt(delta.passed)}`);
    lines.push(`  Failed:    ${fmt(delta.failed)}`);
    lines.push(`  Pass Rate: ${fmt(delta.passRate)}%`);
    lines.push(`  Duration:  ${fmt(delta.duration)}ms`);
  }

  if (report.slowest && report.slowest.length > 0) {
    lines.push('');
    lines.push('Slowest Suites:');
    for (const s of report.slowest) {
      lines.push(`  ${s.name.padEnd(40)} ${s.duration}ms`);
    }
  }

  return lines.join('\n');
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Run the test-report command.
 * @param {string[]} argv - Command arguments
 */
function runTestReport(argv) {
  if (!argv) argv = [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const root = getProjectRoot();
  const formatIdx = argv.indexOf('--format');
  const jsonOutput = formatIdx !== -1 && argv[formatIdx + 1] === 'json';
  const outputIdx = argv.indexOf('--output');
  const outputFile = outputIdx !== -1 ? argv[outputIdx + 1] : null;
  const compareIdx = argv.indexOf('--compare');
  const compareFile = compareIdx !== -1 ? argv[compareIdx + 1] : null;

  const data = loadTestResults();
  if (!data) {
    console.error('Error: No test results file found.');
    console.error('Run Jest with --json --outputFile=test-results.json first.');
    process.exitCode = 1;
    return;
  }

  const report = buildReport(data);

  let delta = null;
  if (compareFile) {
    const absCompare = path.isAbsolute(compareFile) ? compareFile : path.join(root, compareFile);
    if (fs.existsSync(absCompare)) {
      try {
        const prev = JSON.parse(fs.readFileSync(absCompare, 'utf8'));
        delta = compareReports(report, prev);
      } catch {
        console.error(`Warning: Could not parse comparison file: ${compareFile}`);
      }
    } else {
      console.error(`Warning: Comparison file not found: ${compareFile}`);
    }
  }

  if (jsonOutput) {
    const output = delta ? { ...report, delta } : report;
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (outputFile) {
    const absOutput = path.isAbsolute(outputFile) ? outputFile : path.join(root, outputFile);
    const dir = path.dirname(absOutput);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const md = formatMarkdown(report, delta);
    fs.writeFileSync(absOutput, md, 'utf8');
    console.log(`Report written to: ${outputFile}`);
    return;
  }

  console.log(formatText(report, delta));
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runTestReport,
  loadTestResults,
  buildReport,
  compareReports,
  formatMarkdown,
  formatText,
};
