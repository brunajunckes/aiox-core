/**
 * Tests for Review Request Manager Command Module
 * @story 25.4 — Review Request Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-reviews-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/reviews/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/reviews/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('reviews command', () => {
  // ── loadReviews ────────────────────────────────────────────────────────
  describe('loadReviews', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.loadReviews()).toEqual([]);
    });

    it('returns empty array when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'reviews.json'), '', 'utf8');
      expect(mod.loadReviews()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'reviews.json'), 'bad', 'utf8');
      expect(mod.loadReviews()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'reviews.json'), '{"a":1}', 'utf8');
      expect(mod.loadReviews()).toEqual([]);
    });

    it('parses valid JSON array', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = [{ id: 'x', title: 'R' }];
      fs.writeFileSync(path.join(dir, 'reviews.json'), JSON.stringify(data), 'utf8');
      expect(mod.loadReviews()).toEqual(data);
    });
  });

  // ── createReview ───────────────────────────────────────────────────────
  describe('createReview', () => {
    it('creates a review with title and files', () => {
      const r = mod.createReview('Review API', ['--files', 'api.js,routes.js']);
      expect(r).toBeTruthy();
      expect(r.title).toBe('Review API');
      expect(r.files).toEqual(['api.js', 'routes.js']);
      expect(r.status).toBe('pending');
      expect(r.id).toBeTruthy();
    });

    it('creates with reviewer', () => {
      const r = mod.createReview('Code Review', ['--reviewer', 'Quinn']);
      expect(r.reviewer).toBe('Quinn');
    });

    it('returns null when title is missing', () => {
      expect(mod.createReview(undefined, [])).toBeNull();
    });

    it('creates .aiox directory', () => {
      mod.createReview('Test', []);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'reviews.json'))).toBe(true);
    });

    it('persists multiple reviews', () => {
      mod.createReview('A', []);
      mod.createReview('B', []);
      expect(mod.loadReviews().length).toBe(2);
    });
  });

  // ── completeReview ─────────────────────────────────────────────────────
  describe('completeReview', () => {
    it('approves a review', () => {
      const r = mod.createReview('Approve Me', []);
      const result = mod.completeReview(r.id, ['--verdict', 'approve']);
      expect(result.status).toBe('completed');
      expect(result.verdict).toBe('approve');
      expect(result.completedAt).toBeTruthy();
    });

    it('rejects a review', () => {
      const r = mod.createReview('Reject Me', []);
      const result = mod.completeReview(r.id, ['--verdict', 'reject']);
      expect(result.verdict).toBe('reject');
    });

    it('returns null for invalid verdict', () => {
      const r = mod.createReview('Bad', []);
      expect(mod.completeReview(r.id, ['--verdict', 'maybe'])).toBeNull();
    });

    it('returns null for missing verdict', () => {
      const r = mod.createReview('No verdict', []);
      expect(mod.completeReview(r.id, [])).toBeNull();
    });

    it('returns null for unknown id', () => {
      expect(mod.completeReview('nope', ['--verdict', 'approve'])).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.completeReview(undefined, ['--verdict', 'approve'])).toBeNull();
    });
  });

  // ── listReviews ────────────────────────────────────────────────────────
  describe('listReviews', () => {
    it('lists all reviews', () => {
      mod.createReview('A', []);
      mod.createReview('B', []);
      const list = mod.listReviews([]);
      expect(list.length).toBe(2);
    });

    it('returns empty array when none exist', () => {
      expect(mod.listReviews([])).toEqual([]);
    });

    it('outputs JSON format', () => {
      mod.createReview('A', []);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const list = mod.listReviews(['--format', 'json']);
      expect(list.length).toBe(1);
      spy.mockRestore();
    });

    it('outputs JSON for empty list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.listReviews(['--format', 'json']);
      expect(spy).toHaveBeenCalledWith('[]');
      spy.mockRestore();
    });
  });

  // ── reviewStats ────────────────────────────────────────────────────────
  describe('reviewStats', () => {
    it('returns zero stats when empty', () => {
      const stats = mod.reviewStats([]);
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.completionRate).toBe(0);
    });

    it('calculates stats correctly', () => {
      const r1 = mod.createReview('A', []);
      mod.createReview('B', []);
      mod.completeReview(r1.id, ['--verdict', 'approve']);
      const stats = mod.reviewStats([]);
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(0);
      expect(stats.completionRate).toBe(50);
    });

    it('outputs JSON format', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const stats = mod.reviewStats(['--format', 'json']);
      expect(stats).toHaveProperty('total');
      spy.mockRestore();
    });

    it('calculates avgTimeHours', () => {
      const r = mod.createReview('Timed', []);
      mod.completeReview(r.id, ['--verdict', 'approve']);
      const stats = mod.reviewStats([]);
      expect(typeof stats.avgTimeHours).toBe('number');
    });
  });

  // ── runReviews ─────────────────────────────────────────────────────────
  describe('runReviews', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runReviews(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runReviews([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mod.runReviews(['unknown']);
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
