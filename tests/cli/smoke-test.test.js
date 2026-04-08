'use strict';

const path = require('path');

// Mock child_process before requiring the module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const { execSync } = require('child_process');
const {
  runSmokeTest,
  executeCommand,
  formatResultLine,
  formatSummary,
  COMMANDS,
} = require('../../.aiox-core/cli/commands/smoke-test/index.js');

describe('CLI Smoke Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all commands succeed
    execSync.mockReturnValue('OK\n');
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  // --- COMMANDS constant ---

  describe('COMMANDS constant', () => {
    it('should export a non-empty array of commands', () => {
      expect(Array.isArray(COMMANDS)).toBe(true);
      expect(COMMANDS.length).toBeGreaterThanOrEqual(10);
    });

    it('each command should have name and args', () => {
      for (const cmd of COMMANDS) {
        expect(typeof cmd.name).toBe('string');
        expect(cmd.name.length).toBeGreaterThan(0);
        expect(Array.isArray(cmd.args)).toBe(true);
      }
    });

    it('should include core commands', () => {
      const names = COMMANDS.map((c) => c.name);
      expect(names).toContain('agents');
      expect(names).toContain('status');
      expect(names).toContain('info');
      expect(names).toContain('doctor');
      expect(names).toContain('help');
    });
  });

  // --- executeCommand ---

  describe('executeCommand', () => {
    it('should return passed=true when execSync succeeds', () => {
      execSync.mockReturnValue('output here');
      const result = executeCommand({ name: 'info', args: [] });
      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('output here');
      expect(result.name).toBe('info');
    });

    it('should return passed=false when execSync throws', () => {
      const error = new Error('fail');
      error.status = 2;
      error.stdout = 'partial output';
      error.stderr = 'error message';
      execSync.mockImplementation(() => { throw error; });

      const result = executeCommand({ name: 'doctor', args: [] });
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('partial output');
      expect(result.stderr).toBe('error message');
    });

    it('should default exitCode to 1 when error.status is undefined', () => {
      const error = new Error('timeout');
      execSync.mockImplementation(() => { throw error; });

      const result = executeCommand({ name: 'status', args: [] });
      expect(result.exitCode).toBe(1);
    });

    it('should pass correct command string to execSync', () => {
      execSync.mockReturnValue('');
      executeCommand({ name: 'agents', args: ['--help'] });

      const call = execSync.mock.calls[0][0];
      expect(call).toContain('aiox.js agents --help');
    });

    it('should set AIOX_SMOKE_TEST env variable', () => {
      execSync.mockReturnValue('');
      executeCommand({ name: 'info', args: [] });

      const opts = execSync.mock.calls[0][1];
      expect(opts.env.AIOX_SMOKE_TEST).toBe('1');
    });

    it('should include duration in result', () => {
      execSync.mockReturnValue('');
      const result = executeCommand({ name: 'info', args: [] });
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use custom binPath when provided', () => {
      execSync.mockReturnValue('');
      executeCommand({ name: 'info', args: [] }, { binPath: '/custom/aiox.js' });

      const call = execSync.mock.calls[0][0];
      expect(call).toContain('/custom/aiox.js');
    });

    it('should use custom timeout when provided', () => {
      execSync.mockReturnValue('');
      executeCommand({ name: 'info', args: [] }, { timeout: 5000 });

      const opts = execSync.mock.calls[0][1];
      expect(opts.timeout).toBe(5000);
    });
  });

  // --- formatResultLine ---

  describe('formatResultLine', () => {
    it('should format a passing result', () => {
      const line = formatResultLine({
        name: 'info', args: [], passed: true, exitCode: 0, duration: 123,
      });
      expect(line).toBe('[PASS] aiox info [123ms]');
    });

    it('should format a failing result with exit code', () => {
      const line = formatResultLine({
        name: 'status', args: [], passed: false, exitCode: 1, duration: 456,
      });
      expect(line).toBe('[FAIL] aiox status (exit code 1) [456ms]');
    });

    it('should include args in output', () => {
      const line = formatResultLine({
        name: 'agents', args: ['--help'], passed: true, exitCode: 0, duration: 50,
      });
      expect(line).toBe('[PASS] aiox agents --help [50ms]');
    });

    it('should handle multiple args', () => {
      const line = formatResultLine({
        name: 'help', args: ['--raw', '--verbose'], passed: true, exitCode: 0, duration: 10,
      });
      expect(line).toContain('--raw --verbose');
    });
  });

  // --- formatSummary ---

  describe('formatSummary', () => {
    it('should format all passed', () => {
      const summary = formatSummary({ passed: 10, total: 10 });
      expect(summary).toContain('10/10 commands passed');
    });

    it('should format partial pass', () => {
      const summary = formatSummary({ passed: 7, total: 10 });
      expect(summary).toContain('7/10 commands passed');
    });

    it('should format zero passed', () => {
      const summary = formatSummary({ passed: 0, total: 5 });
      expect(summary).toContain('0/5 commands passed');
    });
  });

  // --- runSmokeTest ---

  describe('runSmokeTest', () => {
    it('should return results array with correct length', () => {
      const summary = runSmokeTest([], { silent: true, noExit: true });
      expect(Array.isArray(summary.results)).toBe(true);
      expect(summary.results.length).toBe(COMMANDS.length);
    });

    it('should report allPassed=true when all succeed', () => {
      execSync.mockReturnValue('OK');
      const summary = runSmokeTest([], { silent: true, noExit: true });
      expect(summary.allPassed).toBe(true);
      expect(summary.passed).toBe(COMMANDS.length);
      expect(summary.failed).toBe(0);
    });

    it('should report allPassed=false when any command fails', () => {
      let callCount = 0;
      execSync.mockImplementation(() => {
        callCount++;
        if (callCount === 3) {
          const err = new Error('fail');
          err.status = 1;
          err.stdout = '';
          err.stderr = 'command failed';
          throw err;
        }
        return 'OK';
      });

      const summary = runSmokeTest([], { silent: true, noExit: true });
      expect(summary.allPassed).toBe(false);
      expect(summary.failed).toBe(1);
      expect(summary.passed).toBe(COMMANDS.length - 1);
    });

    it('should accept custom commands list', () => {
      const custom = [
        { name: 'test-cmd', args: ['--foo'] },
      ];
      const summary = runSmokeTest([], { commands: custom, silent: true, noExit: true });
      expect(summary.total).toBe(1);
      expect(summary.results[0].name).toBe('test-cmd');
    });

    it('should print output when not silent', () => {
      runSmokeTest([], { noExit: true });
      expect(console.log).toHaveBeenCalled();
      const output = console.log.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('AIOX CLI Smoke Test Suite');
      expect(output).toContain('commands passed');
    });

    it('should print failed commands detail when failures exist', () => {
      execSync.mockImplementation(() => {
        const err = new Error('fail');
        err.status = 1;
        err.stdout = '';
        err.stderr = 'some error detail';
        throw err;
      });

      runSmokeTest([], { noExit: true });
      const output = console.log.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Failed commands:');
    });

    it('should set process.exitCode to 0 when all pass', () => {
      const original = process.exitCode;
      runSmokeTest([], { silent: true });
      expect(process.exitCode).toBe(0);
      process.exitCode = original;
    });

    it('should set process.exitCode to 1 when any fail', () => {
      const original = process.exitCode;
      execSync.mockImplementation(() => {
        const err = new Error('fail');
        err.status = 1;
        err.stdout = '';
        err.stderr = '';
        throw err;
      });

      runSmokeTest([], { silent: true });
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });

    it('should not set process.exitCode when noExit is true', () => {
      const original = process.exitCode;
      process.exitCode = 42;
      runSmokeTest([], { silent: true, noExit: true });
      // noExit means it should not touch process.exitCode, so it stays at 42
      expect(process.exitCode).toBe(42);
      process.exitCode = original;
    });

    it('should count total correctly', () => {
      const summary = runSmokeTest([], { silent: true, noExit: true });
      expect(summary.total).toBe(summary.passed + summary.failed);
    });
  });
});
