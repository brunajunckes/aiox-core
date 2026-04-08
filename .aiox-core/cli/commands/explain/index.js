'use strict';

/**
 * Explain Command — Story 9.3
 *
 * `aiox explain AIOX-E001` — shows full error details
 * `aiox explain`           — shows usage help
 * `aiox explain --list`    — lists all error codes
 *
 * @module cli/commands/explain
 * @version 1.0.0
 */

const path = require('path');

// ─── Lazy-load error module ──────────────────────────────────────────────────

function loadErrorModule() {
  return require(path.resolve(__dirname, '..', '..', 'utils', 'error.js'));
}

// ─── Severity colors (ANSI) ─────────────────────────────────────────────────

const SEVERITY_PREFIX = {
  error: '\x1b[31m[ERROR]\x1b[0m',
  warning: '\x1b[33m[WARNING]\x1b[0m',
  info: '\x1b[36m[INFO]\x1b[0m',
};

// ─── Output helpers ─────────────────────────────────────────────────────────

function showUsage() {
  console.log(`
AIOX Error Explain

USAGE:
  aiox explain <error-code>   Show full details for an error code
  aiox explain --list         List all error codes
  aiox explain --help         Show this help

EXAMPLES:
  aiox explain AIOX-E001      Explain configuration file not found
  aiox explain AIOX-E030      Explain git repository not initialized
`);
}

function showErrorDetail(entry) {
  const sev = SEVERITY_PREFIX[entry.severity] || entry.severity;
  console.log(`
${sev} ${entry.code}: ${entry.message}

  Category:   ${entry.category}
  Severity:   ${entry.severity}
  Suggestion: ${entry.suggestion}
`);
}

function showAllErrors(errors) {
  console.log('\nAIOX Error Catalog\n');
  console.log('  Code         Severity  Category   Message');
  console.log('  ' + '─'.repeat(70));
  for (const e of errors) {
    const sev = e.severity.padEnd(9);
    const cat = e.category.padEnd(10);
    console.log(`  ${e.code}  ${sev} ${cat} ${e.message}`);
  }
  console.log(`\n  Total: ${errors.length} error codes\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

/**
 * Runs the explain command.
 * @param {string[]} argv  Arguments after 'explain'
 */
function runExplain(argv) {
  const { getErrorInfo, listAllErrors } = loadErrorModule();

  if (!argv || argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    showUsage();
    return;
  }

  if (argv[0] === '--list' || argv[0] === '-l') {
    const errors = listAllErrors();
    showAllErrors(errors);
    return;
  }

  const code = argv[0].toUpperCase();
  const entry = getErrorInfo(code);

  if (!entry) {
    console.error(`❌ Unknown error code: ${code}`);
    console.log("  Run 'aiox explain --list' to see all available codes.\n");
    process.exitCode = 1;
    return;
  }

  showErrorDetail(entry);
}

module.exports = { runExplain };
