/**
 * Tests for Experiment Command Module
 *
 * @module tests/cli/experiment
 * @story 4.2 - Onboarding A/B Testing Framework
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-experiment-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/experiment/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getExperimentFile', () => {
  test('returns experiment.json inside .aiox', () => {
    expect(mod.getExperimentFile()).toBe(path.join(tmpDir, '.aiox', 'experiment.json'));
  });

  test('is a function, not a constant', () => {
    expect(typeof mod.getExperimentFile).toBe('function');
  });
});

// ── readExperiment ──────────────────────────────────────────────────────────────

describe('readExperiment', () => {
  test('returns null when file does not exist', () => {
    expect(mod.readExperiment()).toBeNull();
  });

  test('returns null when file is corrupt JSON', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'experiment.json'), '{bad json', 'utf8');
    expect(mod.readExperiment()).toBeNull();
  });

  test('returns null when file has no experiments key', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'experiment.json'), '{"foo":"bar"}', 'utf8');
    expect(mod.readExperiment()).toBeNull();
  });

  test('returns null for non-object content', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'experiment.json'), '"just a string"', 'utf8');
    expect(mod.readExperiment()).toBeNull();
  });

  test('returns parsed state when file is valid', () => {
    const data = { experiments: { 'onboarding-flow': { variant: 'guided', assignedAt: '2026-01-01T00:00:00Z', completions: 0 } } };
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'experiment.json'), JSON.stringify(data), 'utf8');
    expect(mod.readExperiment()).toEqual(data);
  });
});

// ── writeExperiment ─────────────────────────────────────────────────────────────

describe('writeExperiment', () => {
  test('creates .aiox directory if missing', () => {
    const data = { experiments: {} };
    mod.writeExperiment(data);
    expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
  });

  test('writes valid JSON', () => {
    const data = { experiments: { 'onboarding-flow': { variant: 'minimal', assignedAt: '2026-01-01T00:00:00Z', completions: 0 } } };
    mod.writeExperiment(data);
    const raw = fs.readFileSync(path.join(tmpDir, '.aiox', 'experiment.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(data);
  });

  test('overwrites previous state', () => {
    mod.writeExperiment({ experiments: { a: { variant: 'x' } } });
    mod.writeExperiment({ experiments: { b: { variant: 'y' } } });
    const state = mod.readExperiment();
    expect(state.experiments.b).toBeDefined();
    expect(state.experiments.a).toBeUndefined();
  });

  test('atomic write does not leave temp files', () => {
    mod.writeExperiment({ experiments: {} });
    const files = fs.readdirSync(path.join(tmpDir, '.aiox'));
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);
  });
});

// ── assignVariant ───────────────────────────────────────────────────────────────

describe('assignVariant', () => {
  test('assigns a valid variant for known experiment', () => {
    const variant = mod.assignVariant('onboarding-flow');
    expect(['guided', 'minimal']).toContain(variant);
  });

  test('persists assignment to disk', () => {
    const variant = mod.assignVariant('onboarding-flow');
    const state = mod.readExperiment();
    expect(state.experiments['onboarding-flow'].variant).toBe(variant);
    expect(state.experiments['onboarding-flow'].assignedAt).toBeDefined();
    expect(state.experiments['onboarding-flow'].completions).toBe(0);
  });

  test('returns existing assignment without changing it', () => {
    const first = mod.assignVariant('onboarding-flow');
    const second = mod.assignVariant('onboarding-flow');
    expect(second).toBe(first);
  });

  test('throws for unknown experiment', () => {
    expect(() => mod.assignVariant('unknown-exp')).toThrow('Unknown experiment: unknown-exp');
  });

  test('50/50 distribution over 100 assignments', () => {
    const counts = { guided: 0, minimal: 0 };

    for (let i = 0; i < 100; i++) {
      // Reset state for each iteration
      const dir = path.join(tmpDir, '.aiox');
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }

      const variant = mod.assignVariant('onboarding-flow');
      counts[variant]++;
    }

    // With 100 trials, each variant should appear at least 20 times
    // (probability of fewer than 20 in 100 fair coin flips is astronomically low)
    expect(counts.guided).toBeGreaterThanOrEqual(20);
    expect(counts.minimal).toBeGreaterThanOrEqual(20);
    expect(counts.guided + counts.minimal).toBe(100);
  });

  test('preserves other experiments when assigning', () => {
    mod.writeExperiment({
      experiments: {
        'other-exp': { variant: 'alpha', assignedAt: '2026-01-01T00:00:00Z', completions: 5 },
      },
    });

    // Mock KNOWN_EXPERIMENTS temporarily is not needed — onboarding-flow is known
    mod.assignVariant('onboarding-flow');

    const state = mod.readExperiment();
    expect(state.experiments['other-exp']).toEqual({
      variant: 'alpha',
      assignedAt: '2026-01-01T00:00:00Z',
      completions: 5,
    });
    expect(state.experiments['onboarding-flow']).toBeDefined();
  });
});

// ── getVariant ──────────────────────────────────────────────────────────────────

describe('getVariant', () => {
  test('returns null when no experiment file exists', () => {
    expect(mod.getVariant('onboarding-flow')).toBeNull();
  });

  test('returns null for unassigned experiment', () => {
    mod.writeExperiment({ experiments: {} });
    expect(mod.getVariant('onboarding-flow')).toBeNull();
  });

  test('returns variant after assignment', () => {
    const assigned = mod.assignVariant('onboarding-flow');
    expect(mod.getVariant('onboarding-flow')).toBe(assigned);
  });

  test('returns null for unknown experiment id', () => {
    mod.assignVariant('onboarding-flow');
    expect(mod.getVariant('nonexistent')).toBeNull();
  });
});

// ── runExperiment CLI ───────────────────────────────────────────────────────────

describe('runExperiment', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = undefined;
  });

  // ── help ──

  test('shows help with no arguments', () => {
    mod.runExperiment([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('AIOX Experiment'));
  });

  test('shows help with "help" subcommand', () => {
    mod.runExperiment(['help']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('shows help with null argv', () => {
    mod.runExperiment(null);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('AIOX Experiment'));
  });

  // ── list ──

  test('list shows experiments with no assignments', () => {
    mod.runExperiment(['list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('onboarding-flow'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('(not assigned)'));
  });

  test('list shows assigned variant', () => {
    mod.assignVariant('onboarding-flow');
    mod.runExperiment(['list']);
    const allCalls = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allCalls).toMatch(/guided|minimal/);
    expect(allCalls).toContain('assigned');
  });

  // ── status ──

  test('status shows telemetry state', () => {
    mod.runExperiment(['status']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Telemetry'));
  });

  test('status shows assigned experiment details', () => {
    mod.assignVariant('onboarding-flow');
    mod.runExperiment(['status']);
    const allCalls = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allCalls).toContain('Variant:');
    expect(allCalls).toContain('Completions:');
  });

  test('status shows "not assigned" for unassigned experiment', () => {
    mod.runExperiment(['status']);
    const allCalls = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(allCalls).toContain('not assigned');
  });

  // ── reset ──

  test('reset removes variant assignment', () => {
    mod.assignVariant('onboarding-flow');
    expect(mod.getVariant('onboarding-flow')).not.toBeNull();

    mod.runExperiment(['reset', 'onboarding-flow']);
    expect(mod.getVariant('onboarding-flow')).toBeNull();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Reset'));
  });

  test('reset with no id shows usage error', () => {
    mod.runExperiment(['reset']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    expect(process.exitCode).toBe(1);
  });

  test('reset with unknown id shows error', () => {
    mod.runExperiment(['reset', 'nonexistent']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown experiment'));
    expect(process.exitCode).toBe(1);
  });

  test('reset for unassigned experiment is a no-op', () => {
    mod.runExperiment(['reset', 'onboarding-flow']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('no assignment'));
  });
});

// ── KNOWN_EXPERIMENTS ───────────────────────────────────────────────────────────

describe('KNOWN_EXPERIMENTS', () => {
  test('onboarding-flow has two variants', () => {
    const exp = mod.KNOWN_EXPERIMENTS['onboarding-flow'];
    expect(exp).toBeDefined();
    expect(exp.variants).toEqual(['guided', 'minimal']);
  });

  test('all experiments have description and variants', () => {
    for (const [id, exp] of Object.entries(mod.KNOWN_EXPERIMENTS)) {
      expect(exp.description).toBeTruthy();
      expect(Array.isArray(exp.variants)).toBe(true);
      expect(exp.variants.length).toBeGreaterThanOrEqual(2);
    }
  });
});
