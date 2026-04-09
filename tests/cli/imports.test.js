/**
 * Tests for Import Validator Command Module
 * @story 22.4 — Import Validator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-imports-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/imports/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/imports/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('imports command', () => {
  // ── isLocalRequire ────────────────────────────────────────────────────
  describe('isLocalRequire', () => {
    it('returns true for ./ paths', () => {
      expect(mod.isLocalRequire('./lib')).toBe(true);
    });

    it('returns true for ../ paths', () => {
      expect(mod.isLocalRequire('../utils')).toBe(true);
    });

    it('returns true for absolute paths', () => {
      expect(mod.isLocalRequire('/root/lib')).toBe(true);
    });

    it('returns false for package names', () => {
      expect(mod.isLocalRequire('express')).toBe(false);
      expect(mod.isLocalRequire('fs')).toBe(false);
    });
  });

  // ── resolveRequire ────────────────────────────────────────────────────
  describe('resolveRequire', () => {
    it('resolves existing .js file', () => {
      const lib = path.join(tmpDir, 'lib.js');
      fs.writeFileSync(lib, '');
      const main = path.join(tmpDir, 'main.js');
      const resolved = mod.resolveRequire('./lib', main);
      expect(resolved).toBe(lib);
    });

    it('resolves file without extension', () => {
      const lib = path.join(tmpDir, 'utils.js');
      fs.writeFileSync(lib, '');
      const main = path.join(tmpDir, 'main.js');
      const resolved = mod.resolveRequire('./utils', main);
      expect(resolved).toBe(lib);
    });

    it('resolves index.js in directory', () => {
      const dir = path.join(tmpDir, 'mylib');
      fs.mkdirSync(dir);
      const idx = path.join(dir, 'index.js');
      fs.writeFileSync(idx, '');
      const main = path.join(tmpDir, 'main.js');
      const resolved = mod.resolveRequire('./mylib', main);
      expect(resolved).toBe(idx);
    });

    it('returns null for non-local require', () => {
      expect(mod.resolveRequire('express', '/main.js')).toBeNull();
    });

    it('returns null for missing file', () => {
      const main = path.join(tmpDir, 'main.js');
      expect(mod.resolveRequire('./nonexistent', main)).toBeNull();
    });
  });

  // ── extractRequires ───────────────────────────────────────────────────
  describe('extractRequires', () => {
    it('extracts const assignment require', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, "const fs = require('fs');");
      const reqs = mod.extractRequires(file);
      expect(reqs.length).toBeGreaterThanOrEqual(1);
      expect(reqs[0].name).toBe('fs');
      expect(reqs[0].requirePath).toBe('fs');
    });

    it('extracts destructured require', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, "const { readFile, writeFile } = require('fs');");
      const reqs = mod.extractRequires(file);
      expect(reqs.length).toBeGreaterThanOrEqual(1);
      const destr = reqs.find(r => r.destructured);
      expect(destr.destructured).toContain('readFile');
      expect(destr.destructured).toContain('writeFile');
    });

    it('records line numbers', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, "// comment\nconst x = require('./lib');");
      const reqs = mod.extractRequires(file);
      expect(reqs[0].line).toBe(2);
    });

    it('returns empty for file with no requires', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, 'const x = 1;');
      expect(mod.extractRequires(file)).toEqual([]);
    });

    it('returns empty for nonexistent file', () => {
      expect(mod.extractRequires('/nonexistent')).toEqual([]);
    });
  });

  // ── validateImports ───────────────────────────────────────────────────
  describe('validateImports', () => {
    it('reports broken local requires', () => {
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(main, "const lib = require('./missing');");
      const errors = mod.validateImports({ cwd: tmpDir });
      expect(errors.length).toBe(1);
      expect(errors[0].error).toContain('not found');
    });

    it('does not report valid requires', () => {
      const lib = path.join(tmpDir, 'lib.js');
      fs.writeFileSync(lib, 'module.exports = {};');
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(main, "const lib = require('./lib');");
      const errors = mod.validateImports({ cwd: tmpDir });
      expect(errors.length).toBe(0);
    });

    it('ignores non-local requires (npm packages)', () => {
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(main, "const fs = require('fs');");
      const errors = mod.validateImports({ cwd: tmpDir });
      expect(errors.length).toBe(0);
    });
  });

  // ── buildDependencyGraph ──────────────────────────────────────────────
  describe('buildDependencyGraph', () => {
    it('builds graph with resolved dependencies', () => {
      const lib = path.join(tmpDir, 'lib.js');
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(lib, 'module.exports = {};');
      fs.writeFileSync(main, "const lib = require('./lib');");
      const graph = mod.buildDependencyGraph(tmpDir);
      expect(graph.size).toBe(2);
      const mainDeps = graph.get(main);
      expect(mainDeps).toContain(lib);
    });
  });

  // ── detectCircular ────────────────────────────────────────────────────
  describe('detectCircular', () => {
    it('detects simple circular dependency', () => {
      const a = path.join(tmpDir, 'a.js');
      const b = path.join(tmpDir, 'b.js');
      fs.writeFileSync(a, "const b = require('./b');");
      fs.writeFileSync(b, "const a = require('./a');");
      const graph = mod.buildDependencyGraph(tmpDir);
      const cycles = mod.detectCircular(graph);
      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for acyclic graph', () => {
      const lib = path.join(tmpDir, 'lib.js');
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(lib, 'module.exports = {};');
      fs.writeFileSync(main, "const lib = require('./lib');");
      const graph = mod.buildDependencyGraph(tmpDir);
      const cycles = mod.detectCircular(graph);
      expect(cycles.length).toBe(0);
    });

    it('handles empty graph', () => {
      const graph = new Map();
      expect(mod.detectCircular(graph)).toEqual([]);
    });
  });

  // ── findUnusedImports ─────────────────────────────────────────────────
  describe('findUnusedImports', () => {
    it('finds imported but never used variable', () => {
      const lib = path.join(tmpDir, 'lib.js');
      fs.writeFileSync(lib, 'module.exports = { foo: 1 };');
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(main, "const { foo } = require('./lib');\nconsole.log('hello');");
      const unused = mod.findUnusedImports({ cwd: tmpDir });
      const mainUnused = unused.filter(u => u.file === main);
      expect(mainUnused.length).toBeGreaterThanOrEqual(1);
      expect(mainUnused[0].name).toBe('foo');
    });

    it('does not flag used imports', () => {
      const lib = path.join(tmpDir, 'lib.js');
      fs.writeFileSync(lib, 'module.exports = { foo: 1 };');
      const main = path.join(tmpDir, 'main.js');
      fs.writeFileSync(main, "const { foo } = require('./lib');\nconsole.log(foo);");
      const unused = mod.findUnusedImports({ cwd: tmpDir });
      const mainUnused = unused.filter(u => u.file === main && u.name === 'foo');
      expect(mainUnused.length).toBe(0);
    });
  });

  // ── format functions ──────────────────────────────────────────────────
  describe('formatValidationText', () => {
    it('shows "all valid" for empty errors', () => {
      const text = mod.formatValidationText([], tmpDir);
      expect(text).toContain('All imports are valid');
    });

    it('formats errors', () => {
      const errors = [{ file: path.join(tmpDir, 'a.js'), line: 5, requirePath: './missing', error: 'Module not found' }];
      const text = mod.formatValidationText(errors, tmpDir);
      expect(text).toContain('./missing');
    });
  });

  describe('formatCircularText', () => {
    it('shows "no circular" for empty', () => {
      const text = mod.formatCircularText([], tmpDir);
      expect(text).toContain('No circular');
    });
  });

  describe('formatUnusedText', () => {
    it('shows "no unused" for empty', () => {
      const text = mod.formatUnusedText([], tmpDir);
      expect(text).toContain('No unused');
    });
  });

  // ── runImports CLI ────────────────────────────────────────────────────
  describe('runImports', () => {
    it('runs without error with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runImports(['--help']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs validate mode with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), "const x = require('./missing');");
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runImports(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('runs --circular mode', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = {};');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runImports(['--circular']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs --unused mode', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const x = 1;');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runImports(['--unused']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs --fix mode (dry-run)', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const x = 1;');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runImports(['--fix']);
      expect(spy).toHaveBeenCalled();
    });
  });
});
