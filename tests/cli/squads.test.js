/**
 * Tests for Squads Marketplace Command Module
 *
 * @module tests/cli/squads
 * @story 4.4 — Squads Marketplace MVP
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-squads-test-'));
  process.cwd = () => tmpDir;
  process.exitCode = 0;
});

afterEach(() => {
  process.cwd = originalCwd;
  process.exitCode = 0;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/squads/index.js');

// ── validateManifest ──────────────────────────────────────────────────────────

describe('validateManifest', () => {
  test('accepts valid manifest with all required fields', () => {
    const result = mod.validateManifest({
      name: 'my-squad',
      version: '1.0.0',
      description: 'A test squad',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts manifest with squad wrapper', () => {
    const result = mod.validateManifest({
      squad: {
        name: 'my-squad',
        version: '1.0.0',
        description: 'A test squad',
      },
    });
    expect(result.valid).toBe(true);
  });

  test('rejects null manifest', () => {
    const result = mod.validateManifest(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-null object/);
  });

  test('rejects undefined manifest', () => {
    const result = mod.validateManifest(undefined);
    expect(result.valid).toBe(false);
  });

  test('rejects string manifest', () => {
    const result = mod.validateManifest('not an object');
    expect(result.valid).toBe(false);
  });

  test('rejects manifest missing name', () => {
    const result = mod.validateManifest({
      version: '1.0.0',
      description: 'No name',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: name');
  });

  test('rejects manifest missing version', () => {
    const result = mod.validateManifest({
      name: 'test',
      description: 'No version',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: version');
  });

  test('rejects manifest missing description', () => {
    const result = mod.validateManifest({
      name: 'test',
      version: '1.0.0',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: description');
  });

  test('rejects empty string fields', () => {
    const result = mod.validateManifest({
      name: '',
      version: '1.0.0',
      description: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: name');
  });

  test('rejects name with uppercase letters', () => {
    const result = mod.validateManifest({
      name: 'MySquad',
      version: '1.0.0',
      description: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/lowercase/);
  });

  test('rejects name starting with hyphen', () => {
    const result = mod.validateManifest({
      name: '-bad-name',
      version: '1.0.0',
      description: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/lowercase/);
  });

  test('rejects invalid version format', () => {
    const result = mod.validateManifest({
      name: 'test',
      version: 'abc',
      description: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/semver/);
  });

  test('accepts version with pre-release suffix', () => {
    const result = mod.validateManifest({
      name: 'test',
      version: '1.0.0-beta.1',
      description: 'test',
    });
    expect(result.valid).toBe(true);
  });

  test('reports multiple errors at once', () => {
    const result = mod.validateManifest({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── listInstalled ─────────────────────────────────────────────────────────────

describe('listInstalled', () => {
  test('returns empty array when squads dir does not exist', () => {
    const result = mod.listInstalled();
    expect(result).toEqual([]);
  });

  test('returns empty array when squads dir is empty', () => {
    fs.mkdirSync(path.join(tmpDir, 'squads'), { recursive: true });
    const result = mod.listInstalled();
    expect(result).toEqual([]);
  });

  test('skips _example directory', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(path.join(squadsDir, '_example'), { recursive: true });
    const result = mod.listInstalled();
    expect(result).toEqual([]);
  });

  test('skips files (non-directories)', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(squadsDir, { recursive: true });
    fs.writeFileSync(path.join(squadsDir, 'README.md'), '# Squads');
    const result = mod.listInstalled();
    expect(result).toEqual([]);
  });

  test('lists squad without config.yaml (minimal metadata)', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(path.join(squadsDir, 'test-squad'), { recursive: true });

    const result = mod.listInstalled();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test-squad');
    expect(result[0].version).toBe('unknown');
  });

  test('reads metadata from config.yaml', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const squadDir = path.join(squadsDir, 'my-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(path.join(squadDir, 'config.yaml'), [
      'squad:',
      '  name: my-squad',
      '  version: "2.0.0"',
      '  description: "My awesome squad"',
      'agents:',
      '  agent-one:',
      '    file: agents/one.md',
      '  agent-two:',
      '    file: agents/two.md',
    ].join('\n'));

    const result = mod.listInstalled();
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('2.0.0');
    expect(result[0].description).toMatch(/My awesome squad/);
    expect(result[0].agentCount).toBe(2);
  });

  test('counts agent .md files as fallback', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const squadDir = path.join(squadsDir, 'agent-squad');
    const agentsDir = path.join(squadDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'agent-a.md'), '# Agent A');
    fs.writeFileSync(path.join(agentsDir, 'agent-b.md'), '# Agent B');
    fs.writeFileSync(path.join(agentsDir, 'readme.txt'), 'not an agent');

    const result = mod.listInstalled();
    expect(result).toHaveLength(1);
    expect(result[0].agentCount).toBe(2);
  });
});

// ── searchSquads ──────────────────────────────────────────────────────────────

describe('searchSquads', () => {
  function setupRegistry(entries) {
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'squads-registry.json'),
      JSON.stringify(entries),
    );
  }

  test('returns empty when registry does not exist', () => {
    expect(mod.searchSquads('test')).toEqual([]);
  });

  test('returns empty for invalid registry JSON', () => {
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'squads-registry.json'), 'not json');
    expect(mod.searchSquads('test')).toEqual([]);
  });

  test('returns empty when registry is not an array', () => {
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'squads-registry.json'), '{"a":1}');
    expect(mod.searchSquads('test')).toEqual([]);
  });

  test('returns all entries when query is empty', () => {
    setupRegistry([
      { name: 'alpha', version: '1.0.0', description: 'first' },
      { name: 'beta', version: '2.0.0', description: 'second' },
    ]);
    expect(mod.searchSquads('')).toHaveLength(2);
  });

  test('returns all entries when query is null', () => {
    setupRegistry([{ name: 'alpha', version: '1.0.0', description: 'first' }]);
    expect(mod.searchSquads(null)).toHaveLength(1);
  });

  test('matches by name', () => {
    setupRegistry([
      { name: 'claude-squad', description: 'a' },
      { name: 'react-squad', description: 'b' },
    ]);
    const result = mod.searchSquads('claude');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('claude-squad');
  });

  test('matches by description', () => {
    setupRegistry([
      { name: 'a', description: 'Full spectrum Claude Code expertise' },
      { name: 'b', description: 'React components' },
    ]);
    const result = mod.searchSquads('expertise');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('a');
  });

  test('matches by keywords', () => {
    setupRegistry([
      { name: 'a', description: 'x', keywords: ['hooks', 'mcp'] },
      { name: 'b', description: 'y', keywords: ['react'] },
    ]);
    const result = mod.searchSquads('hooks');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('a');
  });

  test('search is case-insensitive', () => {
    setupRegistry([{ name: 'Claude-Test', description: 'something' }]);
    const result = mod.searchSquads('CLAUDE');
    expect(result).toHaveLength(1);
  });

  test('partial match works', () => {
    setupRegistry([{ name: 'claude-code-mastery', description: 'x' }]);
    const result = mod.searchSquads('mast');
    expect(result).toHaveLength(1);
  });

  test('no match returns empty', () => {
    setupRegistry([{ name: 'alpha', description: 'test' }]);
    expect(mod.searchSquads('zzzzz')).toEqual([]);
  });
});

// ── installSquad ──────────────────────────────────────────────────────────────

describe('installSquad', () => {
  test('fails when already installed', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    fs.mkdirSync(path.join(squadsDir, 'existing'), { recursive: true });

    const result = mod.installSquad('existing');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already installed/);
  });

  test('fails when not in registry and no source given', () => {
    fs.mkdirSync(path.join(tmpDir, 'squads'), { recursive: true });
    const result = mod.installSquad('unknown-squad');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found in registry/);
  });

  test('installs from _example template when source is local', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const exampleDir = path.join(squadsDir, '_example');
    fs.mkdirSync(exampleDir, { recursive: true });
    fs.writeFileSync(path.join(exampleDir, 'config.yaml'), 'squad:\n  name: template');

    const result = mod.installSquad('new-squad', 'local');
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/installed from template/);

    // Verify files were copied
    const targetConfig = path.join(squadsDir, 'new-squad', 'config.yaml');
    expect(fs.existsSync(targetConfig)).toBe(true);
  });

  test('fails local install when _example does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, 'squads'), { recursive: true });
    const result = mod.installSquad('new-squad', 'local');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not available/);
  });

  test('rejects unsupported source type', () => {
    fs.mkdirSync(path.join(tmpDir, 'squads'), { recursive: true });
    const result = mod.installSquad('new-squad', 'github');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not yet supported/);
  });

  test('uses registry to resolve source', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const exampleDir = path.join(squadsDir, '_example');
    fs.mkdirSync(exampleDir, { recursive: true });
    fs.writeFileSync(path.join(exampleDir, 'config.yaml'), 'name: test');

    // Setup registry
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'squads-registry.json'), JSON.stringify([
      { name: 'registered-squad', version: '1.0.0', source: 'local' },
    ]));

    const result = mod.installSquad('registered-squad');
    expect(result.success).toBe(true);
  });
});

// ── packSquad ─────────────────────────────────────────────────────────────────

describe('packSquad', () => {
  test('fails when directory does not exist', () => {
    const result = mod.packSquad(path.join(tmpDir, 'nonexistent'));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/);
  });

  test('fails when no config.yaml', () => {
    const squadDir = path.join(tmpDir, 'pack-test');
    fs.mkdirSync(squadDir, { recursive: true });
    const result = mod.packSquad(squadDir);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/config\.yaml/);
  });

  test('creates .tar.gz file', () => {
    const squadDir = path.join(tmpDir, 'pack-test');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(path.join(squadDir, 'config.yaml'), 'name: test');
    fs.writeFileSync(path.join(squadDir, 'README.md'), '# Test');

    const result = mod.packSquad(squadDir);
    expect(result.success).toBe(true);
    expect(result.outputPath).toMatch(/\.tar\.gz$/);
    expect(fs.existsSync(result.outputPath)).toBe(true);

    // Verify it's a valid gzip
    const content = fs.readFileSync(result.outputPath);
    expect(content[0]).toBe(0x1f); // gzip magic byte 1
    expect(content[1]).toBe(0x8b); // gzip magic byte 2
  });

  test('includes nested files', () => {
    const squadDir = path.join(tmpDir, 'nested-squad');
    const agentsDir = path.join(squadDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(squadDir, 'config.yaml'), 'name: nested');
    fs.writeFileSync(path.join(agentsDir, 'agent.md'), '# Agent');

    const result = mod.packSquad(squadDir);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/2 files/);
  });
});

// ── runSquads CLI handler ─────────────────────────────────────────────────────

describe('runSquads', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('shows help with no args', () => {
    mod.runSquads([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('shows help with --help flag', () => {
    mod.runSquads(['--help']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'));
  });

  test('list subcommand shows "no squads" when empty', () => {
    mod.runSquads(['list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No squads'));
  });

  test('list subcommand shows installed squads', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const squadDir = path.join(squadsDir, 'test-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(path.join(squadDir, 'config.yaml'), [
      'squad:',
      '  name: test-squad',
      '  version: "1.0.0"',
      '  description: "Test"',
    ].join('\n'));

    mod.runSquads(['list']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-squad'));
  });

  test('search subcommand shows results', () => {
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'squads-registry.json'), JSON.stringify([
      { name: 'found-squad', version: '1.0.0', description: 'A squad' },
    ]));

    mod.runSquads(['search', 'found']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('found-squad'));
  });

  test('search subcommand shows no results message', () => {
    const dataDir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'squads-registry.json'), '[]');

    mod.runSquads(['search', 'nothing']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No squads found'));
  });

  test('install subcommand requires name', () => {
    mod.runSquads(['install']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    expect(process.exitCode).toBe(1);
  });

  test('install subcommand reports success', () => {
    const squadsDir = path.join(tmpDir, 'squads');
    const exampleDir = path.join(squadsDir, '_example');
    fs.mkdirSync(exampleDir, { recursive: true });
    fs.writeFileSync(path.join(exampleDir, 'config.yaml'), 'name: x');

    mod.runSquads(['install', 'new-squad', '--source', 'local']);
    // installSquad will be called; it needs registry or explicit source
    // With explicit local source: it uses _example template
  });

  test('publish subcommand shows guide', () => {
    mod.runSquads(['publish']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Publishing Guide'));
  });

  test('unknown subcommand shows error', () => {
    mod.runSquads(['foobar']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
    expect(process.exitCode).toBe(1);
  });

  test('pack subcommand requires directory', () => {
    mod.runSquads(['pack']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    expect(process.exitCode).toBe(1);
  });
});

// ── parseYamlLite ─────────────────────────────────────────────────────────────

describe('parseYamlLite', () => {
  test('parses top-level keys', () => {
    const result = mod.parseYamlLite('squad:\n  name: test\n  version: "1.0.0"');
    expect(result.squad.name).toBe('test');
    expect(result.squad.version).toBe('1.0.0');
  });

  test('strips quotes from values', () => {
    const result = mod.parseYamlLite('squad:\n  name: "quoted-value"');
    expect(result.squad.name).toBe('quoted-value');
  });

  test('handles comments', () => {
    const result = mod.parseYamlLite('# comment\nsquad:\n  name: test');
    expect(result.squad.name).toBe('test');
  });

  test('handles empty content', () => {
    const result = mod.parseYamlLite('');
    expect(result).toEqual({});
  });

  test('handles multiple sections', () => {
    const result = mod.parseYamlLite('squad:\n  name: a\nagents:\n  bot:\n    file: x.md');
    expect(result.squad.name).toBe('a');
    expect(result.agents.bot).toBeDefined();
  });
});

// ── copyDirSync ───────────────────────────────────────────────────────────────

describe('copyDirSync', () => {
  test('copies files recursively', () => {
    const src = path.join(tmpDir, 'src-dir');
    const nested = path.join(src, 'sub');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(src, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(nested, 'b.txt'), 'world');

    const dest = path.join(tmpDir, 'dest-dir');
    mod.copyDirSync(src, dest);

    expect(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8')).toBe('hello');
    expect(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8')).toBe('world');
  });
});
