/**
 * Tests for Test Generator Command Module
 * @story 18.1 — Test Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-test-gen-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/test-gen/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/test-gen/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('test-gen command', () => {
  describe('parseExports', () => {
    it('parses module.exports = { fn1, fn2 }', () => {
      const content = `module.exports = { foo, bar, baz };`;
      expect(mod.parseExports(content)).toEqual(['bar', 'baz', 'foo']);
    });

    it('parses module.exports.fnName = ...', () => {
      const content = `module.exports.alpha = function() {};\nmodule.exports.beta = () => {};`;
      expect(mod.parseExports(content)).toEqual(['alpha', 'beta']);
    });

    it('parses exports.fnName = ...', () => {
      const content = `exports.hello = function() {};\nexports.world = 42;`;
      expect(mod.parseExports(content)).toEqual(['hello', 'world']);
    });

    it('parses module.exports = singleFunction', () => {
      const content = `module.exports = doSomething;\n`;
      expect(mod.parseExports(content)).toEqual(['doSomething']);
    });

    it('parses mixed export styles', () => {
      const content = `module.exports = { run };\nmodule.exports.extra = true;\nexports.third = 3;`;
      const result = mod.parseExports(content);
      expect(result).toContain('run');
      expect(result).toContain('extra');
      expect(result).toContain('third');
    });

    it('returns empty array for no exports', () => {
      expect(mod.parseExports('const x = 1;')).toEqual([]);
    });

    it('handles key: value in object exports', () => {
      const content = `module.exports = { run: runFn, build: buildFn };`;
      expect(mod.parseExports(content)).toEqual(['build', 'run']);
    });
  });

  describe('generateSkeleton', () => {
    it('generates describe/it blocks for each export', () => {
      const result = mod.generateSkeleton('./utils.js', ['foo', 'bar']);
      expect(result).toContain("describe('utils'");
      expect(result).toContain("describe('foo'");
      expect(result).toContain("describe('bar'");
      expect(result).toContain('TODO: implement test');
    });

    it('generates fallback skeleton when no exports found', () => {
      const result = mod.generateSkeleton('./empty.js', []);
      expect(result).toContain("describe('empty'");
      expect(result).toContain('should be defined');
    });

    it('includes require statement with correct path', () => {
      const result = mod.generateSkeleton('./lib/helpers.js', ['helper']);
      expect(result).toContain("require('./lib/helpers.js')");
    });
  });

  describe('defaultTestPath', () => {
    it('converts source path to test path', () => {
      expect(mod.defaultTestPath('src/utils.js')).toBe('src/utils.test.js');
    });

    it('handles nested paths', () => {
      expect(mod.defaultTestPath('lib/deep/module.js')).toBe('lib/deep/module.test.js');
    });
  });

  describe('listUntested', () => {
    it('returns empty for non-existent directory', () => {
      expect(mod.listUntested('nonexistent')).toEqual([]);
    });

    it('returns modules without matching test files', () => {
      const dir = path.join(tmpDir, 'src');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'tested.js'), '');
      fs.writeFileSync(path.join(dir, 'tested.test.js'), '');
      fs.writeFileSync(path.join(dir, 'untested.js'), '');
      expect(mod.listUntested('src')).toEqual(['untested.js']);
    });

    it('ignores .test.js and .spec.js files as source', () => {
      const dir = path.join(tmpDir, 'lib');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'foo.test.js'), '');
      fs.writeFileSync(path.join(dir, 'bar.spec.js'), '');
      expect(mod.listUntested('lib')).toEqual([]);
    });

    it('lists all untested when none have tests', () => {
      const dir = path.join(tmpDir, 'mod');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'a.js'), '');
      fs.writeFileSync(path.join(dir, 'b.js'), '');
      expect(mod.listUntested('mod')).toEqual(['a.js', 'b.js']);
    });
  });

  describe('runTestGen', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('TEST GENERATOR'));
      spy.mockRestore();
    });

    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('TEST GENERATOR'));
      spy.mockRestore();
    });

    it('prints skeleton to stdout for a file', () => {
      const file = path.join(tmpDir, 'mymod.js');
      fs.writeFileSync(file, `module.exports = { run, build };`);
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen(['mymod.js']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("describe('mymod'"));
      spy.mockRestore();
    });

    it('writes to --output file', () => {
      const file = path.join(tmpDir, 'src.js');
      fs.writeFileSync(file, `module.exports = { alpha };`);
      const outPath = path.join(tmpDir, 'out', 'src.test.js');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen(['src.js', '--output', path.join('out', 'src.test.js')]);
      expect(fs.existsSync(outPath)).toBe(true);
      const content = fs.readFileSync(outPath, 'utf8');
      expect(content).toContain("describe('alpha'");
      spy.mockRestore();
    });

    it('errors on non-existent file', () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation();
      mod.runTestGen(['nonexistent.js']);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(process.exitCode).toBe(1);
      errSpy.mockRestore();
    });

    it('lists untested with --list', () => {
      const dir = path.join(tmpDir, 'src');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'x.js'), '');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen(['--list', 'src']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('x.js'));
      spy.mockRestore();
    });

    it('reports all tested when --list finds none', () => {
      const dir = path.join(tmpDir, 'tested');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'a.js'), '');
      fs.writeFileSync(path.join(dir, 'a.test.js'), '');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestGen(['--list', 'tested']);
      expect(spy).toHaveBeenCalledWith('All modules have tests.');
      spy.mockRestore();
    });
  });
});
