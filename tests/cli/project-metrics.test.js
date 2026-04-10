/**
 * Tests for Project Metrics Command Module
 *
 * @module tests/cli/project-metrics
 * @story 34.1 - Opt-in Metrics Collection
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-project-metrics-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/project-metrics/index.js');

// ── Path Helpers ──────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getMetricsDir', () => {
  test('returns metrics dir inside .aiox', () => {
    expect(mod.getMetricsDir()).toBe(path.join(tmpDir, '.aiox', 'metrics'));
  });
});

describe('getSnapshotsFile', () => {
  test('returns project-snapshots.jsonl path', () => {
    expect(mod.getSnapshotsFile()).toContain('project-snapshots.jsonl');
  });
});

// ── isEnabled ─────────────────────────────────────────────────────────────────

describe('isEnabled', () => {
  test('returns false when config does not exist', () => {
    expect(mod.isEnabled()).toBe(false);
  });

  test('returns false when config has no metrics section', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), '{}', 'utf8');
    expect(mod.isEnabled()).toBe(false);
  });

  test('returns true when metrics.enabled is true', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ metrics: { enabled: true } }),
      'utf8'
    );
    expect(mod.isEnabled()).toBe(true);
  });

  test('returns false when metrics.enabled is string "true"', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ metrics: { enabled: 'true' } }),
      'utf8'
    );
    expect(mod.isEnabled()).toBe(false);
  });

  test('returns false on corrupt JSON', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), 'NOT_JSON', 'utf8');
    expect(mod.isEnabled()).toBe(false);
  });
});

// ── countStories ──────────────────────────────────────────────────────────────

describe('countStories', () => {
  test('returns zeros when stories dir does not exist', () => {
    expect(mod.countStories()).toEqual({ total: 0, completed: 0 });
  });

  test('counts story files', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(path.join(storiesDir, '1.1.story.md'), 'status: draft', 'utf8');
    fs.writeFileSync(path.join(storiesDir, '1.2.story.md'), 'status: done', 'utf8');
    fs.writeFileSync(path.join(storiesDir, '1.3.story.md'), 'status: Completed', 'utf8');
    fs.writeFileSync(path.join(storiesDir, 'readme.md'), 'not a story', 'utf8');

    const result = mod.countStories();
    expect(result.total).toBe(3);
    expect(result.completed).toBe(2);
  });
});

// ── countTests ────────────────────────────────────────────────────────────────

describe('countTests', () => {
  test('returns zeros when tests dir does not exist', () => {
    expect(mod.countTests()).toEqual({ count: 0, passRate: 0 });
  });

  test('counts .test.js files recursively', () => {
    const testsDir = path.join(tmpDir, 'tests');
    const subDir = path.join(testsDir, 'cli');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, 'a.test.js'), '', 'utf8');
    fs.writeFileSync(path.join(subDir, 'b.test.js'), '', 'utf8');
    fs.writeFileSync(path.join(subDir, 'c.js'), '', 'utf8');

    const result = mod.countTests();
    expect(result.count).toBe(2);
    expect(result.passRate).toBe(100);
  });
});

// ── countCommands ─────────────────────────────────────────────────────────────

describe('countCommands', () => {
  test('returns 0 when bin/aiox.js does not exist', () => {
    expect(mod.countCommands()).toBe(0);
  });

  test('counts case statements in aiox.js', () => {
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'aiox.js'),
      "case 'help':\ncase 'init':\ncase 'config':\n",
      'utf8'
    );
    expect(mod.countCommands()).toBe(3);
  });
});

// ── lintStatus / buildStatus ──────────────────────────────────────────────────

describe('lintStatus', () => {
  test('returns not-configured without package.json', () => {
    expect(mod.lintStatus()).toBe('not-configured');
  });

  test('returns configured when lint script exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { lint: 'eslint .' } }),
      'utf8'
    );
    expect(mod.lintStatus()).toBe('configured');
  });
});

describe('buildStatus', () => {
  test('returns configured when build script exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'tsc' } }),
      'utf8'
    );
    expect(mod.buildStatus()).toBe('configured');
  });
});

// ── countAgentActivations ─────────────────────────────────────────────────────

describe('countAgentActivations', () => {
  test('returns 0 when log file does not exist', () => {
    expect(mod.countAgentActivations()).toBe(0);
  });

  test('counts lines in agent-log.jsonl', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'agent-log.jsonl'),
      '{"agent":"dev"}\n{"agent":"qa"}\n{"agent":"pm"}\n',
      'utf8'
    );
    expect(mod.countAgentActivations()).toBe(3);
  });
});

// ── collectSnapshot ───────────────────────────────────────────────────────────

describe('collectSnapshot', () => {
  test('returns object with expected fields', () => {
    const snapshot = mod.collectSnapshot();
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot).toHaveProperty('commandsUsed');
    expect(snapshot).toHaveProperty('storiesTotal');
    expect(snapshot).toHaveProperty('storiesCompleted');
    expect(snapshot).toHaveProperty('testsCount');
    expect(snapshot).toHaveProperty('testPassRate');
    expect(snapshot).toHaveProperty('lintStatus');
    expect(snapshot).toHaveProperty('buildStatus');
    expect(snapshot).toHaveProperty('agentActivations');
  });
});

// ── appendSnapshot / readSnapshots ────────────────────────────────────────────

describe('appendSnapshot + readSnapshots', () => {
  test('round-trips a snapshot through JSONL', () => {
    const snapshot = { timestamp: '2026-04-09T00:00:00Z', commandsUsed: 5 };
    mod.appendSnapshot(snapshot);
    const snapshots = mod.readSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].commandsUsed).toBe(5);
  });

  test('appends multiple snapshots', () => {
    mod.appendSnapshot({ timestamp: '2026-01-01', val: 1 });
    mod.appendSnapshot({ timestamp: '2026-01-02', val: 2 });
    mod.appendSnapshot({ timestamp: '2026-01-03', val: 3 });

    const snapshots = mod.readSnapshots();
    expect(snapshots).toHaveLength(3);
  });

  test('returns empty array when file does not exist', () => {
    expect(mod.readSnapshots()).toEqual([]);
  });

  test('skips corrupt JSONL lines', () => {
    const dir = mod.getMetricsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      mod.getSnapshotsFile(),
      '{"valid":true}\nNOT_JSON\n{"also":"valid"}\n',
      'utf8'
    );
    const snapshots = mod.readSnapshots();
    expect(snapshots).toHaveLength(2);
  });
});

// ── formatDashboard ───────────────────────────────────────────────────────────

describe('formatDashboard', () => {
  test('includes all metric fields', () => {
    const snapshot = {
      timestamp: '2026-04-09T00:00:00Z',
      commandsUsed: 126,
      storiesTotal: 80,
      storiesCompleted: 75,
      testsCount: 200,
      testPassRate: 98,
      lintStatus: 'configured',
      buildStatus: 'configured',
      agentActivations: 42,
    };

    const output = mod.formatDashboard(snapshot);
    expect(output).toContain('126');
    expect(output).toContain('80');
    expect(output).toContain('75');
    expect(output).toContain('200');
    expect(output).toContain('98%');
    expect(output).toContain('configured');
    expect(output).toContain('42');
    expect(output).toContain('Dashboard');
  });
});

// ── formatHistory ─────────────────────────────────────────────────────────────

describe('formatHistory', () => {
  test('returns message when no snapshots', () => {
    const output = mod.formatHistory([]);
    expect(output).toContain('No metrics history');
  });

  test('formats history table', () => {
    const snapshots = [
      { timestamp: '2026-04-09T12:00:00Z', commandsUsed: 10, storiesCompleted: 5, storiesTotal: 10, testsCount: 50, testPassRate: 100 },
    ];
    const output = mod.formatHistory(snapshots);
    expect(output).toContain('History');
    expect(output).toContain('1 of 1');
  });

  test('limits to last 10 snapshots', () => {
    const snapshots = Array.from({ length: 15 }, (_, i) => ({
      timestamp: `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      commandsUsed: i,
      storiesCompleted: 0,
      storiesTotal: 0,
      testsCount: 0,
      testPassRate: 0,
    }));
    const output = mod.formatHistory(snapshots);
    expect(output).toContain('10 of 15');
  });
});

// ── runProjectMetrics ─────────────────────────────────────────────────────────

describe('runProjectMetrics', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('shows dashboard with no args', async () => {
    await mod.runProjectMetrics([]);
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Dashboard');
  });

  test('--collect requires metrics to be enabled', async () => {
    await mod.runProjectMetrics(['--collect']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('disabled');
  });

  test('--collect works when enabled', async () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ metrics: { enabled: true } }),
      'utf8'
    );

    await mod.runProjectMetrics(['--collect']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('collected');

    // Verify file was written
    const snapshots = mod.readSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  test('--history shows history', async () => {
    await mod.runProjectMetrics(['--history']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No metrics history');
  });

  test('--export outputs JSON', async () => {
    mod.appendSnapshot({ timestamp: '2026-04-09', val: 1 });
    await mod.runProjectMetrics(['--export']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('exportedAt');
    expect(output).toContain('"count": 1');
  });

  test('--help shows help', async () => {
    await mod.runProjectMetrics(['--help']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });
});
