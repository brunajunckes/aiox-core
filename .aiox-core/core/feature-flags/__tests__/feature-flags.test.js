/**
 * Feature Flags Module Tests
 *
 * @module core/feature-flags/__tests__/feature-flags.test.js
 */

const { createFeatureFlags } = require('../flags');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Feature Flags', () => {
  let tempDir;
  let flags;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-flags-test-'));
    flags = createFeatureFlags({ flagsDir: tempDir });
    // Clear env vars from previous tests
    delete process.env.AIOX_FLAG_TEST_FLAG;
    delete process.env.AIOX_FLAG_ENABLED;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    // Clean up env vars
    for (const key in process.env) {
      if (key.startsWith('AIOX_FLAG_')) {
        delete process.env[key];
      }
    }
  });

  describe('createFeatureFlags()', () => {
    it('should create feature flags manager with default options', () => {
      const mgr = createFeatureFlags({ flagsDir: tempDir });
      expect(mgr).toBeDefined();
      expect(mgr.setFlag).toBeDefined();
      expect(mgr.getFlag).toBeDefined();
    });

    it('should create flags directory if not exists', () => {
      const dir = path.join(tempDir, 'my', 'flags');
      createFeatureFlags({ flagsDir: dir });
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('should accept default values', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { featureA: true, featureB: false },
      });

      expect(mgr.getFlag('featureA')).toBe(true);
      expect(mgr.getFlag('featureB')).toBe(false);
    });
  });

  describe('setFlag()', () => {
    it('should set a boolean flag', () => {
      flags.setFlag('enabled', true);
      expect(flags.getFlag('enabled')).toBe(true);
    });

    it('should set a string flag', () => {
      flags.setFlag('version', '1.2.3');
      expect(flags.getFlag('version')).toBe('1.2.3');
    });

    it('should set a number flag', () => {
      flags.setFlag('maxRetries', 5);
      expect(flags.getFlag('maxRetries')).toBe(5);
    });

    it('should set null flag', () => {
      flags.setFlag('nullable', null);
      expect(flags.getFlag('nullable')).toBe(null);
    });

    it('should overwrite existing flag', () => {
      flags.setFlag('flag', 'v1');
      expect(flags.getFlag('flag')).toBe('v1');
      flags.setFlag('flag', 'v2');
      expect(flags.getFlag('flag')).toBe('v2');
    });

    it('should throw if name is invalid', () => {
      expect(() => flags.setFlag('', 'value')).toThrow('Flag name must be a non-empty string');
      expect(() => flags.setFlag(null, 'value')).toThrow('Flag name must be a non-empty string');
    });

    it('should persist to file', () => {
      flags.setFlag('test', 'value');
      const filePath = flags.getFlagsFilePath();
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.test).toBe('value');
    });
  });

  describe('getFlag()', () => {
    it('should get a set flag', () => {
      flags.setFlag('myFlag', 'myValue');
      expect(flags.getFlag('myFlag')).toBe('myValue');
    });

    it('should return undefined for unset flag', () => {
      expect(flags.getFlag('nonexistent')).toBeUndefined();
    });

    it('should return default value if flag not set', () => {
      expect(flags.getFlag('nonexistent', 'default')).toBe('default');
    });

    it('should return default from manager options', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { feature: 'enabled' },
      });
      expect(mgr.getFlag('feature')).toBe('enabled');
    });

    it('should throw if name is invalid', () => {
      expect(() => flags.getFlag('')).toThrow('Flag name must be a non-empty string');
      expect(() => flags.getFlag(null)).toThrow('Flag name must be a non-empty string');
    });
  });

  describe('environment variable overrides', () => {
    it('should override with AIOX_FLAG_* env var', () => {
      flags.setFlag('test_flag', false);
      process.env.AIOX_FLAG_TEST_FLAG = 'true';

      expect(flags.getFlag('test_flag')).toBe(true);
    });

    it('should parse boolean true from env', () => {
      process.env.AIOX_FLAG_ENABLED = 'true';
      expect(flags.getFlag('enabled')).toBe(true);
    });

    it('should parse boolean false from env', () => {
      process.env.AIOX_FLAG_ENABLED = 'false';
      expect(flags.getFlag('enabled')).toBe(false);
    });

    it('should parse number from env', () => {
      process.env.AIOX_FLAG_COUNT = '42';
      expect(flags.getFlag('count')).toBe(42);
    });

    it('should parse null from env', () => {
      process.env.AIOX_FLAG_NULL_VALUE = 'null';
      expect(flags.getFlag('null_value')).toBe(null);
    });

    it('should keep string values from env', () => {
      process.env.AIOX_FLAG_VERSION = '1.2.3';
      expect(flags.getFlag('version')).toBe('1.2.3');
    });

    it('should convert flag names to env format', () => {
      process.env.AIOX_FLAG_MY_FEATURE_FLAG = 'true';
      expect(flags.getFlag('my-feature-flag')).toBe(true);
    });

    it('env override takes precedence over file', () => {
      flags.setFlag('my_flag', 'fileValue');
      process.env.AIOX_FLAG_MY_FLAG = 'envValue';
      expect(flags.getFlag('my_flag')).toBe('envValue');
    });

    it('env override takes precedence over defaults', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { my_flag: 'default' },
      });
      process.env.AIOX_FLAG_MY_FLAG = 'envValue';
      expect(mgr.getFlag('my_flag')).toBe('envValue');
    });
  });

  describe('isEnabled()', () => {
    it('should return true if flag is true', () => {
      flags.setFlag('enabled', true);
      expect(flags.isEnabled('enabled')).toBe(true);
    });

    it('should return false if flag is false', () => {
      flags.setFlag('enabled', false);
      expect(flags.isEnabled('enabled')).toBe(false);
    });

    it('should return false for non-boolean values', () => {
      flags.setFlag('value', 'string');
      expect(flags.isEnabled('value')).toBe(false);

      flags.setFlag('value', 1);
      expect(flags.isEnabled('value')).toBe(false);
    });

    it('should return false for unset flag', () => {
      expect(flags.isEnabled('nonexistent')).toBe(false);
    });
  });

  describe('listFlags()', () => {
    it('should list all set flags', () => {
      flags.setFlag('flag1', 'value1');
      flags.setFlag('flag2', 'value2');

      const list = flags.listFlags();
      expect(list.flag1).toBe('value1');
      expect(list.flag2).toBe('value2');
    });

    it('should include defaults', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { defaultFlag: 'defaultValue' },
      });
      mgr.setFlag('customFlag', 'customValue');

      const list = mgr.listFlags();
      expect(list.defaultFlag).toBe('defaultValue');
      expect(list.customFlag).toBe('customValue');
    });

    it('should give precedence to file flags over defaults', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { flag: 'default' },
      });
      mgr.setFlag('flag', 'override');

      const list = mgr.listFlags();
      expect(list.flag).toBe('override');
    });

    it('should return empty object if no flags', () => {
      const list = flags.listFlags();
      expect(list).toEqual({});
    });
  });

  describe('deleteFlag()', () => {
    it('should delete a flag', () => {
      flags.setFlag('flag', 'value');
      expect(flags.getFlag('flag')).toBe('value');

      flags.deleteFlag('flag');
      expect(flags.getFlag('flag')).toBeUndefined();
    });

    it('should throw if flag not found', () => {
      expect(() => flags.deleteFlag('nonexistent')).toThrow('Flag not found');
    });

    it('should throw if name is invalid', () => {
      expect(() => flags.deleteFlag('')).toThrow('Flag name must be a non-empty string');
      expect(() => flags.deleteFlag(null)).toThrow('Flag name must be a non-empty string');
    });

    it('should persist to file', () => {
      flags.setFlag('flag', 'value');
      flags.deleteFlag('flag');

      const content = fs.readFileSync(flags.getFlagsFilePath(), 'utf-8');
      const data = JSON.parse(content);
      expect(data.flag).toBeUndefined();
    });
  });

  describe('toggleFlag()', () => {
    it('should toggle false to true', () => {
      flags.setFlag('flag', false);
      const result = flags.toggleFlag('flag');
      expect(result).toBe(true);
      expect(flags.getFlag('flag')).toBe(true);
    });

    it('should toggle true to false', () => {
      flags.setFlag('flag', true);
      const result = flags.toggleFlag('flag');
      expect(result).toBe(false);
      expect(flags.getFlag('flag')).toBe(false);
    });

    it('should toggle unset flag to true', () => {
      const result = flags.toggleFlag('newFlag');
      expect(result).toBe(true);
      expect(flags.getFlag('newFlag')).toBe(true);
    });

    it('should throw if name is invalid', () => {
      expect(() => flags.toggleFlag('')).toThrow('Flag name must be a non-empty string');
      expect(() => flags.toggleFlag(null)).toThrow('Flag name must be a non-empty string');
    });

    it('should persist to file', () => {
      flags.toggleFlag('flag');
      const content = fs.readFileSync(flags.getFlagsFilePath(), 'utf-8');
      const data = JSON.parse(content);
      expect(data.flag).toBe(true);
    });
  });

  describe('getOverrides()', () => {
    it('should return empty object if no overrides', () => {
      const overrides = flags.getOverrides();
      expect(overrides).toEqual({});
    });

    it('should return all env overrides', () => {
      flags.setFlag('flag1', 'fileValue1');
      flags.setFlag('flag2', 'fileValue2');

      process.env.AIOX_FLAG_FLAG1 = 'envValue1';
      process.env.AIOX_FLAG_FLAG2 = 'envValue2';

      const overrides = flags.getOverrides();
      expect(overrides.flag1).toBe('envValue1');
      expect(overrides.flag2).toBe('envValue2');
    });

    it('should include overrides from default flags', () => {
      const mgr = createFeatureFlags({
        flagsDir: tempDir,
        defaults: { default_flag: 'default' },
      });

      process.env.AIOX_FLAG_DEFAULT_FLAG = 'override';
      const overrides = mgr.getOverrides();
      expect(overrides.default_flag).toBe('override');
    });
  });

  describe('file persistence', () => {
    it('should read existing flags file', () => {
      const flagsPath = path.join(tempDir, 'feature-flags.json');
      fs.writeFileSync(flagsPath, JSON.stringify({ existing: 'value' }));

      const mgr = createFeatureFlags({ flagsDir: tempDir });
      expect(mgr.getFlag('existing')).toBe('value');
    });

    it('should handle invalid JSON file gracefully', () => {
      const flagsPath = path.join(tempDir, 'feature-flags.json');
      fs.writeFileSync(flagsPath, 'invalid json');

      const mgr = createFeatureFlags({ flagsDir: tempDir });
      expect(mgr.listFlags()).toEqual({});
    });

    it('should write flags in JSON format', () => {
      flags.setFlag('flag1', true);
      flags.setFlag('flag2', 'value');

      const content = fs.readFileSync(flags.getFlagsFilePath(), 'utf-8');
      const data = JSON.parse(content);

      expect(data.flag1).toBe(true);
      expect(data.flag2).toBe('value');
    });
  });

  describe('getFlagsFilePath()', () => {
    it('should return the flags file path', () => {
      const filePath = flags.getFlagsFilePath();
      expect(filePath).toContain('feature-flags.json');
    });
  });

  describe('edge cases', () => {
    it('should handle flag names with hyphens', () => {
      flags.setFlag('my-feature-flag', true);
      expect(flags.getFlag('my-feature-flag')).toBe(true);
    });

    it('should handle flag names with underscores', () => {
      flags.setFlag('my_feature_flag', true);
      expect(flags.getFlag('my_feature_flag')).toBe(true);
    });

    it('should handle mixed case flag names', () => {
      flags.setFlag('MyFeatureFlag', true);
      expect(flags.getFlag('MyFeatureFlag')).toBe(true);
    });

    it('should handle complex object values', () => {
      const obj = { nested: { deep: 'value' } };
      flags.setFlag('config', obj);
      expect(flags.getFlag('config')).toEqual(obj);
    });

    it('should handle array values', () => {
      const arr = [1, 2, 3];
      flags.setFlag('list', arr);
      expect(flags.getFlag('list')).toEqual(arr);
    });

    it('should handle empty string', () => {
      flags.setFlag('empty', '');
      expect(flags.getFlag('empty')).toBe('');
    });

    it('should handle zero', () => {
      flags.setFlag('zero', 0);
      expect(flags.getFlag('zero')).toBe(0);
    });
  });
});
