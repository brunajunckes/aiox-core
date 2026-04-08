/**
 * Tests for CLI Alias & Shortcuts Command
 * @story 9.4 — CLI Command Aliases & Shortcuts
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// We need to override process.cwd() before requiring the module
// so the ALIAS_FILE path points to our temp dir.
let tmpDir;
let aliasModule;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-alias-test-'));
  // Override process.cwd so the module resolves .aiox/aliases.yaml under tmpDir
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  // Clear require cache to force re-evaluation with new cwd
  const modulePath = require.resolve('../../.aiox-core/cli/commands/alias/index.js');
  delete require.cache[modulePath];
  aliasModule = require('../../.aiox-core/cli/commands/alias/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  // Clean up temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('alias command', () => {
  describe('loadAliases', () => {
    it('returns default aliases when file is absent', () => {
      const aliases = aliasModule.loadAliases();
      expect(aliases).toEqual(aliasModule.DEFAULT_ALIASES);
    });

    it('returns defaults when file is empty', () => {
      const aioxDir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(aioxDir, { recursive: true });
      fs.writeFileSync(path.join(aioxDir, 'aliases.yaml'), '', 'utf8');
      const aliases = aliasModule.loadAliases();
      expect(aliases).toEqual(aliasModule.DEFAULT_ALIASES);
    });

    it('parses aliases from existing file', () => {
      const aioxDir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(aioxDir, { recursive: true });
      fs.writeFileSync(
        path.join(aioxDir, 'aliases.yaml'),
        '# AIOX CLI Aliases\naliases:\n  t: test\n  w: workflow\n',
        'utf8',
      );
      const aliases = aliasModule.loadAliases();
      expect(aliases).toEqual({ t: 'test', w: 'workflow' });
    });
  });

  describe('setAlias', () => {
    it('creates a new alias', () => {
      const result = aliasModule.setAlias('t', 'test');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Created');

      const aliases = aliasModule.loadAliases();
      expect(aliases.t).toBe('test');
    });

    it('updates an existing alias', () => {
      aliasModule.setAlias('t', 'test');
      const result = aliasModule.setAlias('t', 'telemetry');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated');

      const aliases = aliasModule.loadAliases();
      expect(aliases.t).toBe('telemetry');
    });

    it('rejects alias that conflicts with existing command', () => {
      const result = aliasModule.setAlias('status', 'doctor');
      expect(result.success).toBe(false);
      expect(result.message).toContain('conflicts with existing command');
    });

    it('rejects alias with invalid characters', () => {
      const result = aliasModule.setAlias('my alias', 'test');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid alias name');
    });

    it('returns error when name is missing', () => {
      const result = aliasModule.setAlias(undefined, 'test');
      expect(result.success).toBe(false);
    });

    it('returns error when command is missing', () => {
      const result = aliasModule.setAlias('t', undefined);
      expect(result.success).toBe(false);
    });

    it('creates .aiox directory if absent', () => {
      aliasModule.setAlias('t', 'test');
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'aliases.yaml'))).toBe(true);
    });
  });

  describe('removeAlias', () => {
    it('deletes an existing alias', () => {
      aliasModule.setAlias('t', 'test');
      const result = aliasModule.removeAlias('t');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');

      const aliases = aliasModule.loadAliases();
      expect(aliases.t).toBeUndefined();
    });

    it('returns error for non-existent alias', () => {
      const result = aliasModule.removeAlias('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('returns error when name is missing', () => {
      const result = aliasModule.removeAlias(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe('resetAliases', () => {
    it('restores default aliases', () => {
      aliasModule.setAlias('custom', 'something');
      aliasModule.setAlias('x', 'experiment');
      const result = aliasModule.resetAliases();
      expect(result.success).toBe(true);

      const aliases = aliasModule.loadAliases();
      expect(aliases).toEqual(aliasModule.DEFAULT_ALIASES);
      expect(aliases.custom).toBeUndefined();
      expect(aliases.x).toBeUndefined();
    });
  });

  describe('resolveAlias', () => {
    it('returns mapped command for known alias', () => {
      aliasModule.setAlias('t', 'test');
      const resolved = aliasModule.resolveAlias('t');
      expect(resolved).toBe('test');
    });

    it('returns null for non-alias', () => {
      const resolved = aliasModule.resolveAlias('nonexistent');
      expect(resolved).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(aliasModule.resolveAlias(undefined)).toBeNull();
      expect(aliasModule.resolveAlias(null)).toBeNull();
      expect(aliasModule.resolveAlias('')).toBeNull();
    });

    it('resolves default aliases without file on disk', () => {
      const resolved = aliasModule.resolveAlias('s');
      expect(resolved).toBe('status');
    });
  });

  describe('conflict detection', () => {
    it('blocks all existing command names from being used as aliases', () => {
      const commands = ['help', 'agents', 'status', 'doctor', 'alias', 'workflow', 'install'];
      for (const cmd of commands) {
        const result = aliasModule.setAlias(cmd, 'something');
        expect(result.success).toBe(false);
        expect(result.message).toContain('conflicts');
      }
    });

    it('allows non-conflicting names', () => {
      const result = aliasModule.setAlias('x', 'experiment');
      expect(result.success).toBe(true);
    });
  });

  describe('YAML persistence', () => {
    it('persists and reloads aliases across module reloads', () => {
      aliasModule.setAlias('t', 'test');
      aliasModule.setAlias('w', 'workflow');

      // Force fresh module load
      const modulePath = require.resolve('../../.aiox-core/cli/commands/alias/index.js');
      delete require.cache[modulePath];
      const freshModule = require('../../.aiox-core/cli/commands/alias/index.js');

      const aliases = freshModule.loadAliases();
      expect(aliases.t).toBe('test');
      expect(aliases.w).toBe('workflow');
    });

    it('writes valid YAML format', () => {
      aliasModule.setAlias('t', 'test');
      const content = fs.readFileSync(path.join(tmpDir, '.aiox', 'aliases.yaml'), 'utf8');
      expect(content).toContain('# AIOX CLI Aliases');
      expect(content).toContain('aliases:');
      expect(content).toMatch(/^\s{2}t: test$/m);
    });
  });
});
