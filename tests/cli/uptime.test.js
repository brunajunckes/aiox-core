/**
 * Tests for Uptime Tracker Command Module
 * @story 24.4 — Uptime Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let tmpDir;
let mod;

/**
 * Initialize a temporary git repo for testing.
 */
function initGitRepo(dir) {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: dir, stdio: 'pipe' });
}

function makeCommit(dir, message, date) {
  const file = path.join(dir, `file-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(file, message);
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
  const env = date
    ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    : process.env;
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe', env });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-uptime-test-'));
  initGitRepo(tmpDir);
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/uptime/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/uptime/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('uptime command', () => {
  // ── git helper ──────────────────────────────────────────────────────────
  describe('git', () => {
    it('executes git command in cwd', () => {
      makeCommit(tmpDir, 'init');
      const output = mod.git('log --oneline');
      expect(output).toContain('init');
    });

    it('returns empty string on failure', () => {
      jest.spyOn(process, 'cwd').mockReturnValue('/nonexistent');
      const modulePath = require.resolve('../../.aiox-core/cli/commands/uptime/index.js');
      delete require.cache[modulePath];
      const freshMod = require('../../.aiox-core/cli/commands/uptime/index.js');
      expect(freshMod.git('log')).toBe('');
    });
  });

  // ── getFirstCommitDate ─────────────────────────────────────────────────
  describe('getFirstCommitDate', () => {
    it('returns first commit date', () => {
      makeCommit(tmpDir, 'first', '2026-01-01T00:00:00+00:00');
      makeCommit(tmpDir, 'second', '2026-01-02T00:00:00+00:00');
      const date = mod.getFirstCommitDate();
      expect(date).toContain('2026-01-01');
    });

    it('returns null for empty repo', () => {
      // No commits yet
      expect(mod.getFirstCommitDate()).toBeNull();
    });
  });

  // ── getLatestCommitDate ────────────────────────────────────────────────
  describe('getLatestCommitDate', () => {
    it('returns latest commit date', () => {
      makeCommit(tmpDir, 'first', '2026-01-01T00:00:00+00:00');
      makeCommit(tmpDir, 'second', '2026-01-05T00:00:00+00:00');
      const date = mod.getLatestCommitDate();
      expect(date).toContain('2026-01-05');
    });
  });

  // ── getTotalCommits ────────────────────────────────────────────────────
  describe('getTotalCommits', () => {
    it('returns correct count', () => {
      makeCommit(tmpDir, 'a');
      makeCommit(tmpDir, 'b');
      makeCommit(tmpDir, 'c');
      expect(mod.getTotalCommits()).toBe(3);
    });

    it('returns 0 for empty repo', () => {
      expect(mod.getTotalCommits()).toBe(0);
    });
  });

  // ── getCommitDates ─────────────────────────────────────────────────────
  describe('getCommitDates', () => {
    it('returns array of date strings', () => {
      makeCommit(tmpDir, 'first', '2026-03-01T12:00:00+00:00');
      const dates = mod.getCommitDates();
      expect(dates.length).toBeGreaterThan(0);
      expect(dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ── getDaysActive ──────────────────────────────────────────────────────
  describe('getDaysActive', () => {
    it('counts unique days', () => {
      expect(mod.getDaysActive(['2026-01-01', '2026-01-01', '2026-01-02'])).toBe(2);
    });

    it('returns 0 for empty', () => {
      expect(mod.getDaysActive([])).toBe(0);
    });
  });

  // ── daysBetween ────────────────────────────────────────────────────────
  describe('daysBetween', () => {
    it('computes correct number of days', () => {
      expect(mod.daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    });

    it('returns 0 for same date', () => {
      expect(mod.daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    });
  });

  // ── commitFrequency ────────────────────────────────────────────────────
  describe('commitFrequency', () => {
    it('computes frequency', () => {
      const freq = mod.commitFrequency(10, '2026-01-01', '2026-01-11');
      expect(parseFloat(freq)).toBe(1.0);
    });

    it('returns 0 for null dates', () => {
      expect(mod.commitFrequency(0, null, null)).toBe('0');
    });
  });

  // ── collectStats ───────────────────────────────────────────────────────
  describe('collectStats', () => {
    it('collects all stats', () => {
      makeCommit(tmpDir, 'init');
      const stats = mod.collectStats();
      expect(stats).toHaveProperty('firstCommit');
      expect(stats).toHaveProperty('latestCommit');
      expect(stats).toHaveProperty('totalCommits');
      expect(stats).toHaveProperty('daysActive');
      expect(stats).toHaveProperty('totalDays');
      expect(stats).toHaveProperty('frequency');
      expect(stats.totalCommits).toBe(1);
    });
  });

  // ── computeStreaks ─────────────────────────────────────────────────────
  describe('computeStreaks', () => {
    it('returns 0 for empty', () => {
      const streaks = mod.computeStreaks([]);
      expect(streaks.current).toBe(0);
      expect(streaks.longest).toBe(0);
    });

    it('computes streak of consecutive days', () => {
      const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05'];
      const streaks = mod.computeStreaks(dates);
      expect(streaks.longest).toBe(3);
    });

    it('handles single day', () => {
      const streaks = mod.computeStreaks(['2026-01-01']);
      expect(streaks.current).toBe(1);
      expect(streaks.longest).toBe(1);
    });
  });

  // ── generateCalendar ───────────────────────────────────────────────────
  describe('generateCalendar', () => {
    it('generates calendar with legend', () => {
      const counts = new Map([['2026-01-01', 3], ['2026-01-02', 1]]);
      const output = mod.generateCalendar(counts);
      expect(output).toContain('Legend');
      expect(output).toContain('Commit Activity');
    });

    it('renders empty calendar for no data', () => {
      const output = mod.generateCalendar(new Map());
      expect(output).toContain('Commit Activity');
    });
  });

  // ── formatTable ─────────────────────────────────────────────────────────
  describe('formatTable', () => {
    it('formats stats as table', () => {
      const stats = {
        firstCommit: '2026-01-01',
        latestCommit: '2026-01-10',
        totalCommits: 20,
        daysActive: 8,
        totalDays: 10,
        frequency: '2.0',
      };
      const output = mod.formatTable(stats);
      expect(output).toContain('Uptime Tracker');
      expect(output).toContain('2026-01-01');
      expect(output).toContain('20');
    });
  });

  // ── runUptime ───────────────────────────────────────────────────────────
  describe('runUptime', () => {
    it('prints help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runUptime(['--help']);
      expect(spy.mock.calls[0][0]).toContain('Uptime Tracker');
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      makeCommit(tmpDir, 'init');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runUptime(['--format', 'json']);
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed).toHaveProperty('totalCommits');
      spy.mockRestore();
    });

    it('shows table by default', () => {
      makeCommit(tmpDir, 'init');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runUptime([]);
      expect(spy.mock.calls[0][0]).toContain('Uptime Tracker');
      spy.mockRestore();
    });

    it('shows streak with --streak', () => {
      makeCommit(tmpDir, 'init');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runUptime(['--streak']);
      expect(spy.mock.calls[0][0]).toContain('streak');
      spy.mockRestore();
    });
  });
});
