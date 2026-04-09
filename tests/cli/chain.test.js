/**
 * Tests for Command Chaining & Pipelines
 *
 * @module tests/cli/chain
 * @story 13.1 — Command Chaining & Pipelines
 */

'use strict';

const {
  parseCommands,
  executeCommand,
  runSequential,
  runParallel,
  formatReport,
  runChain,
  getHelpText,
} = require('../../.aiox-core/cli/commands/chain/index.js');

// ── parseCommands ────────────────────────────────────────────────────────────

describe('parseCommands', () => {
  test('parses comma-separated commands', () => {
    expect(parseCommands('lint,test,build')).toEqual(['lint', 'test', 'build']);
  });

  test('trims whitespace', () => {
    expect(parseCommands(' lint , test , build ')).toEqual(['lint', 'test', 'build']);
  });

  test('filters empty entries', () => {
    expect(parseCommands('lint,,test,')).toEqual(['lint', 'test']);
  });

  test('returns empty array for null input', () => {
    expect(parseCommands(null)).toEqual([]);
  });

  test('returns empty array for empty string', () => {
    expect(parseCommands('')).toEqual([]);
  });

  test('returns empty array for non-string input', () => {
    expect(parseCommands(123)).toEqual([]);
  });

  test('handles single command', () => {
    expect(parseCommands('lint')).toEqual(['lint']);
  });
});

// ── executeCommand ───────────────────────────────────────────────────────────

describe('executeCommand', () => {
  test('returns success for passing command', () => {
    const mockExec = jest.fn().mockReturnValue('ok\n');
    const result = executeCommand('help', { execFn: mockExec });
    expect(result.command).toBe('help');
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.output).toBe('ok\n');
    expect(result.error).toBe('');
  });

  test('returns failure for failing command', () => {
    const mockExec = jest.fn().mockImplementation(() => {
      const err = new Error('fail');
      err.stderr = 'some error';
      throw err;
    });
    const result = executeCommand('badcmd', { execFn: mockExec });
    expect(result.command).toBe('badcmd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('some error');
  });

  test('handles error without stderr', () => {
    const mockExec = jest.fn().mockImplementation(() => {
      throw new Error('boom');
    });
    const result = executeCommand('badcmd', { execFn: mockExec });
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  test('captures stdout on failure', () => {
    const mockExec = jest.fn().mockImplementation(() => {
      const err = new Error('fail');
      err.stdout = 'partial output';
      err.stderr = 'error info';
      throw err;
    });
    const result = executeCommand('cmd', { execFn: mockExec });
    expect(result.output).toBe('partial output');
  });
});

// ── runSequential ────────────────────────────────────────────────────────────

describe('runSequential', () => {
  test('runs all commands when all pass', () => {
    const mockExec = jest.fn().mockReturnValue('ok');
    const report = runSequential(['lint', 'test', 'build'], { execFn: mockExec });
    expect(report.results).toHaveLength(3);
    expect(report.allPassed).toBe(true);
    expect(report.totalMs).toBeGreaterThanOrEqual(0);
  });

  test('stops on first failure by default', () => {
    let callCount = 0;
    const mockExec = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error('fail');
      return 'ok';
    });
    const report = runSequential(['lint', 'test', 'build'], { execFn: mockExec });
    expect(report.results).toHaveLength(2);
    expect(report.allPassed).toBe(false);
  });

  test('continues on error when flag set', () => {
    let callCount = 0;
    const mockExec = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error('fail');
      return 'ok';
    });
    const report = runSequential(['lint', 'test', 'build'], {
      execFn: mockExec,
      continueOnError: true,
    });
    expect(report.results).toHaveLength(3);
    expect(report.allPassed).toBe(false);
  });

  test('returns allPassed=true when empty', () => {
    const report = runSequential([], { execFn: jest.fn() });
    expect(report.results).toHaveLength(0);
    expect(report.allPassed).toBe(true);
  });
});

// ── runParallel ──────────────────────────────────────────────────────────────

describe('runParallel', () => {
  test('runs all commands regardless of failures', () => {
    let callCount = 0;
    const mockExec = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return 'ok';
    });
    const report = runParallel(['lint', 'test'], { execFn: mockExec });
    expect(report.results).toHaveLength(2);
    expect(report.results[0].success).toBe(false);
    expect(report.results[1].success).toBe(true);
    expect(report.allPassed).toBe(false);
  });

  test('reports allPassed when all succeed', () => {
    const mockExec = jest.fn().mockReturnValue('ok');
    const report = runParallel(['lint', 'test'], { execFn: mockExec });
    expect(report.allPassed).toBe(true);
  });
});

// ── formatReport ─────────────────────────────────────────────────────────────

describe('formatReport', () => {
  test('formats passing report', () => {
    const report = {
      results: [
        { command: 'lint', success: true, durationMs: 100, output: '', error: '' },
        { command: 'test', success: true, durationMs: 200, output: '', error: '' },
      ],
      allPassed: true,
      totalMs: 300,
    };
    const output = formatReport(report);
    expect(output).toContain('CHAIN RESULTS');
    expect(output).toContain('PASS');
    expect(output).toContain('lint');
    expect(output).toContain('test');
    expect(output).toContain('2/2 passed');
    expect(output).toContain('ALL PASSED');
  });

  test('formats failing report', () => {
    const report = {
      results: [
        { command: 'lint', success: true, durationMs: 100, output: '', error: '' },
        { command: 'test', success: false, durationMs: 200, output: '', error: 'err' },
      ],
      allPassed: false,
      totalMs: 300,
    };
    const output = formatReport(report);
    expect(output).toContain('FAIL');
    expect(output).toContain('1/2 passed');
    expect(output).toContain('FAILURES DETECTED');
  });
});

// ── runChain ─────────────────────────────────────────────────────────────────

describe('runChain', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  test('shows help with no args', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runChain([]);
    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runChain(['--help']);
    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('errors on no command string', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const result = runChain(['--parallel']);
    expect(result).toBeNull();
    spy.mockRestore();
    logSpy.mockRestore();
  });

  test('errors on empty command list', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const result = runChain([',,']);
    expect(result).toBeNull();
    spy.mockRestore();
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const text = getHelpText();
    expect(text).toContain('COMMAND CHAINING');
    expect(text).toContain('--parallel');
    expect(text).toContain('--continue-on-error');
  });
});
