/**
 * Tests for Config Diff & Migration Tool Command Module
 *
 * @module tests/cli/config-diff
 * @story 10.3 — Config Diff & Migration Tool
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-config-diff-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/config-diff/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

function writeConfig(filename, content) {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ── parseSimpleYaml ────────────────────────────────────────────────────────────

describe('parseSimpleYaml', () => {
  test('parses flat key-value pairs', () => {
    const result = mod.parseSimpleYaml('name: test\nversion: 1.0.0');
    expect(result.name).toBe('test');
    expect(result.version).toBe('1.0.0');
  });

  test('parses nested objects', () => {
    const result = mod.parseSimpleYaml('parent:\n  child: value');
    expect(result.parent.child).toBe('value');
  });

  test('parses boolean values', () => {
    const result = mod.parseSimpleYaml('enabled: true\ndisabled: false');
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
  });

  test('parses numeric values', () => {
    const result = mod.parseSimpleYaml('count: 42\nratio: 3.14');
    expect(result.count).toBe(42);
    expect(result.ratio).toBe(3.14);
  });

  test('parses null values', () => {
    const result = mod.parseSimpleYaml('empty: null');
    expect(result.empty).toBeNull();
  });

  test('skips comments and blank lines', () => {
    const result = mod.parseSimpleYaml('# comment\n\nkey: value');
    expect(result.key).toBe('value');
    expect(Object.keys(result)).toHaveLength(1);
  });

  test('handles quoted strings', () => {
    const result = mod.parseSimpleYaml("name: 'hello world'");
    expect(result.name).toBe('hello world');
  });
});

// ── flattenObject ──────────────────────────────────────────────────────────────

describe('flattenObject', () => {
  test('flattens nested object', () => {
    const flat = mod.flattenObject({ a: { b: { c: 1 } } });
    expect(flat['a.b.c']).toBe(1);
  });

  test('handles flat object', () => {
    const flat = mod.flattenObject({ x: 1, y: 2 });
    expect(flat.x).toBe(1);
    expect(flat.y).toBe(2);
  });

  test('handles empty object', () => {
    expect(mod.flattenObject({})).toEqual({});
  });
});

// ── unflattenObject ────────────────────────────────────────────────────────────

describe('unflattenObject', () => {
  test('unflattens dot-notation keys', () => {
    const nested = mod.unflattenObject({ 'a.b.c': 1 });
    expect(nested.a.b.c).toBe(1);
  });

  test('handles flat keys', () => {
    const nested = mod.unflattenObject({ x: 1 });
    expect(nested.x).toBe(1);
  });
});

// ── computeDiff ────────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  test('detects modified values', () => {
    const diffs = mod.computeDiff({ key: 'new' }, { key: 'old' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('modified');
  });

  test('detects added keys', () => {
    const diffs = mod.computeDiff({ key: 'val', extra: 'new' }, { key: 'val' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('added');
    expect(diffs[0].key).toBe('extra');
  });

  test('detects removed keys', () => {
    const diffs = mod.computeDiff({ key: 'val' }, { key: 'val', missing: 'old' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].status).toBe('removed');
  });

  test('returns empty for identical configs', () => {
    const diffs = mod.computeDiff({ a: 1 }, { a: 1 });
    expect(diffs).toHaveLength(0);
  });
});

// ── formatDiffText ─────────────────────────────────────────────────────────────

describe('formatDiffText', () => {
  test('formats modified diffs', () => {
    const diffs = [{ key: 'x', status: 'modified', current: 'new', default: 'old' }];
    const text = mod.formatDiffText(diffs);
    expect(text).toContain('~');
    expect(text).toContain('modified');
  });

  test('returns no-diff message for empty', () => {
    expect(mod.formatDiffText([])).toContain('No differences');
  });
});

// ── formatDiffJSON ─────────────────────────────────────────────────────────────

describe('formatDiffJSON', () => {
  test('generates valid JSON', () => {
    const diffs = [{ key: 'x', status: 'added', current: 1, default: undefined }];
    const parsed = JSON.parse(mod.formatDiffJSON(diffs));
    expect(parsed.total).toBe(1);
    expect(parsed.diffs).toHaveLength(1);
  });
});

// ── migrateConfig ──────────────────────────────────────────────────────────────

describe('migrateConfig', () => {
  test('migrates old keys to new', () => {
    const config = { frameworkProtection: true, enableAgents: false };
    const { migrated, changes } = mod.migrateConfig(config);
    expect(migrated['boundary.frameworkProtection']).toBe(true);
    expect(migrated['agents.enabled']).toBe(false);
    expect(migrated.frameworkProtection).toBeUndefined();
    expect(changes).toHaveLength(2);
  });

  test('returns no changes for current config', () => {
    const config = { 'boundary.frameworkProtection': true };
    const { changes } = mod.migrateConfig(config);
    expect(changes).toHaveLength(0);
  });
});

// ── serializeYaml ──────────────────────────────────────────────────────────────

describe('serializeYaml', () => {
  test('serializes flat object', () => {
    const yaml = mod.serializeYaml({ key: 'value' });
    expect(yaml).toContain('key: "value"');
  });

  test('serializes nested object', () => {
    const yaml = mod.serializeYaml({ parent: { child: 1 } });
    expect(yaml).toContain('parent:');
    expect(yaml).toContain('  child: 1');
  });
});

// ── runConfigDiff ──────────────────────────────────────────────────────────────

describe('runConfigDiff', () => {
  let consoleSpy;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('shows help with --help', () => {
    mod.runConfigDiff(['--help']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  test('shows no config message when missing', () => {
    mod.runConfigDiff([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No config file');
  });

  test('shows diff between config and builtin defaults', () => {
    writeConfig('core-config.yaml', 'debug: true\ntelemetry:\n  enabled: true');
    mod.runConfigDiff([]);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Config Differences');
  });

  test('shows JSON diff with --format json', () => {
    writeConfig('core-config.yaml', 'debug: true');
    mod.runConfigDiff(['--format', 'json']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.diffs).toBeDefined();
  });

  test('migrate dry-run shows changes without writing', () => {
    writeConfig('core-config.yaml', 'frameworkProtection: true\nenableAgents: false');
    mod.runConfigDiff(['migrate', '--dry-run']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('dry-run');
    expect(output).toContain('frameworkProtection');
  });

  test('migrate with no old keys shows up-to-date', () => {
    writeConfig('core-config.yaml', 'debug: false');
    mod.runConfigDiff(['migrate']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No migrations needed');
  });

  test('shows diff using custom defaults file', () => {
    const cfgPath = writeConfig('core-config.yaml', 'name: myproject');
    const defPath = writeConfig('core-config.defaults.yaml', 'name: default');
    mod.runConfigDiff([], { configFile: cfgPath, defaultsFile: defPath });
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('modified');
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('BUILTIN_DEFAULTS has expected keys', () => {
    expect(mod.BUILTIN_DEFAULTS.debug).toBeDefined();
    expect(mod.BUILTIN_DEFAULTS.boundary).toBeDefined();
  });

  test('MIGRATION_RULES is non-empty array', () => {
    expect(mod.MIGRATION_RULES.length).toBeGreaterThan(0);
  });
});
