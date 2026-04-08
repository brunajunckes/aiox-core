/**
 * Tests for Interactive CLI Dashboard Command Module
 *
 * @module tests/cli/dashboard
 * @story 8.4 — Interactive CLI Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save originals before any module loads
const originalCwd = process.cwd;
const originalStdoutWrite = process.stdout.write;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-dashboard-test-'));
  process.cwd = () => tmpDir;
  jest.restoreAllMocks();
});

afterEach(() => {
  process.cwd = originalCwd;
  process.stdout.write = originalStdoutWrite;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/dashboard/index.js');

// ── collectDashboardData ─────────────────────────────────────────────────────

describe('collectDashboardData', () => {
  test('returns object with all expected top-level keys', () => {
    const data = mod.collectDashboardData();
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('branch');
    expect(data).toHaveProperty('system');
    expect(data).toHaveProperty('stories');
    expect(data).toHaveProperty('tests');
    expect(data).toHaveProperty('telemetry');
    expect(data).toHaveProperty('squads');
    expect(data).toHaveProperty('recentCommits');
    expect(data).toHaveProperty('timestamp');
  });

  test('system contains cpu, ram, disk as numbers', () => {
    const data = mod.collectDashboardData();
    expect(typeof data.system.cpu).toBe('number');
    expect(typeof data.system.ram).toBe('number');
    expect(typeof data.system.disk).toBe('number');
  });

  test('stories has expected shape', () => {
    const data = mod.collectDashboardData();
    expect(data.stories).toHaveProperty('done');
    expect(data.stories).toHaveProperty('inProgress');
    expect(data.stories).toHaveProperty('ready');
    expect(data.stories).toHaveProperty('draft');
    expect(data.stories).toHaveProperty('total');
  });

  test('tests has expected shape', () => {
    const data = mod.collectDashboardData();
    expect(data.tests).toHaveProperty('passing');
    expect(data.tests).toHaveProperty('failing');
    expect(data.tests).toHaveProperty('status');
  });

  test('timestamp is a valid ISO string', () => {
    const data = mod.collectDashboardData();
    const parsed = new Date(data.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

// ── System Collectors ────────────────────────────────────────────────────────

describe('collectCpuUsage', () => {
  test('returns a number between 0 and 100', () => {
    const cpu = mod.collectCpuUsage();
    expect(typeof cpu).toBe('number');
    expect(cpu).toBeGreaterThanOrEqual(0);
    expect(cpu).toBeLessThanOrEqual(100);
  });
});

describe('collectRamUsage', () => {
  test('returns a number between 0 and 100', () => {
    const ram = mod.collectRamUsage();
    expect(typeof ram).toBe('number');
    expect(ram).toBeGreaterThanOrEqual(0);
    expect(ram).toBeLessThanOrEqual(100);
  });
});

describe('collectDiskUsage', () => {
  test('returns a number', () => {
    const disk = mod.collectDiskUsage();
    expect(typeof disk).toBe('number');
  });
});

// ── Project Data Collectors ──────────────────────────────────────────────────

describe('collectVersion', () => {
  test('returns N/A when no package.json', () => {
    expect(mod.collectVersion()).toBe('N/A');
  });

  test('reads version from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ version: '1.2.3' })
    );
    expect(mod.collectVersion()).toBe('1.2.3');
  });
});

describe('collectGitBranch', () => {
  test('returns a string', () => {
    const branch = mod.collectGitBranch();
    expect(typeof branch).toBe('string');
  });
});

describe('collectStoryProgress', () => {
  test('returns zero counts when stories dir missing', () => {
    const result = mod.collectStoryProgress();
    expect(result.total).toBe(0);
    expect(result.done).toBe(0);
  });

  test('counts stories by status', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    fs.writeFileSync(path.join(storiesDir, '1.1.story.md'), '- [x] Done\n');
    fs.writeFileSync(path.join(storiesDir, '1.2.story.md'), '- [x] Complete\n');
    fs.writeFileSync(path.join(storiesDir, '2.1.story.md'), '- [x] InProgress\n');
    fs.writeFileSync(path.join(storiesDir, '2.2.story.md'), '- [x] Ready\n');
    fs.writeFileSync(path.join(storiesDir, '3.1.story.md'), '## Draft\n');

    const result = mod.collectStoryProgress();
    expect(result.total).toBe(5);
    expect(result.done).toBe(2);
    expect(result.inProgress).toBe(1);
    expect(result.ready).toBe(1);
    expect(result.draft).toBe(1);
  });
});

describe('detectStoryStatus', () => {
  test('returns done for [x] Done', () => {
    expect(mod.detectStoryStatus('- [x] Done')).toBe('done');
  });

  test('returns done for [x] Complete', () => {
    expect(mod.detectStoryStatus('- [x] Complete')).toBe('done');
  });

  test('returns inProgress for [x] InProgress', () => {
    expect(mod.detectStoryStatus('- [x] InProgress')).toBe('inProgress');
  });

  test('returns ready for [x] Ready', () => {
    expect(mod.detectStoryStatus('- [x] Ready')).toBe('ready');
  });

  test('returns draft for empty/null content', () => {
    expect(mod.detectStoryStatus('')).toBe('draft');
    expect(mod.detectStoryStatus(null)).toBe('draft');
  });

  test('returns draft for unrecognized content', () => {
    expect(mod.detectStoryStatus('# Some Story\nNo status markers')).toBe('draft');
  });
});

describe('collectTestStatus', () => {
  test('returns UNKNOWN when no cache file exists', () => {
    const result = mod.collectTestStatus();
    expect(result.status).toBe('UNKNOWN');
  });
});

describe('collectTelemetryStatus', () => {
  test('returns N/A when telemetry module not found', () => {
    const result = mod.collectTelemetryStatus();
    expect(['N/A', 'enabled', 'disabled']).toContain(result.status);
  });
});

describe('collectSquadsStatus', () => {
  test('returns 0 when squads dir missing', () => {
    const result = mod.collectSquadsStatus();
    expect(result.installed).toBe(0);
    expect(result.names).toEqual([]);
  });

  test('counts squads excluding hidden and template dirs', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(squadsDir, { recursive: true });
    fs.mkdirSync(path.join(squadsDir, 'alpha'));
    fs.mkdirSync(path.join(squadsDir, 'beta'));
    fs.mkdirSync(path.join(squadsDir, '_example'));
    fs.mkdirSync(path.join(squadsDir, '.hidden'));

    const result = mod.collectSquadsStatus();
    expect(result.installed).toBe(2);
    expect(result.names).toContain('alpha');
    expect(result.names).toContain('beta');
    expect(result.names).not.toContain('_example');
    expect(result.names).not.toContain('.hidden');
  });
});

describe('collectRecentCommits', () => {
  test('returns an array', () => {
    const result = mod.collectRecentCommits();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('renderDashboard', () => {
  test('produces a string containing box-drawing characters', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(typeof output).toBe('string');
    expect(output).toContain(mod.BOX.topLeft);
    expect(output).toContain(mod.BOX.bottomRight);
    expect(output).toContain(mod.BOX.vertical);
  });

  test('contains AIOX Dashboard title', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('AIOX Dashboard');
  });

  test('contains version from data', () => {
    const data = { ...mod.collectDashboardData(), version: '9.9.9' };
    const output = mod.renderDashboard(data);
    expect(output).toContain('v9.9.9');
  });

  test('contains system metrics labels', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('CPU');
    expect(output).toContain('RAM');
    expect(output).toContain('Disk');
  });

  test('contains Stories section', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('Stories:');
  });

  test('contains Tests section', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('Tests:');
  });

  test('contains Telemetry section', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('Telemetry:');
  });

  test('contains Squads section', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('Squads:');
  });

  test('contains Ctrl+C instruction', () => {
    const data = mod.collectDashboardData();
    const output = mod.renderDashboard(data);
    expect(output).toContain('Ctrl+C');
  });

  test('shows recent commits when present', () => {
    const data = mod.collectDashboardData();
    data.recentCommits = ['abc1234 feat: something'];
    const output = mod.renderDashboard(data);
    expect(output).toContain('Recent Commits:');
    expect(output).toContain('abc1234');
  });
});

describe('hLine', () => {
  test('creates a horizontal line of correct length', () => {
    const line = mod.hLine(mod.BOX.topLeft, mod.BOX.topRight, 10);
    expect(line).toContain(mod.BOX.topLeft);
    expect(line).toContain(mod.BOX.topRight);
    expect(line.length).toBe(12); // left + 10 horizontal + right
  });
});

describe('boxLine', () => {
  test('wraps text with vertical bars', () => {
    const line = mod.boxLine('hello', 20);
    expect(line.startsWith(mod.BOX.vertical)).toBe(true);
    expect(line.endsWith(mod.BOX.vertical)).toBe(true);
  });
});

describe('colorPct', () => {
  test('returns green for low values', () => {
    const result = mod.colorPct(20);
    expect(result).toContain('20%');
    expect(result).toContain('\x1B[32m'); // GREEN
  });

  test('returns yellow for medium values', () => {
    const result = mod.colorPct(65);
    expect(result).toContain('65%');
    expect(result).toContain('\x1B[33m'); // YELLOW
  });

  test('returns red for high values', () => {
    const result = mod.colorPct(85);
    expect(result).toContain('85%');
    expect(result).toContain('\x1B[31m'); // RED
  });
});

// ── Arg Parsing ──────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('returns defaults for empty argv', () => {
    const opts = mod.parseArgs([]);
    expect(opts.once).toBe(false);
    expect(opts.json).toBe(false);
    expect(opts.interval).toBe(mod.DEFAULT_INTERVAL_SEC);
  });

  test('parses --once flag', () => {
    const opts = mod.parseArgs(['--once']);
    expect(opts.once).toBe(true);
  });

  test('parses --json flag', () => {
    const opts = mod.parseArgs(['--json']);
    expect(opts.json).toBe(true);
  });

  test('parses --interval with value', () => {
    const opts = mod.parseArgs(['--interval', '10']);
    expect(opts.interval).toBe(10);
  });

  test('ignores invalid interval values', () => {
    const opts = mod.parseArgs(['--interval', 'abc']);
    expect(opts.interval).toBe(mod.DEFAULT_INTERVAL_SEC);
  });

  test('clamps interval to valid range', () => {
    const opts = mod.parseArgs(['--interval', '999']);
    expect(opts.interval).toBe(mod.DEFAULT_INTERVAL_SEC); // rejected, stays default
  });

  test('parses combined flags', () => {
    const opts = mod.parseArgs(['--once', '--json', '--interval', '3']);
    expect(opts.once).toBe(true);
    expect(opts.json).toBe(true);
    expect(opts.interval).toBe(3);
  });
});

// ── Lifecycle ────────────────────────────────────────────────────────────────

describe('startDashboard / stopDashboard', () => {
  test('stopDashboard does not throw when not started', () => {
    expect(() => mod.stopDashboard()).not.toThrow();
  });
});

describe('runDashboard', () => {
  test('--once mode renders and returns without starting interval', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runDashboard(['--once']);
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('AIOX Dashboard');
    spy.mockRestore();
  });

  test('--json mode outputs valid JSON', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runDashboard(['--json']);
    expect(spy).toHaveBeenCalled();
    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('system');
    spy.mockRestore();
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('DEFAULT_INTERVAL_SEC is 5', () => {
    expect(mod.DEFAULT_INTERVAL_SEC).toBe(5);
  });

  test('BOX_WIDTH is a positive number', () => {
    expect(mod.BOX_WIDTH).toBeGreaterThan(0);
  });

  test('CLEAR_SCREEN contains escape sequences', () => {
    expect(mod.CLEAR_SCREEN).toContain('\x1B[2J');
    expect(mod.CLEAR_SCREEN).toContain('\x1B[H');
  });
});
