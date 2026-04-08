/**
 * Tests for AIOX CLI Benchmark module
 * @module tests/cli/benchmark
 */

'use strict';

const {
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
} = require('../../.aiox-core/cli/commands/benchmark/index.js');

// ── Helpers ────────────────────────────────────────────────────────────

/** Create a mock execSync that takes ~1ms per call */
function createMockExec(failOnCall = false) {
  const calls = [];
  const fn = (cmd, opts) => {
    calls.push({ cmd, opts });
    if (failOnCall) {
      const err = new Error('mock error');
      err.status = 1;
      throw err;
    }
    return Buffer.from('mock output');
  };
  fn.calls = calls;
  return fn;
}

/** Create a slow mock that burns ~N ms */
function createTimedMockExec(delayMs = 5) {
  const calls = [];
  const fn = (cmd, opts) => {
    calls.push({ cmd, opts });
    const start = Date.now();
    while (Date.now() - start < delayMs) { /* spin */ }
    return Buffer.from('ok');
  };
  fn.calls = calls;
  return fn;
}

// ── Constants ──────────────────────────────────────────────────────────

describe('Benchmark constants', () => {
  test('DEFAULT_ITERATIONS is 5', () => {
    expect(DEFAULT_ITERATIONS).toBe(5);
  });

  test('BENCHMARK_COMMANDS has 7 entries', () => {
    expect(BENCHMARK_COMMANDS).toHaveLength(7);
  });

  test('all commands have name and args', () => {
    for (const cmd of BENCHMARK_COMMANDS) {
      expect(cmd).toHaveProperty('name');
      expect(cmd).toHaveProperty('args');
      expect(typeof cmd.name).toBe('string');
      expect(Array.isArray(cmd.args)).toBe(true);
    }
  });

  test('AIOX_BIN points to bin/aiox.js', () => {
    expect(AIOX_BIN).toMatch(/bin\/aiox\.js$/);
  });

  test('commands are read-only safe (--help, status, etc)', () => {
    const names = BENCHMARK_COMMANDS.map(c => c.name);
    expect(names).toContain('agents');
    expect(names).toContain('palette');
    expect(names).toContain('help');
    expect(names).toContain('status');
    expect(names).toContain('telemetry');
    expect(names).toContain('progress');
    expect(names).toContain('health');
  });
});

// ── formatMs ───────────────────────────────────────────────────────────

describe('formatMs', () => {
  test('formats integer ms', () => {
    expect(formatMs(45)).toBe('45ms');
  });

  test('rounds fractional ms', () => {
    expect(formatMs(45.7)).toBe('46ms');
    expect(formatMs(45.2)).toBe('45ms');
  });

  test('formats zero', () => {
    expect(formatMs(0)).toBe('0ms');
  });

  test('formats large values', () => {
    expect(formatMs(12345)).toBe('12345ms');
  });
});

// ── parseArgs ──────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('defaults: 5 iterations, no json, no help', () => {
    const result = parseArgs([]);
    expect(result).toEqual({ iterations: 5, json: false, help: false });
  });

  test('--help flag', () => {
    expect(parseArgs(['--help']).help).toBe(true);
  });

  test('-h flag', () => {
    expect(parseArgs(['-h']).help).toBe(true);
  });

  test('--json flag', () => {
    expect(parseArgs(['--json']).json).toBe(true);
  });

  test('--iterations N', () => {
    expect(parseArgs(['--iterations', '10']).iterations).toBe(10);
  });

  test('-n N shorthand', () => {
    expect(parseArgs(['-n', '3']).iterations).toBe(3);
  });

  test('combined flags', () => {
    const result = parseArgs(['--json', '--iterations', '20']);
    expect(result.json).toBe(true);
    expect(result.iterations).toBe(20);
  });

  test('throws on missing iteration value', () => {
    expect(() => parseArgs(['--iterations'])).toThrow(/positive integer/);
  });

  test('throws on non-numeric iteration value', () => {
    expect(() => parseArgs(['--iterations', 'abc'])).toThrow(/positive integer/);
  });

  test('throws on zero iterations', () => {
    expect(() => parseArgs(['--iterations', '0'])).toThrow(/positive integer/);
  });

  test('throws on negative iterations', () => {
    expect(() => parseArgs(['--iterations', '-1'])).toThrow(/positive integer/);
  });
});

// ── benchmarkCommand ───────────────────────────────────────────────────

describe('benchmarkCommand', () => {
  test('returns correct structure', () => {
    const exec = createMockExec();
    const result = benchmarkCommand('agents', ['--help'], {
      iterations: 3,
      execFn: exec,
    });

    expect(result).toHaveProperty('name', 'agents');
    expect(result).toHaveProperty('args', ['--help']);
    expect(result).toHaveProperty('durations');
    expect(result).toHaveProperty('avg');
    expect(result).toHaveProperty('min');
    expect(result).toHaveProperty('max');
    expect(result).toHaveProperty('p95');
    expect(result.durations).toHaveLength(3);
  });

  test('calls execFn N times', () => {
    const exec = createMockExec();
    benchmarkCommand('status', [], { iterations: 7, execFn: exec });
    expect(exec.calls).toHaveLength(7);
  });

  test('command string includes name and args', () => {
    const exec = createMockExec();
    benchmarkCommand('health', ['--skip-tests'], { iterations: 1, execFn: exec });
    expect(exec.calls[0].cmd).toContain('health');
    expect(exec.calls[0].cmd).toContain('--skip-tests');
  });

  test('command string with no args', () => {
    const exec = createMockExec();
    benchmarkCommand('status', [], { iterations: 1, execFn: exec });
    expect(exec.calls[0].cmd).toMatch(/status$/);
  });

  test('min <= avg <= max', () => {
    const exec = createTimedMockExec(2);
    const result = benchmarkCommand('test', [], { iterations: 5, execFn: exec });
    expect(result.min).toBeLessThanOrEqual(result.avg);
    expect(result.avg).toBeLessThanOrEqual(result.max);
  });

  test('p95 <= max', () => {
    const exec = createMockExec();
    const result = benchmarkCommand('test', [], { iterations: 10, execFn: exec });
    expect(result.p95).toBeLessThanOrEqual(result.max);
  });

  test('p95 >= min', () => {
    const exec = createMockExec();
    const result = benchmarkCommand('test', [], { iterations: 10, execFn: exec });
    expect(result.p95).toBeGreaterThanOrEqual(result.min);
  });

  test('handles command failures gracefully', () => {
    const exec = createMockExec(true);
    const result = benchmarkCommand('fail', [], { iterations: 3, execFn: exec });
    expect(result.durations).toHaveLength(3);
    expect(result.avg).toBeGreaterThan(0);
  });

  test('throws on invalid iterations', () => {
    const exec = createMockExec();
    expect(() => benchmarkCommand('x', [], { iterations: 0, execFn: exec })).toThrow(/Invalid iterations/);
    expect(() => benchmarkCommand('x', [], { iterations: -1, execFn: exec })).toThrow(/Invalid iterations/);
    expect(() => benchmarkCommand('x', [], { iterations: 1.5, execFn: exec })).toThrow(/Invalid iterations/);
  });

  test('durations are positive numbers', () => {
    const exec = createMockExec();
    const result = benchmarkCommand('test', [], { iterations: 3, execFn: exec });
    for (const d of result.durations) {
      expect(typeof d).toBe('number');
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  test('passes timeout to exec', () => {
    const exec = createMockExec();
    benchmarkCommand('test', [], { iterations: 1, execFn: exec });
    expect(exec.calls[0].opts).toHaveProperty('timeout', 30000);
  });

  test('passes stdio pipe to exec', () => {
    const exec = createMockExec();
    benchmarkCommand('test', [], { iterations: 1, execFn: exec });
    expect(exec.calls[0].opts).toHaveProperty('stdio', 'pipe');
  });
});

// ── runAllBenchmarks ───────────────────────────────────────────────────

describe('runAllBenchmarks', () => {
  test('benchmarks all commands', () => {
    const exec = createMockExec();
    const commands = [
      { name: 'a', args: [] },
      { name: 'b', args: ['--help'] },
    ];
    const data = runAllBenchmarks(commands, { iterations: 2, execFn: exec });
    expect(data.results).toHaveLength(2);
    expect(data.commandCount).toBe(2);
    expect(data.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  test('returns totalTimeMs', () => {
    const exec = createMockExec();
    const data = runAllBenchmarks([{ name: 'x', args: [] }], { iterations: 1, execFn: exec });
    expect(typeof data.totalTimeMs).toBe('number');
  });

  test('empty commands array', () => {
    const data = runAllBenchmarks([], { iterations: 1 });
    expect(data.results).toHaveLength(0);
    expect(data.commandCount).toBe(0);
  });

  test('passes options through to benchmarkCommand', () => {
    const exec = createMockExec();
    const data = runAllBenchmarks(
      [{ name: 'test', args: [] }],
      { iterations: 8, execFn: exec }
    );
    expect(data.results[0].durations).toHaveLength(8);
  });
});

// ── formatBenchmarkReport ──────────────────────────────────────────────

describe('formatBenchmarkReport', () => {
  const sampleData = {
    results: [
      { name: 'agents', args: ['--help'], durations: [45, 42, 52], avg: 46.3, min: 42, max: 52, p95: 50 },
      { name: 'status', args: [], durations: [89, 85, 95], avg: 89.7, min: 85, max: 95, p95: 93 },
    ],
    totalTimeMs: 2300,
    commandCount: 2,
  };

  test('includes header with iteration count', () => {
    const report = formatBenchmarkReport(sampleData, { iterations: 5 });
    expect(report).toContain('AIOX CLI Benchmark (5 iterations)');
  });

  test('includes column headers', () => {
    const report = formatBenchmarkReport(sampleData);
    expect(report).toContain('Command');
    expect(report).toContain('Avg');
    expect(report).toContain('Min');
    expect(report).toContain('Max');
    expect(report).toContain('P95');
  });

  test('includes command names', () => {
    const report = formatBenchmarkReport(sampleData);
    expect(report).toContain('agents --help');
    expect(report).toContain('status');
  });

  test('includes ms values', () => {
    const report = formatBenchmarkReport(sampleData);
    expect(report).toContain('46ms');
    expect(report).toContain('42ms');
    expect(report).toContain('52ms');
  });

  test('includes total line', () => {
    const report = formatBenchmarkReport(sampleData);
    expect(report).toContain('Total: 2 commands benchmarked in 2.3s');
  });

  test('returns string', () => {
    const report = formatBenchmarkReport(sampleData);
    expect(typeof report).toBe('string');
  });
});

// ── formatBenchmarkJson ────────────────────────────────────────────────

describe('formatBenchmarkJson', () => {
  const sampleData = {
    results: [
      { name: 'agents', args: ['--help'], durations: [45, 42], avg: 43.5, min: 42, max: 45, p95: 45 },
    ],
    totalTimeMs: 500,
    commandCount: 1,
  };

  test('returns valid JSON string', () => {
    const json = formatBenchmarkJson(sampleData, { iterations: 2 });
    const parsed = JSON.parse(json);
    expect(parsed).toBeDefined();
  });

  test('includes iterations field', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData, { iterations: 2 }));
    expect(parsed.iterations).toBe(2);
  });

  test('includes commands array', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData));
    expect(parsed.commands).toHaveLength(1);
    expect(parsed.commands[0].command).toBe('agents --help');
  });

  test('command has all metrics', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData));
    const cmd = parsed.commands[0];
    expect(cmd).toHaveProperty('avgMs');
    expect(cmd).toHaveProperty('minMs');
    expect(cmd).toHaveProperty('maxMs');
    expect(cmd).toHaveProperty('p95Ms');
    expect(cmd).toHaveProperty('durations');
  });

  test('metrics are rounded integers', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData));
    const cmd = parsed.commands[0];
    expect(Number.isInteger(cmd.avgMs)).toBe(true);
    expect(Number.isInteger(cmd.totalTimeMs || parsed.totalTimeMs)).toBe(true);
  });

  test('includes totalTimeMs', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData));
    expect(parsed.totalTimeMs).toBe(500);
  });

  test('includes commandCount', () => {
    const parsed = JSON.parse(formatBenchmarkJson(sampleData));
    expect(parsed.commandCount).toBe(1);
  });
});

// ── showHelp ───────────────────────────────────────────────────────────

describe('showHelp', () => {
  test('returns string', () => {
    expect(typeof showHelp()).toBe('string');
  });

  test('includes usage info', () => {
    const help = showHelp();
    expect(help).toContain('USAGE:');
    expect(help).toContain('aiox benchmark');
  });

  test('lists benchmarked commands', () => {
    const help = showHelp();
    expect(help).toContain('COMMANDS BENCHMARKED:');
    expect(help).toContain('agents');
    expect(help).toContain('health');
  });

  test('mentions --iterations flag', () => {
    expect(showHelp()).toContain('--iterations');
  });

  test('mentions --json flag', () => {
    expect(showHelp()).toContain('--json');
  });
});

// ── runBenchmark (CLI handler) ─────────────────────────────────────────

describe('runBenchmark', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('--help prints help text', () => {
    runBenchmark(['--help']);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('USAGE:');
  });

  test('-h prints help text', () => {
    runBenchmark(['-h']);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
