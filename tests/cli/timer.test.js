/**
 * Tests for Pomodoro Timer Command Module
 * @story 31.1 — Pomodoro Timer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-timer-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/timer/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/timer/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('timer command', () => {
  // ── loadState ──────────────────────────────────────────────────────────
  describe('loadState', () => {
    it('returns null when file is absent', () => {
      expect(mod.loadState()).toBeNull();
    });

    it('returns null for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'timer-state.json'), '', 'utf8');
      expect(mod.loadState()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'timer-state.json'), 'bad', 'utf8');
      expect(mod.loadState()).toBeNull();
    });

    it('parses valid state', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const state = { status: 'running', duration: 25 };
      fs.writeFileSync(path.join(dir, 'timer-state.json'), JSON.stringify(state), 'utf8');
      expect(mod.loadState()).toEqual(state);
    });
  });

  // ── startTimer ─────────────────────────────────────────────────────────
  describe('startTimer', () => {
    it('starts a 25min timer by default', () => {
      const result = mod.startTimer([]);
      expect(result).toBeTruthy();
      expect(result.status).toBe('running');
      expect(result.duration).toBe(25);
      expect(result.startedAt).toBeTruthy();
      expect(result.endsAt).toBeTruthy();
    });

    it('starts with custom duration', () => {
      const result = mod.startTimer(['--duration', '15']);
      expect(result.duration).toBe(15);
    });

    it('rejects invalid duration', () => {
      const result = mod.startTimer(['--duration', 'abc']);
      expect(result).toBeNull();
    });

    it('rejects zero duration', () => {
      const result = mod.startTimer(['--duration', '0']);
      expect(result).toBeNull();
    });

    it('rejects negative duration', () => {
      const result = mod.startTimer(['--duration', '-5']);
      expect(result).toBeNull();
    });

    it('prevents starting when timer already running', () => {
      mod.startTimer([]);
      const result = mod.startTimer([]);
      expect(result).toBeNull();
    });

    it('creates .aiox directory if absent', () => {
      mod.startTimer([]);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'timer-state.json'))).toBe(true);
    });

    it('saves state to file', () => {
      mod.startTimer(['--duration', '10']);
      const state = mod.loadState();
      expect(state.duration).toBe(10);
      expect(state.status).toBe('running');
    });
  });

  // ── stopTimer ──────────────────────────────────────────────────────────
  describe('stopTimer', () => {
    it('stops a running timer', () => {
      mod.startTimer([]);
      const result = mod.stopTimer();
      expect(result).toBeTruthy();
      expect(result.stoppedAt).toBeTruthy();
      expect(result.elapsed).toBeDefined();
    });

    it('returns null when no timer running', () => {
      const result = mod.stopTimer();
      expect(result).toBeNull();
    });

    it('clears state after stop', () => {
      mod.startTimer([]);
      mod.stopTimer();
      expect(mod.loadState()).toBeNull();
    });

    it('appends to history on stop', () => {
      mod.startTimer([]);
      mod.stopTimer();
      const history = mod.loadHistory();
      expect(history.length).toBe(1);
    });

    it('records completed status correctly', () => {
      // Start a timer with past endsAt to simulate completion
      const past = new Date(Date.now() - 30 * 60000);
      mod.saveState({
        status: 'running',
        duration: 25,
        startedAt: past.toISOString(),
        endsAt: new Date(past.getTime() + 25 * 60000).toISOString(),
      });
      const result = mod.stopTimer();
      expect(result.completed).toBe(true);
    });
  });

  // ── timerStatus ────────────────────────────────────────────────────────
  describe('timerStatus', () => {
    it('shows idle when no timer running', () => {
      const result = mod.timerStatus([]);
      expect(result.status).toBe('idle');
    });

    it('shows running timer info', () => {
      mod.startTimer(['--duration', '25']);
      const result = mod.timerStatus([]);
      expect(result.status).toBe('running');
      expect(result.duration).toBe(25);
      expect(result.remaining).toBeDefined();
    });

    it('outputs JSON format', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.timerStatus(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).status).toBe('idle');
      spy.mockRestore();
    });

    it('outputs JSON for running timer', () => {
      mod.startTimer([]);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.timerStatus(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(JSON.parse(output).status).toBe('running');
      spy.mockRestore();
    });
  });

  // ── loadHistory ────────────────────────────────────────────────────────
  describe('loadHistory', () => {
    it('returns empty array when file absent', () => {
      expect(mod.loadHistory()).toEqual([]);
    });

    it('returns empty array for empty file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'timers.jsonl'), '', 'utf8');
      expect(mod.loadHistory()).toEqual([]);
    });

    it('parses JSONL entries', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = '{"duration":25}\n{"duration":15}\n';
      fs.writeFileSync(path.join(dir, 'timers.jsonl'), data, 'utf8');
      expect(mod.loadHistory().length).toBe(2);
    });

    it('skips invalid lines', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = '{"duration":25}\nbad-line\n{"duration":15}\n';
      fs.writeFileSync(path.join(dir, 'timers.jsonl'), data, 'utf8');
      expect(mod.loadHistory().length).toBe(2);
    });
  });

  // ── timerHistory ───────────────────────────────────────────────────────
  describe('timerHistory', () => {
    it('shows empty message when no history', () => {
      const result = mod.timerHistory([]);
      expect(result).toEqual([]);
    });

    it('lists completed timers', () => {
      mod.startTimer([]);
      mod.stopTimer();
      const result = mod.timerHistory([]);
      expect(result.length).toBe(1);
    });

    it('outputs JSON format', () => {
      mod.startTimer([]);
      mod.stopTimer();
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.timerHistory(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      spy.mockRestore();
    });
  });

  // ── runTimer ───────────────────────────────────────────────────────────
  describe('runTimer', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runTimer(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runTimer([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mod.runTimer(['unknown']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('routes start subcommand', () => {
      const result = mod.runTimer(['start']);
      expect(result).toBeTruthy();
      expect(result.status).toBe('running');
    });

    it('routes stop subcommand', () => {
      mod.startTimer([]);
      const result = mod.runTimer(['stop']);
      expect(result).toBeTruthy();
    });
  });

  // ── HELP_TEXT / DEFAULT_DURATION ───────────────────────────────────────
  describe('exports', () => {
    it('exports HELP_TEXT', () => {
      expect(mod.HELP_TEXT).toContain('POMODORO TIMER');
    });

    it('exports DEFAULT_DURATION as 25', () => {
      expect(mod.DEFAULT_DURATION).toBe(25);
    });
  });
});
