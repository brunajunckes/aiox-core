/**
 * Tests for Command Reference Generator Command Module
 * @story 19.3 — Command Reference Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-ref-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  // Clear caches for both ref and man modules
  const refPath = require.resolve('../../.aiox-core/cli/commands/ref/index.js');
  const manPath = require.resolve('../../.aiox-core/cli/commands/man/index.js');
  delete require.cache[refPath];
  delete require.cache[manPath];
  mod = require('../../.aiox-core/cli/commands/ref/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ref command', () => {
  describe('getCommands', () => {
    it('returns all commands when no category', () => {
      const cmds = mod.getCommands();
      expect(Array.isArray(cmds)).toBe(true);
      expect(cmds.length).toBeGreaterThan(10);
    });

    it('filters by category', () => {
      const cmds = mod.getCommands('test');
      expect(cmds.length).toBeGreaterThan(0);
      for (const cmd of cmds) {
        expect(cmd.category).toBe('test');
      }
    });

    it('returns empty for nonexistent category', () => {
      const cmds = mod.getCommands('nonexistent-xyz');
      expect(cmds).toEqual([]);
    });
  });

  describe('getAvailableCategories', () => {
    it('returns sorted array of categories', () => {
      const cats = mod.getAvailableCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats).toContain('core');
      expect(cats).toContain('test');
      // Verify sorted
      const sorted = [...cats].sort();
      expect(cats).toEqual(sorted);
    });
  });

  describe('groupByCategory', () => {
    it('groups commands by category', () => {
      const cmds = mod.getCommands();
      const grouped = mod.groupByCategory(cmds);
      expect(typeof grouped).toBe('object');
      expect(grouped).toHaveProperty('core');
      expect(Array.isArray(grouped.core)).toBe(true);
    });

    it('handles empty input', () => {
      const grouped = mod.groupByCategory([]);
      expect(grouped).toEqual({});
    });
  });

  describe('formatText', () => {
    it('produces text with header and commands', () => {
      const cmds = mod.getCommands();
      const text = mod.formatText(cmds);
      expect(text).toContain('AIOX CLI Command Reference');
      expect(text).toContain('Total:');
    });

    it('includes category headers', () => {
      const cmds = mod.getCommands();
      const text = mod.formatText(cmds);
      expect(text).toContain('CORE');
    });
  });

  describe('formatMarkdown', () => {
    it('produces markdown with tables', () => {
      const cmds = mod.getCommands();
      const md = mod.formatMarkdown(cmds);
      expect(md).toContain('# AIOX CLI Command Reference');
      expect(md).toContain('| Command | Description |');
      expect(md).toContain('|---------|-------------|');
    });

    it('wraps command names in backticks', () => {
      const cmds = mod.getCommands();
      const md = mod.formatMarkdown(cmds);
      expect(md).toContain('`config`');
    });
  });

  describe('formatJSON', () => {
    it('produces valid JSON', () => {
      const cmds = mod.getCommands();
      const jsonStr = mod.formatJSON(cmds);
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('total');
      expect(parsed).toHaveProperty('categories');
    });

    it('includes all commands in total', () => {
      const cmds = mod.getCommands();
      const parsed = JSON.parse(mod.formatJSON(cmds));
      expect(parsed.total).toBe(cmds.length);
    });
  });

  describe('writeOutput', () => {
    it('writes content to file', () => {
      const filePath = path.join(tmpDir, 'output.md');
      const result = mod.writeOutput(filePath, '# Test');
      expect(result.path).toBe(filePath);
      expect(result.bytes).toBeGreaterThan(0);
      expect(fs.readFileSync(filePath, 'utf8')).toContain('# Test');
    });

    it('creates parent directories', () => {
      const filePath = path.join(tmpDir, 'sub', 'dir', 'output.md');
      mod.writeOutput(filePath, 'content');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('resolves relative paths', () => {
      const result = mod.writeOutput('ref-output.md', 'test');
      expect(path.isAbsolute(result.path)).toBe(true);
    });
  });

  describe('parseFlag', () => {
    it('parses flag value', () => {
      expect(mod.parseFlag(['--format', 'json'], '--format')).toBe('json');
    });

    it('returns null for missing flag', () => {
      expect(mod.parseFlag(['--other', 'val'], '--format')).toBeNull();
    });

    it('returns null for flag at end without value', () => {
      expect(mod.parseFlag(['--format'], '--format')).toBeNull();
    });
  });

  describe('runRef', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      spy.mockRestore();
    });

    it('outputs text by default', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('AIOX CLI Command Reference'));
      spy.mockRestore();
    });

    it('outputs markdown with --format markdown', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef(['--format', 'markdown']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('# AIOX CLI'));
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('filters by category', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef(['--category', 'test']);
      const output = spy.mock.calls[0][0];
      expect(output).toContain('test-gen');
      spy.mockRestore();
    });

    it('rejects invalid format', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runRef(['--format', 'xml']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
      spy.mockRestore();
    });

    it('rejects invalid category', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runRef(['--category', 'nonexistent']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown category'));
      spy.mockRestore();
    });

    it('writes to file with --output', () => {
      const outPath = path.join(tmpDir, 'ref.md');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runRef(['--output', outPath]);
      expect(fs.existsSync(outPath)).toBe(true);
      spy.mockRestore();
    });
  });
});
