'use strict';

/**
 * CLI Smoke Test Suite
 * Runs all CLI commands in a safe way and reports pass/fail.
 * Story 5.1 - Zero external dependencies.
 */

const { execSync } = require('child_process');
const path = require('path');

const COMMANDS = [
  { name: 'agents', args: ['--help'] },
  { name: 'palette', args: ['--help'] },
  { name: 'status', args: [] },
  { name: 'help', args: ['--raw'] },
  { name: 'telemetry', args: ['status'] },
  { name: 'experiment', args: ['list'] },
  { name: 'feedback', args: ['list'] },
  { name: 'squads', args: ['list'] },
  { name: 'info', args: [] },
  { name: 'doctor', args: [] },
];

const BIN_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'aiox.js');

/**
 * Execute a single smoke test command.
 * @param {{ name: string, args: string[] }} cmd
 * @param {{ binPath?: string, timeout?: number }} options
 * @returns {{ name: string, args: string[], passed: boolean, exitCode: number, stdout: string, stderr: string, duration: number }}
 */
function executeCommand(cmd, options = {}) {
  const bin = options.binPath || BIN_PATH;
  const timeout = options.timeout || 30000;
  const fullArgs = [cmd.name, ...cmd.args].join(' ');
  const fullCmd = `node ${bin} ${fullArgs}`;
  const start = Date.now();

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(fullCmd, {
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, AIOX_SMOKE_TEST: '1', NO_COLOR: '1' },
    });
  } catch (error) {
    exitCode = error.status || 1;
    stdout = error.stdout || '';
    stderr = error.stderr || '';
  }

  const duration = Date.now() - start;

  return {
    name: cmd.name,
    args: cmd.args,
    passed: exitCode === 0,
    exitCode,
    stdout,
    stderr,
    duration,
  };
}

/**
 * Format a single result line.
 * @param {{ name: string, args: string[], passed: boolean, exitCode: number, duration: number }} result
 * @returns {string}
 */
function formatResultLine(result) {
  const tag = result.passed ? '[PASS]' : '[FAIL]';
  const cmdStr = `aiox ${result.name}${result.args.length ? ' ' + result.args.join(' ') : ''}`;
  const failInfo = result.passed ? '' : ` (exit code ${result.exitCode})`;
  const timing = ` [${result.duration}ms]`;
  return `${tag} ${cmdStr}${failInfo}${timing}`;
}

/**
 * Format the summary line.
 * @param {{ passed: number, total: number }} counts
 * @returns {string}
 */
function formatSummary(counts) {
  return `\n${counts.passed}/${counts.total} commands passed`;
}

/**
 * Run the full smoke test suite.
 * @param {string[]} argv - CLI arguments (unused for now, reserved for future filters)
 * @param {{ commands?: Array, binPath?: string, timeout?: number, silent?: boolean }} options
 * @returns {{ results: Array, passed: number, failed: number, total: number, allPassed: boolean }}
 */
function runSmokeTest(argv = [], options = {}) {
  const commands = options.commands || COMMANDS;
  const silent = options.silent || false;
  const results = [];

  if (!silent) {
    console.log('AIOX CLI Smoke Test Suite');
    console.log('========================\n');
  }

  for (const cmd of commands) {
    const result = executeCommand(cmd, {
      binPath: options.binPath,
      timeout: options.timeout,
    });
    results.push(result);

    if (!silent) {
      console.log(formatResultLine(result));
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const total = results.length;
  const allPassed = failed === 0;

  const summary = { results, passed, failed, total, allPassed };

  if (!silent) {
    console.log(formatSummary({ passed, total }));

    if (!allPassed) {
      console.log('\nFailed commands:');
      for (const r of results.filter((r) => !r.passed)) {
        console.log(`  - aiox ${r.name}: exit code ${r.exitCode}`);
        if (r.stderr) {
          const firstLine = r.stderr.split('\n')[0];
          console.log(`    ${firstLine}`);
        }
      }
    }
  }

  if (!options.noExit) {
    process.exitCode = allPassed ? 0 : 1;
  }

  return summary;
}

module.exports = { runSmokeTest, executeCommand, formatResultLine, formatSummary, COMMANDS };
