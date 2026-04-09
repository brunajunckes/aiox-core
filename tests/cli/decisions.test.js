/**
 * Tests for Decision Log Command Module
 * @story 25.2 — Decision Log
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-decisions-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/decisions/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/decisions/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('decisions command', () => {
  // ── loadDecisions ──────────────────────────────────────────────────────
  describe('loadDecisions', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.loadDecisions()).toEqual([]);
    });

    it('returns empty array when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'decisions.json'), '', 'utf8');
      expect(mod.loadDecisions()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'decisions.json'), 'nope', 'utf8');
      expect(mod.loadDecisions()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'decisions.json'), '{"a":1}', 'utf8');
      expect(mod.loadDecisions()).toEqual([]);
    });

    it('parses valid JSON array', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = [{ id: 'x', title: 'T' }];
      fs.writeFileSync(path.join(dir, 'decisions.json'), JSON.stringify(data), 'utf8');
      expect(mod.loadDecisions()).toEqual(data);
    });
  });

  // ── addDecision ────────────────────────────────────────────────────────
  describe('addDecision', () => {
    it('adds a decision with title, context and outcome', () => {
      const d = mod.addDecision('Use REST', ['--context', 'Need simple API', '--outcome', 'REST chosen']);
      expect(d).toBeTruthy();
      expect(d.title).toBe('Use REST');
      expect(d.context).toBe('Need simple API');
      expect(d.outcome).toBe('REST chosen');
      expect(d.id).toBeTruthy();
      expect(d.date).toBeTruthy();
    });

    it('adds alternatives', () => {
      const d = mod.addDecision('DB', ['--alternatives', 'MySQL,SQLite']);
      expect(d.alternatives).toEqual(['MySQL', 'SQLite']);
    });

    it('adds author', () => {
      const d = mod.addDecision('Auth', ['--author', 'Aria']);
      expect(d.author).toBe('Aria');
    });

    it('returns null when title is missing', () => {
      expect(mod.addDecision(undefined, [])).toBeNull();
    });

    it('creates .aiox directory', () => {
      mod.addDecision('Test', []);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'decisions.json'))).toBe(true);
    });

    it('persists multiple decisions', () => {
      mod.addDecision('A', []);
      mod.addDecision('B', []);
      expect(mod.loadDecisions().length).toBe(2);
    });
  });

  // ── getDecision ────────────────────────────────────────────────────────
  describe('getDecision', () => {
    it('returns decision by id', () => {
      const d = mod.addDecision('Find', ['--context', 'ctx']);
      const found = mod.getDecision(d.id);
      expect(found.title).toBe('Find');
    });

    it('returns null for unknown id', () => {
      expect(mod.getDecision('nope')).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.getDecision(undefined)).toBeNull();
    });
  });

  // ── searchDecisions ────────────────────────────────────────────────────
  describe('searchDecisions', () => {
    it('finds by title', () => {
      mod.addDecision('Use PostgreSQL', ['--context', 'ACID']);
      mod.addDecision('Use Redis', ['--context', 'caching']);
      const results = mod.searchDecisions('PostgreSQL');
      expect(results.length).toBe(1);
    });

    it('finds by context', () => {
      mod.addDecision('DB', ['--context', 'need scalability']);
      const results = mod.searchDecisions('scalability');
      expect(results.length).toBe(1);
    });

    it('finds by outcome', () => {
      mod.addDecision('DB', ['--outcome', 'selected postgres']);
      const results = mod.searchDecisions('postgres');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.addDecision('X', []);
      expect(mod.searchDecisions('zzz').length).toBe(0);
    });

    it('returns empty array when term is missing', () => {
      expect(mod.searchDecisions(undefined)).toEqual([]);
    });
  });

  // ── removeDecision ─────────────────────────────────────────────────────
  describe('removeDecision', () => {
    it('removes a decision by id', () => {
      const d = mod.addDecision('Bye', []);
      expect(mod.removeDecision(d.id)).toBe(true);
      expect(mod.loadDecisions().length).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(mod.removeDecision('nonexistent')).toBe(false);
    });

    it('returns false when id is missing', () => {
      expect(mod.removeDecision(undefined)).toBe(false);
    });
  });

  // ── listDecisions ──────────────────────────────────────────────────────
  describe('listDecisions', () => {
    it('lists all decisions', () => {
      mod.addDecision('A', []);
      mod.addDecision('B', []);
      const list = mod.listDecisions([]);
      expect(list.length).toBe(2);
    });

    it('returns empty array when none exist', () => {
      expect(mod.listDecisions([])).toEqual([]);
    });

    it('outputs JSON format', () => {
      mod.addDecision('A', []);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const list = mod.listDecisions(['--format', 'json']);
      expect(list.length).toBe(1);
      spy.mockRestore();
    });

    it('outputs JSON for empty list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.listDecisions(['--format', 'json']);
      expect(spy).toHaveBeenCalledWith('[]');
      spy.mockRestore();
    });
  });

  // ── runDecisions ───────────────────────────────────────────────────────
  describe('runDecisions', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runDecisions(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runDecisions([]);
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
