/**
 * Tests for Test Flaky Detector Command Module
 * @story 18.2 — Test Flaky Detector
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-flaky-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/flaky/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/flaky/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('flaky command', () => {
  describe('readHistory', () => {
    it('returns empty array when no history file', () => {
      expect(mod.readHistory()).toEqual([]);
    });

    it('reads JSONL records', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const record = { timestamp: '2026-01-01', suites: [{ name: 'a.test.js', status: 'pass' }] };
      fs.writeFileSync(path.join(dir, 'test-runs.jsonl'), JSON.stringify(record) + '\n');
      const result = mod.readHistory();
      expect(result).toHaveLength(1);
      expect(result[0].suites[0].name).toBe('a.test.js');
    });

    it('skips malformed lines', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'test-runs.jsonl'), 'bad json\n{"valid":true}\n');
      const result = mod.readHistory();
      expect(result).toHaveLength(1);
      expect(result[0].valid).toBe(true);
    });
  });

  describe('appendRecord', () => {
    it('creates directory and appends', () => {
      mod.appendRecord({ timestamp: 'now', suites: [] });
      const content = fs.readFileSync(path.join(tmpDir, '.aiox', 'test-runs.jsonl'), 'utf8');
      expect(content).toContain('"timestamp":"now"');
    });

    it('appends multiple records', () => {
      mod.appendRecord({ id: 1 });
      mod.appendRecord({ id: 2 });
      const lines = fs.readFileSync(path.join(tmpDir, '.aiox', 'test-runs.jsonl'), 'utf8').trim().split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('clearHistory', () => {
    it('clears existing history', () => {
      mod.appendRecord({ id: 1 });
      mod.clearHistory();
      const content = fs.readFileSync(path.join(tmpDir, '.aiox', 'test-runs.jsonl'), 'utf8');
      expect(content).toBe('');
    });

    it('does nothing if no history file', () => {
      expect(() => mod.clearHistory()).not.toThrow();
    });
  });

  describe('analyzeFlaky', () => {
    it('detects flaky tests (both pass and fail)', () => {
      const records = [
        { suites: [{ name: 'a.test.js', status: 'pass' }, { name: 'b.test.js', status: 'fail' }] },
        { suites: [{ name: 'a.test.js', status: 'fail' }, { name: 'b.test.js', status: 'fail' }] },
        { suites: [{ name: 'a.test.js', status: 'pass' }, { name: 'b.test.js', status: 'pass' }] },
      ];
      const flaky = mod.analyzeFlaky(records, 1);
      // a has 1 fail, 2 pass → flaky
      // b has 2 fail, 1 pass → flaky
      expect(flaky).toHaveLength(2);
      expect(flaky[0].name).toBe('b.test.js');
      expect(flaky[0].failures).toBe(2);
    });

    it('respects threshold', () => {
      const records = [
        { suites: [{ name: 'a.test.js', status: 'pass' }, { name: 'a.test.js', status: 'fail' }] },
      ];
      // threshold 2 means must fail 2+ times
      expect(mod.analyzeFlaky(records, 2)).toHaveLength(0);
    });

    it('excludes always-failing tests (no passes)', () => {
      const records = [
        { suites: [{ name: 'broken.test.js', status: 'fail' }] },
        { suites: [{ name: 'broken.test.js', status: 'fail' }] },
      ];
      // No passes → not flaky, just broken
      expect(mod.analyzeFlaky(records, 1)).toHaveLength(0);
    });

    it('returns empty for empty records', () => {
      expect(mod.analyzeFlaky([], 1)).toEqual([]);
    });

    it('calculates flaky rate correctly', () => {
      const records = [
        { suites: [{ name: 'x.test.js', status: 'fail' }] },
        { suites: [{ name: 'x.test.js', status: 'pass' }] },
        { suites: [{ name: 'x.test.js', status: 'fail' }] },
        { suites: [{ name: 'x.test.js', status: 'pass' }] },
      ];
      const flaky = mod.analyzeFlaky(records, 1);
      expect(flaky[0].flakyRate).toBe(50);
    });
  });

  describe('runFlaky', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('FLAKY DETECTOR'));
      spy.mockRestore();
    });

    it('clears history with --clear', () => {
      mod.appendRecord({ id: 1 });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky(['--clear']);
      expect(spy).toHaveBeenCalledWith('Test run history cleared.');
      expect(mod.readHistory()).toEqual([]);
      spy.mockRestore();
    });

    it('reports no history when empty', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No test run history'));
      spy.mockRestore();
    });

    it('reports no flaky tests when none detected', () => {
      mod.appendRecord({ suites: [{ name: 'a.test.js', status: 'pass' }] });
      mod.appendRecord({ suites: [{ name: 'a.test.js', status: 'pass' }] });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky([]);
      expect(spy).toHaveBeenCalledWith('No flaky tests detected.');
      spy.mockRestore();
    });

    it('displays flaky tests with default threshold', () => {
      mod.appendRecord({ suites: [{ name: 'f.test.js', status: 'fail' }] });
      mod.appendRecord({ suites: [{ name: 'f.test.js', status: 'pass' }] });
      mod.appendRecord({ suites: [{ name: 'f.test.js', status: 'fail' }] });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky([]);
      const output = spy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('f.test.js');
      expect(output).toContain('Flaky Tests');
      spy.mockRestore();
    });

    it('respects --top N', () => {
      mod.appendRecord({ suites: [
        { name: 'a.test.js', status: 'fail' },
        { name: 'b.test.js', status: 'fail' },
      ]});
      mod.appendRecord({ suites: [
        { name: 'a.test.js', status: 'pass' },
        { name: 'b.test.js', status: 'pass' },
      ]});
      mod.appendRecord({ suites: [
        { name: 'a.test.js', status: 'fail' },
        { name: 'b.test.js', status: 'fail' },
      ]});
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky(['--top', '1']);
      const output = spy.mock.calls.map(c => c[0]).join('\n');
      // Should only show 1 entry
      expect(output).toContain('Total: 1 flaky');
      spy.mockRestore();
    });

    it('--record fails without test results', () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation();
      mod.runFlaky(['--record']);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('No test results'));
      expect(process.exitCode).toBe(1);
      errSpy.mockRestore();
    });

    it('--record succeeds with test results file', () => {
      const resultsDir = path.join(tmpDir, 'coverage');
      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(path.join(resultsDir, 'test-results.json'), JSON.stringify({
        testResults: [
          { testFilePath: '/tests/a.test.js', numPassingTests: 5, numFailingTests: 0, numPendingTests: 0 },
        ],
      }));
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runFlaky(['--record']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Recorded 1'));
      spy.mockRestore();
    });
  });
});
