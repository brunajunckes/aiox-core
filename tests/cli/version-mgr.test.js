/**
 * Tests for Version Manager Command Module
 * @story 20.1 — Version Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-version-mgr-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/version-mgr/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/version-mgr/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('version-mgr command', () => {
  // ── parseSemver ────────────────────────────────────────────────────────────
  describe('parseSemver', () => {
    it('parses standard semver', () => {
      expect(mod.parseSemver('5.0.3')).toEqual({ major: 5, minor: 0, patch: 3 });
    });

    it('parses with v prefix', () => {
      expect(mod.parseSemver('v2.1.0')).toEqual({ major: 2, minor: 1, patch: 0 });
    });

    it('returns null for invalid input', () => {
      expect(mod.parseSemver(null)).toBeNull();
      expect(mod.parseSemver('')).toBeNull();
      expect(mod.parseSemver('abc')).toBeNull();
      expect(mod.parseSemver(42)).toBeNull();
    });
  });

  // ── bumpVersion ────────────────────────────────────────────────────────────
  describe('bumpVersion', () => {
    it('bumps patch', () => {
      expect(mod.bumpVersion('5.0.3', 'patch')).toBe('5.0.4');
    });

    it('bumps minor and resets patch', () => {
      expect(mod.bumpVersion('5.0.3', 'minor')).toBe('5.1.0');
    });

    it('bumps major and resets minor+patch', () => {
      expect(mod.bumpVersion('5.0.3', 'major')).toBe('6.0.0');
    });

    it('returns null for invalid version', () => {
      expect(mod.bumpVersion('invalid', 'patch')).toBeNull();
    });

    it('returns null for invalid level', () => {
      expect(mod.bumpVersion('1.0.0', 'pre')).toBeNull();
    });
  });

  // ── loadPackageJson ────────────────────────────────────────────────────────
  describe('loadPackageJson', () => {
    it('loads package.json from cwd', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
      const result = mod.loadPackageJson({ cwd: tmpDir });
      expect(result).not.toBeNull();
      expect(result.data.version).toBe('1.2.3');
    });

    it('returns null when not found', () => {
      expect(mod.loadPackageJson({ cwd: tmpDir })).toBeNull();
    });
  });

  // ── writeVersion ───────────────────────────────────────────────────────────
  describe('writeVersion', () => {
    it('writes new version to package.json', () => {
      const pkgPath = path.join(tmpDir, 'package.json');
      const data = { name: 'test', version: '1.0.0' };
      fs.writeFileSync(pkgPath, JSON.stringify(data));
      mod.writeVersion(pkgPath, data, '1.0.1');
      const updated = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      expect(updated.version).toBe('1.0.1');
    });
  });

  // ── getVersionHistory ──────────────────────────────────────────────────────
  describe('getVersionHistory', () => {
    it('returns parsed version history', () => {
      const execFn = () => 'v2.0.0|2025-01-01\nv1.0.0|2024-06-15';
      const history = mod.getVersionHistory({ execFn });
      expect(history).toHaveLength(2);
      expect(history[0].tag).toBe('v2.0.0');
      expect(history[1].date).toBe('2024-06-15');
    });

    it('returns empty array on error', () => {
      const execFn = () => { throw new Error('fail'); };
      expect(mod.getVersionHistory({ execFn })).toEqual([]);
    });

    it('returns empty array on empty output', () => {
      const execFn = () => '';
      expect(mod.getVersionHistory({ execFn })).toEqual([]);
    });
  });

  // ── runVersionMgr ──────────────────────────────────────────────────────────
  describe('runVersionMgr', () => {
    it('shows current version', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '3.2.1' }));
      const lines = [];
      mod.runVersionMgr([], { log: (m) => lines.push(m), cwd: tmpDir });
      expect(lines[0]).toBe('3.2.1');
    });

    it('shows error when no package.json', () => {
      const lines = [];
      mod.runVersionMgr([], { log: (m) => lines.push(m), cwd: tmpDir });
      expect(lines[0]).toContain('Error');
    });

    it('bumps patch version', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      const lines = [];
      mod.runVersionMgr(['bump', 'patch'], { log: (m) => lines.push(m), cwd: tmpDir });
      expect(lines[0]).toContain('1.0.1');
      const updated = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
      expect(updated.version).toBe('1.0.1');
    });

    it('dry-run does not write', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      const lines = [];
      mod.runVersionMgr(['bump', 'minor', '--dry-run'], { log: (m) => lines.push(m), cwd: tmpDir });
      expect(lines[0]).toContain('Would bump');
      const unchanged = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
      expect(unchanged.version).toBe('1.0.0');
    });

    it('shows help with --help', () => {
      const lines = [];
      mod.runVersionMgr(['--help'], { log: (m) => lines.push(m) });
      expect(lines[0]).toContain('Version Manager');
    });

    it('shows version history', () => {
      const execFn = () => 'v1.0.0|2025-01-01';
      const lines = [];
      mod.runVersionMgr(['history'], { log: (m) => lines.push(m), execFn });
      expect(lines[0]).toContain('Version History');
    });

    it('reports error for invalid bump level', () => {
      const lines = [];
      mod.runVersionMgr(['bump'], { log: (m) => lines.push(m), cwd: tmpDir });
      expect(lines[0]).toContain('specify bump level');
    });
  });

  // ── getHelpText ────────────────────────────────────────────────────────────
  describe('getHelpText', () => {
    it('returns non-empty help string', () => {
      const help = mod.getHelpText();
      expect(help.length).toBeGreaterThan(50);
      expect(help).toContain('aiox version');
    });
  });
});
