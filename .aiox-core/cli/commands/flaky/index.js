/**
 * Test Flaky Detector Command Module
 *
 * Detects intermittently failing test suites from historical run data.
 *
 * Subcommands:
 *   aiox flaky                   — show flaky tests from history
 *   aiox flaky --threshold N     — tests that failed N+ times
 *   aiox flaky --record          — record current test run results
 *   aiox flaky --clear           — clear history
 *   aiox flaky --top N           — top N most flaky tests
 *   aiox flaky --help            — show help
 *
 * @module cli/commands/flaky
 * @version 1.0.0
 * @story 18.2 — Test Flaky Detector
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HISTORY_FILE = '.aiox/test-runs.jsonl';

const HELP_TEXT = `
TEST FLAKY DETECTOR

USAGE:
  aiox flaky                    Show tests that have failed intermittently
  aiox flaky --threshold <N>    Show tests that failed N+ times (default: 2)
  aiox flaky --record           Record current test run results to history
  aiox flaky --clear            Clear test run history
  aiox flaky --top <N>          Show top N most flaky tests
  aiox flaky --help             Show this help

EXAMPLES:
  aiox flaky --threshold 3
  aiox flaky --record
  aiox flaky --top 5
`.trim();

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get project root.
 * @returns {string}
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Get absolute path to history file.
 * @returns {string}
 */
function getHistoryPath() {
  return path.join(getProjectRoot(), HISTORY_FILE);
}

/**
 * Read all test run records from history.
 * @returns {object[]} Array of run records
 */
function readHistory() {
  const histPath = getHistoryPath();
  if (!fs.existsSync(histPath)) {
    return [];
  }
  const content = fs.readFileSync(histPath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Append a test run record to history.
 * @param {object} record - { timestamp, suites: [{ name, status: 'pass'|'fail' }] }
 */
function appendRecord(record) {
  const histPath = getHistoryPath();
  const dir = path.dirname(histPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(histPath, JSON.stringify(record) + '\n', 'utf8');
}

/**
 * Clear history file.
 */
function clearHistory() {
  const histPath = getHistoryPath();
  if (fs.existsSync(histPath)) {
    fs.writeFileSync(histPath, '', 'utf8');
  }
}

/**
 * Analyze history to find flaky tests.
 * A test is flaky if it has both passes and failures across runs.
 * @param {object[]} records - History records
 * @param {number} threshold - Minimum failure count
 * @returns {object[]} Array of { name, passes, failures, total, flakyRate }
 */
function analyzeFlaky(records, threshold) {
  const stats = {};

  for (const record of records) {
    if (!record.suites || !Array.isArray(record.suites)) continue;
    for (const suite of record.suites) {
      if (!stats[suite.name]) {
        stats[suite.name] = { passes: 0, failures: 0 };
      }
      if (suite.status === 'pass') {
        stats[suite.name].passes++;
      } else if (suite.status === 'fail') {
        stats[suite.name].failures++;
      }
    }
  }

  const results = [];
  for (const [name, s] of Object.entries(stats)) {
    const total = s.passes + s.failures;
    // Flaky = has both passes AND failures
    if (s.failures >= threshold && s.passes > 0) {
      results.push({
        name,
        passes: s.passes,
        failures: s.failures,
        total,
        flakyRate: Math.round((s.failures / total) * 100),
      });
    }
  }

  return results.sort((a, b) => b.failures - a.failures);
}

/**
 * Record current test results from Jest output.
 * Reads from coverage/test-results.json or .aiox/test-results.json.
 * @returns {object|null} The recorded entry or null
 */
function recordCurrentRun() {
  const root = getProjectRoot();
  const candidates = [
    path.join(root, 'coverage', 'test-results.json'),
    path.join(root, '.aiox', 'test-results.json'),
    path.join(root, 'test-results.json'),
  ];

  let data = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        data = JSON.parse(fs.readFileSync(c, 'utf8'));
        break;
      } catch {
        continue;
      }
    }
  }

  if (!data) {
    return null;
  }

  const suites = [];
  const testSuites = data.testResults || data.suites || [];
  for (const suite of testSuites) {
    const name = suite.testFilePath || suite.name || suite.file || 'unknown';
    const failed = (suite.numFailingTests || 0) > 0 || suite.status === 'failed';
    suites.push({
      name: path.basename(name),
      status: failed ? 'fail' : 'pass',
    });
  }

  const record = {
    timestamp: new Date().toISOString(),
    suites,
  };

  appendRecord(record);
  return record;
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Run the flaky command.
 * @param {string[]} argv - Command arguments
 */
function runFlaky(argv) {
  if (!argv) argv = [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  // --clear
  if (argv.includes('--clear')) {
    clearHistory();
    console.log('Test run history cleared.');
    return;
  }

  // --record
  if (argv.includes('--record')) {
    const record = recordCurrentRun();
    if (!record) {
      console.error('Error: No test results file found.');
      console.error('Run Jest with --json --outputFile=test-results.json first.');
      process.exitCode = 1;
      return;
    }
    console.log(`Recorded ${record.suites.length} test suite(s).`);
    return;
  }

  // Default: show flaky
  const thresholdIdx = argv.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 && argv[thresholdIdx + 1]
    ? parseInt(argv[thresholdIdx + 1], 10)
    : 2;

  const topIdx = argv.indexOf('--top');
  const top = topIdx !== -1 && argv[topIdx + 1]
    ? parseInt(argv[topIdx + 1], 10)
    : 0;

  const records = readHistory();
  if (records.length === 0) {
    console.log('No test run history found.');
    console.log('Use "aiox flaky --record" to start recording test runs.');
    return;
  }

  let flaky = analyzeFlaky(records, threshold);

  if (top > 0) {
    flaky = flaky.slice(0, top);
  }

  if (flaky.length === 0) {
    console.log('No flaky tests detected.');
    return;
  }

  console.log(`Flaky Tests (threshold: ${threshold}+ failures):\n`);
  console.log(`${'Test'.padEnd(40)} ${'Passes'.padStart(7)} ${'Fails'.padStart(7)} ${'Rate'.padStart(6)}`);
  console.log('-'.repeat(62));

  for (const t of flaky) {
    const name = t.name.length > 38 ? t.name.slice(0, 38) + '..' : t.name;
    console.log(`${name.padEnd(40)} ${String(t.passes).padStart(7)} ${String(t.failures).padStart(7)} ${(t.flakyRate + '%').padStart(6)}`);
  }

  console.log(`\nTotal: ${flaky.length} flaky test(s) from ${records.length} run(s).`);
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runFlaky,
  readHistory,
  appendRecord,
  clearHistory,
  analyzeFlaky,
  recordCurrentRun,
};
