/**
 * Tests for Capacity Planner Command Module
 * @story 27.4 — Capacity Planner
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-capacity-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/capacity/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/capacity/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createStory(sprint, num, status) {
  const dir = path.join(tmpDir, 'docs', 'stories');
  fs.mkdirSync(dir, { recursive: true });
  const content = `# Story ${sprint}.${num}: Test Story\n\n## Status\n\n${status}\n`;
  fs.writeFileSync(path.join(dir, `${sprint}.${num}.story.md`), content, 'utf8');
}

describe('capacity command', () => {
  // ── parseStory ─────────────────────────────────────────────────────────
  describe('parseStory', () => {
    it('parses a valid story file', () => {
      const content = '# Story 5.1: Test\n\n## Status\n\nDone\n';
      const result = mod.parseStory('5.1.story.md', content);
      expect(result).toBeTruthy();
      expect(result.sprint).toBe(5);
      expect(result.storyNum).toBe(1);
      expect(result.done).toBe(true);
    });

    it('returns null for non-story filenames', () => {
      expect(mod.parseStory('readme.md', 'content')).toBeNull();
    });

    it('detects InReview as done', () => {
      const content = '# Story 3.2: Test\n\n## Status\n\nInReview\n';
      const result = mod.parseStory('3.2.story.md', content);
      expect(result.done).toBe(true);
    });

    it('detects Draft as not done', () => {
      const content = '# Story 3.2: Test\n\n## Status\n\nDraft\n';
      const result = mod.parseStory('3.2.story.md', content);
      expect(result.done).toBe(false);
    });
  });

  // ── scanStories ────────────────────────────────────────────────────────
  describe('scanStories', () => {
    it('returns empty for missing dir', () => {
      expect(mod.scanStories('/nonexistent')).toEqual([]);
    });

    it('scans stories from directory', () => {
      createStory(10, 1, 'Done');
      createStory(10, 2, 'InProgress');
      const stories = mod.scanStories(path.join(tmpDir, 'docs', 'stories'));
      expect(stories.length).toBe(2);
    });
  });

  // ── calculateVelocity ──────────────────────────────────────────────────
  describe('calculateVelocity', () => {
    it('calculates velocity across sprints', () => {
      const stories = [
        { sprint: 1, done: true },
        { sprint: 1, done: true },
        { sprint: 1, done: false },
        { sprint: 2, done: true },
        { sprint: 2, done: true },
        { sprint: 2, done: true },
      ];
      const v = mod.calculateVelocity(stories);
      expect(v.totalSprints).toBe(2);
      expect(v.totalStories).toBe(6);
      expect(v.totalDone).toBe(5);
      expect(v.avgVelocity).toBe(2.5);
    });

    it('returns zero velocity for no done stories', () => {
      const stories = [{ sprint: 1, done: false }];
      const v = mod.calculateVelocity(stories);
      expect(v.avgVelocity).toBe(0);
    });

    it('handles empty stories', () => {
      const v = mod.calculateVelocity([]);
      expect(v.totalSprints).toBe(0);
      expect(v.avgVelocity).toBe(0);
    });

    it('detects increasing trend', () => {
      const stories = [
        { sprint: 1, done: true },
        { sprint: 2, done: true },
        { sprint: 2, done: true },
        { sprint: 2, done: true },
      ];
      const v = mod.calculateVelocity(stories);
      expect(v.trend).toBe('increasing');
    });

    it('detects decreasing trend', () => {
      const stories = [
        { sprint: 1, done: true },
        { sprint: 1, done: true },
        { sprint: 1, done: true },
        { sprint: 2, done: true },
      ];
      const v = mod.calculateVelocity(stories);
      expect(v.trend).toBe('decreasing');
    });
  });

  // ── forecastCompletion ─────────────────────────────────────────────────
  describe('forecastCompletion', () => {
    it('forecasts sprints needed', () => {
      const velocity = { avgVelocity: 4 };
      const f = mod.forecastCompletion(velocity, 20);
      expect(f.sprintsNeeded).toBe(5);
      expect(f.stories).toBe(20);
    });

    it('returns Infinity for zero velocity', () => {
      const velocity = { avgVelocity: 0 };
      const f = mod.forecastCompletion(velocity, 10);
      expect(f.sprints).toBe(Infinity);
    });

    it('rounds up partial sprints', () => {
      const velocity = { avgVelocity: 3 };
      const f = mod.forecastCompletion(velocity, 10);
      expect(f.sprintsNeeded).toBe(4); // ceil(10/3)
    });
  });

  // ── renderCapacity ─────────────────────────────────────────────────────
  describe('renderCapacity', () => {
    it('renders capacity summary', () => {
      const velocity = {
        totalSprints: 5,
        totalStories: 20,
        totalDone: 18,
        avgVelocity: 3.6,
        trend: 'stable',
      };
      const output = mod.renderCapacity(velocity);
      expect(output).toContain('Capacity Planner');
      expect(output).toContain('3.6');
      expect(output).toContain('stable');
    });
  });

  // ── renderHistory ──────────────────────────────────────────────────────
  describe('renderHistory', () => {
    it('renders history table', () => {
      const velocity = {
        history: [
          { sprint: 1, total: 4, done: 3 },
          { sprint: 2, total: 4, done: 4 },
        ],
      };
      const output = mod.renderHistory(velocity);
      expect(output).toContain('Velocity History');
      expect(output).toContain('Sprint');
    });

    it('handles empty history', () => {
      const output = mod.renderHistory({ history: [] });
      expect(output).toContain('No sprint data');
    });
  });

  // ── runCapacity ────────────────────────────────────────────────────────
  describe('runCapacity', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runCapacity(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('outputs JSON format', () => {
      createStory(5, 1, 'Done');
      createStory(5, 2, 'Done');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.runCapacity(['--format', 'json']);
      expect(result).toBeTruthy();
      expect(result.velocity).toBeTruthy();
      spy.mockRestore();
    });

    it('includes forecast in JSON', () => {
      createStory(5, 1, 'Done');
      createStory(5, 2, 'Done');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.runCapacity(['--format', 'json', '--forecast', '10']);
      expect(result.forecast).toBeTruthy();
      spy.mockRestore();
    });

    it('shows history with --history', () => {
      createStory(5, 1, 'Done');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runCapacity(['--history']);
      const calls = spy.mock.calls.map(c => c[0]).join('\n');
      expect(calls).toContain('Velocity History');
      spy.mockRestore();
    });

    it('returns null for invalid forecast', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const spy2 = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = mod.runCapacity(['--forecast', 'abc']);
      expect(result).toBeNull();
      spy.mockRestore();
      spy2.mockRestore();
    });
  });
});
