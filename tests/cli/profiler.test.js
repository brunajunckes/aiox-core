/**
 * Tests for Performance Profiler Command Module
 * @story 35.3 - Performance Profiler for Large Codebases
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-profiler-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/profiler/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/profiler/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('profiler command', () => {
  // -- formatBytes ------------------------------------------------------------

  describe('formatBytes', () => {
    it('formats bytes', () => {
      expect(mod.formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(mod.formatBytes(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(mod.formatBytes(1048576)).toBe('1.0 MB');
    });
  });

  // -- walkDirectory ----------------------------------------------------------

  describe('walkDirectory', () => {
    it('counts files in directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const x = 1;\n');
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), 'const y = 2;\n');
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.totalFiles).toBe(2);
    });

    it('skips ignored directories', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm);
      fs.writeFileSync(path.join(nm, 'x.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.totalFiles).toBe(1);
    });

    it('counts lines', () => {
      fs.writeFileSync(path.join(tmpDir, 'multi.js'), 'line1\nline2\nline3\n');
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.totalLines).toBe(4); // includes trailing newline
    });

    it('tracks deepest directory', () => {
      const deep = path.join(tmpDir, 'a', 'b', 'c');
      fs.mkdirSync(deep, { recursive: true });
      fs.writeFileSync(path.join(deep, 'x.js'), '');
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.deepestDepth).toBeGreaterThanOrEqual(3);
    });

    it('tracks extension counts', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'c.ts'), '');
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.extensionCounts['.js']).toBe(2);
      expect(stats.extensionCounts['.ts']).toBe(1);
    });

    it('handles empty directory', () => {
      const stats = mod.walkDirectory(tmpDir, null, 0);
      expect(stats.totalFiles).toBe(0);
    });
  });

  // -- profileFiles -----------------------------------------------------------

  describe('profileFiles', () => {
    it('returns file profile with all metrics', () => {
      fs.writeFileSync(path.join(tmpDir, 'test.js'), 'const a = 1;\nconst b = 2;\n');
      const profile = mod.profileFiles(tmpDir);
      expect(profile.totalFiles).toBe(1);
      expect(profile.totalLines).toBeGreaterThan(0);
      expect(profile.avgFileSize).toBeGreaterThan(0);
      expect(profile.largestFiles).toBeDefined();
    });

    it('returns largest files sorted by size', () => {
      fs.writeFileSync(path.join(tmpDir, 'small.js'), 'x');
      fs.writeFileSync(path.join(tmpDir, 'big.js'), 'x'.repeat(1000));
      const profile = mod.profileFiles(tmpDir);
      expect(profile.largestFiles[0].path).toBe('big.js');
    });
  });

  // -- profileDeps ------------------------------------------------------------

  describe('profileDeps', () => {
    it('returns zero when no package.json', () => {
      const deps = mod.profileDeps(tmpDir);
      expect(deps.total).toBe(0);
    });

    it('counts dependencies from package.json', () => {
      const pkg = {
        dependencies: { react: '18.0.0', next: '14.0.0' },
        devDependencies: { jest: '29.0.0' },
      };
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
      const deps = mod.profileDeps(tmpDir);
      expect(deps.deps).toBe(2);
      expect(deps.devDeps).toBe(1);
      expect(deps.total).toBe(3);
    });
  });

  // -- profileTests -----------------------------------------------------------

  describe('profileTests', () => {
    it('counts test files', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'a.test.js'), "it('works', () => {});\nit('also', () => {});\n");
      fs.writeFileSync(path.join(testDir, 'b.test.js'), "describe('x', () => { it('y', () => {}); });\n");
      const tests = mod.profileTests(tmpDir);
      expect(tests.testFiles).toBe(2);
      expect(tests.itCount).toBe(3);
    });

    it('returns zero when no tests', () => {
      const tests = mod.profileTests(tmpDir);
      expect(tests.testFiles).toBe(0);
      expect(tests.itCount).toBe(0);
    });
  });

  // -- profileCommands --------------------------------------------------------

  describe('profileCommands', () => {
    it('returns zero when no commands dir', () => {
      const cmds = mod.profileCommands(tmpDir);
      expect(cmds.commandCount).toBe(0);
    });

    it('counts command directories', () => {
      const cmdDir = path.join(tmpDir, '.aiox-core', 'cli', 'commands');
      fs.mkdirSync(path.join(cmdDir, 'search'), { recursive: true });
      fs.mkdirSync(path.join(cmdDir, 'memory'), { recursive: true });
      const cmds = mod.profileCommands(tmpDir);
      expect(cmds.commandCount).toBe(2);
      expect(cmds.commands).toContain('search');
      expect(cmds.commands).toContain('memory');
    });
  });

  // -- runFullProfile ---------------------------------------------------------

  describe('runFullProfile', () => {
    it('returns all profile sections', () => {
      fs.writeFileSync(path.join(tmpDir, 'test.js'), 'code\n');
      const profile = mod.runFullProfile(tmpDir);
      expect(profile.files).toBeDefined();
      expect(profile.deps).toBeDefined();
      expect(profile.tests).toBeDefined();
      expect(profile.commands).toBeDefined();
      expect(profile.timestamp).toBeDefined();
    });
  });

  // -- runProfiler CLI --------------------------------------------------------

  describe('runProfiler', () => {
    it('runs full profile without args', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runProfiler([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Performance Profile'));
      spy.mockRestore();
    });

    it('outputs JSON with --json flag', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runProfiler(['--json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('profiles files only with --files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'x');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runProfiler(['--files']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('File Profile'));
      spy.mockRestore();
    });
  });
});
