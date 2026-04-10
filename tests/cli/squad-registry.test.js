/**
 * Tests for Squad Registry Command Module
 *
 * @module tests/cli/squad-registry
 * @story 34.2 - Squad Registry
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-squad-registry-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/squad-registry/index.js');

// ── Path Helpers ──────────────────────────────────────────────────────────────

describe('getRegistryFile', () => {
  test('returns squads.json inside .aiox/registry/', () => {
    expect(mod.getRegistryFile()).toBe(path.join(tmpDir, '.aiox', 'registry', 'squads.json'));
  });
});

// ── readRegistry / writeRegistry ──────────────────────────────────────────────

describe('readRegistry', () => {
  test('returns empty registry when file does not exist', () => {
    const reg = mod.readRegistry();
    expect(reg.squads).toEqual([]);
    expect(reg.updatedAt).toBeNull();
  });

  test('returns empty on corrupt JSON', () => {
    const dir = path.join(tmpDir, '.aiox', 'registry');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'squads.json'), 'CORRUPT', 'utf8');
    const reg = mod.readRegistry();
    expect(reg.squads).toEqual([]);
  });

  test('returns empty when squads is not an array', () => {
    const dir = path.join(tmpDir, '.aiox', 'registry');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'squads.json'), '{"squads":"not-array"}', 'utf8');
    const reg = mod.readRegistry();
    expect(reg.squads).toEqual([]);
  });
});

describe('writeRegistry', () => {
  test('creates directory and writes file', () => {
    const reg = { squads: [{ name: 'test-squad' }] };
    mod.writeRegistry(reg);
    expect(reg.updatedAt).toBeDefined();

    const read = mod.readRegistry();
    expect(read.squads).toHaveLength(1);
    expect(read.squads[0].name).toBe('test-squad');
  });
});

// ── validateSquadMeta ─────────────────────────────────────────────────────────

describe('validateSquadMeta', () => {
  test('accepts valid metadata', () => {
    const result = mod.validateSquadMeta({
      name: 'my-squad',
      description: 'A test squad',
      version: '1.0.0',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects null metadata', () => {
    const result = mod.validateSquadMeta(null);
    expect(result.valid).toBe(false);
  });

  test('rejects missing name', () => {
    const result = mod.validateSquadMeta({ description: 'test', version: '1.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('name');
  });

  test('rejects invalid name format', () => {
    const result = mod.validateSquadMeta({
      name: 'My Squad',
      description: 'test',
      version: '1.0.0',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('lowercase'),
    ]));
  });

  test('rejects invalid version format', () => {
    const result = mod.validateSquadMeta({
      name: 'my-squad',
      description: 'test',
      version: 'invalid',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('semver'),
    ]));
  });

  test('rejects empty string fields', () => {
    const result = mod.validateSquadMeta({
      name: '  ',
      description: '',
      version: '1.0.0',
    });
    expect(result.valid).toBe(false);
  });
});

// ── readSquadMeta ─────────────────────────────────────────────────────────────

describe('readSquadMeta', () => {
  test('reads squad.json', () => {
    const squadDir = path.join(tmpDir, 'my-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'my-squad', version: '1.0.0', description: 'test' }),
      'utf8'
    );

    const meta = mod.readSquadMeta(squadDir);
    expect(meta.name).toBe('my-squad');
  });

  test('reads config.yaml as fallback', () => {
    const squadDir = path.join(tmpDir, 'yaml-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'config.yaml'),
      'name: yaml-squad\nversion: 1.0.0\ndescription: yaml test\n',
      'utf8'
    );

    const meta = mod.readSquadMeta(squadDir);
    expect(meta.name).toBe('yaml-squad');
  });

  test('returns null when no metadata files exist', () => {
    const squadDir = path.join(tmpDir, 'empty-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    expect(mod.readSquadMeta(squadDir)).toBeNull();
  });
});

// ── addSquad ──────────────────────────────────────────────────────────────────

describe('addSquad', () => {
  test('adds squad from valid directory', () => {
    const squadDir = path.join(tmpDir, 'new-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'new-squad', version: '1.0.0', description: 'New squad' }),
      'utf8'
    );

    const result = mod.addSquad(squadDir);
    expect(result.success).toBe(true);
    expect(result.squad.name).toBe('new-squad');

    const squads = mod.listSquads();
    expect(squads).toHaveLength(1);
  });

  test('rejects missing path', () => {
    const result = mod.addSquad('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  test('rejects non-existent path', () => {
    const result = mod.addSquad('/non/existent/path');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  test('rejects path that is not a directory', () => {
    const filePath = path.join(tmpDir, 'not-a-dir');
    fs.writeFileSync(filePath, 'content', 'utf8');
    const result = mod.addSquad(filePath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('directory');
  });

  test('rejects invalid metadata', () => {
    const squadDir = path.join(tmpDir, 'bad-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'INVALID NAME' }),
      'utf8'
    );

    const result = mod.addSquad(squadDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  test('updates existing squad on re-add', () => {
    const squadDir = path.join(tmpDir, 'update-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'update-squad', version: '1.0.0', description: 'v1' }),
      'utf8'
    );

    mod.addSquad(squadDir);

    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'update-squad', version: '2.0.0', description: 'v2' }),
      'utf8'
    );

    mod.addSquad(squadDir);
    const squads = mod.listSquads();
    expect(squads).toHaveLength(1);
    expect(squads[0].version).toBe('2.0.0');
  });
});

// ── removeSquad ───────────────────────────────────────────────────────────────

describe('removeSquad', () => {
  test('removes existing squad', () => {
    const squadDir = path.join(tmpDir, 'rm-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'rm-squad', version: '1.0.0', description: 'test' }),
      'utf8'
    );
    mod.addSquad(squadDir);

    const result = mod.removeSquad('rm-squad');
    expect(result.success).toBe(true);
    expect(mod.listSquads()).toHaveLength(0);
  });

  test('rejects removing non-existent squad', () => {
    const result = mod.removeSquad('ghost-squad');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('rejects empty name', () => {
    const result = mod.removeSquad('');
    expect(result.success).toBe(false);
  });
});

// ── searchSquads ──────────────────────────────────────────────────────────────

describe('searchSquads', () => {
  beforeEach(() => {
    const reg = {
      squads: [
        { name: 'web-dev', description: 'Web development', tags: ['web', 'frontend'] },
        { name: 'api-backend', description: 'API services', tags: ['api', 'rest'] },
        { name: 'data-science', description: 'Data analytics', tags: ['data', 'ml'] },
      ],
    };
    mod.writeRegistry(reg);
  });

  test('finds by name', () => {
    expect(mod.searchSquads('web')).toHaveLength(1);
  });

  test('finds by description', () => {
    expect(mod.searchSquads('analytics')).toHaveLength(1);
  });

  test('finds by tag', () => {
    expect(mod.searchSquads('rest')).toHaveLength(1);
  });

  test('returns empty for no match', () => {
    expect(mod.searchSquads('blockchain')).toHaveLength(0);
  });

  test('returns empty for null term', () => {
    expect(mod.searchSquads(null)).toHaveLength(0);
  });
});

// ── getSquadInfo ──────────────────────────────────────────────────────────────

describe('getSquadInfo', () => {
  test('returns squad when found', () => {
    mod.writeRegistry({ squads: [{ name: 'info-squad', version: '1.0.0' }] });
    const info = mod.getSquadInfo('info-squad');
    expect(info).not.toBeNull();
    expect(info.name).toBe('info-squad');
  });

  test('returns null when not found', () => {
    expect(mod.getSquadInfo('nope')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(mod.getSquadInfo(null)).toBeNull();
  });
});

// ── formatSquadList ───────────────────────────────────────────────────────────

describe('formatSquadList', () => {
  test('shows message for empty list', () => {
    const output = mod.formatSquadList([]);
    expect(output).toContain('No squads registered');
  });

  test('formats squad entries', () => {
    const output = mod.formatSquadList([
      { name: 'test', version: '1.0.0', description: 'A test squad', tags: ['dev'] },
    ]);
    expect(output).toContain('test');
    expect(output).toContain('1.0.0');
    expect(output).toContain('dev');
    expect(output).toContain('Total: 1');
  });
});

// ── formatSquadInfo ───────────────────────────────────────────────────────────

describe('formatSquadInfo', () => {
  test('formats detailed info', () => {
    const output = mod.formatSquadInfo({
      name: 'detail-squad',
      version: '2.0.0',
      description: 'Detailed',
      author: 'AIOX',
      tags: ['a', 'b'],
      agents: ['dev', 'qa'],
      registeredAt: '2026-04-09',
    });
    expect(output).toContain('detail-squad');
    expect(output).toContain('2.0.0');
    expect(output).toContain('AIOX');
    expect(output).toContain('dev, qa');
  });
});

// ── runSquadRegistry ──────────────────────────────────────────────────────────

describe('runSquadRegistry', () => {
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('list shows empty message', () => {
    mod.runSquadRegistry(['list']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No squads registered');
  });

  test('help shows usage', () => {
    mod.runSquadRegistry(['help']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });

  test('search without term shows error', () => {
    mod.runSquadRegistry(['search']);
    expect(errSpy).toHaveBeenCalled();
  });
});
