/**
 * Tests for Marketplace Command Module
 *
 * @module tests/cli/marketplace
 * @story 34.3 - Squads Marketplace MVP (Local)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-marketplace-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/marketplace/index.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeCatalog(squads) {
  const dir = path.join(tmpDir, '.aiox-core', 'data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'marketplace-catalog.json'),
    JSON.stringify({ version: '1.0.0', squads }),
    'utf8'
  );
}

// ── Path Helpers ──────────────────────────────────────────────────────────────

describe('getCatalogFile', () => {
  test('returns marketplace-catalog.json path', () => {
    expect(mod.getCatalogFile()).toContain('marketplace-catalog.json');
  });
});

describe('getSquadsDir', () => {
  test('returns squads/ dir', () => {
    expect(mod.getSquadsDir()).toBe(path.join(tmpDir, 'squads'));
  });
});

// ── readCatalog ───────────────────────────────────────────────────────────────

describe('readCatalog', () => {
  test('returns empty catalog when file does not exist', () => {
    const catalog = mod.readCatalog();
    expect(catalog.squads).toEqual([]);
  });

  test('reads catalog from disk', () => {
    writeCatalog([{ name: 'test-squad', version: '1.0.0' }]);
    const catalog = mod.readCatalog();
    expect(catalog.squads).toHaveLength(1);
    expect(catalog.squads[0].name).toBe('test-squad');
  });

  test('returns empty on corrupt JSON', () => {
    const dir = path.join(tmpDir, '.aiox-core', 'data');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'marketplace-catalog.json'), 'BAD', 'utf8');
    const catalog = mod.readCatalog();
    expect(catalog.squads).toEqual([]);
  });
});

// ── searchCatalog ─────────────────────────────────────────────────────────────

describe('searchCatalog', () => {
  beforeEach(() => {
    writeCatalog([
      { name: 'web-dev', description: 'Web development', tags: ['web', 'react'] },
      { name: 'api-service', description: 'REST API', tags: ['api', 'node'] },
      { name: 'data-ml', description: 'Machine learning', tags: ['data', 'ml'] },
    ]);
  });

  test('finds by name', () => {
    expect(mod.searchCatalog('web')).toHaveLength(1);
  });

  test('finds by description', () => {
    expect(mod.searchCatalog('machine')).toHaveLength(1);
  });

  test('finds by tag', () => {
    expect(mod.searchCatalog('react')).toHaveLength(1);
  });

  test('case insensitive', () => {
    expect(mod.searchCatalog('REST')).toHaveLength(1);
  });

  test('returns empty for no match', () => {
    expect(mod.searchCatalog('blockchain')).toHaveLength(0);
  });

  test('returns empty for null/empty', () => {
    expect(mod.searchCatalog('')).toHaveLength(0);
    expect(mod.searchCatalog(null)).toHaveLength(0);
  });
});

// ── getFeatured ───────────────────────────────────────────────────────────────

describe('getFeatured', () => {
  test('returns only featured squads', () => {
    writeCatalog([
      { name: 'featured-one', featured: true },
      { name: 'not-featured', featured: false },
      { name: 'featured-two', featured: true },
    ]);

    const featured = mod.getFeatured();
    expect(featured).toHaveLength(2);
    expect(featured.map(f => f.name)).toEqual(['featured-one', 'featured-two']);
  });

  test('returns empty when no featured', () => {
    writeCatalog([{ name: 'boring', featured: false }]);
    expect(mod.getFeatured()).toHaveLength(0);
  });
});

// ── getCatalogSquad ───────────────────────────────────────────────────────────

describe('getCatalogSquad', () => {
  test('finds squad by name', () => {
    writeCatalog([{ name: 'target', version: '2.0.0' }]);
    const squad = mod.getCatalogSquad('target');
    expect(squad).not.toBeNull();
    expect(squad.version).toBe('2.0.0');
  });

  test('returns null for missing squad', () => {
    writeCatalog([]);
    expect(mod.getCatalogSquad('ghost')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(mod.getCatalogSquad(null)).toBeNull();
  });
});

// ── installSquad ──────────────────────────────────────────────────────────────

describe('installSquad', () => {
  test('installs squad from catalog', () => {
    writeCatalog([{
      name: 'install-me',
      version: '1.0.0',
      description: 'Install test',
      tags: ['test'],
      agents: ['dev', 'qa'],
    }]);

    const result = mod.installSquad('install-me');
    expect(result.success).toBe(true);
    expect(result.path).toContain('install-me');

    // Verify squad.json was created
    const metaPath = path.join(result.path, 'squad.json');
    expect(fs.existsSync(metaPath)).toBe(true);

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(meta.name).toBe('install-me');
    expect(meta.source).toBe('marketplace');

    // Verify agents dir created
    expect(fs.existsSync(path.join(result.path, 'agents'))).toBe(true);
  });

  test('rejects installing non-existent squad', () => {
    writeCatalog([]);
    const result = mod.installSquad('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('rejects already installed squad', () => {
    writeCatalog([{ name: 'dup-squad', version: '1.0.0', description: 'test' }]);

    // Pre-create the directory
    fs.mkdirSync(path.join(tmpDir, 'squads', 'dup-squad'), { recursive: true });

    const result = mod.installSquad('dup-squad');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already installed');
  });

  test('rejects empty name', () => {
    const result = mod.installSquad('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});

// ── publishSquad ──────────────────────────────────────────────────────────────

describe('publishSquad', () => {
  test('packages squad from local directory', () => {
    const squadDir = path.join(tmpDir, 'publish-squad');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify({ name: 'publish-squad', version: '1.0.0' }),
      'utf8'
    );

    const result = mod.publishSquad(squadDir);
    expect(result.success).toBe(true);
    expect(result.outputPath).toContain('publish-squad.json');
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  test('rejects non-existent path', () => {
    const result = mod.publishSquad('/nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  test('rejects path without metadata', () => {
    const dir = path.join(tmpDir, 'no-meta');
    fs.mkdirSync(dir, { recursive: true });
    const result = mod.publishSquad(dir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid');
  });

  test('rejects empty path', () => {
    const result = mod.publishSquad('');
    expect(result.success).toBe(false);
  });

  test('reads config.yaml fallback for publishing', () => {
    const squadDir = path.join(tmpDir, 'yaml-pub');
    fs.mkdirSync(squadDir, { recursive: true });
    fs.writeFileSync(
      path.join(squadDir, 'config.yaml'),
      'name: yaml-pub\nversion: 1.0.0\n',
      'utf8'
    );

    const result = mod.publishSquad(squadDir);
    expect(result.success).toBe(true);
  });
});

// ── formatCatalog ─────────────────────────────────────────────────────────────

describe('formatCatalog', () => {
  test('shows message for empty catalog', () => {
    const output = mod.formatCatalog([]);
    expect(output).toContain('No squads available');
  });

  test('formats squad entries with tags and featured marker', () => {
    const output = mod.formatCatalog([
      { name: 'demo', version: '1.0.0', description: 'Demo squad', tags: ['dev'], featured: true },
    ]);
    expect(output).toContain('demo');
    expect(output).toContain('1.0.0');
    expect(output).toContain('dev');
    expect(output).toContain('*');
    expect(output).toContain('Total: 1');
  });

  test('uses custom title', () => {
    const output = mod.formatCatalog([], 'Custom Title');
    expect(output).toContain('Custom Title');
  });
});

// ── runMarketplace ────────────────────────────────────────────────────────────

describe('runMarketplace', () => {
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

  test('browse with no args shows catalog', () => {
    writeCatalog([{ name: 'browse-squad', version: '1.0.0', description: 'test' }]);
    mod.runMarketplace([]);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('browse-squad');
  });

  test('--featured shows featured squads', () => {
    writeCatalog([
      { name: 'feat', featured: true, version: '1.0.0' },
      { name: 'nofeat', featured: false, version: '1.0.0' },
    ]);
    mod.runMarketplace(['--featured']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('feat');
  });

  test('search without term shows error', () => {
    mod.runMarketplace(['search']);
    expect(errSpy).toHaveBeenCalled();
  });

  test('install without name shows error', () => {
    mod.runMarketplace(['install']);
    expect(errSpy).toHaveBeenCalled();
  });

  test('help shows usage', () => {
    mod.runMarketplace(['help']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });
});
