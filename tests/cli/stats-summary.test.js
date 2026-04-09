/**
 * Tests for CLI Stats & Summary Command Module
 * @story 20.4 — CLI Stats & Summary
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-stats-summary-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/stats-summary/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/stats-summary/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('stats-summary command', () => {
  // ── countCommands ──────────────────────────────────────────────────────────
  describe('countCommands', () => {
    it('counts case statements in aiox.js', () => {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'aiox.js'), "case 'foo': break;\ncase 'bar': break;");
      const count = mod.countCommands({ cwd: tmpDir });
      expect(count).toBe(2);
    });

    it('returns 0 when file missing', () => {
      expect(mod.countCommands({ cwd: tmpDir })).toBe(0);
    });
  });

  // ── countTestFiles ─────────────────────────────────────────────────────────
  describe('countTestFiles', () => {
    it('counts .test.js files recursively', () => {
      const dir = path.join(tmpDir, 'tests', 'cli');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.test.js'), '');
      fs.writeFileSync(path.join(dir, 'b.test.js'), '');
      fs.writeFileSync(path.join(dir, 'c.js'), ''); // not a test
      expect(mod.countTestFiles({ cwd: tmpDir })).toBe(2);
    });

    it('returns 0 when no tests dir', () => {
      expect(mod.countTestFiles({ cwd: tmpDir })).toBe(0);
    });
  });

  // ── countStories ───────────────────────────────────────────────────────────
  describe('countStories', () => {
    it('counts .story.md files', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.1.story.md'), '');
      fs.writeFileSync(path.join(dir, '2.1.story.md'), '');
      fs.writeFileSync(path.join(dir, 'README.md'), '');
      expect(mod.countStories({ cwd: tmpDir })).toBe(2);
    });

    it('returns 0 when no stories dir', () => {
      expect(mod.countStories({ cwd: tmpDir })).toBe(0);
    });
  });

  // ── countSprints ───────────────────────────────────────────────────────────
  describe('countSprints', () => {
    it('counts unique sprint numbers', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.1.story.md'), '');
      fs.writeFileSync(path.join(dir, '1.2.story.md'), '');
      fs.writeFileSync(path.join(dir, '2.1.story.md'), '');
      expect(mod.countSprints({ cwd: tmpDir })).toBe(2);
    });

    it('returns 0 when no stories', () => {
      expect(mod.countSprints({ cwd: tmpDir })).toBe(0);
    });
  });

  // ── countDependencies ──────────────────────────────────────────────────────
  describe('countDependencies', () => {
    it('counts deps and devDeps', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        dependencies: { a: '1', b: '2' },
        devDependencies: { c: '3' },
      }));
      const result = mod.countDependencies({ cwd: tmpDir });
      expect(result.deps).toBe(2);
      expect(result.devDeps).toBe(1);
    });

    it('returns zeros when no package.json', () => {
      const result = mod.countDependencies({ cwd: tmpDir });
      expect(result.deps).toBe(0);
      expect(result.devDeps).toBe(0);
    });
  });

  // ── countLinesOfCode ───────────────────────────────────────────────────────
  describe('countLinesOfCode', () => {
    it('returns number from exec', () => {
      const execFn = () => '  12345 total';
      expect(mod.countLinesOfCode({ execFn })).toBe(12345);
    });

    it('returns 0 on error', () => {
      const execFn = () => { throw new Error('fail'); };
      expect(mod.countLinesOfCode({ execFn })).toBe(0);
    });
  });

  // ── countMergedPRs ─────────────────────────────────────────────────────────
  describe('countMergedPRs', () => {
    it('returns count from exec', () => {
      const execFn = () => '15';
      expect(mod.countMergedPRs({ execFn })).toBe(15);
    });

    it('returns 0 on error', () => {
      const execFn = () => { throw new Error('fail'); };
      expect(mod.countMergedPRs({ execFn })).toBe(0);
    });
  });

  // ── collectStats ───────────────────────────────────────────────────────────
  describe('collectStats', () => {
    it('returns object with all stat keys', () => {
      const execFn = () => '0';
      const stats = mod.collectStats({ cwd: tmpDir, execFn });
      expect(stats).toHaveProperty('commands');
      expect(stats).toHaveProperty('testFiles');
      expect(stats).toHaveProperty('stories');
      expect(stats).toHaveProperty('linesOfCode');
      expect(stats).toHaveProperty('sprints');
      expect(stats).toHaveProperty('mergedPRs');
      expect(stats).toHaveProperty('dependencies');
      expect(stats).toHaveProperty('devDependencies');
    });
  });

  // ── formatText ─────────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats stats as text', () => {
      const stats = { commands: 50, testFiles: 80, stories: 40, linesOfCode: 10000, sprints: 20, mergedPRs: 15, dependencies: 20, devDependencies: 10 };
      const text = mod.formatText(stats);
      expect(text).toContain('Project Summary');
      expect(text).toContain('50');
      expect(text).toContain('80');
    });
  });

  // ── formatJSON ─────────────────────────────────────────────────────────────
  describe('formatJSON', () => {
    it('returns valid JSON', () => {
      const stats = { commands: 1, testFiles: 2, stories: 3, linesOfCode: 4, sprints: 5, mergedPRs: 6, dependencies: 7, devDependencies: 8 };
      const parsed = JSON.parse(mod.formatJSON(stats));
      expect(parsed.commands).toBe(1);
      expect(parsed).toHaveProperty('generated');
    });
  });

  // ── generateBadges ─────────────────────────────────────────────────────────
  describe('generateBadges', () => {
    it('generates badge URLs', () => {
      const stats = { commands: 50, testFiles: 80, stories: 40, linesOfCode: 10000, sprints: 20 };
      const badges = mod.generateBadges(stats);
      expect(badges).toContain('img.shields.io');
      expect(badges).toContain('commands-50');
    });
  });

  // ── runStatsSummary ────────────────────────────────────────────────────────
  describe('runStatsSummary', () => {
    it('outputs text summary', () => {
      const execFn = () => '0';
      const lines = [];
      mod.runStatsSummary([], { log: (m) => lines.push(m), execFn, cwd: tmpDir });
      expect(lines[0]).toContain('Project Summary');
    });

    it('outputs JSON format', () => {
      const execFn = () => '0';
      const lines = [];
      mod.runStatsSummary(['--format', 'json'], { log: (m) => lines.push(m), execFn, cwd: tmpDir });
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('commands');
    });

    it('outputs badge URLs', () => {
      const execFn = () => '0';
      const lines = [];
      mod.runStatsSummary(['--badge'], { log: (m) => lines.push(m), execFn, cwd: tmpDir });
      expect(lines[0]).toContain('img.shields.io');
    });

    it('writes to output file', () => {
      const execFn = () => '0';
      const outPath = path.join(tmpDir, 'stats.json');
      const lines = [];
      mod.runStatsSummary(['--output', outPath], { log: (m) => lines.push(m), execFn, cwd: tmpDir });
      expect(fs.existsSync(outPath)).toBe(true);
    });

    it('shows help with --help', () => {
      const lines = [];
      mod.runStatsSummary(['--help'], { log: (m) => lines.push(m) });
      expect(lines[0]).toContain('Stats & Summary');
    });
  });

  // ── getHelpText ────────────────────────────────────────────────────────────
  describe('getHelpText', () => {
    it('returns help text', () => {
      const help = mod.getHelpText();
      expect(help).toContain('aiox stats-summary');
      expect(help.length).toBeGreaterThan(50);
    });
  });
});
