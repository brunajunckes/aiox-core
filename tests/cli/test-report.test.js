/**
 * Tests for Test Report Dashboard Command Module
 * @story 18.4 — Test Report Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-test-report-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/test-report/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/test-report/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_RESULTS = {
  testResults: [
    {
      testFilePath: '/project/tests/a.test.js',
      numPassingTests: 10,
      numFailingTests: 2,
      numPendingTests: 1,
      perfStats: { start: 1000, end: 3500 },
    },
    {
      testFilePath: '/project/tests/b.test.js',
      numPassingTests: 5,
      numFailingTests: 0,
      numPendingTests: 0,
      perfStats: { start: 1000, end: 1500 },
    },
  ],
};

function writeResults(data) {
  const dir = path.join(tmpDir, 'coverage');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'test-results.json'), JSON.stringify(data || FIXTURE_RESULTS));
}

describe('test-report command', () => {
  describe('loadTestResults', () => {
    it('returns null when no results file', () => {
      expect(mod.loadTestResults()).toBeNull();
    });

    it('loads from coverage/test-results.json', () => {
      writeResults();
      const result = mod.loadTestResults();
      expect(result).not.toBeNull();
      expect(result.testResults).toHaveLength(2);
    });

    it('loads from test-results.json in root', () => {
      fs.writeFileSync(path.join(tmpDir, 'test-results.json'), JSON.stringify(FIXTURE_RESULTS));
      const result = mod.loadTestResults();
      expect(result).not.toBeNull();
    });
  });

  describe('buildReport', () => {
    it('calculates totals correctly', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      expect(report.totalTests).toBe(18);
      expect(report.passed).toBe(15);
      expect(report.failed).toBe(2);
      expect(report.skipped).toBe(1);
    });

    it('calculates pass rate', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      expect(report.passRate).toBe(83);
    });

    it('includes slowest suites', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      expect(report.slowest).toHaveLength(2);
      expect(report.slowest[0].name).toBe('a.test.js');
      expect(report.slowest[0].duration).toBe(2500);
    });

    it('calculates total duration', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      expect(report.duration).toBe(3000);
    });

    it('handles empty results', () => {
      const report = mod.buildReport({ testResults: [] });
      expect(report.totalTests).toBe(0);
      expect(report.passRate).toBe(0);
    });
  });

  describe('compareReports', () => {
    it('calculates deltas', () => {
      const current = { totalTests: 20, passed: 18, failed: 2, skipped: 0, duration: 5000, passRate: 90 };
      const previous = { totalTests: 15, passed: 14, failed: 1, skipped: 0, duration: 4000, passRate: 93 };
      const delta = mod.compareReports(current, previous);
      expect(delta.totalTests).toBe(5);
      expect(delta.passed).toBe(4);
      expect(delta.failed).toBe(1);
      expect(delta.duration).toBe(1000);
      expect(delta.passRate).toBe(-3);
    });

    it('handles missing previous fields', () => {
      const current = { totalTests: 10, passed: 10, failed: 0, skipped: 0, duration: 1000, passRate: 100 };
      const delta = mod.compareReports(current, {});
      expect(delta.totalTests).toBe(10);
    });
  });

  describe('formatMarkdown', () => {
    it('generates markdown with summary table', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      const md = mod.formatMarkdown(report);
      expect(md).toContain('# Test Report');
      expect(md).toContain('| Total Tests | 18 |');
      expect(md).toContain('| Pass Rate | 83% |');
    });

    it('includes delta section when provided', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      const delta = { totalTests: 5, passed: 3, failed: 2, skipped: 0, duration: 100, passRate: -2 };
      const md = mod.formatMarkdown(report, delta);
      expect(md).toContain('## Delta');
      expect(md).toContain('+5');
    });

    it('includes slowest suites section', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      const md = mod.formatMarkdown(report);
      expect(md).toContain('Slowest Suites');
      expect(md).toContain('a.test.js');
    });
  });

  describe('formatText', () => {
    it('generates text report', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      const text = mod.formatText(report);
      expect(text).toContain('TEST REPORT');
      expect(text).toContain('Tests:    18');
      expect(text).toContain('Pass Rate: 83%');
    });

    it('includes delta in text when provided', () => {
      const report = mod.buildReport(FIXTURE_RESULTS);
      const delta = { totalTests: 5, passed: 3, failed: 2, skipped: 0, duration: 100, passRate: -2 };
      const text = mod.formatText(report, delta);
      expect(text).toContain('DELTA');
    });
  });

  describe('runTestReport', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('TEST REPORT DASHBOARD'));
      spy.mockRestore();
    });

    it('errors when no results file', () => {
      const errSpy = jest.spyOn(console, 'error').mockImplementation();
      mod.runTestReport([]);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('No test results'));
      expect(process.exitCode).toBe(1);
      errSpy.mockRestore();
    });

    it('displays text report', () => {
      writeResults();
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('TEST REPORT'));
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      writeResults();
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.totalTests).toBe(18);
      spy.mockRestore();
    });

    it('writes markdown to --output file', () => {
      writeResults();
      const outFile = path.join(tmpDir, 'report.md');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport(['--output', outFile]);
      expect(fs.existsSync(outFile)).toBe(true);
      const content = fs.readFileSync(outFile, 'utf8');
      expect(content).toContain('# Test Report');
      spy.mockRestore();
    });

    it('compares with --compare file', () => {
      writeResults();
      const prevReport = { totalTests: 10, passed: 9, failed: 1, skipped: 0, duration: 2000, passRate: 90 };
      const prevFile = path.join(tmpDir, 'prev.json');
      fs.writeFileSync(prevFile, JSON.stringify(prevReport));
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport(['--compare', prevFile]);
      const output = spy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('DELTA');
      spy.mockRestore();
    });

    it('warns on missing compare file', () => {
      writeResults();
      const errSpy = jest.spyOn(console, 'error').mockImplementation();
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runTestReport(['--compare', 'nonexistent.json']);
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      spy.mockRestore();
      errSpy.mockRestore();
    });
  });
});
