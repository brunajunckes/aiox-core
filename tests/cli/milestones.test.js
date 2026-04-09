/**
 * Tests for Milestone Tracker Command Module
 * @story 27.1 — Milestone Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-milestones-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/milestones/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/milestones/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('milestones command', () => {
  // ── loadMilestones ──────────────────────────────────────────────────────
  describe('loadMilestones', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.loadMilestones()).toEqual([]);
    });

    it('returns empty array when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'milestones.json'), '', 'utf8');
      expect(mod.loadMilestones()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'milestones.json'), 'bad', 'utf8');
      expect(mod.loadMilestones()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'milestones.json'), '{"a":1}', 'utf8');
      expect(mod.loadMilestones()).toEqual([]);
    });

    it('parses valid JSON array', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = [{ id: 'x', name: 'M1' }];
      fs.writeFileSync(path.join(dir, 'milestones.json'), JSON.stringify(data), 'utf8');
      expect(mod.loadMilestones()).toEqual(data);
    });
  });

  // ── addMilestone ────────────────────────────────────────────────────────
  describe('addMilestone', () => {
    it('adds a milestone with name and target', () => {
      const m = mod.addMilestone('MVP Launch', ['--target', '2026-05-01']);
      expect(m).toBeTruthy();
      expect(m.name).toBe('MVP Launch');
      expect(m.target).toBe('2026-05-01');
      expect(m.progress).toBe(0);
      expect(m.status).toBe('active');
      expect(m.id).toBeTruthy();
    });

    it('adds milestone without target', () => {
      const m = mod.addMilestone('Beta', []);
      expect(m.target).toBe('');
    });

    it('returns null when name is missing', () => {
      expect(mod.addMilestone(undefined, [])).toBeNull();
    });

    it('creates .aiox directory', () => {
      mod.addMilestone('Test', []);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'milestones.json'))).toBe(true);
    });

    it('persists multiple milestones', () => {
      mod.addMilestone('A', []);
      mod.addMilestone('B', []);
      expect(mod.loadMilestones().length).toBe(2);
    });
  });

  // ── updateMilestone ────────────────────────────────────────────────────
  describe('updateMilestone', () => {
    it('updates progress', () => {
      const m = mod.addMilestone('M1', []);
      const updated = mod.updateMilestone(m.id, ['--progress', '75']);
      expect(updated.progress).toBe(75);
    });

    it('returns null for invalid progress', () => {
      const m = mod.addMilestone('M1', []);
      expect(mod.updateMilestone(m.id, ['--progress', '150'])).toBeNull();
    });

    it('returns null for non-numeric progress', () => {
      const m = mod.addMilestone('M1', []);
      expect(mod.updateMilestone(m.id, ['--progress', 'abc'])).toBeNull();
    });

    it('returns null for unknown id', () => {
      expect(mod.updateMilestone('nope', ['--progress', '50'])).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.updateMilestone(undefined, [])).toBeNull();
    });
  });

  // ── completeMilestone ──────────────────────────────────────────────────
  describe('completeMilestone', () => {
    it('marks milestone as done', () => {
      const m = mod.addMilestone('M1', []);
      const done = mod.completeMilestone(m.id);
      expect(done.status).toBe('done');
      expect(done.progress).toBe(100);
      expect(done.completedAt).toBeTruthy();
    });

    it('returns null for unknown id', () => {
      expect(mod.completeMilestone('nope')).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.completeMilestone(undefined)).toBeNull();
    });
  });

  // ── removeMilestone ────────────────────────────────────────────────────
  describe('removeMilestone', () => {
    it('removes a milestone by id', () => {
      const m = mod.addMilestone('Bye', []);
      expect(mod.removeMilestone(m.id)).toBe(true);
      expect(mod.loadMilestones().length).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(mod.removeMilestone('nonexistent')).toBe(false);
    });

    it('returns false when id is missing', () => {
      expect(mod.removeMilestone(undefined)).toBe(false);
    });
  });

  // ── listMilestones ────────────────────────────────────────────────────
  describe('listMilestones', () => {
    it('lists all milestones', () => {
      mod.addMilestone('A', []);
      mod.addMilestone('B', []);
      const list = mod.listMilestones([]);
      expect(list.length).toBe(2);
    });

    it('returns empty array when none exist', () => {
      expect(mod.listMilestones([])).toEqual([]);
    });

    it('outputs JSON format', () => {
      mod.addMilestone('A', []);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const list = mod.listMilestones(['--format', 'json']);
      expect(list.length).toBe(1);
      spy.mockRestore();
    });

    it('outputs JSON for empty list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.listMilestones(['--format', 'json']);
      expect(spy).toHaveBeenCalledWith('[]');
      spy.mockRestore();
    });
  });

  // ── renderProgressBar ──────────────────────────────────────────────────
  describe('renderProgressBar', () => {
    it('renders 0% progress', () => {
      expect(mod.renderProgressBar(0)).toBe('[' + '-'.repeat(20) + ']');
    });

    it('renders 100% progress', () => {
      expect(mod.renderProgressBar(100)).toBe('[' + '#'.repeat(20) + ']');
    });

    it('renders 50% progress', () => {
      const bar = mod.renderProgressBar(50);
      expect(bar).toContain('#');
      expect(bar).toContain('-');
    });
  });

  // ── runMilestones ─────────────────────────────────────────────────────
  describe('runMilestones', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runMilestones(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runMilestones([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ── generateId ─────────────────────────────────────────────────────────
  describe('generateId', () => {
    it('returns 8-char hex string', () => {
      expect(mod.generateId()).toMatch(/^[a-f0-9]{8}$/);
    });
  });
});
