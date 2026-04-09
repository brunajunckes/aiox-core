/**
 * Tests for TODO/FIXME Tracker Command Module
 * @story 22.3 — TODO/FIXME Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-todos-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/todos/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/todos/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('todos command', () => {
  // ── parseFile ─────────────────────────────────────────────────────────
  describe('parseFile', () => {
    it('detects TODO comments', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// TODO: fix this\nconst x = 1;');
      const results = mod.parseFile(file);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('TODO');
      expect(results[0].text).toBe('fix this');
    });

    it('detects FIXME comments', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// FIXME: broken logic');
      const results = mod.parseFile(file);
      expect(results[0].type).toBe('FIXME');
    });

    it('detects HACK comments', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// HACK: temporary workaround');
      const results = mod.parseFile(file);
      expect(results[0].type).toBe('HACK');
    });

    it('detects XXX comments', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// XXX: needs review');
      const results = mod.parseFile(file);
      expect(results[0].type).toBe('XXX');
    });

    it('extracts assignee from TODO(@name)', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// TODO(@john): implement this');
      const results = mod.parseFile(file);
      expect(results[0].assignee).toBe('john');
    });

    it('extracts assignee from TODO(name)', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, '// TODO(alice) fix bug');
      const results = mod.parseFile(file);
      expect(results[0].assignee).toBe('alice');
    });

    it('returns correct line numbers', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, 'line1\n// TODO: on line 2\nline3');
      const results = mod.parseFile(file);
      expect(results[0].line).toBe(2);
    });

    it('returns empty for no tags', () => {
      const file = path.join(tmpDir, 'a.js');
      fs.writeFileSync(file, 'const x = 1;');
      expect(mod.parseFile(file)).toEqual([]);
    });

    it('returns empty for nonexistent file', () => {
      expect(mod.parseFile('/nonexistent')).toEqual([]);
    });
  });

  // ── findTodos ─────────────────────────────────────────────────────────
  describe('findTodos', () => {
    it('finds todos across multiple files', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: task A');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), '// FIXME: bug B');
      const results = mod.findTodos({ cwd: tmpDir });
      expect(results.length).toBe(2);
    });

    it('filters by type', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: task\n// FIXME: bug');
      const results = mod.findTodos({ cwd: tmpDir, type: 'TODO' });
      expect(results.every(r => r.type === 'TODO')).toBe(true);
    });

    it('filters by assignee', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO(@john): task\n// TODO(@alice): other');
      const results = mod.findTodos({ cwd: tmpDir, assignee: 'john' });
      expect(results.length).toBe(1);
      expect(results[0].assignee).toBe('john');
    });

    it('sorts by priority', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: low\n// FIXME: high\n// XXX: lowest');
      const results = mod.findTodos({ cwd: tmpDir, sort: 'priority' });
      expect(results[0].type).toBe('FIXME');
      expect(results[1].type).toBe('TODO');
      expect(results[2].type).toBe('XXX');
    });

    it('returns empty for clean project', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'const clean = true;');
      const results = mod.findTodos({ cwd: tmpDir });
      expect(results.length).toBe(0);
    });
  });

  // ── countByType ───────────────────────────────────────────────────────
  describe('countByType', () => {
    it('counts correctly', () => {
      const results = [
        { type: 'TODO' }, { type: 'TODO' }, { type: 'FIXME' },
      ];
      const counts = mod.countByType(results);
      expect(counts.TODO).toBe(2);
      expect(counts.FIXME).toBe(1);
    });

    it('returns empty object for empty input', () => {
      expect(mod.countByType([])).toEqual({});
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('shows "no TODO" for empty results', () => {
      const text = mod.formatText([], tmpDir, false);
      expect(text).toContain('No TODO');
    });

    it('shows count summary when countOnly is true', () => {
      const results = [{ type: 'TODO', file: 'a.js', line: 1, assignee: null, text: 'x' }];
      const text = mod.formatText(results, tmpDir, true);
      expect(text).toContain('TODO: 1');
      expect(text).toContain('Total: 1');
    });

    it('formats full table', () => {
      const results = [{
        type: 'FIXME', file: path.join(tmpDir, 'a.js'), line: 5, assignee: 'bob', text: 'fix me',
      }];
      const text = mod.formatText(results, tmpDir, false);
      expect(text).toContain('FIXME');
      expect(text).toContain('bob');
    });
  });

  // ── runTodos CLI ──────────────────────────────────────────────────────
  describe('runTodos', () => {
    it('runs without error with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTodos(['--help']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: test');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTodos(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('runs with --count', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: test');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTodos(['--count']);
      expect(spy).toHaveBeenCalled();
    });

    it('runs with --count --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), '// TODO: test');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTodos(['--count', '--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  // ── PRIORITY_MAP ──────────────────────────────────────────────────────
  describe('constants', () => {
    it('FIXME has highest priority', () => {
      expect(mod.PRIORITY_MAP.FIXME).toBeLessThan(mod.PRIORITY_MAP.TODO);
    });

    it('exports TAG_TYPES', () => {
      expect(mod.TAG_TYPES).toContain('FIXME');
      expect(mod.TAG_TYPES).toContain('TODO');
      expect(mod.TAG_TYPES).toContain('HACK');
      expect(mod.TAG_TYPES).toContain('XXX');
    });
  });
});
