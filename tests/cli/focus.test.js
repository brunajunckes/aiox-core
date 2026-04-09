/**
 * Tests for Focus Mode Command Module
 * @story 31.2 — Focus Mode
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-focus-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/focus/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/focus/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('focus command', () => {
  // ── loadState ──────────────────────────────────────────────────────────
  describe('loadState', () => {
    it('returns null when file is absent', () => {
      expect(mod.loadState()).toBeNull();
    });

    it('returns null for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'focus-state.json'), '', 'utf8');
      expect(mod.loadState()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'focus-state.json'), 'bad', 'utf8');
      expect(mod.loadState()).toBeNull();
    });

    it('parses valid state', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const state = { active: true, startedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(dir, 'focus-state.json'), JSON.stringify(state), 'utf8');
      expect(mod.loadState()).toEqual(state);
    });
  });

  // ── focusOn ────────────────────────────────────────────────────────────
  describe('focusOn', () => {
    it('enables focus mode', () => {
      const result = mod.focusOn();
      expect(result).toBeTruthy();
      expect(result.active).toBe(true);
      expect(result.startedAt).toBeTruthy();
    });

    it('saves state to file', () => {
      mod.focusOn();
      const state = mod.loadState();
      expect(state.active).toBe(true);
    });

    it('prevents enabling when already active', () => {
      mod.focusOn();
      const result = mod.focusOn();
      expect(result).toBeNull();
    });

    it('creates .aiox directory if absent', () => {
      mod.focusOn();
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'focus-state.json'))).toBe(true);
    });
  });

  // ── focusOff ───────────────────────────────────────────────────────────
  describe('focusOff', () => {
    it('disables focus mode and shows duration', () => {
      mod.focusOn();
      const result = mod.focusOff();
      expect(result).toBeTruthy();
      expect(result.endedAt).toBeTruthy();
      expect(result.durationMin).toBeDefined();
    });

    it('returns null when not active', () => {
      const result = mod.focusOff();
      expect(result).toBeNull();
    });

    it('clears state after off', () => {
      mod.focusOn();
      mod.focusOff();
      expect(mod.loadState()).toBeNull();
    });

    it('appends to history', () => {
      mod.focusOn();
      mod.focusOff();
      const history = mod.loadHistory();
      expect(history.length).toBe(1);
    });

    it('records duration correctly for past session', () => {
      const past = new Date(Date.now() - 60 * 60000);
      mod.saveState({ active: true, startedAt: past.toISOString() });
      const result = mod.focusOff();
      expect(result.durationMin).toBeGreaterThanOrEqual(59);
    });
  });

  // ── focusStatus ────────────────────────────────────────────────────────
  describe('focusStatus', () => {
    it('shows inactive when no focus', () => {
      const result = mod.focusStatus([]);
      expect(result.active).toBe(false);
    });

    it('shows active status with elapsed time', () => {
      mod.focusOn();
      const result = mod.focusStatus([]);
      expect(result.active).toBe(true);
      expect(result.elapsedMin).toBeDefined();
    });

    it('outputs JSON for inactive', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.focusStatus(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).active).toBe(false);
      spy.mockRestore();
    });

    it('outputs JSON for active', () => {
      mod.focusOn();
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.focusStatus(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).active).toBe(true);
      spy.mockRestore();
    });
  });

  // ── focusHistory ───────────────────────────────────────────────────────
  describe('focusHistory', () => {
    it('shows empty when no history', () => {
      const result = mod.focusHistory([]);
      expect(result).toEqual([]);
    });

    it('lists focus sessions', () => {
      mod.focusOn();
      mod.focusOff();
      const result = mod.focusHistory([]);
      expect(result.length).toBe(1);
    });

    it('outputs JSON format', () => {
      mod.focusOn();
      mod.focusOff();
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.focusHistory(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).length).toBe(1);
      spy.mockRestore();
    });
  });

  // ── focusStats ─────────────────────────────────────────────────────────
  describe('focusStats', () => {
    it('returns zeros when no history', () => {
      const result = mod.focusStats([]);
      expect(result.today).toBe(0);
      expect(result.week).toBe(0);
      expect(result.month).toBe(0);
      expect(result.total).toBe(0);
      expect(result.sessions).toBe(0);
    });

    it('counts session time', () => {
      mod.focusOn();
      mod.focusOff();
      const result = mod.focusStats([]);
      expect(result.sessions).toBe(1);
      expect(result.total).toBeDefined();
    });

    it('outputs JSON format', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.focusStats(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).sessions).toBe(0);
      spy.mockRestore();
    });
  });

  // ── loadHistory ────────────────────────────────────────────────────────
  describe('loadHistory', () => {
    it('returns empty array when absent', () => {
      expect(mod.loadHistory()).toEqual([]);
    });

    it('returns empty for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'focus-history.jsonl'), '', 'utf8');
      expect(mod.loadHistory()).toEqual([]);
    });

    it('skips invalid lines', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'focus-history.jsonl'), '{"a":1}\nbad\n{"b":2}\n', 'utf8');
      expect(mod.loadHistory().length).toBe(2);
    });
  });

  // ── runFocus ───────────────────────────────────────────────────────────
  describe('runFocus', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runFocus(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runFocus([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mod.runFocus(['unknown']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('routes on subcommand', () => {
      const result = mod.runFocus(['on']);
      expect(result.active).toBe(true);
    });

    it('routes off subcommand', () => {
      mod.focusOn();
      const result = mod.runFocus(['off']);
      expect(result).toBeTruthy();
    });
  });

  // ── exports ────────────────────────────────────────────────────────────
  describe('exports', () => {
    it('exports HELP_TEXT', () => {
      expect(mod.HELP_TEXT).toContain('FOCUS MODE');
    });
  });
});
