/**
 * Build Time Tracker Command Module
 *
 * Records and displays build times.
 *
 * Subcommands:
 *   aiox build-time                     — Show build times
 *   aiox build-time --record "<cmd>"    — Time a command and record it
 *   aiox build-time --trend             — Show trend over last 10 builds
 *   aiox build-time --format json       — Output as JSON
 *   aiox build-time --clear             — Clear history
 *   aiox build-time --avg               — Show average build time
 *   aiox build-time --help              — Show help
 *
 * @module cli/commands/build-time
 * @version 1.0.0
 * @story 24.2 — Build Time Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ───────────────────────────────────────────────────────────────

const DATA_DIR = '.aiox';
const DATA_FILE = 'build-times.jsonl';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the path to the build times file.
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
 * Read all build time entries.
 * @returns {Array<{ command: string, durationMs: number, timestamp: string, exitCode: number }>}
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
 * Append a build time entry.
 * @param {{ command: string, durationMs: number, timestamp: string, exitCode: number }} entry
 */
function appendEntry(entry) {
  ensureDataDir();
  const filePath = getDataPath();
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Clear all build time entries.
 */
function clearEntries() {
  const filePath = getDataPath();
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

/**
 * Format milliseconds to human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  if (ms < 60000) return `${seconds}s`;
  const minutes = Math.floor(ms / 60000);
  const remaining = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${remaining}s`;
}

/**
 * Record a command execution and its duration.
 * @param {string} command
 * @returns {{ command: string, durationMs: number, timestamp: string, exitCode: number }}
 */
function recordCommand(command) {
  const start = Date.now();
  let exitCode = 0;
  try {
    execSync(command, { encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
  } catch (err) {
    exitCode = err.status || 1;
  }
  const durationMs = Date.now() - start;
  const entry = {
    command,
    durationMs,
    timestamp: new Date().toISOString(),
    exitCode,
  };
  appendEntry(entry);
  return entry;
}

/**
 * Compute average duration from entries.
 * @param {Array} entries
 * @returns {number}
 */
function computeAverage(entries) {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + e.durationMs, 0);
  return Math.round(sum / entries.length);
}

/**
 * Get trend of last N builds.
 * @param {Array} entries
 * @param {number} count
 * @returns {Array}
 */
function getTrend(entries, count = 10) {
  return entries.slice(-count);
}

/**
 * Format trend as ASCII bar chart.
 * @param {Array} entries
 * @returns {string}
 */
function formatTrend(entries) {
  if (entries.length === 0) return 'No build records found.';

  const maxMs = Math.max(...entries.map(e => e.durationMs));
  const barWidth = 30;
  const lines = ['Build Time Trend (last ' + entries.length + ' builds)', ''];

  for (const entry of entries) {
    const ratio = maxMs > 0 ? entry.durationMs / maxMs : 0;
    const filled = Math.round(ratio * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const dur = formatDuration(entry.durationMs);
    const cmd = entry.command.length > 20
      ? entry.command.substring(0, 17) + '...'
      : entry.command;
    lines.push(`  ${bar} ${dur.padStart(8)} — ${cmd}`);
  }

  return lines.join('\n');
}

/**
 * Format entries as a table.
 * @param {Array} entries
 * @returns {string}
 */
function formatTable(entries) {
  if (entries.length === 0) return 'No build records found.';

  const lines = ['Build Time History', ''];
  lines.push('  #  Duration   Exit  Command');
  lines.push('  — ————————— ———— ———————————————————————————');

  entries.forEach((entry, i) => {
    const num = String(i + 1).padStart(3);
    const dur = formatDuration(entry.durationMs).padStart(9);
    const exit = String(entry.exitCode).padStart(4);
    lines.push(`${num} ${dur} ${exit}  ${entry.command}`);
  });

  return lines.join('\n');
}

/**
 * Run the build-time command.
 * @param {string[]} argv
 */
function runBuildTime(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
AIOX Build Time Tracker

USAGE:
  aiox build-time                     Show build times
  aiox build-time --record "<cmd>"    Time a command and record it
  aiox build-time --trend             Show trend over last 10 builds
  aiox build-time --format json       Output as JSON
  aiox build-time --clear             Clear history
  aiox build-time --avg               Show average build time
  aiox build-time --help              Show this help
`);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 ? argv[formatIdx + 1] : 'table';

  // --clear
  if (argv.includes('--clear')) {
    clearEntries();
    console.log('Build time history cleared.');
    return;
  }

  // --record
  const recordIdx = argv.indexOf('--record');
  if (recordIdx !== -1) {
    const command = argv[recordIdx + 1];
    if (!command) {
      console.error('Error: --record requires a command argument.');
      process.exitCode = 1;
      return;
    }
    console.log(`Recording: ${command}`);
    const entry = recordCommand(command);
    if (format === 'json') {
      console.log(JSON.stringify(entry, null, 2));
    } else {
      const status = entry.exitCode === 0 ? 'SUCCESS' : `FAILED (exit ${entry.exitCode})`;
      console.log(`Completed in ${formatDuration(entry.durationMs)} — ${status}`);
    }
    return;
  }

  const entries = readEntries();

  // --avg
  if (argv.includes('--avg')) {
    const avg = computeAverage(entries);
    if (format === 'json') {
      console.log(JSON.stringify({ averageMs: avg, averageFormatted: formatDuration(avg), count: entries.length }, null, 2));
    } else {
      console.log(`Average build time: ${formatDuration(avg)} (${entries.length} builds)`);
    }
    return;
  }

  // --trend
  if (argv.includes('--trend')) {
    const trend = getTrend(entries);
    if (format === 'json') {
      console.log(JSON.stringify(trend, null, 2));
    } else {
      console.log(formatTrend(trend));
    }
    return;
  }

  // default: show all
  if (format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
  } else {
    console.log(formatTable(entries));
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runBuildTime,
  readEntries,
  appendEntry,
  clearEntries,
  recordCommand,
  computeAverage,
  getTrend,
  formatDuration,
  formatTrend,
  formatTable,
  getDataPath,
  ensureDataDir,
};
