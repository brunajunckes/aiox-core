/**
 * Tests for Environment Variable Manager Command Module
 * @story 23.3 — Environment Variable Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-env-vars-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/env-vars/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/env-vars/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('env-vars command', () => {
  // ── parseEnvContent ───────────────────────────────────────────────────
  describe('parseEnvContent', () => {
    it('parses KEY=VALUE pairs', () => {
      const result = mod.parseEnvContent('FOO=bar\nBAZ=qux');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ key: 'FOO', value: 'bar', line: 1 });
      expect(result[1]).toEqual({ key: 'BAZ', value: 'qux', line: 2 });
    });

    it('strips double quotes', () => {
      const result = mod.parseEnvContent('FOO="bar baz"');
      expect(result[0].value).toBe('bar baz');
    });

    it('strips single quotes', () => {
      const result = mod.parseEnvContent("FOO='bar baz'");
      expect(result[0].value).toBe('bar baz');
    });

    it('ignores comments', () => {
      const result = mod.parseEnvContent('# comment\nFOO=bar');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('FOO');
    });

    it('ignores empty lines', () => {
      const result = mod.parseEnvContent('\n\nFOO=bar\n\n');
      expect(result).toHaveLength(1);
    });

    it('returns empty for empty input', () => {
      expect(mod.parseEnvContent('')).toEqual([]);
      expect(mod.parseEnvContent(null)).toEqual([]);
    });

    it('handles values with equals sign', () => {
      const result = mod.parseEnvContent('URL=http://example.com?a=1&b=2');
      expect(result[0].value).toBe('http://example.com?a=1&b=2');
    });
  });

  // ── findEnvFiles ──────────────────────────────────────────────────────
  describe('findEnvFiles', () => {
    it('finds .env files', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'A=1');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'A=');
      fs.writeFileSync(path.join(tmpDir, '.env.local'), 'A=2');
      const files = mod.findEnvFiles(tmpDir);
      expect(files).toHaveLength(3);
    });

    it('returns empty for no .env files', () => {
      fs.writeFileSync(path.join(tmpDir, 'index.js'), '');
      const files = mod.findEnvFiles(tmpDir);
      expect(files).toHaveLength(0);
    });
  });

  // ── listEnvVars ───────────────────────────────────────────────────────
  describe('listEnvVars', () => {
    it('lists vars from all .env files', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar\nBAZ=qux');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=\nBAZ=');
      const result = mod.listEnvVars({ cwd: tmpDir });
      expect(result.files['.env']).toHaveLength(2);
      expect(result.files['.env.example']).toHaveLength(2);
    });

    it('returns empty files for no .env', () => {
      const result = mod.listEnvVars({ cwd: tmpDir });
      expect(Object.keys(result.files)).toHaveLength(0);
    });
  });

  // ── checkEnvVars ──────────────────────────────────────────────────────
  describe('checkEnvVars', () => {
    it('reports missing vars', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=\nBAZ=\nQUX=');
      const result = mod.checkEnvVars({ cwd: tmpDir });
      expect(result.missing).toContain('BAZ');
      expect(result.missing).toContain('QUX');
      expect(result.valid).toBe(false);
    });

    it('reports extra vars', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar\nEXTRA=yes');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=');
      const result = mod.checkEnvVars({ cwd: tmpDir });
      expect(result.extra).toContain('EXTRA');
    });

    it('returns valid when all vars present', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar\nBAZ=qux');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=\nBAZ=');
      const result = mod.checkEnvVars({ cwd: tmpDir });
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('handles missing .env.example', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar');
      const result = mod.checkEnvVars({ cwd: tmpDir });
      expect(result.exampleExists).toBe(false);
    });
  });

  // ── diffEnvVars ───────────────────────────────────────────────────────
  describe('diffEnvVars', () => {
    it('identifies vars only in .env', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar\nEXTRA=yes');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=');
      const result = mod.diffEnvVars({ cwd: tmpDir });
      expect(result.onlyInEnv).toContain('EXTRA');
    });

    it('identifies vars only in .env.example', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=\nMISSING=');
      const result = mod.diffEnvVars({ cwd: tmpDir });
      expect(result.onlyInExample).toContain('MISSING');
    });

    it('identifies changed values', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=production');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=development');
      const result = mod.diffEnvVars({ cwd: tmpDir });
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].key).toBe('FOO');
    });

    it('identifies common keys', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'FOO=bar');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=bar');
      const result = mod.diffEnvVars({ cwd: tmpDir });
      expect(result.common).toContain('FOO');
      expect(result.changed).toHaveLength(0);
    });
  });

  // ── generateEnv ───────────────────────────────────────────────────────
  describe('generateEnv', () => {
    it('generates .env from .env.example', () => {
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=default\nBAR=');
      const result = mod.generateEnv({ cwd: tmpDir });
      expect(result.generated).toBe(true);
      expect(result.vars).toBe(2);
      expect(fs.existsSync(path.join(tmpDir, '.env'))).toBe(true);
    });

    it('refuses to overwrite existing .env', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'EXISTING=yes');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=default');
      const result = mod.generateEnv({ cwd: tmpDir });
      expect(result.generated).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('overwrites with overwrite option', () => {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'EXISTING=yes');
      fs.writeFileSync(path.join(tmpDir, '.env.example'), 'FOO=default');
      const result = mod.generateEnv({ cwd: tmpDir, overwrite: true });
      expect(result.generated).toBe(true);
    });

    it('fails when .env.example missing', () => {
      const result = mod.generateEnv({ cwd: tmpDir });
      expect(result.generated).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  // ── formatListText ────────────────────────────────────────────────────
  describe('formatListText', () => {
    it('formats with files', () => {
      const result = { files: { '.env': [{ key: 'FOO', value: 'bar', line: 1 }] } };
      const text = mod.formatListText(result);
      expect(text).toContain('Environment Variables');
      expect(text).toContain('.env');
      expect(text).toContain('FOO');
    });

    it('handles no files', () => {
      const result = { files: {} };
      const text = mod.formatListText(result);
      expect(text).toContain('No .env files found');
    });
  });

  // ── runEnvVars ────────────────────────────────────────────────────────
  describe('runEnvVars', () => {
    it('runs list by default', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runEnvVars([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runEnvVars(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });
  });
});
