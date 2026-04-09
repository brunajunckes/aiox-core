/**
 * Tests for Burndown Chart Command Module
 * @story 27.3 — Burndown Chart
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-burndown-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/burndown/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/burndown/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createStory(sprint, num, status) {
  const dir = path.join(tmpDir, 'docs', 'stories');
  fs.mkdirSync(dir, { recursive: true });
  const ac = status === 'Done' || status === 'InReview'
    ? '- [x] Criterion 1\n- [x] Criterion 2'
    : '- [ ] Criterion 1\n- [ ] Criterion 2';
  const content = `# Story ${sprint}.${num}: Test Story\n\n## Status\n\n${status}\n\n## Acceptance Criteria\n\n${ac}\n`;
  fs.writeFileSync(path.join(dir, `${sprint}.${num}.story.md`), content, 'utf8');
}

describe('burndown command', () => {
  // ── parseStory ─────────────────────────────────────────────────────────
  describe('parseStory', () => {
    it('parses a valid story filename and content', () => {
      const content = '# Story 5.1: Test\n\n## Status\n\nDone\n\n- [x] AC1\n- [x] AC2\n';
      const result = mod.parseStory('5.1.story.md', content);
      expect(result).toBeTruthy();
      expect(result.sprint).toBe(5);
      expect(result.storyNum).toBe(1);
      expect(result.done).toBe(true);
      expect(result.totalAC).toBe(2);
      expect(result.doneAC).toBe(2);
    });

    it('returns null for non-story filenames', () => {
      expect(mod.parseStory('readme.md', 'content')).toBeNull();
    });

    it('detects InReview as done', () => {
      const content = '# Story 3.2: Test\n\n## Status\n\nInReview\n';
      const result = mod.parseStory('3.2.story.md', content);
      expect(result.done).toBe(true);
    });

    it('detects InProgress as not done', () => {
      const content = '# Story 3.2: Test\n\n## Status\n\nInProgress\n';
      const result = mod.parseStory('3.2.story.md', content);
      expect(result.done).toBe(false);
    });
  });

  // ── scanStories ────────────────────────────────────────────────────────
  describe('scanStories', () => {
    it('returns empty array for missing directory', () => {
      expect(mod.scanStories('/nonexistent')).toEqual([]);
    });

    it('scans stories from directory', () => {
      createStory(10, 1, 'Done');
      createStory(10, 2, 'InProgress');
      const stories = mod.scanStories(path.join(tmpDir, 'docs', 'stories'));
      expect(stories.length).toBe(2);
    });
  });

  // ── detectCurrentSprint ────────────────────────────────────────────────
  describe('detectCurrentSprint', () => {
    it('returns 1 for empty stories', () => {
      expect(mod.detectCurrentSprint([])).toBe(1);
    });

    it('returns highest sprint number', () => {
      const stories = [
        { sprint: 5 },
        { sprint: 10 },
        { sprint: 3 },
      ];
      expect(mod.detectCurrentSprint(stories)).toBe(10);
    });
  });

  // ── calculateBurndown ──────────────────────────────────────────────────
  describe('calculateBurndown', () => {
    it('calculates burndown for a sprint', () => {
      createStory(5, 1, 'Done');
      createStory(5, 2, 'Done');
      createStory(5, 3, 'InProgress');
      createStory(5, 4, 'Draft');
      const stories = mod.scanStories(path.join(tmpDir, 'docs', 'stories'));
      const result = mod.calculateBurndown(stories, 5);
      expect(result.total).toBe(4);
      expect(result.done).toBe(2);
      expect(result.remaining).toBe(2);
      expect(result.points.length).toBeGreaterThan(0);
    });

    it('handles empty sprint', () => {
      const result = mod.calculateBurndown([], 99);
      expect(result.total).toBe(0);
      expect(result.done).toBe(0);
      expect(result.remaining).toBe(0);
    });
  });

  // ── generateIdealLine ──────────────────────────────────────────────────
  describe('generateIdealLine', () => {
    it('generates ideal burndown points', () => {
      const points = mod.generateIdealLine(10, 5);
      expect(points.length).toBe(6); // 0..5
      expect(points[0].remaining).toBe(10);
      expect(points[5].remaining).toBe(0);
    });

    it('handles single day', () => {
      const points = mod.generateIdealLine(4, 1);
      expect(points.length).toBe(2);
    });
  });

  // ── renderAsciiChart ───────────────────────────────────────────────────
  describe('renderAsciiChart', () => {
    it('renders chart for a sprint with data', () => {
      createStory(7, 1, 'Done');
      createStory(7, 2, 'InProgress');
      const stories = mod.scanStories(path.join(tmpDir, 'docs', 'stories'));
      const burndown = mod.calculateBurndown(stories, 7);
      const chart = mod.renderAsciiChart(burndown, false);
      expect(chart).toContain('Sprint 7');
      expect(chart).toContain('*');
    });

    it('renders chart with ideal line', () => {
      createStory(7, 1, 'Done');
      createStory(7, 2, 'InProgress');
      const stories = mod.scanStories(path.join(tmpDir, 'docs', 'stories'));
      const burndown = mod.calculateBurndown(stories, 7);
      const chart = mod.renderAsciiChart(burndown, true);
      expect(chart).toContain('ideal');
    });

    it('handles empty sprint', () => {
      const burndown = mod.calculateBurndown([], 99);
      const chart = mod.renderAsciiChart(burndown, false);
      expect(chart).toContain('No stories found');
    });
  });

  // ── runBurndown ────────────────────────────────────────────────────────
  describe('runBurndown', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runBurndown(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('outputs JSON format', () => {
      createStory(8, 1, 'Done');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.runBurndown(['--format', 'json']);
      expect(result).toBeTruthy();
      expect(result.sprint).toBe(8);
      spy.mockRestore();
    });

    it('accepts --sprint flag', () => {
      createStory(5, 1, 'Done');
      createStory(6, 1, 'InProgress');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.runBurndown(['--sprint', '5']);
      expect(result.sprint).toBe(5);
      expect(result.done).toBe(1);
      spy.mockRestore();
    });

    it('returns null for invalid sprint number', () => {
      expect(mod.runBurndown(['--sprint', 'abc'])).toBeNull();
    });
  });
});
