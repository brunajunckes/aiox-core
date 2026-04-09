/**
 * Tests for Dependency Graph Visualizer Command Module
 * @story 21.2 — Dependency Graph Visualizer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-dep-graph-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/dep-graph/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/dep-graph/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('dep-graph command', () => {
  // ── readPackageJson ───────────────────────────────────────────────────────
  describe('readPackageJson', () => {
    it('reads valid package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }));
      const pkg = mod.readPackageJson(tmpDir);
      expect(pkg.name).toBe('test');
      expect(pkg.version).toBe('1.0.0');
    });

    it('returns null for missing package.json', () => {
      expect(mod.readPackageJson(tmpDir)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), 'not json');
      expect(mod.readPackageJson(tmpDir)).toBeNull();
    });
  });

  // ── buildDependencyTree ───────────────────────────────────────────────────
  describe('buildDependencyTree', () => {
    it('builds tree from package.json dependencies', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'my-project',
        version: '2.0.0',
        dependencies: { lodash: '^4.0.0', express: '^4.18.0' },
      }));
      const tree = mod.buildDependencyTree({ cwd: tmpDir });
      expect(tree.name).toBe('my-project');
      expect(tree.version).toBe('2.0.0');
      expect(Object.keys(tree.dependencies)).toContain('lodash');
      expect(Object.keys(tree.dependencies)).toContain('express');
    });

    it('includes devDependencies when --dev flag used', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { jest: '^29.0.0' },
      }));
      const tree = mod.buildDependencyTree({ cwd: tmpDir, dev: true });
      expect(Object.keys(tree.dependencies)).toContain('jest');
    });

    it('excludes devDependencies by default', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' },
        devDependencies: { jest: '^29.0.0' },
      }));
      const tree = mod.buildDependencyTree({ cwd: tmpDir });
      expect(Object.keys(tree.dependencies)).not.toContain('jest');
    });

    it('returns default for missing package.json', () => {
      const tree = mod.buildDependencyTree({ cwd: tmpDir });
      expect(tree.name).toBe('unknown');
    });

    it('respects depth limit', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' },
      }));
      const tree = mod.buildDependencyTree({ cwd: tmpDir, depth: 1 });
      expect(tree.dependencies.lodash).toBeDefined();
    });
  });

  // ── renderAsciiTree ───────────────────────────────────────────────────────
  describe('renderAsciiTree', () => {
    it('renders root node', () => {
      const tree = { name: 'project', version: '1.0.0', dependencies: {} };
      const output = mod.renderAsciiTree(tree);
      expect(output).toContain('project@1.0.0');
    });

    it('renders children with connectors', () => {
      const tree = {
        name: 'project',
        version: '1.0.0',
        dependencies: {
          lodash: { name: 'lodash', version: '4.17.21', dependencies: {} },
        },
      };
      const output = mod.renderAsciiTree(tree);
      expect(output).toContain('lodash@4.17.21');
      expect(output).toContain('\\--');
    });

    it('renders multiple children with pipes', () => {
      const tree = {
        name: 'project',
        version: '1.0.0',
        dependencies: {
          a: { name: 'a', version: '1.0.0', dependencies: {} },
          b: { name: 'b', version: '2.0.0', dependencies: {} },
        },
      };
      const output = mod.renderAsciiTree(tree);
      expect(output).toContain('|--');
    });
  });

  // ── countDependencies ─────────────────────────────────────────────────────
  describe('countDependencies', () => {
    it('counts zero for empty deps', () => {
      const tree = { name: 'x', version: '1.0.0', dependencies: {} };
      expect(mod.countDependencies(tree)).toBe(0);
    });

    it('counts flat dependencies', () => {
      const tree = {
        name: 'x',
        version: '1.0.0',
        dependencies: {
          a: { name: 'a', version: '1.0.0', dependencies: {} },
          b: { name: 'b', version: '1.0.0', dependencies: {} },
        },
      };
      expect(mod.countDependencies(tree)).toBe(2);
    });

    it('counts nested dependencies', () => {
      const tree = {
        name: 'x',
        version: '1.0.0',
        dependencies: {
          a: {
            name: 'a',
            version: '1.0.0',
            dependencies: {
              c: { name: 'c', version: '1.0.0', dependencies: {} },
            },
          },
        },
      };
      expect(mod.countDependencies(tree)).toBe(2);
    });
  });

  // ── collectJSFiles ────────────────────────────────────────────────────────
  describe('collectJSFiles', () => {
    it('collects JS files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.txt'), '');
      const files = mod.collectJSFiles(tmpDir);
      expect(files.length).toBe(1);
    });

    it('skips node_modules', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm, { recursive: true });
      fs.writeFileSync(path.join(nm, 'x.js'), '');
      expect(mod.collectJSFiles(tmpDir).length).toBe(0);
    });
  });

  // ── extractRequires ───────────────────────────────────────────────────────
  describe('extractRequires', () => {
    it('extracts relative require paths', () => {
      const filePath = path.join(tmpDir, 'main.js');
      const targetPath = path.join(tmpDir, 'util.js');
      fs.writeFileSync(filePath, "const u = require('./util');");
      fs.writeFileSync(targetPath, 'module.exports = {};');
      const reqs = mod.extractRequires(filePath);
      expect(reqs.length).toBeGreaterThanOrEqual(1);
    });

    it('ignores non-relative requires', () => {
      const filePath = path.join(tmpDir, 'main.js');
      fs.writeFileSync(filePath, "const fs = require('fs');");
      expect(mod.extractRequires(filePath)).toEqual([]);
    });

    it('returns empty for missing file', () => {
      expect(mod.extractRequires('/nonexistent.js')).toEqual([]);
    });
  });

  // ── detectCircular ────────────────────────────────────────────────────────
  describe('detectCircular', () => {
    it('detects circular require chains', () => {
      const aPath = path.join(tmpDir, 'a.js');
      const bPath = path.join(tmpDir, 'b.js');
      fs.writeFileSync(aPath, "const b = require('./b');");
      fs.writeFileSync(bPath, "const a = require('./a');");
      const circles = mod.detectCircular({ cwd: tmpDir });
      expect(circles.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty when no circular deps', () => {
      const aPath = path.join(tmpDir, 'a.js');
      const bPath = path.join(tmpDir, 'b.js');
      fs.writeFileSync(aPath, "const b = require('./b');");
      fs.writeFileSync(bPath, 'module.exports = {};');
      const circles = mod.detectCircular({ cwd: tmpDir });
      expect(circles.length).toBe(0);
    });
  });

  // ── runDepGraph ───────────────────────────────────────────────────────────
  describe('runDepGraph', () => {
    it('runs with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDepGraph(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });

    it('runs default tree output', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test', version: '1.0.0', dependencies: {},
      }));
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDepGraph([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'test', version: '1.0.0', dependencies: {},
      }));
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDepGraph(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('runs with --circular', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'module.exports = {};');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDepGraph(['--circular']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No circular'));
      spy.mockRestore();
    });

    it('runs --circular --format json', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDepGraph(['--circular', '--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });
  });
});
