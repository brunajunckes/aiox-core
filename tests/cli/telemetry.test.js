/**
 * Tests for Telemetry Command Module
 *
 * @module tests/cli/telemetry
 * @story 4.1 - Opt-in Usage Metrics Collection
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-telemetry-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/telemetry/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getTelemetryFile', () => {
  test('returns telemetry.json inside .aiox', () => {
    expect(mod.getTelemetryFile()).toBe(path.join(tmpDir, '.aiox', 'telemetry.json'));
  });
});

describe('getMetricsDir', () => {
  test('returns metrics dir inside .aiox', () => {
    expect(mod.getMetricsDir()).toBe(path.join(tmpDir, '.aiox', 'metrics'));
  });
});

// ── readTelemetryState ──────────────────────────────────────────────────────────

describe('readTelemetryState', () => {
  test('returns { enabled: false } when file does not exist', () => {
    const state = mod.readTelemetryState();
    expect(state).toEqual({ enabled: false });
  });

  test('returns { enabled: false } when file is corrupt JSON', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'telemetry.json'), 'NOT-JSON{{{', 'utf8');
    const state = mod.readTelemetryState();
    expect(state).toEqual({ enabled: false });
  });

  test('returns { enabled: false } when JSON has no enabled field', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'telemetry.json'), JSON.stringify({ foo: 'bar' }), 'utf8');
    const state = mod.readTelemetryState();
    expect(state).toEqual({ enabled: false });
  });

  test('returns { enabled: false } when enabled is a string instead of boolean', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'telemetry.json'), JSON.stringify({ enabled: 'true' }), 'utf8');
    const state = mod.readTelemetryState();
    expect(state).toEqual({ enabled: false });
  });

  test('returns full state when file is valid and enabled', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    const data = { enabled: true, enabledAt: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(path.join(dir, 'telemetry.json'), JSON.stringify(data), 'utf8');
    const state = mod.readTelemetryState();
    expect(state).toEqual(data);
  });

  test('returns full state when file is valid and disabled', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    const data = { enabled: false, disabledAt: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(path.join(dir, 'telemetry.json'), JSON.stringify(data), 'utf8');
    const state = mod.readTelemetryState();
    expect(state).toEqual(data);
  });
});

// ── writeTelemetryState ─────────────────────────────────────────────────────────

describe('writeTelemetryState', () => {
  test('creates .aiox directory if it does not exist', () => {
    mod.writeTelemetryState({ enabled: true });
    expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
  });

  test('writes valid JSON to telemetry.json', () => {
    const data = { enabled: true, enabledAt: '2026-04-08T00:00:00.000Z' };
    mod.writeTelemetryState(data);
    const raw = fs.readFileSync(path.join(tmpDir, '.aiox', 'telemetry.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(data);
  });

  test('atomic write leaves no temp file behind', () => {
    mod.writeTelemetryState({ enabled: false });
    const files = fs.readdirSync(path.join(tmpDir, '.aiox'));
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);
  });

  test('overwrites existing state file', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.writeTelemetryState({ enabled: false, disabledAt: '2026-04-08T12:00:00.000Z' });
    const state = mod.readTelemetryState();
    expect(state.enabled).toBe(false);
    expect(state.disabledAt).toBe('2026-04-08T12:00:00.000Z');
  });
});

// ── recordMetric ────────────────────────────────────────────────────────────────

describe('recordMetric', () => {
  test('is a no-op when telemetry is disabled', () => {
    mod.recordMetric('commands', { command: 'test' });
    const metricsDir = path.join(tmpDir, '.aiox', 'metrics');
    expect(fs.existsSync(metricsDir)).toBe(false);
  });

  test('records metric when telemetry is enabled', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('commands', { command: 'install' });
    const filePath = path.join(tmpDir, '.aiox', 'metrics', 'commands.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(entries).toHaveLength(1);
    expect(entries[0].command).toBe('install');
    expect(entries[0].timestamp).toBeDefined();
  });

  test('appends to existing metric file', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('commands', { command: 'install' });
    mod.recordMetric('commands', { command: 'doctor' });
    const filePath = path.join(tmpDir, '.aiox', 'metrics', 'commands.json');
    const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(entries).toHaveLength(2);
    expect(entries[0].command).toBe('install');
    expect(entries[1].command).toBe('doctor');
  });

  test('creates metrics directory if not exists', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('sessions', { duration: 120 });
    expect(fs.existsSync(path.join(tmpDir, '.aiox', 'metrics'))).toBe(true);
  });

  test('handles corrupt existing metric file gracefully', () => {
    mod.writeTelemetryState({ enabled: true });
    const metricsDir = path.join(tmpDir, '.aiox', 'metrics');
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(path.join(metricsDir, 'commands.json'), 'BROKEN{', 'utf8');
    mod.recordMetric('commands', { command: 'test' });
    const entries = JSON.parse(fs.readFileSync(path.join(metricsDir, 'commands.json'), 'utf8'));
    expect(entries).toHaveLength(1);
  });
});

// ── readMetrics ─────────────────────────────────────────────────────────────────

describe('readMetrics', () => {
  test('returns empty object when metrics dir does not exist', () => {
    expect(mod.readMetrics()).toEqual({});
  });

  test('returns empty object when metrics dir is empty', () => {
    const metricsDir = path.join(tmpDir, '.aiox', 'metrics');
    fs.mkdirSync(metricsDir, { recursive: true });
    expect(mod.readMetrics()).toEqual({});
  });

  test('reads multiple metric files', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('commands', { command: 'install' });
    mod.recordMetric('sessions', { duration: 60 });
    const metrics = mod.readMetrics();
    expect(Object.keys(metrics)).toContain('commands');
    expect(Object.keys(metrics)).toContain('sessions');
    expect(metrics.commands).toHaveLength(1);
    expect(metrics.sessions).toHaveLength(1);
  });

  test('skips corrupt metric files silently', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('commands', { command: 'ok' });
    const metricsDir = path.join(tmpDir, '.aiox', 'metrics');
    fs.writeFileSync(path.join(metricsDir, 'bad.json'), 'NOT_VALID', 'utf8');
    const metrics = mod.readMetrics();
    expect(metrics.commands).toHaveLength(1);
    expect(metrics.bad).toBeUndefined();
  });

  test('skips non-array JSON files', () => {
    const metricsDir = path.join(tmpDir, '.aiox', 'metrics');
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(path.join(metricsDir, 'obj.json'), JSON.stringify({ notArray: true }), 'utf8');
    const metrics = mod.readMetrics();
    expect(metrics.obj).toBeUndefined();
  });
});

// ── formatMetricsSummary ────────────────────────────────────────────────────────

describe('formatMetricsSummary', () => {
  test('returns "No metrics recorded yet." for empty metrics', () => {
    expect(mod.formatMetricsSummary({})).toBe('No metrics recorded yet.');
  });

  test('formats single category correctly', () => {
    const metrics = { commands: [{ timestamp: '2026-01-01', command: 'test' }] };
    const summary = mod.formatMetricsSummary(metrics);
    expect(summary).toContain('1 total event');
    expect(summary).toContain('1 category');
    expect(summary).toContain('commands: 1 event');
  });

  test('formats multiple categories correctly', () => {
    const metrics = {
      commands: [{ timestamp: '2026-01-01' }, { timestamp: '2026-01-02' }],
      sessions: [{ timestamp: '2026-01-01' }],
    };
    const summary = mod.formatMetricsSummary(metrics);
    expect(summary).toContain('3 total events');
    expect(summary).toContain('2 categories');
    expect(summary).toContain('commands: 2 events');
    expect(summary).toContain('sessions: 1 event');
  });

  test('uses correct pluralization for single event', () => {
    const metrics = { x: [{ timestamp: '2026-01-01' }] };
    const summary = mod.formatMetricsSummary(metrics);
    expect(summary).toContain('1 total event,');
    expect(summary).toContain('1 category');
  });
});

// ── runTelemetry CLI ────────────────────────────────────────────────────────────

describe('runTelemetry', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test('"on" enables telemetry and writes state', () => {
    mod.runTelemetry(['on']);
    const state = mod.readTelemetryState();
    expect(state.enabled).toBe(true);
    expect(state.enabledAt).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Telemetry enabled'));
  });

  test('"off" disables telemetry and writes state', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.runTelemetry(['off']);
    const state = mod.readTelemetryState();
    expect(state.enabled).toBe(false);
    expect(state.disabledAt).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Telemetry disabled'));
  });

  test('"status" shows DISABLED when not enabled', () => {
    mod.runTelemetry(['status']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DISABLED'));
  });

  test('"status" shows ENABLED after turning on', () => {
    mod.writeTelemetryState({ enabled: true, enabledAt: '2026-01-01T00:00:00.000Z' });
    mod.runTelemetry(['status']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ENABLED'));
  });

  test('"export" outputs valid JSON with telemetry and metrics keys', () => {
    mod.writeTelemetryState({ enabled: true });
    mod.recordMetric('commands', { command: 'test' });
    mod.runTelemetry(['export']);
    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('telemetry');
    expect(parsed).toHaveProperty('metrics');
    expect(parsed).toHaveProperty('exportedAt');
  });

  test('"help" prints usage text', () => {
    mod.runTelemetry(['help']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('unknown subcommand shows help', () => {
    mod.runTelemetry(['bogus']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('empty argv shows help', () => {
    mod.runTelemetry([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('undefined argv shows help', () => {
    mod.runTelemetry(undefined);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });
});
