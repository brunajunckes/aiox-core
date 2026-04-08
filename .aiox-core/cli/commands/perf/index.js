/**
 * Command Execution Timer & Performance Logging Module
 *
 * Tracks and displays CLI command execution times.
 *
 * Subcommands:
 *   aiox perf               — Show last 10 command execution times
 *   aiox perf --slow        — Show top 5 slowest commands
 *   aiox perf --clear       — Clear the performance log
 *   aiox perf --avg         — Show average execution time per command
 *   aiox perf --help        — Show help
 *
 * @module cli/commands/perf
 * @version 1.0.0
 * @story 10.2 — Command Execution Timer & Performance Logging
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_LOG_FILE = '.aiox/perf-log.jsonl';

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Get the perf log file path.
 * @param {object} [options]
 * @param {string} [options.logFile] - Custom log file path
 * @returns {string}
 */
function getLogPath(options = {}) {
  if (options.logFile) return options.logFile;
  return path.join(process.cwd(), DEFAULT_LOG_FILE);
}

/**
 * Read all entries from the perf log.
 * @param {string} logPath - Path to log file
 * @returns {Array<{command: string, duration_ms: number, timestamp: string}>}
 */
function readPerfLog(logPath) {
  try {
    const content = fs.readFileSync(logPath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Append a perf entry to the log.
 * @param {string} command - Command name
 * @param {number} duration_ms - Duration in milliseconds
 * @param {object} [options]
 * @param {string} [options.logFile] - Custom log file path
 * @param {string} [options.timestamp] - Custom timestamp
 */
function appendPerfEntry(command, duration_ms, options = {}) {
  const logPath = getLogPath(options);
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const entry = {
    command,
    duration_ms,
    timestamp: options.timestamp || new Date().toISOString(),
  };
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Clear the perf log.
 * @param {string} logPath - Path to log file
 * @returns {boolean} - True if cleared, false if file didn't exist
 */
function clearPerfLog(logPath) {
  try {
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '', 'utf8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get the last N entries from the perf log.
 * @param {Array} entries - All entries
 * @param {number} [count=10] - Number of entries
 * @returns {Array}
 */
function getLastEntries(entries, count = 10) {
  return entries.slice(-count);
}

/**
 * Get the top N slowest entries.
 * @param {Array} entries - All entries
 * @param {number} [count=5] - Number of entries
 * @returns {Array}
 */
function getSlowestEntries(entries, count = 5) {
  return [...entries].sort((a, b) => b.duration_ms - a.duration_ms).slice(0, count);
}

/**
 * Calculate average execution time per command.
 * @param {Array} entries - All entries
 * @returns {Object} - Map of command -> avg duration_ms
 */
function getAverages(entries) {
  const sums = {};
  const counts = {};
  for (const e of entries) {
    if (!sums[e.command]) {
      sums[e.command] = 0;
      counts[e.command] = 0;
    }
    sums[e.command] += e.duration_ms;
    counts[e.command] += 1;
  }
  const result = {};
  for (const cmd of Object.keys(sums)) {
    result[cmd] = Math.round(sums[cmd] / counts[cmd]);
  }
  return result;
}

/**
 * Format a duration in milliseconds for display.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format entries as a table for display.
 * @param {Array} entries
 * @returns {string}
 */
function formatEntryTable(entries) {
  if (entries.length === 0) return 'No entries found.';
  const lines = [];
  lines.push('Command'.padEnd(30) + 'Duration'.padEnd(15) + 'Timestamp');
  lines.push('-'.repeat(70));
  for (const e of entries) {
    const cmd = (e.command || 'unknown').padEnd(30);
    const dur = formatDuration(e.duration_ms).padEnd(15);
    const ts = e.timestamp || '';
    lines.push(`${cmd}${dur}${ts}`);
  }
  return lines.join('\n');
}

/**
 * Format averages for display.
 * @param {Object} averages - Map of command -> avg ms
 * @returns {string}
 */
function formatAverages(averages) {
  const commands = Object.keys(averages);
  if (commands.length === 0) return 'No entries found.';
  const lines = [];
  lines.push('Command'.padEnd(30) + 'Avg Duration');
  lines.push('-'.repeat(45));
  // Sort by average descending
  commands.sort((a, b) => averages[b] - averages[a]);
  for (const cmd of commands) {
    lines.push(`${cmd.padEnd(30)}${formatDuration(averages[cmd])}`);
  }
  return lines.join('\n');
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the perf command.
 * @param {string[]} argv - CLI arguments (after command name)
 * @param {object} [options]
 * @param {string} [options.logFile] - Custom log file path
 */
function runPerf(argv = [], options = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Usage: aiox perf [options]

Show CLI command performance metrics.

Options:
  --slow          Show top 5 slowest commands
  --clear         Clear the performance log
  --avg           Show average execution time per command
  --help, -h      Show this help message
`);
    return;
  }

  const logPath = getLogPath(options);

  if (argv.includes('--clear')) {
    const cleared = clearPerfLog(logPath);
    if (cleared) {
      console.log('Performance log cleared.');
    } else {
      console.log('No performance log found.');
    }
    return;
  }

  const entries = readPerfLog(logPath);

  if (entries.length === 0) {
    console.log('No performance data found. Run some commands first.');
    return;
  }

  if (argv.includes('--avg')) {
    const averages = getAverages(entries);
    console.log('Average Execution Times:\n');
    console.log(formatAverages(averages));
    return;
  }

  if (argv.includes('--slow')) {
    const slowest = getSlowestEntries(entries, 5);
    console.log('Top 5 Slowest Commands:\n');
    console.log(formatEntryTable(slowest));
    return;
  }

  // Default: show last 10
  const last = getLastEntries(entries, 10);
  console.log('Last 10 Command Executions:\n');
  console.log(formatEntryTable(last));
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runPerf,
  readPerfLog,
  appendPerfEntry,
  clearPerfLog,
  getLastEntries,
  getSlowestEntries,
  getAverages,
  formatDuration,
  formatEntryTable,
  formatAverages,
  getLogPath,
  DEFAULT_LOG_FILE,
};
