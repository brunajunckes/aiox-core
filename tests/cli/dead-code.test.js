/**
 * Tests for Dead Code Detector Command Module
 * @story 22.1 — Dead Code Detector
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-dead-code-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/dead-code/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/dead-code/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('dead-code command', () => {
  // ── extractExports ──────────────────────────────────────────────────────
  describe('extractExports', () => {
    it('extracts module.exports object keys', () => {
      const source = 'module.exports = { foo, bar, baz };';
      const exports = mod.extractExports(source);
      expect(exports).toContain('foo');
      expect(exports).toContain('bar');
      expect(exports).toContain('baz');
    });

    it('extracts module.exports.name pattern', () => {
      const source = 'module.exports.hello = function() {};';
      const exports = mod.extractExports(source);
      expect(exports).toContain('hello');
    });

    it('extracts exports.name pattern', () => {
      const source = 'exports.myFunc = () => {};';
      const exports = mod.extractExports(source);
      expect(exports).toContain('myFunc');
    });

    it('handles key:value exports', () => {
      const source = 'module.exports = { run: runImpl, test: testImpl };';
      const exports = mod.extractExports(source);
      expect(exports).toContain('run');
      expect(exports).toContain('test');
    });

    it('returns empty array for no exports', () => {
      expect(mod.extractExports('const x = 1;')).toEqual([]);
    });
  });

  // ── extractImports ──────────────────────────────────────────────────────
  describe('extractImports', () => {
    it('extracts destructured require names', () => {
      const source = "const { foo, bar } = require('./lib');";
      const imports = mod.extractImports(source);
      expect(imports).toContain('foo');
      expect(imports).toContain('bar');
    });

    it('tracks module-level requires', () => {
      const source = "require('./setup');";
      const imports = mod.extractImports(source);
      expect(imports.some(i => i.startsWith('__module__:'))).toBe(true);
    });

    it('handles aliased destructuring', () => {
      const source = "const { foo: myFoo } = require('./lib');";
      const imports = mod.extractImports(source);
      expect(imports).toContain('foo');
    });

    it('returns empty for no requires', () => {
      expect(mod.extractImports('const x = 1;')).toEqual([]);
    });
  });

  // ── collectFiles ────────────────────────────────────────────────────────
  describe('collectFiles', () => {
    it('collects JS files from directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = {}');
      fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'not js');
      const files = mod.collectFiles(tmpDir, new Set(['.js']));
      expect(files.length).toBe(1);
      expect(files[0]).toContain('a.js');
    });

    it('skips node_modules', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm);
      fs.writeFileSync(path.join(nm, 'lib.js'), '');
      const files = mod.collectFiles(tmpDir, new Set(['.js']));
      expect(files.length).toBe(0);
    });

    it('respects ignore patterns', () => {
      const testsDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testsDir);
      fs.writeFileSync(path.join(testsDir, 'a.test.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'main.js'), '');
      const files = mod.collectFiles(tmpDir, new Set(['.js']), ['tests/**']);
      expect(files.length).toBe(1);
      expect(files[0]).toContain('main.js');
    });
  });

  // ── matchesIgnorePattern ────────────────────────────────────────────────
  describe('matchesIgnorePattern', () => {
    it('matches dir/** pattern', () => {
      expect(mod.matchesIgnorePattern('src/tests/foo.js', ['tests/**'])).toBe(true);
    });

    it('matches *.ext pattern', () => {
      expect(mod.matchesIgnorePattern('foo.test.js', ['*.test.js'])).toBe(true);
    });

    it('returns false for empty patterns', () => {
      expect(mod.matchesIgnorePattern('foo.js', [])).toBe(false);
    });

    it('returns false for no match', () => {
      expect(mod.matchesIgnorePattern('src/main.js', ['tests/**'])).toBe(false);
    });
  });

  // ── findDeadCode (integration) ──────────────────────────────────────────
  describe('findDeadCode', () => {
    it('finds exported function not imported anywhere', () => {
      fs.writeFileSync(path.join(tmpDir, 'lib.js'), `
function deadFunc() { return 1; }
function usedFunc() { return 2; }
module.exports = { deadFunc, usedFunc };
`);
      fs.writeFileSync(path.join(tmpDir, 'main.js'), `
const { usedFunc } = require('./lib');
usedFunc();
module.exports = {};
`);
      const results = mod.findDeadCode({ cwd: tmpDir });
      const deadNames = results.map(r => r.name);
      expect(deadNames).toContain('deadFunc');
    });

    it('returns empty when all exports are used', () => {
      fs.writeFileSync(path.join(tmpDir, 'lib.js'), `
function foo() {}
module.exports = { foo };
`);
      fs.writeFileSync(path.join(tmpDir, 'main.js'), `
const { foo } = require('./lib');
foo();
module.exports = {};
`);
      const results = mod.findDeadCode({ cwd: tmpDir });
      const deadNames = results.map(r => r.name);
      expect(deadNames).not.toContain('foo');
    });

    it('filters by file type', () => {
      fs.writeFileSync(path.join(tmpDir, 'lib.js'), 'module.exports = { a: 1 };');
      const results = mod.findDeadCode({ cwd: tmpDir, type: 'js' });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ── formatText ──────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('shows "no dead code" for empty results', () => {
      const text = mod.formatText([], tmpDir);
      expect(text).toContain('No dead code');
    });

    it('formats results as table', () => {
      const results = [{ file: path.join(tmpDir, 'lib.js'), name: 'deadFunc' }];
      const text = mod.formatText(results, tmpDir);
      expect(text).toContain('deadFunc');
      expect(text).toContain('Dead Code Report');
    });
  });

  // ── runDeadCode CLI ─────────────────────────────────────────────────────
  describe('runDeadCode', () => {
    it('runs without error with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDeadCode(['--help']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = { x: 1 };');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDeadCode(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('runs with --type js', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = {};');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDeadCode(['--type', 'js']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --ignore pattern', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = {};');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDeadCode(['--ignore', 'tests/**']);
      expect(spy).toHaveBeenCalled();
    });
  });
});
