'use strict';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

const { execSync } = require('child_process');
const fs = require('fs');

const {
  runQuickstart,
  detectEnvironment,
  checkPrerequisites,
  detectProjectType,
  runVerification,
  getNextSteps,
  formatWelcome,
  formatEnvironment,
  formatPrerequisites,
  formatProjectType,
  formatVerification,
  formatNextSteps,
  STEPS,
  VERSION,
} = require('../../.aiox-core/cli/commands/quickstart/index.js');

describe('Quickstart Command — Story 32.1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.existsSync.mockReturnValue(false);
    execSync.mockReturnValue('');
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // --- Constants ---

  describe('constants', () => {
    it('should export STEPS array with 7 steps', () => {
      expect(STEPS).toHaveLength(7);
      expect(STEPS[0]).toBe('Welcome');
      expect(STEPS[6]).toBe('Next Steps');
    });

    it('should export VERSION string', () => {
      expect(typeof VERSION).toBe('string');
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  // --- detectEnvironment ---

  describe('detectEnvironment', () => {
    it('should return nodeVersion, os, arch, ide, cwd', () => {
      const env = detectEnvironment();
      expect(env).toHaveProperty('nodeVersion');
      expect(env).toHaveProperty('os');
      expect(env).toHaveProperty('arch');
      expect(env).toHaveProperty('ide');
      expect(env).toHaveProperty('cwd');
    });

    it('should detect Node.js version from process.version', () => {
      const env = detectEnvironment();
      expect(env.nodeVersion).toBe(process.version);
    });

    it('should return a valid OS name', () => {
      const env = detectEnvironment();
      expect(['macOS', 'Windows', 'Linux']).toContain(env.os);
    });
  });

  // --- checkPrerequisites ---

  describe('checkPrerequisites', () => {
    it('should return array of prerequisite checks', () => {
      execSync.mockReturnValue('10.0.0\n');
      const prereqs = checkPrerequisites();
      expect(Array.isArray(prereqs)).toBe(true);
      expect(prereqs.length).toBeGreaterThanOrEqual(4);
    });

    it('should mark Node.js >= 18 as found when version is adequate', () => {
      const prereqs = checkPrerequisites();
      const nodeCheck = prereqs.find((p) => p.name.includes('Node.js'));
      expect(nodeCheck).toBeTruthy();
      // Running in Node 18+, so should be found
      const major = parseInt(process.version.slice(1), 10);
      expect(nodeCheck.found).toBe(major >= 18);
    });

    it('should check npm availability', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('npm')) return '10.0.0\n';
        return '';
      });
      const prereqs = checkPrerequisites();
      const npmCheck = prereqs.find((p) => p.name === 'npm');
      expect(npmCheck).toBeTruthy();
      expect(npmCheck.found).toBe(true);
    });

    it('should handle npm not found gracefully', () => {
      execSync.mockImplementation(() => { throw new Error('not found'); });
      const prereqs = checkPrerequisites();
      const npmCheck = prereqs.find((p) => p.name === 'npm');
      expect(npmCheck.found).toBe(false);
    });

    it('should mark GitHub CLI as optional', () => {
      const prereqs = checkPrerequisites();
      const ghCheck = prereqs.find((p) => p.name.includes('GitHub'));
      expect(ghCheck.required).toBe(false);
    });
  });

  // --- detectProjectType ---

  describe('detectProjectType', () => {
    it('should detect existing project when package.json exists', () => {
      fs.existsSync.mockImplementation((p) => p.endsWith('package.json'));
      const result = detectProjectType('/test');
      expect(result.isExisting).toBe(true);
      expect(result.hasPackageJson).toBe(true);
    });

    it('should detect new project when directory is empty', () => {
      fs.existsSync.mockReturnValue(false);
      const result = detectProjectType('/test');
      expect(result.isExisting).toBe(false);
    });

    it('should detect AIOX installation', () => {
      fs.existsSync.mockImplementation((p) => p.endsWith('.aiox-core'));
      const result = detectProjectType('/test');
      expect(result.hasAiox).toBe(true);
      expect(result.isExisting).toBe(true);
    });
  });

  // --- runVerification ---

  describe('runVerification', () => {
    it('should return array of verification checks', () => {
      const checks = runVerification('/test');
      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThanOrEqual(5);
    });

    it('each check should have check, passed, and detail', () => {
      const checks = runVerification('/test');
      for (const c of checks) {
        expect(c).toHaveProperty('check');
        expect(c).toHaveProperty('passed');
        expect(c).toHaveProperty('detail');
      }
    });

    it('should report passed when files exist', () => {
      fs.existsSync.mockReturnValue(true);
      const checks = runVerification('/test');
      const allPassed = checks.every((c) => c.passed);
      expect(allPassed).toBe(true);
    });
  });

  // --- getNextSteps ---

  describe('getNextSteps', () => {
    it('should include install step when AIOX not present', () => {
      const steps = getNextSteps({ hasAiox: false });
      const installStep = steps.find((s) => s.command.includes('aiox-core install'));
      expect(installStep).toBeTruthy();
    });

    it('should skip install step when AIOX is present', () => {
      const steps = getNextSteps({ hasAiox: true });
      const installStep = steps.find((s) => s.command.includes('aiox-core install'));
      expect(installStep).toBeFalsy();
    });

    it('should always include doctor and getting-started', () => {
      const steps = getNextSteps({ hasAiox: true });
      const cmds = steps.map((s) => s.command);
      expect(cmds).toContain('aiox doctor');
      expect(cmds).toContain('aiox getting-started');
    });
  });

  // --- Format functions ---

  describe('formatWelcome', () => {
    it('should include version number', () => {
      const output = formatWelcome();
      expect(output).toContain(VERSION);
    });

    it('should include step count', () => {
      const output = formatWelcome();
      expect(output).toContain('7');
    });
  });

  describe('formatEnvironment', () => {
    it('should include environment info labels', () => {
      const output = formatEnvironment({ nodeVersion: 'v20.0.0', os: 'Linux', arch: 'x64', ide: 'VS Code', cwd: '/test' });
      expect(output).toContain('Node.js');
      expect(output).toContain('OS');
      expect(output).toContain('IDE');
    });
  });

  describe('formatPrerequisites', () => {
    it('should show [OK] for found prerequisites', () => {
      const output = formatPrerequisites([{ name: 'Node.js', required: true, found: true, message: 'v20 detected' }]);
      expect(output).toContain('[OK]');
    });

    it('should show [FAIL] for missing required prerequisites', () => {
      const output = formatPrerequisites([{ name: 'npm', required: true, found: false, message: 'Not found' }]);
      expect(output).toContain('[FAIL]');
    });

    it('should show [SKIP] for missing optional prerequisites', () => {
      const output = formatPrerequisites([{ name: 'gh', required: false, found: false, message: 'Not found' }]);
      expect(output).toContain('[SKIP]');
    });
  });

  // --- runQuickstart ---

  describe('runQuickstart', () => {
    it('should return env, prereqs, project, verification, nextSteps', () => {
      execSync.mockReturnValue('');
      const result = runQuickstart([], { silent: true, cwd: '/test' });
      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('prereqs');
      expect(result).toHaveProperty('project');
      expect(result).toHaveProperty('verification');
      expect(result).toHaveProperty('nextSteps');
      expect(result).toHaveProperty('allPrereqsMet');
    });

    it('should print output when not silent', () => {
      execSync.mockReturnValue('10.0.0');
      runQuickstart([], { cwd: '/test' });
      expect(console.log).toHaveBeenCalled();
      const output = console.log.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('AIOX Quickstart');
    });

    it('should not print when silent', () => {
      runQuickstart([], { silent: true, cwd: '/test' });
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
