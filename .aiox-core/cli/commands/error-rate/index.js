/**
 * Error Rate Monitor Command Module
 *
 * Tracks and displays error rates from a JSONL log.
 *
 * Subcommands:
 *   aiox error-rate                          — Show error rates
 *   aiox error-rate --since 24h              — Filter by time
 *   aiox error-rate --top 5                  — Top N most frequent errors
 *   aiox error-rate --format json            — Output as JSON
 *   aiox error-rate --record "<message>"     — Log an error
 *   aiox error-rate --clear                  — Clear log
 *   aiox error-rate --help                   — Show help
 *
 * @module cli/commands/error-rate
 * @version 1.0.0
 * @story 24.3 — Error Rate Monitor
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ───────────────────────────────────────────────────────────────

const DATA_DIR = '.aiox';
const DATA_FILE = 'error-log.jsonl';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the path to the error log file.
 * @returns {string}
 */
function getDataPath() {
  return path.join(process.cwd(), DATA_DIR, DATA_FILE);
}

/**
 * Ensure .aiox directory exists.
 */
function ensureDataDir() {
  const dir = path.join(process.cwd(), DATA_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read all error entries.
 * @returns {Array<{ message: string, timestamp: string, source?: string }>}
 */
function readEntries() {
  const filePath = getDataPath();
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];

  return content
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Append an error entry.
 * @param {{ message: string, timestamp: string, source?: string }} entry
 */
function appendEntry(entry) {
  ensureDataDir();
  const filePath = getDataPath();
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Clear all error entries.
 */
function clearEntries() {
  const filePath = getDataPath();
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

/**
 * Record a new error.
 * @param {string} message
 * @param {string} [source]
 * @returns {{ message: string, timestamp: string, source: string }}
 */
function recordError(message, source = 'manual') {
  const entry = {
    message,
    timestamp: new Date().toISOString(),
    source,
  };
  appendEntry(entry);
  return entry;
}

/**
 * Parse a duration string like "24h", "7d", "30m" into milliseconds.
 * @param {string} str
 * @returns {number}
 */
function parseDuration(str) {
  const match = str.match(/^(\d+)(m|h|d)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 3600 * 1000;
    case 'd': return value * 86400 * 1000;
    default: return 0;
  }
}

/**
 * Filter entries by time window.
 * @param {Array} entries
 * @param {string} sinceStr — e.g. "24h", "7d"
 * @returns {Array}
 */
function filterBySince(entries, sinceStr) {
  const durationMs = parseDuration(sinceStr);
  if (durationMs === 0) return entries;
  const cutoff = Date.now() - durationMs;
  return entries.filter(e => new Date(e.timestamp).getTime() >= cutoff);
}

/**
 * Get top N most frequent errors.
 * @param {Array} entries
 * @param {number} n
 * @returns {Array<{ message: string, count: number }>}
 */
function getTopErrors(entries, n = 5) {
  const freq = {};
  for (const entry of entries) {
    freq[entry.message] = (freq[entry.message] || 0) + 1;
  }
  return Object.entries(freq)
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * Compute error rate stats.
 * @param {Array} entries
 * @returns {{ total: number, uniqueMessages: number, rate: string }}
 */
function computeStats(entries) {
  const uniqueMessages = new Set(entries.map(e => e.message)).size;
  // Compute rate: errors per hour over the entry time span
  let rate = '0/h';
  if (entries.length >= 2) {
    const times = entries.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
    const spanMs = times[times.length - 1] - times[0];
    if (spanMs > 0) {
      const perHour = (entries.length / (spanMs / 3600000)).toFixed(1);
      rate = `${perHour}/h`;
    }
  }
  return { total: entries.length, uniqueMessages, rate };
}

/**
 * Format entries as table.
 * @param {Array} entries
 * @returns {string}
 */
function formatTable(entries) {
  if (entries.length === 0) return 'No errors recorded.';

  const stats = computeStats(entries);
  const lines = [
    'Error Rate Monitor',
    '',
    `  Total errors: ${stats.total}`,
    `  Unique messages: ${stats.uniqueMessages}`,
    `  Rate: ${stats.rate}`,
    '',
    '  Recent errors:',
  ];

  const recent = entries.slice(-10);
  for (const entry of recent) {
    const ts = entry.timestamp.replace('T', ' ').substring(0, 19);
    const msg = entry.message.length > 50
      ? entry.message.substring(0, 47) + '...'
      : entry.message;
    lines.push(`    [${ts}] ${msg}`);
  }

  return lines.join('\n');
}

/**
 * Format top errors as table.
 * @param {Array<{ message: string, count: number }>} topErrors
 * @returns {string}
 */
function formatTopErrors(topErrors) {
  if (topErrors.length === 0) return 'No errors recorded.';

  const lines = ['Top Errors', ''];
  lines.push('  Count  Message');
  lines.push('  ————— ———————————————————————————————————————');

  for (const { message, count } of topErrors) {
    lines.push(`  ${String(count).padStart(5)}  ${message}`);
  }

  return lines.join('\n');
}

/**
 * Run the error-rate command.
 * @param {string[]} argv
 */
function runErrorRate(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
AIOX Error Rate Monitor

USAGE:
  aiox error-rate                          Show error rates
  aiox error-rate --since 24h              Filter by time (m/h/d)
  aiox error-rate --top 5                  Top N most frequent errors
  aiox error-rate --format json            Output as JSON
  aiox error-rate --record "<message>"     Log an error
  aiox error-rate --clear                  Clear log
  aiox error-rate --help                   Show this help
`);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 ? argv[formatIdx + 1] : 'table';

  // --clear
  if (argv.includes('--clear')) {
    clearEntries();
    console.log('Error log cleared.');
    return;
  }

  // --record
  const recordIdx = argv.indexOf('--record');
  if (recordIdx !== -1) {
    const message = argv[recordIdx + 1];
    if (!message) {
      console.error('Error: --record requires a message argument.');
      process.exitCode = 1;
      return;
    }
    const entry = recordError(message);
    if (format === 'json') {
      console.log(JSON.stringify(entry, null, 2));
    } else {
      console.log(`Error recorded: ${entry.message}`);
    }
    return;
  }

  let entries = readEntries();

  // --since
  const sinceIdx = argv.indexOf('--since');
  if (sinceIdx !== -1) {
    const sinceStr = argv[sinceIdx + 1];
    if (sinceStr) {
      entries = filterBySince(entries, sinceStr);
    }
  }

  // --top
  const topIdx = argv.indexOf('--top');
  if (topIdx !== -1) {
    const n = parseInt(argv[topIdx + 1], 10) || 5;
    const topErrors = getTopErrors(entries, n);
    if (format === 'json') {
      console.log(JSON.stringify(topErrors, null, 2));
    } else {
      console.log(formatTopErrors(topErrors));
    }
    return;
  }

  // default: show summary
  if (format === 'json') {
    const stats = computeStats(entries);
    console.log(JSON.stringify({ ...stats, entries }, null, 2));
  } else {
    console.log(formatTable(entries));
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runErrorRate,
  readEntries,
  appendEntry,
  clearEntries,
  recordError,
  parseDuration,
  filterBySince,
  getTopErrors,
  computeStats,
  formatTable,
  formatTopErrors,
  getDataPath,
  ensureDataDir,
};
