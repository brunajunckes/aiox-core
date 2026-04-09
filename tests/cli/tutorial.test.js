/**
 * Tests for Interactive Tutorial Command Module
 * @story 19.2 — Interactive Tutorial
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-tutorial-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/tutorial/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/tutorial/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('tutorial command', () => {
  describe('getSteps', () => {
    it('returns array of steps', () => {
      const steps = mod.getSteps();
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(5);
    });

    it('each step has id, title, content', () => {
      for (const step of mod.getSteps()) {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('content');
        expect(Array.isArray(step.content)).toBe(true);
      }
    });

    it('steps have sequential ids', () => {
      const steps = mod.getSteps();
      for (let i = 0; i < steps.length; i++) {
        expect(steps[i].id).toBe(i + 1);
      }
    });
  });

  describe('readProgress', () => {
    it('returns empty progress when no file', () => {
      const progress = mod.readProgress({ baseDir: tmpDir });
      expect(progress.completedSteps).toEqual([]);
      expect(progress.lastStep).toBe(0);
    });

    it('reads saved progress', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'tutorial-progress.json'), JSON.stringify({
        completedSteps: [1, 2, 3],
        lastStep: 3,
      }));
      const progress = mod.readProgress({ baseDir: tmpDir });
      expect(progress.completedSteps).toEqual([1, 2, 3]);
      expect(progress.lastStep).toBe(3);
    });

    it('handles corrupted file gracefully', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'tutorial-progress.json'), 'not json');
      const progress = mod.readProgress({ baseDir: tmpDir });
      expect(progress.completedSteps).toEqual([]);
    });
  });

  describe('writeProgress', () => {
    it('writes progress file', () => {
      mod.writeProgress({ completedSteps: [1, 2], lastStep: 2 }, { baseDir: tmpDir });
      const filePath = path.join(tmpDir, '.aiox', 'tutorial-progress.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.completedSteps).toEqual([1, 2]);
    });

    it('creates directory if missing', () => {
      const dir = path.join(tmpDir, '.aiox');
      expect(fs.existsSync(dir)).toBe(false);
      mod.writeProgress({ completedSteps: [], lastStep: 0 }, { baseDir: tmpDir });
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('resetProgress', () => {
    it('removes progress file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, 'tutorial-progress.json');
      fs.writeFileSync(filePath, '{}');
      const result = mod.resetProgress({ baseDir: tmpDir });
      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('returns false when no file exists', () => {
      const result = mod.resetProgress({ baseDir: tmpDir });
      expect(result).toBe(false);
    });
  });

  describe('formatStep', () => {
    it('formats step with checkbox', () => {
      const step = mod.getSteps()[0];
      const formatted = mod.formatStep(step, false);
      expect(formatted).toContain('[ ] Step 1:');
      expect(formatted).toContain(step.title);
    });

    it('marks completed step', () => {
      const step = mod.getSteps()[0];
      const formatted = mod.formatStep(step, true);
      expect(formatted).toContain('[x] Step 1:');
    });
  });

  describe('formatStepList', () => {
    it('shows all steps with progress', () => {
      const list = mod.formatStepList([1, 2]);
      expect(list).toContain('[x] Step 1:');
      expect(list).toContain('[x] Step 2:');
      expect(list).toContain('[ ] Step 3:');
      expect(list).toContain('Progress:');
    });

    it('shows 0 progress for empty input', () => {
      const list = mod.formatStepList([]);
      expect(list).toContain('0/');
    });
  });

  describe('runFullTutorial', () => {
    it('displays all steps', () => {
      const output = mod.runFullTutorial({ baseDir: tmpDir });
      expect(output).toContain('AIOX Tutorial');
      expect(output).toContain('Step 1:');
      const steps = mod.getSteps();
      expect(output).toContain(`Step ${steps.length}:`);
    });

    it('marks all steps completed in progress', () => {
      mod.runFullTutorial({ baseDir: tmpDir });
      const progress = mod.readProgress({ baseDir: tmpDir });
      expect(progress.completedSteps.length).toBe(mod.getSteps().length);
    });
  });

  describe('runTutorial', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTutorial(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      spy.mockRestore();
    });

    it('lists steps with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTutorial(['--list']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('AIOX Tutorial Steps'));
      spy.mockRestore();
    });

    it('resets progress with --reset', () => {
      // Create progress first
      mod.writeProgress({ completedSteps: [1], lastStep: 1 });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTutorial(['--reset']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('reset'));
      spy.mockRestore();
    });

    it('shows specific step with --step N', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTutorial(['--step', '2']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Step 2:'));
      spy.mockRestore();
    });

    it('rejects invalid step number', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runTutorial(['--step', '999']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid step'));
      spy.mockRestore();
    });

    it('runs full tutorial with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTutorial([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('AIOX Tutorial'));
      spy.mockRestore();
    });
  });

  describe('getProgressPath', () => {
    it('returns correct path', () => {
      const p = mod.getProgressPath(tmpDir);
      expect(p).toContain('.aiox');
      expect(p).toContain('tutorial-progress.json');
    });
  });
});
