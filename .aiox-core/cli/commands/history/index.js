/**
 * CLI Session Replay & History Command Module
 *
 * Tracks and displays CLI command history.
 *
 * Subcommands:
 *   aiox history                 — Show last 20 commands
 *   aiox history --limit N       — Show last N commands
 *   aiox history --search <term> — Filter history by keyword
 *   aiox history --clear         — Clear history
 *   aiox history --export        — Export history as JSON to stdout
 *   aiox history --help          — Show help
 *
 * @module cli/commands/history
 * @version 1.0.0
 * @story 10.4 — CLI Session Replay & History
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_HISTORY_FILE = '.aiox/command-history.jsonl';
const DEFAULT_LIMIT = 20;

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Get the history file path.
 * @param {object} [options]
 * @param {string} [options.historyFile] - Custom history file path
 * @returns {string}
 */
function getHistoryPath(options = {}) {
  if (options.historyFile) return options.historyFile;
  return path.join(process.cwd(), DEFAULT_HISTORY_FILE);
}

/**
 * Read all entries from the history file.
 * @param {string} historyPath
 * @returns {Array<{command: string, args: string[], timestamp: string}>}
 */
function readHistory(historyPath) {
  try {
    const content = fs.readFileSync(historyPath, 'utf8').trim();
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
 * Append a history entry.
 * @param {string} command - Command name
 * @param {string[]} cmdArgs - Command arguments
 * @param {object} [options]
 * @param {string} [options.historyFile] - Custom history file path
 * @param {string} [options.timestamp] - Custom timestamp
 */
function appendHistory(command, cmdArgs = [], options = {}) {
  const historyPath = getHistoryPath(options);
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const entry = {
    command,
    args: cmdArgs,
    timestamp: options.timestamp || new Date().toISOString(),
  };
  fs.appendFileSync(historyPath, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Clear the history file.
 * @param {string} historyPath
 * @returns {boolean}
 */
function clearHistory(historyPath) {
  try {
    if (fs.existsSync(historyPath)) {
      fs.writeFileSync(historyPath, '', 'utf8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get the last N entries.
 * @param {Array} entries
 * @param {number} [limit=20]
 * @returns {Array}
 */
function getLastEntries(entries, limit = DEFAULT_LIMIT) {
  return entries.slice(-limit);
}

/**
 * Search entries by keyword.
 * @param {Array} entries
 * @param {string} term - Search term
 * @returns {Array}
 */
function searchHistory(entries, term) {
  const lower = term.toLowerCase();
  return entries.filter(e => {
    const cmdStr = `${e.command} ${(e.args || []).join(' ')}`.toLowerCase();
    return cmdStr.includes(lower);
  });
}

/**
 * Format history entries for display.
 * @param {Array} entries
 * @returns {string}
 */
function formatHistoryTable(entries) {
  if (entries.length === 0) return 'No history entries found.';
  const lines = [];
  lines.push('#'.padEnd(6) + 'Command'.padEnd(20) + 'Args'.padEnd(30) + 'Timestamp');
  lines.push('-'.repeat(80));
  entries.forEach((e, i) => {
    const num = String(i + 1).padEnd(6);
    const cmd = (e.command || 'unknown').padEnd(20);
    const entryArgs = (e.args || []).join(' ').substring(0, 28).padEnd(30);
    const ts = e.timestamp || '';
    lines.push(`${num}${cmd}${entryArgs}${ts}`);
  });
  return lines.join('\n');
}

/**
 * Export history as JSON.
 * @param {Array} entries
 * @returns {string}
 */
function exportHistory(entries) {
  return JSON.stringify(entries, null, 2);
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the history command.
 * @param {string[]} argv - CLI arguments (after command name)
 * @param {object} [options]
 * @param {string} [options.historyFile] - Custom history file path
 */
function runHistory(argv = [], options = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Usage: aiox history [options]

Show CLI command history.

Options:
  --limit N           Show last N commands (default: 20)
  --search <term>     Filter history by keyword
  --clear             Clear history
  --export            Export history as JSON to stdout
  --help, -h          Show this help message
`);
    return;
  }

  const historyPath = getHistoryPath(options);

  if (argv.includes('--clear')) {
    const cleared = clearHistory(historyPath);
    if (cleared) {
      console.log('Command history cleared.');
    } else {
      console.log('No history file found.');
    }
    return;
  }

  const entries = readHistory(historyPath);

  if (argv.includes('--export')) {
    console.log(exportHistory(entries));
    return;
  }

  if (entries.length === 0) {
    console.log('No command history found.');
    return;
  }

  const searchIdx = argv.indexOf('--search');
  if (searchIdx !== -1 && argv[searchIdx + 1]) {
    const term = argv[searchIdx + 1];
    const results = searchHistory(entries, term);
    console.log(`Search results for "${term}":\n`);
    console.log(formatHistoryTable(results));
    return;
  }

  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 && argv[limitIdx + 1] ? parseInt(argv[limitIdx + 1], 10) : DEFAULT_LIMIT;

  const last = getLastEntries(entries, limit);
  console.log(`Last ${last.length} commands:\n`);
  console.log(formatHistoryTable(last));
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runHistory,
  readHistory,
  appendHistory,
  clearHistory,
  getLastEntries,
  searchHistory,
  formatHistoryTable,
  exportHistory,
  getHistoryPath,
  DEFAULT_HISTORY_FILE,
  DEFAULT_LIMIT,
};
