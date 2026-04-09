/**
 * Tests for Markdown Report Engine Command Module
 * @story 26.4 — Markdown Report Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-md-report-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/md-report/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/md-report/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('md-report command', () => {
  // ── collectStats ──────────────────────────────────────────────────────
  describe('collectStats', () => {
    it('returns project name from package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-proj', version: '1.0.0' }));
      const stats = mod.collectStats({ cwd: tmpDir });
      expect(stats.name).toBe('test-proj');
      expect(stats.version).toBe('1.0.0');
    });

    it('uses directory name when no package.json', () => {
      const stats = mod.collectStats({ cwd: tmpDir });
      expect(stats.name).toBeTruthy();
      expect(stats.version).toBe('unknown');
    });

    it('counts JS files in key directories', () => {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'cli.js'), '');
      fs.writeFileSync(path.join(binDir, 'util.js'), '');
      const stats = mod.collectStats({ cwd: tmpDir });
      expect(stats.jsFiles).toBe(2);
    });
  });

  // ── collectStories ────────────────────────────────────────────────────
  describe('collectStories', () => {
    it('returns empty array when no stories dir', () => {
      expect(mod.collectStories({ cwd: tmpDir })).toEqual([]);
    });

    it('collects stories with id, title, status', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.1.story.md'), '# Story One\n\n## Status\n\nDone\n');
      const stories = mod.collectStories({ cwd: tmpDir });
      expect(stories).toHaveLength(1);
      expect(stories[0].id).toBe('1.1');
      expect(stories[0].title).toBe('Story One');
      expect(stories[0].status).toBe('Done');
    });
  });

  // ── collectCommands ───────────────────────────────────────────────────
  describe('collectCommands', () => {
    it('returns empty when no aiox.js', () => {
      expect(mod.collectCommands({ cwd: tmpDir })).toEqual([]);
    });

    it('extracts command names', () => {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'aiox.js'), "case 'web':\ncase 'chart':");
      const cmds = mod.collectCommands({ cwd: tmpDir });
      expect(cmds).toEqual(['web', 'chart']);
    });
  });

  // ── collectTests ──────────────────────────────────────────────────────
  describe('collectTests', () => {
    it('returns 0 when no tests dir', () => {
      const result = mod.collectTests({ cwd: tmpDir });
      expect(result.total).toBe(0);
    });

    it('counts test files and directories', () => {
      const dir = path.join(tmpDir, 'tests', 'cli');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.test.js'), '');
      fs.writeFileSync(path.join(dir, 'b.test.js'), '');
      const result = mod.collectTests({ cwd: tmpDir });
      expect(result.total).toBe(2);
      expect(result.dirs).toContain('cli');
    });
  });

  // ── collectDependencies ───────────────────────────────────────────────
  describe('collectDependencies', () => {
    it('returns empty when no package.json', () => {
      const result = mod.collectDependencies({ cwd: tmpDir });
      expect(result.deps).toEqual([]);
      expect(result.devDeps).toEqual([]);
    });

    it('lists dependencies', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { express: '4.18.0' },
        devDependencies: { jest: '29.0.0' },
      }));
      const result = mod.collectDependencies({ cwd: tmpDir });
      expect(result.deps).toEqual(['express']);
      expect(result.devDeps).toEqual(['jest']);
    });
  });

  // ── collectContributors ───────────────────────────────────────────────
  describe('collectContributors', () => {
    it('returns array from exec function', () => {
      const execFn = () => 'Alice\nBob\n';
      const result = mod.collectContributors({ cwd: tmpDir, execFn });
      expect(result).toEqual(['Alice', 'Bob']);
    });

    it('returns empty array on failure', () => {
      const execFn = () => { throw new Error('fail'); };
      const result = mod.collectContributors({ cwd: tmpDir, execFn });
      expect(result).toEqual([]);
    });
  });

  // ── generateReport ────────────────────────────────────────────────────
  describe('generateReport', () => {
    it('generates full markdown report', () => {
      const execFn = () => 'Alice\n';
      const report = mod.generateReport({ cwd: tmpDir, execFn });
      expect(report).toContain('# AIOX Project Report');
      expect(report).toContain('## Project Overview');
      expect(report).toContain('## Sprint Summary');
      expect(report).toContain('## Command Inventory');
    });

    it('respects sections filter', () => {
      const execFn = () => '';
      const report = mod.generateReport({ sections: ['stats'], cwd: tmpDir, execFn });
      expect(report).toContain('## Project Overview');
      expect(report).not.toContain('## Sprint Summary');
    });

    it('includes story table', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '3.1.story.md'), '# Test\n\n## Status\n\nDone\n');
      const execFn = () => '';
      const report = mod.generateReport({ sections: ['stories'], cwd: tmpDir, execFn });
      expect(report).toContain('3.1');
      expect(report).toContain('Done');
    });

    it('includes command inventory', () => {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'aiox.js'), "case 'web':\ncase 'chart':");
      const execFn = () => '';
      const report = mod.generateReport({ sections: ['commands'], cwd: tmpDir, execFn });
      expect(report).toContain('`aiox web`');
      expect(report).toContain('`aiox chart`');
    });
  });

  // ── generateReportJSON ────────────────────────────────────────────────
  describe('generateReportJSON', () => {
    it('returns object with all sections', () => {
      const execFn = () => '';
      const data = mod.generateReportJSON({ cwd: tmpDir, execFn });
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('stories');
      expect(data).toHaveProperty('commands');
      expect(data).toHaveProperty('tests');
    });

    it('respects sections filter', () => {
      const execFn = () => '';
      const data = mod.generateReportJSON({ sections: ['stats', 'commands'], cwd: tmpDir, execFn });
      expect(data).toHaveProperty('stats');
      expect(data).toHaveProperty('commands');
      expect(data).not.toHaveProperty('stories');
    });
  });

  // ── runMdReport (CLI) ─────────────────────────────────────────────────
  describe('runMdReport', () => {
    it('outputs markdown by default', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runMdReport([]);
      expect(result).toContain('# AIOX Project Report');
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runMdReport(['--format', 'json']);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('stats');
      spy.mockRestore();
    });

    it('writes to file with --output', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const outFile = path.join(tmpDir, 'report.md');
      mod.runMdReport(['--output', outFile]);
      expect(fs.existsSync(outFile)).toBe(true);
      const content = fs.readFileSync(outFile, 'utf8');
      expect(content).toContain('# AIOX Project Report');
      spy.mockRestore();
    });

    it('filters sections with --sections', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runMdReport(['--sections', 'stats,commands']);
      expect(result).toContain('## Project Overview');
      expect(result).toContain('## Command Inventory');
      expect(result).not.toContain('## Sprint Summary');
      spy.mockRestore();
    });

    it('uses all sections for invalid --sections filter', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runMdReport(['--sections', 'bogus,invalid']);
      expect(result).toContain('## Project Overview');
      expect(result).toContain('## Sprint Summary');
      spy.mockRestore();
    });
  });

  // ── ALL_SECTIONS constant ─────────────────────────────────────────────
  describe('ALL_SECTIONS', () => {
    it('contains expected sections', () => {
      expect(mod.ALL_SECTIONS).toContain('stats');
      expect(mod.ALL_SECTIONS).toContain('stories');
      expect(mod.ALL_SECTIONS).toContain('commands');
      expect(mod.ALL_SECTIONS).toContain('tests');
      expect(mod.ALL_SECTIONS).toContain('dependencies');
      expect(mod.ALL_SECTIONS).toContain('contributors');
    });
  });
});
