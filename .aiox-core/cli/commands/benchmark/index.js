#!/usr/bin/env node

/**
 * AIOX CLI Benchmark
 * Measures execution time of CLI commands across multiple iterations.
 * Zero external dependencies. ES2022 CommonJS.
 *
 * @module benchmark
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_ITERATIONS = 5;

const BENCHMARK_COMMANDS = [
  { name: 'agents', args: ['--help'] },
  { name: 'palette', args: ['--help'] },
  { name: 'help', args: ['--raw'] },
  { name: 'status', args: [] },
  { name: 'telemetry', args: ['status'] },
  { name: 'progress', args: [] },
  { name: 'health', args: ['--skip-tests'] },
];

const AIOX_BIN = path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'aiox.js');

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Benchmark a single command N times.
 * @param {string} name - Command name (e.g. 'agents')
 * @param {string[]} args - Command arguments
 * @param {object} [options]
 * @param {number} [options.iterations=5]
 * @param {string} [options.aioxBin] - Path to aiox.js
 * @param {Function} [options.execFn] - Custom exec function (for testing)
 * @returns {{ name: string, args: string[], durations: number[], avg: number, min: number, max: number, p95: number }}
 */
function benchmarkCommand(name, args = [], options = {}) {
  const iterations = options.iterations != null ? options.iterations : DEFAULT_ITERATIONS;
  const bin = options.aioxBin || AIOX_BIN;
  const exec = options.execFn || execSync;

  if (typeof iterations !== 'number' || iterations < 1 || !Number.isInteger(iterations)) {
    throw new Error(`Invalid iterations: ${iterations}. Must be a positive integer.`);
  }

  const cmdStr = `node ${bin} ${name}${args.length ? ' ' + args.join(' ') : ''}`;
  const durations = [];

  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    try {
      exec(cmdStr, { stdio: 'pipe', timeout: 30000 });
    } catch {
      // Command may exit non-zero (e.g. --help exits 0 or 1 depending on impl)
      // We still measure the time
    }
    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1e6); // nanoseconds to ms
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[p95Index];

  return { name, args, durations, avg, min, max, p95 };
}

/**
 * Benchmark all commands.
 * @param {Array<{name: string, args: string[]}>} commands
 * @param {object} [options]
 * @returns {{ results: object[], totalTimeMs: number, commandCount: number }}
 */
function runAllBenchmarks(commands, options = {}) {
  const totalStart = process.hrtime.bigint();
  const results = [];

  for (const cmd of commands) {
    results.push(benchmarkCommand(cmd.name, cmd.args, options));
  }

  const totalEnd = process.hrtime.bigint();
  const totalTimeMs = Number(totalEnd - totalStart) / 1e6;

  return {
    results,
    totalTimeMs,
    commandCount: commands.length,
  };
}

/**
 * Format a number as milliseconds string (e.g. "45ms").
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
  return `${Math.round(ms)}ms`;
}

/**
 * Format benchmark results as a human-readable report.
 * @param {{ results: object[], totalTimeMs: number, commandCount: number }} benchmarkData
 * @param {object} [options]
 * @param {number} [options.iterations]
 * @returns {string}
 */
function formatBenchmarkReport(benchmarkData, options = {}) {
  const { results, totalTimeMs, commandCount } = benchmarkData;
  const iterations = options.iterations != null ? options.iterations : DEFAULT_ITERATIONS;

  const lines = [];

  lines.push('');
  lines.push(`AIOX CLI Benchmark (${iterations} iterations)`);
  lines.push('\u2501'.repeat(50));

  // Header
  const header = '  ' + [
    'Command'.padEnd(22),
    'Avg'.padStart(8),
    'Min'.padStart(8),
    'Max'.padStart(8),
    'P95'.padStart(8),
  ].join('');
  lines.push(header);

  // Rows
  for (const r of results) {
    const label = r.args.length ? `${r.name} ${r.args.join(' ')}` : r.name;
    const row = '  ' + [
      label.padEnd(22),
      formatMs(r.avg).padStart(8),
      formatMs(r.min).padStart(8),
      formatMs(r.max).padStart(8),
      formatMs(r.p95).padStart(8),
    ].join('');
    lines.push(row);
  }

  lines.push('');
  const totalSec = (totalTimeMs / 1000).toFixed(1);
  lines.push(`  Total: ${commandCount} commands benchmarked in ${totalSec}s`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format benchmark results as JSON.
 * @param {{ results: object[], totalTimeMs: number, commandCount: number }} benchmarkData
 * @param {object} [options]
 * @param {number} [options.iterations]
 * @returns {string}
 */
function formatBenchmarkJson(benchmarkData, options = {}) {
  const { results, totalTimeMs, commandCount } = benchmarkData;
  const iterations = options.iterations != null ? options.iterations : DEFAULT_ITERATIONS;

  const output = {
    iterations,
    commandCount,
    totalTimeMs: Math.round(totalTimeMs),
    commands: results.map(r => ({
      command: r.args.length ? `${r.name} ${r.args.join(' ')}` : r.name,
      avgMs: Math.round(r.avg),
      minMs: Math.round(r.min),
      maxMs: Math.round(r.max),
      p95Ms: Math.round(r.p95),
      durations: r.durations.map(d => Math.round(d)),
    })),
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Show help text.
 * @returns {string}
 */
function showHelp() {
  return [
    '',
    'AIOX CLI Benchmark',
    '',
    'USAGE:',
    '  aiox benchmark                  Run all benchmarks (5 iterations)',
    '  aiox benchmark --iterations 10  Custom iteration count',
    '  aiox benchmark --json           Machine-readable JSON output',
    '  aiox benchmark --help           Show this help',
    '',
    'COMMANDS BENCHMARKED:',
    ...BENCHMARK_COMMANDS.map(c =>
      `  ${c.name}${c.args.length ? ' ' + c.args.join(' ') : ''}`
    ),
    '',
  ].join('\n');
}

/**
 * Parse CLI args for benchmark options.
 * @param {string[]} argv
 * @returns {{ iterations: number, json: boolean, help: boolean }}
 */
function parseArgs(argv) {
  const result = { iterations: DEFAULT_ITERATIONS, json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--iterations' || arg === '-n') {
      const next = argv[i + 1];
      const val = parseInt(next, 10);
      if (!next || isNaN(val) || val < 1) {
        throw new Error(`--iterations requires a positive integer, got: ${next || '(nothing)'}`);
      }
      result.iterations = val;
      i++; // skip next
    }
  }

  return result;
}

/**
 * CLI handler — entry point from bin/aiox.js.
 * @param {string[]} argv - Arguments after 'benchmark' command
 */
function runBenchmark(argv = []) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(showHelp());
    return;
  }

  const data = runAllBenchmarks(BENCHMARK_COMMANDS, { iterations: opts.iterations });

  if (opts.json) {
    console.log(formatBenchmarkJson(data, { iterations: opts.iterations }));
  } else {
    console.log(formatBenchmarkReport(data, { iterations: opts.iterations }));
  }
}

// ── Exports ────────────────────────────────────────────────────────────

module.exports = {
  benchmarkCommand,
  runAllBenchmarks,
  formatBenchmarkReport,
  formatBenchmarkJson,
  formatMs,
  parseArgs,
  showHelp,
  runBenchmark,
  BENCHMARK_COMMANDS,
  DEFAULT_ITERATIONS,
  AIOX_BIN,
};
