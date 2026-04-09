/**
 * Tests for Test Impact Analysis Command Module
 * @story 18.3 — Test Impact Analysis
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-test-impact-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/test-impact/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/test-impact/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('test-impact command', () => {
  describe('parseImports', () => {
    it('parses require statements', () => {
      const content = `const x = require('./utils');\nconst y = require('./lib/helpers');`;
      expect(mod.parseImports(content)).toEqual(['./utils', './lib/helpers']);
    });

    it('parses ES import statements', () => {
      const content = `import { foo } from './foo';\nimport bar from './bar';`;
      expect(mod.parseImports(content)).toEqual(['./foo', './bar']);
    });

    it('ignores non-relative imports', () => {
      const content = `const fs = require('fs');\nimport path from 'path';`;
      expect(mod.parseImports(content)).toEqual([]);
    });

    it('returns empty for no imports', () => {
      expect(mod.parseImports('const x = 1;')).toEqual([]);
    });
  });

  describe('isTestFile', () => {
    it('identifies .test.js files', () => {
      expect(mod.isTestFile('foo.test.js')).toBe(true);
    });

    it('identifies .spec.js files', () => {
      expect(mod.isTestFile('foo.spec.js')).toBe(true);
    });

    it('rejects regular files', () => {
      expect(mod.isTestFile('foo.js')).toBe(false);
    });
  });

  describe('collectFiles', () => {
    it('returns empty for non-existent dir', () => {
      expect(mod.collectFiles(path.join(tmpDir, 'nope'))).toEqual([]);
    });

    it('collects JS files recursively', () => {
      const src = path.join(tmpDir, 'src');
      fs.mkdirSync(src);
      fs.writeFileSync(path.join(src, 'a.js'), '');
      fs.writeFileSync(path.join(src, 'b.ts'), '');
      fs.writeFileSync(path.join(src, 'c.txt'), '');
      const files = mod.collectFiles(src);
      expect(files).toHaveLength(2);
    });

    it('skips node_modules', () => {
      const nm = path.join(tmpDir, 'node_modules', 'pkg');
      fs.mkdirSync(nm, { recursive: true });
      fs.writeFileSync(path.join(nm, 'index.js'), '');
      const files = mod.collectFiles(tmpDir);
      const nmFiles = files.filter(f => f.includes('node_modules'));
      expect(nmFiles).toHaveLength(0);
    });
  });

  describe('resolveImport', () => {
    it('resolves file with extension', () => {
      const file = path.join(tmpDir, 'helper.js');
      fs.writeFileSync(file, '');
      const resolved = mod.resolveImport(tmpDir, './helper');
      expect(resolved).toBe(file);
    });

    it('resolves index.js in directory', () => {
      const dir = path.join(tmpDir, 'lib');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'index.js'), '');
      const resolved = mod.resolveImport(tmpDir, './lib');
      expect(resolved).toBe(path.join(dir, 'index.js'));
    });

    it('returns null for unresolvable import', () => {
      expect(mod.resolveImport(tmpDir, './nonexistent')).toBeNull();
    });
  });

  describe('buildImpactMap', () => {
    it('maps test imports to source files', () => {
      const src = path.join(tmpDir, 'utils.js');
      const test = path.join(tmpDir, 'utils.test.js');
      fs.writeFileSync(src, 'module.exports = { x: 1 };');
      fs.writeFileSync(test, `const u = require('./utils');\ndescribe('test', () => {});`);
      const files = [src, test];
      const map = mod.buildImpactMap(tmpDir, files);
      expect(map['utils.js']).toContain('utils.test.js');
    });

    it('maps by naming convention', () => {
      const src = path.join(tmpDir, 'foo.js');
      const test = path.join(tmpDir, 'foo.test.js');
      fs.writeFileSync(src, '');
      fs.writeFileSync(test, '');
      const files = [src, test];
      const map = mod.buildImpactMap(tmpDir, files);
      expect(map['foo.js']).toContain('foo.test.js');
    });

    it('returns empty map for no test files', () => {
      const src = path.join(tmpDir, 'solo.js');
      fs.writeFileSync(src, '');
      const map = mod.buildImpactMap(tmpDir, [src]);
      expect(Object.keys(map)).toHaveLength(0);
    });
  });

  describe('suggestTests', () => {
    it('suggests tests for changed source files', () => {
      const map = { 'src/a.js': ['tests/a.test.js'] };
      expect(mod.suggestTests(map, ['src/a.js'])).toEqual(['tests/a.test.js']);
    });

    it('includes changed test files directly', () => {
      expect(mod.suggestTests({}, ['tests/b.test.js'])).toEqual(['tests/b.test.js']);
    });

    it('returns empty for unmatched files', () => {
      expect(mod.suggestTests({}, ['unknown.js'])).toEqual([]);
    });
  });

  describe('runTestImpact', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestImpact(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('TEST IMPACT ANALYSIS'));
      spy.mockRestore();
    });

    it('shows no mappings for empty project', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestImpact([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No source'));
      spy.mockRestore();
    });

    it('outputs JSON format', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestImpact(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('shows tests for specific file', () => {
      const src = path.join(tmpDir, 'mod.js');
      const test = path.join(tmpDir, 'mod.test.js');
      fs.writeFileSync(src, 'module.exports = {};');
      fs.writeFileSync(test, `const m = require('./mod');\ndescribe('test', () => {});`);
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestImpact(['mod.js']);
      const output = spy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('mod.test.js');
      spy.mockRestore();
    });
  });
});
