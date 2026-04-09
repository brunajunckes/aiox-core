/**
 * Watch Mode for File Changes
 *
 * Subcommands:
 *   aiox watch                              — watch src files, run tests on change
 *   aiox watch --command "npm run lint"     — custom command on file change
 *   aiox watch --pattern "**\/*.js"          — custom glob pattern
 *   aiox watch --debounce 500               — debounce interval in ms (default: 300)
 *   aiox watch --help                       — show help
 *
 * @module cli/commands/watch
 * @version 1.0.0
 * @story 15.2 — Watch Mode for File Changes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE = 300;
const DEFAULT_COMMAND = 'npm test';
const DEFAULT_PATTERN = '**/*.js';
const IGNORE_DIRS = ['node_modules', '.git', 'coverage', 'dist', '.aiox'];

const HELP_TEXT = `
WATCH MODE FOR FILE CHANGES

USAGE:
  aiox watch                                Watch src files, run tests on change
  aiox watch --command "<cmd>"              Custom command on file change
  aiox watch --pattern "<glob>"             Custom glob pattern (default: **/*.js)
  aiox watch --debounce <ms>                Debounce interval in ms (default: 300)
  aiox watch --help                         Show this help

EXAMPLES:
  aiox watch
  aiox watch --command "npm run lint"
  aiox watch --pattern "src/**/*.ts" --debounce 500
  aiox watch --command "npm run build" --pattern "**/*.js"
`.trim();

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse watch arguments.
 * @param {string[]} argv
 * @returns {{ command: string, pattern: string, debounce: number, help: boolean }}
 */
function parseWatchArgs(argv) {
  const result = {
    command: DEFAULT_COMMAND,
    pattern: DEFAULT_PATTERN,
    debounce: DEFAULT_DEBOUNCE,
    help: false,
  };

  if (!argv || !argv.length) return result;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--command' && argv[i + 1]) {
      result.command = argv[++i];
    } else if (arg === '--pattern' && argv[i + 1]) {
      result.pattern = argv[++i];
    } else if (arg === '--debounce' && argv[i + 1]) {
      const val = parseInt(argv[++i], 10);
      if (!isNaN(val) && val > 0) result.debounce = val;
    }
  }

  return result;
}

/**
 * Check if a file path matches a simple glob pattern.
 * Supports: *.js, **\/*.js, src/**\/*.ts, etc.
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
function matchesPattern(filePath, pattern) {
  // Normalize
  const normalized = filePath.replace(/\\/g, '/');

  // Convert glob to regex
  const pat = pattern.replace(/\\/g, '/');

  // Replace glob ? first (before we introduce regex ?), then handle **, *, .
  const PLACEHOLDER_STAR2 = '___GLOBSTAR___';
  const PLACEHOLDER_Q = '___QMARK___';
  let regex = pat
    .replace(/\?/g, PLACEHOLDER_Q)         // save glob ? first
    .replace(/\*\*\//g, PLACEHOLDER_STAR2) // save **/
    .replace(/\./g, '\\.')                  // escape dots
    .replace(/\*/g, '[^/]*')               // single *
    .replace(new RegExp(PLACEHOLDER_STAR2, 'g'), '(.+/)?')  // restore **/
    .replace(new RegExp(PLACEHOLDER_Q, 'g'), '[^/]');        // restore ?

  regex = '^(' + regex + ')$';

  try {
    const re = new RegExp(regex);
    // Test against full path and basename
    return re.test(normalized) || re.test(normalized.split('/').pop());
  } catch {
    return false;
  }
}

/**
 * Check if a path should be ignored.
 * @param {string} filePath
 * @returns {boolean}
 */
function shouldIgnore(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.some(p => IGNORE_DIRS.includes(p));
}

/**
 * Get all watchable directories recursively.
 * @param {string} dir
 * @param {string[]} [result]
 * @returns {string[]}
 */
function getWatchDirs(dir, result = []) {
  if (shouldIgnore(dir)) return result;

  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) return result;
  } catch {
    return result;
  }

  result.push(dir);

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (IGNORE_DIRS.includes(entry)) continue;
      const full = path.join(dir, entry);
      try {
        if (fs.statSync(full).isDirectory()) {
          getWatchDirs(full, result);
        }
      } catch {
        // Skip inaccessible
      }
    }
  } catch {
    // Skip unreadable dirs
  }

  return result;
}

/**
 * Create a debounced function.
 * @param {function} fn
 * @param {number} delay
 * @returns {function}
 */
function debounce(fn, delay) {
  let timer = null;
  const debounced = function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  debounced.pending = () => timer !== null;
  return debounced;
}

/**
 * Execute the watch command.
 * @param {string} command
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {{ success: boolean, output: string, error: string }}
 */
function executeWatchCommand(command, options = {}) {
  const exec = options.execFn || execSync;
  const cwd = options.cwd || process.cwd();

  try {
    const output = exec(command, { encoding: 'utf8', cwd, stdio: 'pipe' });
    return { success: true, output: output || '', error: '' };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || '',
      error: err.stderr || err.message || 'Unknown error',
    };
  }
}

/**
 * Start watching directories for file changes.
 * @param {object} config
 * @param {string} config.command
 * @param {string} config.pattern
 * @param {number} config.debounce
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @param {function} [options.onEvent] - callback for events (for testing)
 * @param {function} [options.watchFn] - custom fs.watch (for testing)
 * @returns {{ watchers: Array, stop: function }}
 */
function startWatch(config, options = {}) {
  const cwd = options.cwd || process.cwd();
  const watchFn = options.watchFn || fs.watch;
  const watchers = [];
  let running = false;

  const onFileChange = debounce((eventType, filename) => {
    if (!filename) return;
    if (shouldIgnore(filename)) return;
    if (!matchesPattern(filename, config.pattern)) return;
    if (running) return;

    running = true;
    if (options.onEvent) options.onEvent('change', filename);

    const result = executeWatchCommand(config.command, {
      execFn: options.execFn,
      cwd,
    });

    if (options.onEvent) {
      options.onEvent('result', result);
    }
    running = false;
  }, config.debounce);

  const dirs = getWatchDirs(cwd);
  for (const dir of dirs) {
    try {
      const watcher = watchFn(dir, { recursive: false }, (eventType, filename) => {
        onFileChange(eventType, filename);
      });
      watchers.push(watcher);
    } catch {
      // Skip unwatchable directories
    }
  }

  const stop = () => {
    onFileChange.cancel();
    for (const w of watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    watchers.length = 0;
  };

  return { watchers, stop };
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Main entry point for the watch command.
 * @param {string[]} argv
 */
function runWatch(argv) {
  const config = parseWatchArgs(argv);

  if (config.help) {
    console.log(HELP_TEXT);
    return;
  }

  console.log(`Watching for changes (pattern: ${config.pattern}, debounce: ${config.debounce}ms)`);
  console.log(`Command: ${config.command}`);
  console.log('Press Ctrl+C to stop\n');

  const { stop } = startWatch(config);

  process.on('SIGINT', () => {
    console.log('\nStopping watcher...');
    stop();
    process.exit(0);
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parseWatchArgs,
  matchesPattern,
  shouldIgnore,
  getWatchDirs,
  debounce,
  executeWatchCommand,
  startWatch,
  runWatch,
  getHelpText: () => HELP_TEXT,
  DEFAULT_DEBOUNCE,
  DEFAULT_COMMAND,
  DEFAULT_PATTERN,
  IGNORE_DIRS,
};
