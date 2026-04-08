/**
 * Tests for Health Dashboard Command Module
 *
 * @module tests/cli/health
 * @story 5.3 — Project Health Dashboard CLI
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-health-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/health/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────────

describe('getProjectRoot', () => {
  test('returns cwd', () => {
    expect(mod.getProjectRoot()).toBe(tmpDir);
  });
});

describe('getStoriesDir', () => {
  test('returns docs/stories inside cwd', () => {
    expect(mod.getStoriesDir()).toBe(path.join(tmpDir, 'docs', 'stories'));
  });
});

describe('getSquadsDir', () => {
  test('returns squads inside cwd', () => {
    expect(mod.getSquadsDir()).toBe(path.join(tmpDir, 'squads'));
  });
});

// ── parseTestOutput ─────────────────────────────────────────────────────────────

describe('parseTestOutput', () => {
  test('parses Jest summary line with passing and failing', () => {
    const output = 'Tests:       10 failed, 7885 passed, 7895 total';
    const result = mod.parseTestOutput(output);
    expect(result.passing).toBe(7885);
    expect(result.failing).toBe(10);
    expect(result.status).toBe('FAILING');
  });

  test('parses Jest summary line with only passing', () => {
    const output = 'Tests:       500 passed, 500 total';
    const result = mod.parseTestOutput(output);
    expect(result.passing).toBe(500);
    expect(result.failing).toBe(0);
    expect(result.status).toBe('PASSING');
  });

  test('parses PASS/FAIL prefix lines as fallback', () => {
    const output = [
      'PASS src/a.test.js',
      'PASS src/b.test.js',
      'FAIL src/c.test.js',
    ].join('\n');
    const result = mod.parseTestOutput(output);
    expect(result.passing).toBe(2);
    expect(result.failing).toBe(1);
    expect(result.status).toBe('FAILING');
  });

  test('returns UNKNOWN for null input', () => {
    const result = mod.parseTestOutput(null);
    expect(result.status).toBe('UNKNOWN');
  });

  test('returns UNKNOWN for empty string', () => {
    const result = mod.parseTestOutput('');
    expect(result.status).toBe('UNKNOWN');
  });

  test('returns UNKNOWN for non-string input', () => {
    const result = mod.parseTestOutput(42);
    expect(result.status).toBe('UNKNOWN');
  });

  test('returns UNKNOWN for unrecognizable output', () => {
    const result = mod.parseTestOutput('some random text');
    expect(result.status).toBe('UNKNOWN');
  });
});

// ── detectStoryStatus ───────────────────────────────────────────────────────────

describe('detectStoryStatus', () => {
  test('detects done from checkbox', () => {
    const content = '## Status\n- [x] Done\n- [ ] InProgress';
    expect(mod.detectStoryStatus(content)).toBe('done');
  });

  test('detects done from Complete checkbox', () => {
    const content = '## Status\n- [x] Complete\n';
    expect(mod.detectStoryStatus(content)).toBe('done');
  });

  test('detects done from status section text', () => {
    const content = '## Status\n**Status:** Phase 1 COMPLETE\n## Next';
    expect(mod.detectStoryStatus(content)).toBe('done');
  });

  test('detects done from ready for merge', () => {
    const content = '## Status\n**Status:** Story 1.1 is READY FOR MERGE\n## Next';
    expect(mod.detectStoryStatus(content)).toBe('done');
  });

  test('detects inProgress from checkbox', () => {
    const content = '## Status\n- [ ] Done\n- [x] InProgress';
    expect(mod.detectStoryStatus(content)).toBe('inProgress');
  });

  test('detects inProgress from plain text', () => {
    const content = '## Status\nInProgress\n\n## Details';
    expect(mod.detectStoryStatus(content)).toBe('inProgress');
  });

  test('detects ready from unchecked checkboxes with Ready checked', () => {
    const content = '## Status\n- [x] Ready\n- [ ] InProgress\n- [ ] Done';
    // Ready is checked but not InProgress or Done
    // This content also doesn't have Complete/Done in status section
    expect(mod.detectStoryStatus(content)).toBe('ready');
  });

  test('returns draft for empty content', () => {
    expect(mod.detectStoryStatus('')).toBe('draft');
  });

  test('returns draft for null content', () => {
    expect(mod.detectStoryStatus(null)).toBe('draft');
  });

  test('returns draft for content with no status section', () => {
    const content = '# Story\nSome description\n';
    expect(mod.detectStoryStatus(content)).toBe('draft');
  });
});

// ── extractStatusSection ────────────────────────────────────────────────────────

describe('extractStatusSection', () => {
  test('extracts status section content', () => {
    const content = '## Status\nInProgress\n## Details\nSomething';
    const section = mod.extractStatusSection(content);
    expect(section).toContain('InProgress');
  });

  test('returns null when no status section', () => {
    const content = '# Title\nSome text';
    expect(mod.extractStatusSection(content)).toBeNull();
  });

  test('extracts until next heading', () => {
    const content = '## Status\nLine 1\nLine 2\n## Other\nLine 3';
    const section = mod.extractStatusSection(content);
    expect(section).toContain('Line 1');
    expect(section).toContain('Line 2');
    expect(section).not.toContain('Line 3');
  });
});

// ── collectStoryProgress ────────────────────────────────────────────────────────

describe('collectStoryProgress', () => {
  test('returns zeros when stories dir does not exist', () => {
    const result = mod.collectStoryProgress();
    expect(result).toEqual({ done: 0, inProgress: 0, ready: 0, draft: 0, total: 0 });
  });

  test('counts story files by status', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    fs.writeFileSync(path.join(storiesDir, '1.1.story.md'),
      '## Status\n- [x] Done\n');
    fs.writeFileSync(path.join(storiesDir, '1.2.story.md'),
      '## Status\n- [x] InProgress\n');
    fs.writeFileSync(path.join(storiesDir, '1.3.story.md'),
      '## Status\nDraft\n');
    fs.writeFileSync(path.join(storiesDir, '1.4.story.md'),
      '## Status\n- [x] Complete\n');

    const result = mod.collectStoryProgress();
    expect(result.total).toBe(4);
    expect(result.done).toBe(2);
    expect(result.inProgress).toBe(1);
    expect(result.draft).toBe(1);
  });

  test('ignores non-story files', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    fs.writeFileSync(path.join(storiesDir, '1.1.story.md'), '## Status\n- [x] Done\n');
    fs.writeFileSync(path.join(storiesDir, 'readme.md'), '# Readme');
    fs.writeFileSync(path.join(storiesDir, 'notes.txt'), 'notes');

    const result = mod.collectStoryProgress();
    expect(result.total).toBe(1);
  });

  test('handles empty stories directory', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    const result = mod.collectStoryProgress();
    expect(result.total).toBe(0);
  });
});

// ── collectSquadsStatus ─────────────────────────────────────────────────────────

describe('collectSquadsStatus', () => {
  test('returns zero when squads dir does not exist', () => {
    const result = mod.collectSquadsStatus();
    expect(result).toEqual({ installed: 0, names: [] });
  });

  test('counts installed squads', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(squadsDir, { recursive: true });
    fs.mkdirSync(path.join(squadsDir, 'alpha'));
    fs.mkdirSync(path.join(squadsDir, 'beta'));

    const result = mod.collectSquadsStatus();
    expect(result.installed).toBe(2);
    expect(result.names).toContain('alpha');
    expect(result.names).toContain('beta');
  });

  test('excludes _example and hidden dirs', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(squadsDir, { recursive: true });
    fs.mkdirSync(path.join(squadsDir, '_example'));
    fs.mkdirSync(path.join(squadsDir, '.hidden'));
    fs.mkdirSync(path.join(squadsDir, 'real-squad'));

    const result = mod.collectSquadsStatus();
    expect(result.installed).toBe(1);
    expect(result.names).toEqual(['real-squad']);
  });

  test('excludes files (only counts directories)', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(squadsDir, { recursive: true });
    fs.writeFileSync(path.join(squadsDir, 'readme.md'), 'readme');
    fs.mkdirSync(path.join(squadsDir, 'my-squad'));

    const result = mod.collectSquadsStatus();
    expect(result.installed).toBe(1);
  });
});

// ── collectTelemetryStatus ──────────────────────────────────────────────────────

describe('collectTelemetryStatus', () => {
  test('returns N/A when telemetry module not found', () => {
    // tmpDir has no telemetry module
    const result = mod.collectTelemetryStatus();
    expect(result.status).toBe('N/A');
  });
});

// ── collectVersion ──────────────────────────────────────────────────────────────

describe('collectVersion', () => {
  test('reads version from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.2.3' })
    );
    const result = mod.collectVersion();
    expect(result).toBe('1.2.3');
  });

  test('returns N/A when package.json missing', () => {
    const result = mod.collectVersion();
    expect(result).toBe('N/A');
  });

  test('returns N/A when package.json has no version', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test' })
    );
    const result = mod.collectVersion();
    expect(result).toBe('N/A');
  });
});

// ── determineOverallStatus ──────────────────────────────────────────────────────

describe('determineOverallStatus', () => {
  test('returns UNKNOWN when tests are unknown', () => {
    const result = mod.determineOverallStatus({
      tests: { status: 'UNKNOWN' },
      stories: { total: 5 },
    });
    expect(result).toBe('UNKNOWN');
  });

  test('returns DEGRADED when failing > 10% of passing', () => {
    const result = mod.determineOverallStatus({
      tests: { status: 'FAILING', failing: 20, passing: 100 },
      stories: { total: 5 },
    });
    expect(result).toBe('DEGRADED');
  });

  test('returns HEALTHY with failures when failing <= 10%', () => {
    const result = mod.determineOverallStatus({
      tests: { status: 'FAILING', failing: 5, passing: 100 },
      stories: { total: 5 },
    });
    expect(result).toBe('HEALTHY (with failures)');
  });

  test('returns HEALTHY when all tests pass', () => {
    const result = mod.determineOverallStatus({
      tests: { status: 'PASSING', failing: 0, passing: 100 },
      stories: { total: 5 },
    });
    expect(result).toBe('HEALTHY');
  });

  test('returns HEALTHY when no stories', () => {
    const result = mod.determineOverallStatus({
      tests: { status: 'PASSING', failing: 0, passing: 50 },
      stories: { total: 0 },
    });
    expect(result).toBe('HEALTHY');
  });
});

// ── formatTestsLine ─────────────────────────────────────────────────────────────

describe('formatTestsLine', () => {
  test('formats passing and failing', () => {
    const line = mod.formatTestsLine({ passing: 100, failing: 5, status: 'FAILING' });
    expect(line).toBe('100 passing, 5 failing');
  });

  test('formats only passing', () => {
    const line = mod.formatTestsLine({ passing: 100, failing: 0, status: 'PASSING' });
    expect(line).toBe('100 passing');
  });

  test('returns UNKNOWN for unknown status', () => {
    expect(mod.formatTestsLine({ status: 'UNKNOWN' })).toBe('UNKNOWN');
  });

  test('returns SKIPPED for skipped', () => {
    expect(mod.formatTestsLine({ status: 'SKIPPED' })).toBe('SKIPPED');
  });

  test('returns UNKNOWN for null', () => {
    expect(mod.formatTestsLine(null)).toBe('UNKNOWN');
  });

  test('returns no tests found when zero counts', () => {
    expect(mod.formatTestsLine({ passing: 0, failing: 0, status: 'PASSING' })).toBe('no tests found');
  });
});

// ── formatStoriesLine ───────────────────────────────────────────────────────────

describe('formatStoriesLine', () => {
  test('formats full story breakdown', () => {
    const line = mod.formatStoriesLine({ done: 10, inProgress: 3, ready: 2, draft: 5, total: 20 });
    expect(line).toBe('10 done, 3 in progress, 2 ready, 5 draft (20 total)');
  });

  test('formats partial data', () => {
    const line = mod.formatStoriesLine({ done: 5, inProgress: 0, ready: 0, draft: 0, total: 5 });
    expect(line).toBe('5 done (5 total)');
  });

  test('returns no stories found for zero total', () => {
    expect(mod.formatStoriesLine({ done: 0, inProgress: 0, ready: 0, draft: 0, total: 0 })).toBe('no stories found');
  });

  test('returns no stories found for null', () => {
    expect(mod.formatStoriesLine(null)).toBe('no stories found');
  });
});

// ── formatHealthReport ──────────────────────────────────────────────────────────

describe('formatHealthReport', () => {
  test('renders full report', () => {
    const data = {
      tests: { passing: 100, failing: 2, status: 'FAILING' },
      stories: { done: 10, inProgress: 3, ready: 2, draft: 5, total: 20 },
      telemetry: { enabled: true, status: 'enabled' },
      squads: { installed: 2, names: ['a', 'b'] },
      branch: 'main',
      version: '5.0.3',
      overall: 'HEALTHY (with failures)',
    };
    const report = mod.formatHealthReport(data);

    expect(report).toContain('AIOX Project Health Report');
    expect(report).toContain('100 passing, 2 failing');
    expect(report).toContain('10 done, 3 in progress');
    expect(report).toContain('enabled');
    expect(report).toContain('2 installed');
    expect(report).toContain('main');
    expect(report).toContain('5.0.3');
    expect(report).toContain('HEALTHY (with failures)');
  });

  test('renders report with N/A values', () => {
    const data = {
      tests: { status: 'UNKNOWN' },
      stories: { done: 0, inProgress: 0, ready: 0, draft: 0, total: 0 },
      telemetry: null,
      squads: null,
      branch: 'N/A',
      version: 'N/A',
      overall: 'UNKNOWN',
    };
    const report = mod.formatHealthReport(data);

    expect(report).toContain('UNKNOWN');
    expect(report).toContain('N/A');
    expect(report).toContain('no stories found');
  });

  test('renders separator lines', () => {
    const data = {
      tests: { passing: 10, failing: 0, status: 'PASSING' },
      stories: { done: 1, inProgress: 0, ready: 0, draft: 0, total: 1 },
      telemetry: { status: 'disabled' },
      squads: { installed: 0, names: [] },
      branch: 'feat/test',
      version: '1.0.0',
      overall: 'HEALTHY',
    };
    const report = mod.formatHealthReport(data);
    const sepChar = '\u2500';
    expect(report).toContain(sepChar.repeat(36));
  });
});

// ── runHealth ───────────────────────────────────────────────────────────────────

describe('runHealth', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('outputs text report by default (with --skip-tests)', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    );

    mod.runHealth(['--skip-tests']);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('AIOX Project Health Report');
  });

  test('outputs JSON when --json flag provided', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '2.0.0' })
    );

    mod.runHealth(['--json', '--skip-tests']);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('tests');
    expect(parsed).toHaveProperty('stories');
    expect(parsed).toHaveProperty('telemetry');
    expect(parsed).toHaveProperty('squads');
    expect(parsed).toHaveProperty('branch');
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('overall');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed.version).toBe('2.0.0');
  });

  test('handles null argv', () => {
    mod.runHealth(null);
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('handles empty argv', () => {
    mod.runHealth([]);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ── collectAll ──────────────────────────────────────────────────────────────────

describe('collectAll', () => {
  test('returns all health sections with skipTests', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '3.0.0' })
    );

    const data = mod.collectAll({ skipTests: true });
    expect(data.tests.status).toBe('SKIPPED');
    expect(data.stories).toBeDefined();
    expect(data.telemetry).toBeDefined();
    expect(data.squads).toBeDefined();
    expect(data.branch).toBeDefined();
    expect(data.version).toBe('3.0.0');
    expect(data.overall).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  test('includes timestamp in ISO format', () => {
    const data = mod.collectAll({ skipTests: true });
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
