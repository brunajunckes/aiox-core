/**
 * Tests for Plugin Loader & Registry Command Module
 *
 * @module tests/cli/plugins
 * @story 11.2 — Plugin Loader & Registry
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-plugins-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/plugins/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────

describe('getPluginsDir', () => {
  test('returns .aiox/plugins inside cwd', () => {
    expect(mod.getPluginsDir()).toBe(path.join(tmpDir, '.aiox', 'plugins'));
  });
});

describe('getManifestPath', () => {
  test('returns plugin.json path for given name', () => {
    expect(mod.getManifestPath('foo')).toBe(path.join(tmpDir, '.aiox', 'plugins', 'foo', 'plugin.json'));
  });
});

// ── readManifest / writeManifest ────────────────────────────────────────────

describe('readManifest', () => {
  test('returns null for non-existent plugin', () => {
    expect(mod.readManifest('nope')).toBeNull();
  });

  test('reads manifest after write', () => {
    mod.writeManifest('test-plug', { name: 'test-plug', version: '1.0.0', enabled: true });
    const manifest = mod.readManifest('test-plug');
    expect(manifest.name).toBe('test-plug');
    expect(manifest.version).toBe('1.0.0');
  });
});

describe('writeManifest', () => {
  test('creates directory and writes manifest', () => {
    mod.writeManifest('my-plugin', { name: 'my-plugin', version: '0.1.0', enabled: false });
    const manifestPath = mod.getManifestPath('my-plugin');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(content.name).toBe('my-plugin');
  });
});

// ── listPlugins ─────────────────────────────────────────────────────────────

describe('listPlugins', () => {
  test('returns empty array when plugins dir missing', () => {
    expect(mod.listPlugins()).toEqual([]);
  });

  test('returns manifests for installed plugins', () => {
    mod.writeManifest('a', { name: 'a', version: '1.0.0', enabled: true });
    mod.writeManifest('b', { name: 'b', version: '2.0.0', enabled: false });
    const list = mod.listPlugins();
    expect(list).toHaveLength(2);
    const names = list.map(p => p.name).sort();
    expect(names).toEqual(['a', 'b']);
  });

  test('skips directories without plugin.json', () => {
    const dir = path.join(mod.getPluginsDir(), 'empty');
    fs.mkdirSync(dir, { recursive: true });
    expect(mod.listPlugins()).toEqual([]);
  });
});

// ── enablePlugin ────────────────────────────────────────────────────────────

describe('enablePlugin', () => {
  test('returns failure for non-existent plugin', () => {
    const result = mod.enablePlugin('nope');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  test('enables a disabled plugin', () => {
    mod.writeManifest('plug', { name: 'plug', version: '1.0.0', enabled: false });
    const result = mod.enablePlugin('plug');
    expect(result.success).toBe(true);
    expect(mod.readManifest('plug').enabled).toBe(true);
  });

  test('reports already enabled', () => {
    mod.writeManifest('plug', { name: 'plug', version: '1.0.0', enabled: true });
    const result = mod.enablePlugin('plug');
    expect(result.success).toBe(true);
    expect(result.message).toContain('already enabled');
  });
});

// ── disablePlugin ───────────────────────────────────────────────────────────

describe('disablePlugin', () => {
  test('returns failure for non-existent plugin', () => {
    const result = mod.disablePlugin('nope');
    expect(result.success).toBe(false);
  });

  test('disables an enabled plugin', () => {
    mod.writeManifest('plug', { name: 'plug', version: '1.0.0', enabled: true });
    const result = mod.disablePlugin('plug');
    expect(result.success).toBe(true);
    expect(mod.readManifest('plug').enabled).toBe(false);
  });

  test('reports already disabled', () => {
    mod.writeManifest('plug', { name: 'plug', version: '1.0.0', enabled: false });
    const result = mod.disablePlugin('plug');
    expect(result.success).toBe(true);
    expect(result.message).toContain('already disabled');
  });
});

// ── initPlugin ──────────────────────────────────────────────────────────────

describe('initPlugin', () => {
  test('scaffolds a new plugin', () => {
    const result = mod.initPlugin('my-new-plugin');
    expect(result.success).toBe(true);
    const manifest = mod.readManifest('my-new-plugin');
    expect(manifest.name).toBe('my-new-plugin');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.enabled).toBe(true);
    expect(fs.existsSync(path.join(mod.getPluginDir('my-new-plugin'), 'index.js'))).toBe(true);
  });

  test('fails for existing plugin', () => {
    mod.initPlugin('dup');
    const result = mod.initPlugin('dup');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  test('fails for invalid name', () => {
    const result = mod.initPlugin('INVALID_NAME');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid plugin name');
  });

  test('fails for empty name', () => {
    const result = mod.initPlugin('');
    expect(result.success).toBe(false);
  });
});

// ── loadPlugins ─────────────────────────────────────────────────────────────

describe('loadPlugins', () => {
  test('returns only enabled plugins', () => {
    mod.writeManifest('on', { name: 'on', version: '1.0.0', enabled: true });
    mod.writeManifest('off', { name: 'off', version: '1.0.0', enabled: false });
    const loaded = mod.loadPlugins();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('on');
  });
});

// ── formatPluginRow ─────────────────────────────────────────────────────────

describe('formatPluginRow', () => {
  test('formats enabled plugin', () => {
    const str = mod.formatPluginRow({ name: 'foo', version: '1.0.0', enabled: true, description: 'A plugin' });
    expect(str).toContain('foo');
    expect(str).toContain('enabled');
    expect(str).toContain('A plugin');
  });

  test('formats disabled plugin without description', () => {
    const str = mod.formatPluginRow({ name: 'bar', version: '0.1.0', enabled: false });
    expect(str).toContain('disabled');
    expect(str).toContain('(no description)');
  });
});

// ── formatPluginInfo ────────────────────────────────────────────────────────

describe('formatPluginInfo', () => {
  test('includes all fields', () => {
    const str = mod.formatPluginInfo({
      name: 'test',
      version: '2.0.0',
      description: 'desc',
      enabled: true,
      commands: ['cmd1'],
      hooks: [],
    });
    expect(str).toContain('test');
    expect(str).toContain('2.0.0');
    expect(str).toContain('desc');
    expect(str).toContain('enabled');
    expect(str).toContain('cmd1');
  });
});

// ── runPlugins ──────────────────────────────────────────────────────────────

describe('runPlugins', () => {
  test('list shows "No plugins installed." when empty', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runPlugins(['list']);
    expect(spy).toHaveBeenCalledWith('No plugins installed.');
    spy.mockRestore();
  });

  test('default subcommand is list', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runPlugins([]);
    expect(spy).toHaveBeenCalledWith('No plugins installed.');
    spy.mockRestore();
  });

  test('info without name shows usage error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    mod.runPlugins(['info']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    spy.mockRestore();
  });

  test('unknown subcommand shows error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    mod.runPlugins(['bogus']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown'));
    spy.mockRestore();
  });
});
