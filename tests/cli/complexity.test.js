/**
 * Tests for Code Complexity Analyzer Command Module
 * @story 21.1 — Code Complexity Analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-complexity-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/complexity/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/complexity/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('complexity command', () => {
  // ── extractFunctions ──────────────────────────────────────────────────────
  describe('extractFunctions', () => {
    it('detects function declarations', () => {
      const source = 'function hello() {\n  return 1;\n}';
      const funcs = mod.extractFunctions(source);
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs[0].name).toBe('hello');
    });

    it('detects const arrow functions', () => {
      const source = 'const greet = (name) => {\n  return name;\n}';
      const funcs = mod.extractFunctions(source);
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs[0].name).toBe('greet');
    });

    it('detects const function expressions', () => {
      const source = 'const run = function() {\n  return true;\n}';
      const funcs = mod.extractFunctions(source);
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs[0].name).toBe('run');
    });

    it('returns empty array for empty source', () => {
      expect(mod.extractFunctions('')).toEqual([]);
    });

    it('captures line numbers', () => {
      const source = '\n\nfunction foo() {\n  return 1;\n}';
      const funcs = mod.extractFunctions(source);
      expect(funcs.length).toBeGreaterThanOrEqual(1);
      expect(funcs[0].startLine).toBe(3);
    });
  });

  // ── calculateComplexity ───────────────────────────────────────────────────
  describe('calculateComplexity', () => {
    it('returns 1 for trivial function', () => {
      expect(mod.calculateComplexity('return 1;')).toBe(1);
    });

    it('adds 1 for each if', () => {
      const body = 'if (a) {} if (b) {}';
      expect(mod.calculateComplexity(body)).toBe(3);
    });

    it('counts for/while/switch/case', () => {
      const body = 'for (;;) {} while (x) {} switch(y) { case 1: break; }';
      expect(mod.calculateComplexity(body)).toBe(5); // 1 + for + while + switch + case
    });

    it('counts && and || operators', () => {
      const body = 'if (a && b || c) {}';
      expect(mod.calculateComplexity(body)).toBe(4); // 1 + if + && + ||
    });

    it('counts ternary operator', () => {
      const body = 'const x = a ? b : c;';
      expect(mod.calculateComplexity(body)).toBe(2); // 1 + ?
    });
  });

  // ── collectJSFiles ────────────────────────────────────────────────────────
  describe('collectJSFiles', () => {
    it('collects .js files recursively', () => {
      const subDir = path.join(tmpDir, 'src');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '');
      fs.writeFileSync(path.join(subDir, 'b.js'), '');
      fs.writeFileSync(path.join(subDir, 'c.txt'), '');
      const files = mod.collectJSFiles(tmpDir);
      expect(files.length).toBe(2);
    });

    it('skips node_modules', () => {
      const nm = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(nm, { recursive: true });
      fs.writeFileSync(path.join(nm, 'a.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), '');
      const files = mod.collectJSFiles(tmpDir);
      expect(files.length).toBe(1);
    });

    it('returns empty for non-existent dir', () => {
      expect(mod.collectJSFiles('/nonexistent-dir-xyz')).toEqual([]);
    });
  });

  // ── analyzeFile ───────────────────────────────────────────────────────────
  describe('analyzeFile', () => {
    it('analyzes a file with functions', () => {
      const filePath = path.join(tmpDir, 'test.js');
      fs.writeFileSync(filePath, 'function foo() {\n  if (x) { return 1; }\n  return 2;\n}');
      const results = mod.analyzeFile(filePath);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].function).toBe('foo');
      expect(results[0].complexity).toBeGreaterThanOrEqual(2);
    });

    it('returns empty for missing file', () => {
      expect(mod.analyzeFile('/nonexistent.js')).toEqual([]);
    });

    it('returns empty for file with no functions', () => {
      const filePath = path.join(tmpDir, 'constants.js');
      fs.writeFileSync(filePath, 'const X = 1;\nconst Y = 2;\n');
      const results = mod.analyzeFile(filePath);
      expect(results).toEqual([]);
    });
  });

  // ── analyzeComplexity ─────────────────────────────────────────────────────
  describe('analyzeComplexity', () => {
    it('analyzes all files in directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function foo() {\n  return 1;\n}');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'function bar() {\n  if (x) {}\n  return 2;\n}');
      const results = mod.analyzeComplexity({ cwd: tmpDir });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('sorts by complexity descending', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function simple() {\n  return 1;\n}');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'function complex() {\n  if (a) {} if (b) {} if (c) {}\n}');
      const results = mod.analyzeComplexity({ cwd: tmpDir });
      expect(results[0].complexity).toBeGreaterThanOrEqual(results[results.length - 1].complexity);
    });

    it('applies threshold filter', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function simple() {\n  return 1;\n}');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'function complex() {\n  if (a) {} if (b) {} if (c) {}\n}');
      const results = mod.analyzeComplexity({ cwd: tmpDir, threshold: 3 });
      for (const r of results) {
        expect(r.complexity).toBeGreaterThanOrEqual(3);
      }
    });

    it('applies top N limit', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function f1() { return 1; }\nfunction f2() { if(x){} }');
      const results = mod.analyzeComplexity({ cwd: tmpDir, top: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('analyzes a specific file', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function foo() { return 1; }');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'function bar() { return 2; }');
      const results = mod.analyzeComplexity({ cwd: tmpDir, file: 'a.js' });
      expect(results.every((r) => r.file.endsWith('a.js'))).toBe(true);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('returns message for empty results', () => {
      const output = mod.formatText([], tmpDir);
      expect(output).toContain('No functions found');
    });

    it('formats results as table', () => {
      const results = [{ file: path.join(tmpDir, 'a.js'), function: 'foo', line: 1, complexity: 5 }];
      const output = mod.formatText(results, tmpDir);
      expect(output).toContain('Complexity');
      expect(output).toContain('foo');
      expect(output).toContain('5');
    });

    it('truncates long function names', () => {
      const longName = 'a'.repeat(40);
      const results = [{ file: path.join(tmpDir, 'a.js'), function: longName, line: 1, complexity: 1 }];
      const output = mod.formatText(results, tmpDir);
      expect(output).toContain('..');
    });
  });

  // ── runComplexity ─────────────────────────────────────────────────────────
  describe('runComplexity', () => {
    it('runs without error with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runComplexity(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function foo() { return 1; }');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runComplexity(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('runs with --threshold', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function foo() { return 1; }');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runComplexity(['--threshold', '100']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('runs with --top', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'function foo() { return 1; }');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runComplexity(['--top', '1']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('runs with specific file', () => {
      fs.writeFileSync(path.join(tmpDir, 'target.js'), 'function bar() { if (x) {} }');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runComplexity(['target.js']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
