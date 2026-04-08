/**
 * Tests for Coverage Reporting & Enforcement Command Module
 *
 * @module tests/cli/coverage
 * @story 9.2 — Test Coverage Reporting & Enforcement
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;
const originalExitCode = process.exitCode;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-coverage-test-'));
  process.cwd = () => tmpDir;
  process.exitCode = undefined;
});

afterEach(() => {
  process.cwd = originalCwd;
  process.exitCode = originalExitCode;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/coverage/index.js');

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE_SUMMARY = {
  total: {
    statements: { total: 100, covered: 85, skipped: 0, pct: 85 },
    branches: { total: 50, covered: 35, skipped: 0, pct: 70 },
    functions: { total: 40, covered: 32, skipped: 0, pct: 80 },
    lines: { total: 100, covered: 85, skipped: 0, pct: 85 },
  },
  '/src/index.js': {
    statements: { total: 50, covered: 45, skipped: 0, pct: 90 },
    branches: { total: 20, covered: 16, skipped: 0, pct: 80 },
    functions: { total: 20, covered: 18, skipped: 0, pct: 90 },
    lines: { total: 50, covered: 45, skipped: 0, pct: 90 },
  },
};

const FIXTURE_SUMMARY_FAILING = {
  total: {
    statements: { total: 100, covered: 50, skipped: 0, pct: 50 },
    branches: { total: 50, covered: 20, skipped: 0, pct: 40 },
    functions: { total: 40, covered: 20, skipped: 0, pct: 50 },
    lines: { total: 100, covered: 50, skipped: 0, pct: 50 },
  },
};

const FIXTURE_HISTORY = [
  { timestamp: '2026-04-01T10:00:00.000Z', statements: 70, branches: 55, functions: 65, lines: 70 },
  { timestamp: '2026-04-02T10:00:00.000Z', statements: 72, branches: 58, functions: 68, lines: 72 },
  { timestamp: '2026-04-03T10:00:00.000Z', statements: 72, branches: 58, functions: 68, lines: 72 },
  { timestamp: '2026-04-04T10:00:00.000Z', statements: 75, branches: 60, functions: 70, lines: 75 },
  { timestamp: '2026-04-05T10:00:00.000Z', statements: 74, branches: 61, functions: 70, lines: 74 },
];

/**
 * Helper: write coverage-summary.json fixture to tmp dir.
 */
function writeSummaryFixture(data) {
  const dir = path.join(tmpDir, 'coverage');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'coverage-summary.json'), JSON.stringify(data), 'utf8');
}

/**
 * Helper: write coverage history fixture to tmp dir.
 */
function writeHistoryFixture(entries) {
  const dir = path.join(tmpDir, '.aiox');
  fs.mkdirSync(dir, { recursive: true });
  const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'coverage-history.jsonl'), lines, 'utf8');
}

// ── getProjectRoot ───────────────────────────────────────────────────────────

describe('getProjectRoot', () => {
  test('returns cwd', () => {
    expect(mod.getProjectRoot()).toBe(tmpDir);
  });
});

// ── readCoverageSummary ──────────────────────────────────────────────────────

describe('readCoverageSummary', () => {
  test('returns null when file does not exist', () => {
    expect(mod.readCoverageSummary()).toBeNull();
  });

  test('returns parsed data when file exists', () => {
    writeSummaryFixture(FIXTURE_SUMMARY);
    const result = mod.readCoverageSummary();
    expect(result).toBeDefined();
    expect(result.total.statements.pct).toBe(85);
  });

  test('returns null on invalid JSON', () => {
    const dir = path.join(tmpDir, 'coverage');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'coverage-summary.json'), 'not json', 'utf8');
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = mod.readCoverageSummary();
    expect(result).toBeNull();
    spy.mockRestore();
  });
});

// ── extractModuleCoverage ────────────────────────────────────────────────────

describe('extractModuleCoverage', () => {
  test('extracts total and per-file coverage', () => {
    const modules = mod.extractModuleCoverage(FIXTURE_SUMMARY);
    expect(modules.length).toBe(2);
    const total = modules.find(m => m.module === 'Total');
    expect(total).toBeDefined();
    expect(total.statements).toBe(85);
  });
});

// ── formatPct ────────────────────────────────────────────────────────────────

describe('formatPct', () => {
  test('formats number as percentage', () => {
    expect(mod.formatPct(85).trim()).toBe('85.0%');
  });

  test('returns N/A for non-number', () => {
    expect(mod.formatPct(undefined).trim()).toBe('N/A');
    expect(mod.formatPct(NaN).trim()).toBe('N/A');
  });
});

// ── deltaArrow ───────────────────────────────────────────────────────────────

describe('deltaArrow', () => {
  test('returns up arrow for increase', () => {
    expect(mod.deltaArrow(80, 70)).toBe('↑');
  });

  test('returns down arrow for decrease', () => {
    expect(mod.deltaArrow(70, 80)).toBe('↓');
  });

  test('returns right arrow for no change', () => {
    expect(mod.deltaArrow(70, 70)).toBe('→');
  });

  test('returns space for non-number input', () => {
    expect(mod.deltaArrow(70, undefined)).toBe(' ');
  });
});

// ── showSummary ──────────────────────────────────────────────────────────────

describe('showSummary', () => {
  test('prints no-data message when coverage file missing', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showSummary();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage data found');
    spy.mockRestore();
  });

  test('prints coverage table and writes report', () => {
    writeSummaryFixture(FIXTURE_SUMMARY);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showSummary();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Coverage Summary');
    expect(output).toContain('85.0%');
    expect(output).toContain('Report written to');
    spy.mockRestore();

    // Verify report was written
    const reportFile = path.join(tmpDir, '.aiox', 'coverage-report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    expect(report.modules).toBeDefined();
    expect(report.modules.length).toBe(2);

    // Verify history was appended
    const historyFile = path.join(tmpDir, '.aiox', 'coverage-history.jsonl');
    expect(fs.existsSync(historyFile)).toBe(true);
  });
});

// ── checkThresholds ──────────────────────────────────────────────────────────

describe('checkThresholds', () => {
  test('prints no-data message and sets exit code when no coverage', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.checkThresholds();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage data found');
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
  });

  test('passes when all thresholds are met', () => {
    writeSummaryFixture(FIXTURE_SUMMARY);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.checkThresholds();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('All thresholds met');
    expect(output).toContain('PASS');
    expect(process.exitCode).toBeUndefined();
    spy.mockRestore();
  });

  test('fails when thresholds are not met', () => {
    writeSummaryFixture(FIXTURE_SUMMARY_FAILING);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.checkThresholds();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Coverage below thresholds');
    expect(output).toContain('FAIL');
    expect(process.exitCode).toBe(1);
    spy.mockRestore();
  });
});

// ── showTrend ────────────────────────────────────────────────────────────────

describe('showTrend', () => {
  test('prints no-history message when no data', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showTrend();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage history found');
    spy.mockRestore();
  });

  test('displays trend table with delta arrows', () => {
    writeHistoryFixture(FIXTURE_HISTORY);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showTrend();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Coverage Trend');
    expect(output).toContain('2026-04-01');
    expect(output).toContain('↑');
    expect(output).toContain('→');
    spy.mockRestore();
  });

  test('shows only last 5 entries', () => {
    const longHistory = [];
    for (let i = 0; i < 10; i++) {
      longHistory.push({
        timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
        statements: 70 + i,
        branches: 55 + i,
        functions: 65 + i,
        lines: 70 + i,
      });
    }
    writeHistoryFixture(longHistory);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showTrend();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    // Should NOT contain first entries
    expect(output).not.toContain('2026-04-01');
    // Should contain last entries
    expect(output).toContain('2026-04-10');
    spy.mockRestore();
  });
});

// ── showHelp ─────────────────────────────────────────────────────────────────

describe('showHelp', () => {
  test('outputs usage information', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.showHelp();
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage: aiox coverage');
    expect(output).toContain('--check');
    expect(output).toContain('--trend');
    expect(output).toContain('--help');
    spy.mockRestore();
  });
});

// ── runCoverage (integration) ────────────────────────────────────────────────

describe('runCoverage', () => {
  test('routes --help to showHelp', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runCoverage(['--help']);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage: aiox coverage');
    spy.mockRestore();
  });

  test('routes -h to showHelp', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runCoverage(['-h']);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage: aiox coverage');
    spy.mockRestore();
  });

  test('routes --trend to showTrend', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runCoverage(['--trend']);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage history found');
    spy.mockRestore();
  });

  test('routes --check to checkThresholds', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runCoverage(['--check']);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage data found');
    spy.mockRestore();
  });

  test('defaults to showSummary with no args', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runCoverage([]);
    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No coverage data found');
    spy.mockRestore();
  });
});

// ── readHistory ──────────────────────────────────────────────────────────────

describe('readHistory', () => {
  test('returns empty array when no file', () => {
    expect(mod.readHistory()).toEqual([]);
  });

  test('returns empty array for empty file', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'coverage-history.jsonl'), '', 'utf8');
    expect(mod.readHistory()).toEqual([]);
  });

  test('parses valid JSONL entries', () => {
    writeHistoryFixture(FIXTURE_HISTORY);
    const result = mod.readHistory();
    expect(result.length).toBe(5);
    expect(result[0].statements).toBe(70);
  });
});

// ── appendHistory ────────────────────────────────────────────────────────────

describe('appendHistory', () => {
  test('creates history file and appends entry', () => {
    const totals = {
      statements: { pct: 80 },
      branches: { pct: 65 },
      functions: { pct: 75 },
      lines: { pct: 80 },
    };
    mod.appendHistory(totals);
    const historyFile = path.join(tmpDir, '.aiox', 'coverage-history.jsonl');
    expect(fs.existsSync(historyFile)).toBe(true);
    const entries = fs.readFileSync(historyFile, 'utf8').trim().split('\n');
    expect(entries.length).toBe(1);
    const parsed = JSON.parse(entries[0]);
    expect(parsed.statements).toBe(80);
    expect(parsed.timestamp).toBeDefined();
  });
});

// ── writeReport ──────────────────────────────────────────────────────────────

describe('writeReport', () => {
  test('writes report JSON file', () => {
    const modules = [{ module: 'Total', statements: 80, branches: 65, functions: 75, lines: 80 }];
    mod.writeReport(modules);
    const reportFile = path.join(tmpDir, '.aiox', 'coverage-report.json');
    expect(fs.existsSync(reportFile)).toBe(true);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    expect(report.generated).toBeDefined();
    expect(report.modules).toEqual(modules);
  });
});
