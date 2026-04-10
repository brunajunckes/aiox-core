/**
 * Coverage Reporting & Enforcement Command Module
 *
 * Reads Jest coverage output, displays summary tables, enforces thresholds,
 * and tracks coverage trends over time.
 *
 * Subcommands:
 *   aiox coverage           — Show coverage summary table
 *   aiox coverage --check   — Enforce thresholds (exit 1 if below)
 *   aiox coverage --trend   — Show last 5 coverage snapshots with deltas
 *   aiox coverage --help    — Show help
 *
 * @module cli/commands/coverage
 * @version 1.0.0
 * @story 9.2 — Test Coverage Reporting & Enforcement
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  parseCoverageJson,
  calculateSummary,
  checkThresholds,
  getUncoveredFiles,
  generateTextReport,
  generateJsonReport,
  DEFAULT_THRESHOLDS,
} = require('../../../core/coverage-report');

// ── Constants ────────────────────────────────────────────────────────────────

const COVERAGE_SUMMARY_PATH = 'coverage/coverage-summary.json';
const HISTORY_PATH = '.aiox/coverage-history.jsonl';
const REPORT_PATH = '.aiox/coverage-report.json';
const MAX_TREND_ENTRIES = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get project root directory.
 * @returns {string}
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Read and parse Jest coverage-summary.json.
 * @returns {object|null} Parsed coverage data or null if not found.
 */
function readCoverageSummary() {
  const filePath = path.join(getProjectRoot(), COVERAGE_SUMMARY_PATH);
  try {
    return parseCoverageJson(filePath);
  } catch (error) {
    console.error(`Error reading coverage summary: ${error.message}`);
    return null;
  }
}

/**
 * Extract module-level coverage percentages from summary data.
 * @param {object} summaryData - Raw coverage-summary.json content.
 * @returns {Array<{module: string, statements: number, branches: number, functions: number, lines: number}>}
 */
function extractModuleCoverage(summaryData) {
  const modules = [];
  for (const [key, value] of Object.entries(summaryData)) {
    const moduleName = key === 'total' ? 'Total' : path.relative(getProjectRoot(), key) || key;
    modules.push({
      module: moduleName,
      statements: value.statements ? value.statements.pct : 0,
      branches: value.branches ? value.branches.pct : 0,
      functions: value.functions ? value.functions.pct : 0,
      lines: value.lines ? value.lines.pct : 0,
    });
  }
  return modules;
}

/**
 * Format a percentage for display.
 * @param {number} pct
 * @returns {string}
 */
function formatPct(pct) {
  if (typeof pct !== 'number' || isNaN(pct)) return '  N/A';
  return `${pct.toFixed(1)}%`.padStart(7);
}

/**
 * Ensure .aiox directory exists.
 */
function ensureAioxDir() {
  const dir = path.join(getProjectRoot(), '.aiox');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append a coverage snapshot to history file.
 * @param {object} totals - Total coverage object from summary.
 */
function appendHistory(totals) {
  ensureAioxDir();
  const entry = {
    timestamp: new Date().toISOString(),
    statements: totals.statements ? totals.statements.pct : 0,
    branches: totals.branches ? totals.branches.pct : 0,
    functions: totals.functions ? totals.functions.pct : 0,
    lines: totals.lines ? totals.lines.pct : 0,
  };
  const historyFile = path.join(getProjectRoot(), HISTORY_PATH);
  fs.appendFileSync(historyFile, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Write coverage report JSON.
 * @param {Array} modules - Module coverage data.
 */
function writeReport(modules) {
  ensureAioxDir();
  const report = {
    generated: new Date().toISOString(),
    modules,
  };
  const reportFile = path.join(getProjectRoot(), REPORT_PATH);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

/**
 * Read coverage history entries.
 * @returns {Array<object>}
 */
function readHistory() {
  const historyFile = path.join(getProjectRoot(), HISTORY_PATH);
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(historyFile, 'utf8').trim();
    if (!raw) return [];
    return raw.split('\n').map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error reading coverage history: ${error.message}`);
    return [];
  }
}

/**
 * Get delta arrow for two values.
 * @param {number} current
 * @param {number} previous
 * @returns {string}
 */
function deltaArrow(current, previous) {
  if (typeof previous !== 'number' || typeof current !== 'number') return ' ';
  const diff = current - previous;
  if (diff > 0.1) return '↑';
  if (diff < -0.1) return '↓';
  return '→';
}

// ── Subcommands ──────────────────────────────────────────────────────────────

/**
 * Display help text.
 */
function showHelp() {
  console.log(`
Usage: aiox coverage [options]

Options:
  --check    Enforce coverage thresholds (exit 1 if below)
  --trend    Show coverage trend (last ${MAX_TREND_ENTRIES} snapshots)
  --help     Show this help message

Thresholds (default):
  Statements: ${DEFAULT_THRESHOLDS.statements}%
  Branches:   ${DEFAULT_THRESHOLDS.branches}%
  Functions:  ${DEFAULT_THRESHOLDS.functions}%
  Lines:      ${DEFAULT_THRESHOLDS.lines}%

Coverage data is read from: ${COVERAGE_SUMMARY_PATH}
Run 'npm run test:coverage' to generate coverage data.
`.trim());
}

/**
 * Display coverage summary table.
 */
function showSummary() {
  const data = readCoverageSummary();
  if (!data) {
    console.log('No coverage data found. Run npm run test:coverage first.');
    return;
  }

  const modules = extractModuleCoverage(data);

  console.log('\n Coverage Summary');
  console.log('─'.repeat(76));
  console.log(
    'Module'.padEnd(40) +
    'Stmts'.padStart(8) +
    'Branch'.padStart(8) +
    'Funcs'.padStart(8) +
    'Lines'.padStart(8)
  );
  console.log('─'.repeat(76));

  for (const mod of modules) {
    const name = mod.module.length > 38 ? '...' + mod.module.slice(-35) : mod.module;
    console.log(
      name.padEnd(40) +
      formatPct(mod.statements) +
      formatPct(mod.branches) +
      formatPct(mod.functions) +
      formatPct(mod.lines)
    );
  }
  console.log('─'.repeat(76));

  // Append history and write report
  if (data.total) {
    appendHistory(data.total);
  }
  writeReport(modules);
  console.log(`\nReport written to ${REPORT_PATH}`);
}

/**
 * Check coverage against thresholds.
 */
function checkThresholdsCmd() {
  const data = readCoverageSummary();
  if (!data) {
    console.log('No coverage data found. Run npm run test:coverage first.');
    process.exitCode = 1;
    return;
  }

  const summary = calculateSummary(data);
  const result = checkThresholds(summary, DEFAULT_THRESHOLDS);

  console.log('\n Coverage Threshold Check');
  console.log('─'.repeat(50));
  console.log(
    'Metric'.padEnd(15) +
    'Threshold'.padStart(12) +
    'Actual'.padStart(10) +
    'Status'.padStart(10)
  );
  console.log('─'.repeat(50));

  for (const [metric, threshold] of Object.entries(DEFAULT_THRESHOLDS)) {
    const actual = summary[metric] || 0;
    const pass = actual >= threshold;
    console.log(
      metric.padEnd(15) +
      `${threshold}%`.padStart(12) +
      `${actual.toFixed(1)}%`.padStart(10) +
      (pass ? '  PASS' : '  FAIL').padStart(10)
    );
  }
  console.log('─'.repeat(50));

  if (result.passed) {
    console.log('\nAll thresholds met.');
  } else {
    console.log('\nCoverage below thresholds.');
    process.exitCode = 1;
  }
}

/**
 * Show coverage trend from history.
 */
function showTrend() {
  const history = readHistory();
  if (history.length === 0) {
    console.log('No coverage history found. Run aiox coverage to start tracking.');
    return;
  }

  const entries = history.slice(-MAX_TREND_ENTRIES);

  console.log('\n Coverage Trend');
  console.log('─'.repeat(72));
  console.log(
    'Date'.padEnd(22) +
    'Stmts'.padStart(10) +
    'Branch'.padStart(10) +
    'Funcs'.padStart(10) +
    'Lines'.padStart(10)
  );
  console.log('─'.repeat(72));

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = i > 0 ? entries[i - 1] : null;
    const date = e.timestamp ? e.timestamp.slice(0, 19).replace('T', ' ') : 'unknown';

    const stmtArrow = prev ? deltaArrow(e.statements, prev.statements) : ' ';
    const branchArrow = prev ? deltaArrow(e.branches, prev.branches) : ' ';
    const funcArrow = prev ? deltaArrow(e.functions, prev.functions) : ' ';
    const lineArrow = prev ? deltaArrow(e.lines, prev.lines) : ' ';

    console.log(
      date.padEnd(22) +
      `${e.statements.toFixed(1)}%${stmtArrow}`.padStart(10) +
      `${e.branches.toFixed(1)}%${branchArrow}`.padStart(10) +
      `${e.functions.toFixed(1)}%${funcArrow}`.padStart(10) +
      `${e.lines.toFixed(1)}%${lineArrow}`.padStart(10)
    );
  }
  console.log('─'.repeat(72));
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run the coverage command.
 * @param {string[]} args - CLI arguments after 'coverage'.
 */
function runCoverage(args) {
  const check = args.includes('--check');
  const trend = args.includes('--trend');
  const help = args.includes('--help') || args.includes('-h');

  if (help) { showHelp(); return; }
  if (trend) { showTrend(); return; }
  if (check) { checkThresholdsCmd(); return; }

  showSummary();
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runCoverage,
  showHelp,
  showSummary,
  showTrend,
  checkThresholds: checkThresholdsCmd,
  readCoverageSummary,
  extractModuleCoverage,
  readHistory,
  appendHistory,
  writeReport,
  deltaArrow,
  formatPct,
  getProjectRoot,
  DEFAULT_THRESHOLDS,
};
