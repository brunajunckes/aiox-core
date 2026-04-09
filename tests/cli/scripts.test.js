/**
 * Tests for Script Runner & Discovery Command Module
 * @story 23.4 — Script Runner & Discovery
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-scripts-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/scripts/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/scripts/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Helper to write package.json
function writePkg(scripts, extraFields = {}) {
  const pkg = { name: 'test-pkg', version: '1.0.0', scripts, ...extraFields };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg, null, 2));
}

describe('scripts command', () => {
  // ── readPackageJson ───────────────────────────────────────────────────
  describe('readPackageJson', () => {
    it('reads package.json', () => {
      writePkg({ test: 'jest' });
      const pkg = mod.readPackageJson(tmpDir);
      expect(pkg.name).toBe('test-pkg');
      expect(pkg.scripts.test).toBe('jest');
    });

    it('returns null for missing package.json', () => {
      expect(mod.readPackageJson(tmpDir)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{invalid}');
      expect(mod.readPackageJson(tmpDir)).toBeNull();
    });
  });

  // ── listScripts ───────────────────────────────────────────────────────
  describe('listScripts', () => {
    it('lists all scripts', () => {
      writePkg({ test: 'jest', build: 'tsc', lint: 'eslint .' });
      const result = mod.listScripts({ cwd: tmpDir });
      expect(result.total).toBe(3);
      expect(result.scripts.map(s => s.name)).toEqual(['test', 'build', 'lint']);
    });

    it('returns empty for no scripts', () => {
      writePkg({});
      const result = mod.listScripts({ cwd: tmpDir });
      expect(result.total).toBe(0);
    });

    it('returns empty for no package.json', () => {
      const result = mod.listScripts({ cwd: tmpDir });
      expect(result.total).toBe(0);
    });
  });

  // ── searchScripts ─────────────────────────────────────────────────────
  describe('searchScripts', () => {
    it('finds scripts by name', () => {
      writePkg({ test: 'jest', 'test:ci': 'jest --ci', build: 'tsc' });
      const result = mod.searchScripts('test', { cwd: tmpDir });
      expect(result.total).toBe(2);
      expect(result.results.every(r => r.name.includes('test'))).toBe(true);
    });

    it('finds scripts by command content', () => {
      writePkg({ build: 'webpack --mode production', dev: 'webpack serve' });
      const result = mod.searchScripts('webpack', { cwd: tmpDir });
      expect(result.total).toBe(2);
    });

    it('returns empty for no matches', () => {
      writePkg({ test: 'jest' });
      const result = mod.searchScripts('docker', { cwd: tmpDir });
      expect(result.total).toBe(0);
    });

    it('identifies match type correctly', () => {
      writePkg({ jest: 'jest --coverage' });
      const result = mod.searchScripts('jest', { cwd: tmpDir });
      expect(result.results[0].matchType).toBe('both');
    });

    it('handles empty search term', () => {
      writePkg({ test: 'jest' });
      const result = mod.searchScripts('', { cwd: tmpDir });
      expect(result.total).toBe(0);
    });
  });

  // ── auditScripts ──────────────────────────────────────────────────────
  describe('auditScripts', () => {
    it('flags very long commands', () => {
      const longCmd = 'x'.repeat(201);
      writePkg({ build: longCmd });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.message.includes('very long'))).toBe(true);
    });

    it('flags hardcoded paths', () => {
      writePkg({ build: 'node /Users/dev/build.js' });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.message.includes('hardcoded'))).toBe(true);
    });

    it('flags rm -rf usage', () => {
      writePkg({ clean: 'rm -rf dist/' });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.message.includes('destructive'))).toBe(true);
    });

    it('flags missing CLI tools not in deps', () => {
      writePkg({ lint: 'eslint .' });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.message.includes('eslint'))).toBe(true);
    });

    it('does not flag CLI tools that are in deps', () => {
      writePkg({ lint: 'eslint .' }, { devDependencies: { eslint: '^8.0.0' } });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.message.includes('"eslint"'))).toBe(false);
    });

    it('flags lifecycle hooks without base script', () => {
      writePkg({ pretest: 'echo pre', postbuild: 'echo post' });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.issues.some(i => i.script === 'pretest')).toBe(true);
      expect(result.issues.some(i => i.script === 'postbuild')).toBe(true);
    });

    it('returns no issues for clean scripts', () => {
      writePkg({ test: 'jest' }, { devDependencies: { jest: '^29.0.0' } });
      const result = mod.auditScripts({ cwd: tmpDir });
      expect(result.total).toBe(0);
    });
  });

  // ── formatListText ────────────────────────────────────────────────────
  describe('formatListText', () => {
    it('formats script list', () => {
      const result = { scripts: [{ name: 'test', command: 'jest' }], total: 1 };
      const text = mod.formatListText(result);
      expect(text).toContain('NPM Scripts');
      expect(text).toContain('test');
      expect(text).toContain('Total: 1');
    });

    it('handles no scripts', () => {
      const result = { scripts: [], total: 0 };
      const text = mod.formatListText(result);
      expect(text).toContain('No scripts found');
    });
  });

  // ── formatSearchText ──────────────────────────────────────────────────
  describe('formatSearchText', () => {
    it('formats search results', () => {
      const result = { results: [{ name: 'test', command: 'jest', matchType: 'name' }], total: 1 };
      const text = mod.formatSearchText(result, 'test');
      expect(text).toContain('Search Results');
      expect(text).toContain('test');
    });
  });

  // ── formatAuditText ───────────────────────────────────────────────────
  describe('formatAuditText', () => {
    it('formats audit results', () => {
      const result = { issues: [{ script: 'build', severity: 'warning', message: 'too long' }], total: 1 };
      const text = mod.formatAuditText(result);
      expect(text).toContain('Script Audit');
      expect(text).toContain('WARN');
    });

    it('handles no issues', () => {
      const result = { issues: [], total: 0 };
      const text = mod.formatAuditText(result);
      expect(text).toContain('No issues found');
    });
  });

  // ── runScripts ────────────────────────────────────────────────────────
  describe('runScripts', () => {
    it('runs list by default', () => {
      writePkg({ test: 'jest' });
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runScripts([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runScripts(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });
  });
});
