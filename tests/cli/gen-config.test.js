/**
 * Tests for Config Schema Generator Command Module
 * @story 28.4 -- Config Schema Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-gen-config-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/gen-config/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/gen-config/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('gen-config command', () => {
  // ── toPascalCase ────────────────────────────────────────────────────────
  describe('toPascalCase', () => {
    it('converts hyphenated names', () => {
      expect(mod.toPascalCase('app-config')).toBe('AppConfig');
    });

    it('returns empty for null', () => {
      expect(mod.toPascalCase(null)).toBe('');
    });
  });

  // ── toEnvKey ────────────────────────────────────────────────────────────
  describe('toEnvKey', () => {
    it('converts camelCase to SCREAMING_SNAKE', () => {
      expect(mod.toEnvKey('appConfig')).toBe('APP_CONFIG');
    });

    it('converts hyphenated to SCREAMING_SNAKE', () => {
      expect(mod.toEnvKey('my-app')).toBe('MY_APP');
    });

    it('returns empty for null', () => {
      expect(mod.toEnvKey(null)).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(mod.toEnvKey('')).toBe('');
    });

    it('handles already uppercase', () => {
      expect(mod.toEnvKey('PORT')).toBe('PORT');
    });
  });

  // ── parseFields ─────────────────────────────────────────────────────────
  describe('parseFields', () => {
    it('parses fields with defaults', () => {
      const fields = mod.parseFields('port:number:3000,host:string:localhost');
      expect(fields).toEqual([
        { name: 'port', type: 'number', defaultValue: '3000' },
        { name: 'host', type: 'string', defaultValue: 'localhost' },
      ]);
    });

    it('parses fields without defaults', () => {
      const fields = mod.parseFields('name:string,count:number');
      expect(fields).toEqual([
        { name: 'name', type: 'string', defaultValue: '' },
        { name: 'count', type: 'number', defaultValue: '' },
      ]);
    });

    it('returns empty for null', () => {
      expect(mod.parseFields(null)).toEqual([]);
    });

    it('returns empty for empty string', () => {
      expect(mod.parseFields('')).toEqual([]);
    });

    it('filters invalid types', () => {
      const fields = mod.parseFields('port:number,bad:unknown');
      expect(fields).toHaveLength(1);
    });

    it('handles boolean fields', () => {
      const fields = mod.parseFields('debug:boolean:true');
      expect(fields[0]).toEqual({ name: 'debug', type: 'boolean', defaultValue: 'true' });
    });
  });

  // ── getTypedDefault ─────────────────────────────────────────────────────
  describe('getTypedDefault', () => {
    it('returns quoted string for string type', () => {
      expect(mod.getTypedDefault('string', 'hello')).toBe("'hello'");
    });

    it('returns number for number type', () => {
      expect(mod.getTypedDefault('number', '3000')).toBe('3000');
    });

    it('returns true/false for boolean type', () => {
      expect(mod.getTypedDefault('boolean', 'true')).toBe('true');
      expect(mod.getTypedDefault('boolean', 'false')).toBe('false');
    });

    it('returns defaults when no value provided', () => {
      expect(mod.getTypedDefault('string', '')).toBe("''");
      expect(mod.getTypedDefault('number', '')).toBe('0');
      expect(mod.getTypedDefault('boolean', '')).toBe('false');
    });
  });

  // ── getOutputDir ────────────────────────────────────────────────────────
  describe('getOutputDir', () => {
    it('returns default output dir', () => {
      const dir = mod.getOutputDir([]);
      expect(dir).toBe(path.resolve(tmpDir, 'generated', 'configs'));
    });

    it('uses custom --output dir', () => {
      const dir = mod.getOutputDir(['--output', '/custom']);
      expect(dir).toBe('/custom');
    });
  });

  // ── listConfigs ─────────────────────────────────────────────────────────
  describe('listConfigs', () => {
    it('returns empty for non-existent dir', () => {
      expect(mod.listConfigs('/non/existent')).toEqual([]);
    });

    it('lists directories', () => {
      const dir = path.join(tmpDir, 'cfgs');
      fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'db'), { recursive: true });
      expect(mod.listConfigs(dir)).toEqual(['app', 'db']);
    });
  });

  // ── generateConfig ─────────────────────────────────────────────────────
  describe('generateConfig', () => {
    it('generates config with fields', () => {
      const content = mod.generateConfig('app', [
        { name: 'port', type: 'number', defaultValue: '3000' },
        { name: 'host', type: 'string', defaultValue: 'localhost' },
      ], false);
      expect(content).toContain("'use strict'");
      expect(content).toContain('getDefaults');
      expect(content).toContain('validate');
      expect(content).toContain('load');
      expect(content).toContain('3000');
      expect(content).toContain('localhost');
    });

    it('generates env-aware config', () => {
      const content = mod.generateConfig('app', [
        { name: 'port', type: 'number', defaultValue: '3000' },
      ], true);
      expect(content).toContain('process.env');
      expect(content).toContain('APP_PORT');
    });

    it('generates config without env', () => {
      const content = mod.generateConfig('app', [
        { name: 'port', type: 'number', defaultValue: '3000' },
      ], false);
      expect(content).not.toContain('process.env');
    });
  });

  // ── generateConfigTest ─────────────────────────────────────────────────
  describe('generateConfigTest', () => {
    it('generates test content', () => {
      const content = mod.generateConfigTest('app', [
        { name: 'port', type: 'number', defaultValue: '3000' },
      ], false);
      expect(content).toContain('describe');
      expect(content).toContain('getDefaults');
      expect(content).toContain('validate');
      expect(content).toContain('load');
    });

    it('includes env tests when useEnv is true', () => {
      const content = mod.generateConfigTest('app', [
        { name: 'port', type: 'number', defaultValue: '3000' },
      ], true);
      expect(content).toContain('environment');
    });
  });

  // ── runGenConfig ────────────────────────────────────────────────────────
  describe('runGenConfig', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig([]);
      expect(spy.mock.calls[0][0]).toContain('Usage');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('generates config files', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig(['app', '--fields', 'port:number:3000,host:string:localhost']);
      const cfgDir = path.join(tmpDir, 'generated', 'configs', 'app');
      expect(fs.existsSync(path.join(cfgDir, 'config.js'))).toBe(true);
      expect(fs.existsSync(path.join(cfgDir, 'config.test.js'))).toBe(true);
      spy.mockRestore();
    });

    it('generates with --env flag', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig(['app', '--fields', 'port:number:3000', '--env']);
      const cfgDir = path.join(tmpDir, 'generated', 'configs', 'app');
      const content = fs.readFileSync(path.join(cfgDir, 'config.js'), 'utf8');
      expect(content).toContain('process.env');
      spy.mockRestore();
    });

    it('lists configs with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig(['app', '--fields', 'port:number:3000']);
      spy.mockClear();
      mod.runGenConfig(['--list']);
      expect(spy).toHaveBeenCalledWith('Generated configs:');
      spy.mockRestore();
    });

    it('shows no configs message', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenConfig(['--list']);
      expect(spy).toHaveBeenCalledWith('No generated configs found.');
      spy.mockRestore();
    });

    it('reports error for missing name', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runGenConfig(['--fields', 'port:number']);
      expect(spy).toHaveBeenCalledWith('Error: config name is required');
      spy.mockRestore();
    });

    it('VALID_TYPES contains expected types', () => {
      expect(mod.VALID_TYPES).toContain('string');
      expect(mod.VALID_TYPES).toContain('number');
      expect(mod.VALID_TYPES).toContain('boolean');
    });
  });
});
