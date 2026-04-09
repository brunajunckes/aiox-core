/**
 * Tests for Risk Register Command Module
 * @story 27.2 — Risk Register
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-risks-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/risks/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/risks/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('risks command', () => {
  // ── loadRisks ──────────────────────────────────────────────────────────
  describe('loadRisks', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.loadRisks()).toEqual([]);
    });

    it('returns empty array when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'risks.json'), '', 'utf8');
      expect(mod.loadRisks()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'risks.json'), 'bad', 'utf8');
      expect(mod.loadRisks()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'risks.json'), '{"a":1}', 'utf8');
      expect(mod.loadRisks()).toEqual([]);
    });

    it('parses valid JSON array', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = [{ id: 'x', title: 'Risk1' }];
      fs.writeFileSync(path.join(dir, 'risks.json'), JSON.stringify(data), 'utf8');
      expect(mod.loadRisks()).toEqual(data);
    });
  });

  // ── addRisk ────────────────────────────────────────────────────────────
  describe('addRisk', () => {
    it('adds a risk with title, severity and mitigation', () => {
      const r = mod.addRisk('Data loss', ['--severity', 'critical', '--mitigation', 'Daily backups']);
      expect(r).toBeTruthy();
      expect(r.title).toBe('Data loss');
      expect(r.severity).toBe('critical');
      expect(r.mitigation).toBe('Daily backups');
      expect(r.status).toBe('open');
      expect(r.id).toBeTruthy();
    });

    it('defaults severity to medium', () => {
      const r = mod.addRisk('Minor issue', []);
      expect(r.severity).toBe('medium');
    });

    it('rejects invalid severity', () => {
      expect(mod.addRisk('Bad', ['--severity', 'extreme'])).toBeNull();
    });

    it('returns null when title is missing', () => {
      expect(mod.addRisk(undefined, [])).toBeNull();
    });

    it('creates .aiox directory', () => {
      mod.addRisk('Test', []);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'risks.json'))).toBe(true);
    });

    it('persists multiple risks', () => {
      mod.addRisk('A', []);
      mod.addRisk('B', []);
      expect(mod.loadRisks().length).toBe(2);
    });
  });

  // ── updateRisk ─────────────────────────────────────────────────────────
  describe('updateRisk', () => {
    it('updates status to mitigated', () => {
      const r = mod.addRisk('R1', []);
      const updated = mod.updateRisk(r.id, ['--status', 'mitigated']);
      expect(updated.status).toBe('mitigated');
    });

    it('updates severity', () => {
      const r = mod.addRisk('R1', ['--severity', 'low']);
      const updated = mod.updateRisk(r.id, ['--severity', 'high']);
      expect(updated.severity).toBe('high');
    });

    it('updates mitigation', () => {
      const r = mod.addRisk('R1', []);
      const updated = mod.updateRisk(r.id, ['--mitigation', 'New plan']);
      expect(updated.mitigation).toBe('New plan');
    });

    it('rejects invalid status', () => {
      const r = mod.addRisk('R1', []);
      expect(mod.updateRisk(r.id, ['--status', 'bogus'])).toBeNull();
    });

    it('rejects invalid severity on update', () => {
      const r = mod.addRisk('R1', []);
      expect(mod.updateRisk(r.id, ['--severity', 'extreme'])).toBeNull();
    });

    it('returns null for unknown id', () => {
      expect(mod.updateRisk('nope', ['--status', 'closed'])).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.updateRisk(undefined, [])).toBeNull();
    });
  });

  // ── removeRisk ─────────────────────────────────────────────────────────
  describe('removeRisk', () => {
    it('removes a risk by id', () => {
      const r = mod.addRisk('Bye', []);
      expect(mod.removeRisk(r.id)).toBe(true);
      expect(mod.loadRisks().length).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(mod.removeRisk('nonexistent')).toBe(false);
    });

    it('returns false when id is missing', () => {
      expect(mod.removeRisk(undefined)).toBe(false);
    });
  });

  // ── listRisks ──────────────────────────────────────────────────────────
  describe('listRisks', () => {
    it('lists all risks sorted by severity', () => {
      mod.addRisk('Low', ['--severity', 'low']);
      mod.addRisk('Critical', ['--severity', 'critical']);
      mod.addRisk('High', ['--severity', 'high']);
      const list = mod.listRisks([]);
      expect(list.length).toBe(3);
      expect(list[0].severity).toBe('critical');
      expect(list[1].severity).toBe('high');
      expect(list[2].severity).toBe('low');
    });

    it('returns empty array when none exist', () => {
      expect(mod.listRisks([])).toEqual([]);
    });

    it('outputs JSON format', () => {
      mod.addRisk('A', []);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const list = mod.listRisks(['--format', 'json']);
      expect(list.length).toBe(1);
      spy.mockRestore();
    });

    it('outputs JSON for empty list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.listRisks(['--format', 'json']);
      expect(spy).toHaveBeenCalledWith('[]');
      spy.mockRestore();
    });
  });

  // ── runRisks ───────────────────────────────────────────────────────────
  describe('runRisks', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runRisks(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runRisks([]);
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
