'use strict';

const path = require('path');

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
  ONBOARDING_COMMANDS,
} = require('../../.aiox-core/cli/commands/smoke-test/index.js');

describe('Onboarding Smoke Test — Story 32.4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    execSync.mockReturnValue('OK\n');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // --- ONBOARDING_COMMANDS ---

  describe('ONBOARDING_COMMANDS', () => {
    it('should be a non-empty array', () => {
      expect(Array.isArray(ONBOARDING_COMMANDS)).toBe(true);
      expect(ONBOARDING_COMMANDS.length).toBeGreaterThanOrEqual(5);
    });

    it('each command should have name, args, and label', () => {
      for (const cmd of ONBOARDING_COMMANDS) {
        expect(typeof cmd.name).toBe('string');
        expect(Array.isArray(cmd.args)).toBe(true);
        expect(typeof cmd.label).toBe('string');
      }
    });

    it('should include quickstart command', () => {
      const names = ONBOARDING_COMMANDS.map((c) => c.name);
      expect(names).toContain('quickstart');
    });

    it('should include ide-matrix command', () => {
      const names = ONBOARDING_COMMANDS.map((c) => c.name);
      expect(names).toContain('ide-matrix');
    });

    it('should include getting-started command', () => {
      const names = ONBOARDING_COMMANDS.map((c) => c.name);
      expect(names).toContain('getting-started');
    });

    it('should include help command', () => {
      const names = ONBOARDING_COMMANDS.map((c) => c.name);
      expect(names).toContain('help');
    });
  });

  // --- Onboarding mode via --onboarding ---

  describe('runSmokeTest with --onboarding', () => {
    it('should use ONBOARDING_COMMANDS when --onboarding flag passed', () => {
      const summary = runSmokeTest(['--onboarding'], { silent: true, noExit: true });
      expect(summary.total).toBe(ONBOARDING_COMMANDS.length);
      expect(summary.suite).toBe('onboarding');
    });

    it('should use default COMMANDS without --onboarding flag', () => {
      const summary = runSmokeTest([], { silent: true, noExit: true });
      expect(summary.total).toBe(COMMANDS.length);
      expect(summary.suite).toBe('default');
    });

    it('should report allPassed=true when all onboarding commands succeed', () => {
      execSync.mockReturnValue('OK');
      const summary = runSmokeTest(['--onboarding'], { silent: true, noExit: true });
      expect(summary.allPassed).toBe(true);
      expect(summary.passed).toBe(ONBOARDING_COMMANDS.length);
    });

    it('should report allPassed=false when any onboarding command fails', () => {
      let callCount = 0;
      execSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('fail');
          err.status = 1;
          err.stdout = '';
          err.stderr = 'quickstart failed';
          throw err;
        }
        return 'OK';
      });

      const summary = runSmokeTest(['--onboarding'], { silent: true, noExit: true });
      expect(summary.allPassed).toBe(false);
      expect(summary.failed).toBe(1);
    });

    it('should include labels in results when using onboarding commands', () => {
      const summary = runSmokeTest(['--onboarding'], { silent: true, noExit: true });
      const hasLabels = summary.results.some((r) => r.label);
      expect(hasLabels).toBe(true);
    });

    it('should print onboarding title when not silent', () => {
      runSmokeTest(['--onboarding'], { noExit: true });
      const output = console.log.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Onboarding Smoke Test');
    });
  });

  // --- JSON output ---

  describe('JSON output with --json', () => {
    it('should output JSON when --json flag is used', () => {
      const summary = runSmokeTest(['--onboarding', '--json'], { noExit: true });
      expect(console.log).toHaveBeenCalled();
      const jsonCall = console.log.mock.calls.find((c) => {
        try { JSON.parse(c[0]); return true; } catch { return false; }
      });
      expect(jsonCall).toBeTruthy();
    });

    it('should include suite field in JSON output', () => {
      const summary = runSmokeTest(['--onboarding', '--json'], { silent: true, noExit: true });
      expect(summary.suite).toBe('onboarding');
    });

    it('should output valid JSON for default suite', () => {
      const summary = runSmokeTest(['--json'], { silent: true, noExit: true });
      expect(summary.suite).toBe('default');
    });
  });

  // --- Exit code behavior ---

  describe('exit code behavior', () => {
    it('should set exitCode 0 on all pass with --onboarding', () => {
      const original = process.exitCode;
      runSmokeTest(['--onboarding'], { silent: true });
      expect(process.exitCode).toBe(0);
      process.exitCode = original;
    });

    it('should set exitCode 1 on failure with --onboarding', () => {
      const original = process.exitCode;
      execSync.mockImplementation(() => {
        const err = new Error('fail');
        err.status = 1;
        err.stdout = '';
        err.stderr = '';
        throw err;
      });
      runSmokeTest(['--onboarding'], { silent: true });
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });

    it('should not set exitCode when noExit is true', () => {
      const original = process.exitCode;
      process.exitCode = 42;
      runSmokeTest(['--onboarding'], { silent: true, noExit: true });
      expect(process.exitCode).toBe(42);
      process.exitCode = original;
    });
  });

  // --- Failed command detail ---

  describe('failed command detail output', () => {
    it('should show labels in failure detail for onboarding', () => {
      execSync.mockImplementation(() => {
        const err = new Error('fail');
        err.status = 1;
        err.stdout = '';
        err.stderr = 'test error';
        throw err;
      });

      runSmokeTest(['--onboarding'], { noExit: true });
      const output = console.log.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Failed commands:');
    });
  });
});
