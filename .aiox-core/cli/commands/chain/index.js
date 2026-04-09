/**
 * Command Chaining & Pipelines
 *
 * Run multiple AIOX commands sequentially or in parallel with timing/status reporting.
 *
 * Usage:
 *   aiox chain "lint,test,coverage --check"        — sequential, stop on first failure
 *   aiox chain --parallel "lint,typecheck"          — run in parallel
 *   aiox chain --continue-on-error "lint,test"      — run all, report at end
 *   aiox chain --help                               — show help
 *
 * @module cli/commands/chain
 * @version 1.0.0
 * @story 13.1 — Command Chaining & Pipelines
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
COMMAND CHAINING & PIPELINES

USAGE:
  aiox chain "<commands>"                     Run commands sequentially (stop on first failure)
  aiox chain --parallel "<commands>"          Run commands in parallel
  aiox chain --continue-on-error "<commands>" Run all commands even if some fail
  aiox chain --help                           Show this help

EXAMPLES:
  aiox chain "lint,test,coverage"
  aiox chain --parallel "lint,typecheck"
  aiox chain --continue-on-error "lint,test,build"

Commands are comma-separated. Each command is run as "aiox <cmd>".
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a comma-separated command string into an array of commands.
 * @param {string} input - Comma-separated command string
 * @returns {string[]}
 */
function parseCommands(input) {
  if (!input || typeof input !== 'string') return [];
  return input.split(',').map(c => c.trim()).filter(Boolean);
}

/**
 * Execute a single command synchronously and return result.
 * @param {string} cmd - Command to run
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @param {string} [options.cwd] - Working directory
 * @returns {{ command: string, success: boolean, durationMs: number, output: string, error: string }}
 */
function executeCommand(cmd, options = {}) {
  const exec = options.execFn || execSync;
  const cwd = options.cwd || process.cwd();
  const binPath = path.join(__dirname, '..', '..', '..', '..', 'bin', 'aiox.js');
  const fullCmd = `node "${binPath}" ${cmd}`;

  const start = Date.now();
  try {
    const output = exec(fullCmd, { encoding: 'utf8', cwd, stdio: 'pipe' });
    const durationMs = Date.now() - start;
    return { command: cmd, success: true, durationMs, output: output || '', error: '' };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      command: cmd,
      success: false,
      durationMs,
      output: (err.stdout || ''),
      error: (err.stderr || err.message || 'Unknown error'),
    };
  }
}

/**
 * Run commands sequentially (stop on first failure by default).
 * @param {string[]} commands
 * @param {object} [options]
 * @param {boolean} [options.continueOnError=false]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {{ results: Array, allPassed: boolean, totalMs: number }}
 */
function runSequential(commands, options = {}) {
  const results = [];
  const totalStart = Date.now();

  for (const cmd of commands) {
    const result = executeCommand(cmd, options);
    results.push(result);
    if (!result.success && !options.continueOnError) {
      break;
    }
  }

  const totalMs = Date.now() - totalStart;
  const allPassed = results.every(r => r.success);
  return { results, allPassed, totalMs };
}

/**
 * Run commands in parallel.
 * @param {string[]} commands
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {{ results: Array, allPassed: boolean, totalMs: number }}
 */
function runParallel(commands, options = {}) {
  const totalStart = Date.now();
  // In synchronous Node, we simulate parallel by running all regardless of failures
  const results = commands.map(cmd => executeCommand(cmd, options));
  const totalMs = Date.now() - totalStart;
  const allPassed = results.every(r => r.success);
  return { results, allPassed, totalMs };
}

/**
 * Format a results summary as a string.
 * @param {{ results: Array, allPassed: boolean, totalMs: number }} report
 * @returns {string}
 */
function formatReport(report) {
  const lines = [];
  lines.push('');
  lines.push('CHAIN RESULTS');
  lines.push('─'.repeat(50));

  for (const r of report.results) {
    const status = r.success ? 'PASS' : 'FAIL';
    const icon = r.success ? '✓' : '✗';
    lines.push(`  ${icon} ${status}  ${r.command}  (${r.durationMs}ms)`);
  }

  lines.push('─'.repeat(50));
  const passed = report.results.filter(r => r.success).length;
  const total = report.results.length;
  lines.push(`  ${passed}/${total} passed  |  Total: ${report.totalMs}ms`);
  lines.push(`  Status: ${report.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Main entry point for the chain command.
 * @param {string[]} args - CLI arguments after "chain"
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {{ results: Array, allPassed: boolean, totalMs: number }|null}
 */
function runChain(args, options = {}) {
  if (!args || args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return null;
  }

  const isParallel = args.includes('--parallel');
  const isContinueOnError = args.includes('--continue-on-error');

  // Find the command string (first arg that's not a flag)
  const cmdString = args.find(a => !a.startsWith('--'));
  if (!cmdString) {
    console.error('Error: No commands specified.');
    console.log('Usage: aiox chain "cmd1,cmd2,cmd3"');
    return null;
  }

  const commands = parseCommands(cmdString);
  if (commands.length === 0) {
    console.error('Error: No valid commands found in input.');
    return null;
  }

  let report;
  if (isParallel) {
    report = runParallel(commands, options);
  } else {
    report = runSequential(commands, { ...options, continueOnError: isContinueOnError });
  }

  console.log(formatReport(report));

  if (!report.allPassed) {
    process.exitCode = 1;
  }

  return report;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return HELP_TEXT;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  parseCommands,
  executeCommand,
  runSequential,
  runParallel,
  formatReport,
  runChain,
  getHelpText,
};
