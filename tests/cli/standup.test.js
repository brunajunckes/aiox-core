/**
 * Tests for Standup Report Generator Command Module
 * @story 25.3 — Standup Report Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-standup-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/standup/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/standup/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('standup command', () => {
  // ── parseSince ─────────────────────────────────────────────────────────
  describe('parseSince', () => {
    it('returns default for null', () => {
      expect(mod.parseSince(null)).toBe('1.day.ago');
    });

    it('returns default for undefined', () => {
      expect(mod.parseSince(undefined)).toBe('1.day.ago');
    });

    it('parses days', () => {
      expect(mod.parseSince('2d')).toBe('2.day.ago');
    });

    it('parses weeks', () => {
      expect(mod.parseSince('1w')).toBe('1.week.ago');
    });

    it('parses months', () => {
      expect(mod.parseSince('3m')).toBe('3.month.ago');
    });

    it('returns default for invalid format', () => {
      expect(mod.parseSince('abc')).toBe('1.day.ago');
    });
  });

  // ── getBlockers ────────────────────────────────────────────────────────
  describe('getBlockers', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.getBlockers()).toEqual([]);
    });

    it('returns empty array for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blockers.json'), '', 'utf8');
      expect(mod.getBlockers()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blockers.json'), 'nope', 'utf8');
      expect(mod.getBlockers()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blockers.json'), '{}', 'utf8');
      expect(mod.getBlockers()).toEqual([]);
    });

    it('parses valid blockers', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const blockers = [{ description: 'API down' }];
      fs.writeFileSync(path.join(dir, 'blockers.json'), JSON.stringify(blockers), 'utf8');
      expect(mod.getBlockers()).toEqual(blockers);
    });
  });

  // ── getInProgressStories ───────────────────────────────────────────────
  describe('getInProgressStories', () => {
    it('returns empty when stories dir does not exist', () => {
      expect(mod.getInProgressStories()).toEqual([]);
    });

    it('finds InProgress stories', () => {
      const storiesDir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(storiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(storiesDir, '1.1.story.md'),
        '# My Story\n\n## Status\n\nInProgress\n',
        'utf8',
      );
      const stories = mod.getInProgressStories();
      expect(stories.length).toBe(1);
      expect(stories[0].status).toBe('InProgress');
    });

    it('skips Done stories', () => {
      const storiesDir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(storiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(storiesDir, '1.1.story.md'),
        '# Done Story\n\n## Status\n\nDone\n',
        'utf8',
      );
      expect(mod.getInProgressStories()).toEqual([]);
    });

    it('finds Ready stories', () => {
      const storiesDir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(storiesDir, { recursive: true });
      fs.writeFileSync(
        path.join(storiesDir, '2.1.story.md'),
        '# Ready Story\n\n## Status\n\nReady\n',
        'utf8',
      );
      const stories = mod.getInProgressStories();
      expect(stories.length).toBe(1);
      expect(stories[0].status).toBe('Ready');
    });
  });

  // ── getRecentCommits ───────────────────────────────────────────────────
  describe('getRecentCommits', () => {
    it('returns empty array when not in a git repo', () => {
      const commits = mod.getRecentCommits('1.day.ago');
      expect(Array.isArray(commits)).toBe(true);
    });
  });

  // ── generateReport ─────────────────────────────────────────────────────
  describe('generateReport', () => {
    it('returns report object with required fields', () => {
      const report = mod.generateReport('1d');
      expect(report).toHaveProperty('date');
      expect(report).toHaveProperty('whatIDid');
      expect(report).toHaveProperty('whatIllDo');
      expect(report).toHaveProperty('blockers');
      expect(report).toHaveProperty('since');
    });

    it('includes blockers from file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'blockers.json'), '[{"description":"blocked"}]', 'utf8');
      const report = mod.generateReport('1d');
      expect(report.blockers.length).toBe(1);
    });
  });

  // ── formatMarkdown ─────────────────────────────────────────────────────
  describe('formatMarkdown', () => {
    it('formats report as markdown', () => {
      const report = {
        date: '2026-04-08',
        whatIDid: ['abc123 feat: something'],
        whatIllDo: [{ id: '1.1', title: 'Story', status: 'InProgress' }],
        blockers: [{ description: 'API down' }],
        since: '1d',
      };
      const md = mod.formatMarkdown(report);
      expect(md).toContain('# Standup Report');
      expect(md).toContain('## What I Did');
      expect(md).toContain('abc123 feat: something');
      expect(md).toContain('## What I\'ll Do');
      expect(md).toContain('[1.1] Story');
      expect(md).toContain('## Blockers');
      expect(md).toContain('API down');
    });

    it('shows placeholders when sections are empty', () => {
      const report = { date: '2026-04-08', whatIDid: [], whatIllDo: [], blockers: [], since: '1d' };
      const md = mod.formatMarkdown(report);
      expect(md).toContain('(no recent commits)');
      expect(md).toContain('(no in-progress stories)');
      expect(md).toContain('(none)');
    });

    it('handles string blockers', () => {
      const report = { date: '2026-04-08', whatIDid: [], whatIllDo: [], blockers: ['simple string'], since: '1d' };
      const md = mod.formatMarkdown(report);
      expect(md).toContain('simple string');
    });
  });

  // ── runStandup ─────────────────────────────────────────────────────────
  describe('runStandup', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runStandup(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('generates report with --format json', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.runStandup(['--format', 'json']);
      expect(result).toHaveProperty('date');
      spy.mockRestore();
    });

    it('writes to file with --output', () => {
      const outFile = path.join(tmpDir, 'report.md');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runStandup(['--output', outFile]);
      expect(fs.existsSync(outFile)).toBe(true);
      const content = fs.readFileSync(outFile, 'utf8');
      expect(content).toContain('# Standup Report');
      spy.mockRestore();
    });

    it('writes JSON to file with --format json --output', () => {
      const outFile = path.join(tmpDir, 'report.json');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runStandup(['--format', 'json', '--output', outFile]);
      expect(fs.existsSync(outFile)).toBe(true);
      const content = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      expect(content).toHaveProperty('date');
      spy.mockRestore();
    });
  });
});
