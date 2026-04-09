/**
 * Tests for Database Model Generator Command Module
 * @story 28.2 -- Database Model Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-gen-model-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/gen-model/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/gen-model/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('gen-model command', () => {
  // ── toPascalCase ────────────────────────────────────────────────────────
  describe('toPascalCase', () => {
    it('converts hyphenated names', () => {
      expect(mod.toPascalCase('user-profile')).toBe('UserProfile');
    });

    it('returns empty string for null', () => {
      expect(mod.toPascalCase(null)).toBe('');
    });
  });

  // ── toCamelCase ─────────────────────────────────────────────────────────
  describe('toCamelCase', () => {
    it('converts underscored names', () => {
      expect(mod.toCamelCase('user_profile')).toBe('userProfile');
    });

    it('returns empty for empty string', () => {
      expect(mod.toCamelCase('')).toBe('');
    });
  });

  // ── parseFields ─────────────────────────────────────────────────────────
  describe('parseFields', () => {
    it('parses valid fields string', () => {
      const fields = mod.parseFields('id:number,name:string,email:string');
      expect(fields).toEqual([
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ]);
    });

    it('returns empty for null', () => {
      expect(mod.parseFields(null)).toEqual([]);
    });

    it('returns empty for empty string', () => {
      expect(mod.parseFields('')).toEqual([]);
    });

    it('filters invalid types', () => {
      const fields = mod.parseFields('id:number,bad:unknown');
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('id');
    });

    it('filters entries without colon', () => {
      const fields = mod.parseFields('id:number,badentry');
      expect(fields).toHaveLength(1);
    });

    it('handles all valid types', () => {
      const fields = mod.parseFields('a:string,b:number,c:boolean,d:date,e:object,f:array');
      expect(fields).toHaveLength(6);
    });
  });

  // ── getDefaultValue ─────────────────────────────────────────────────────
  describe('getDefaultValue', () => {
    it('returns empty string for string type', () => {
      expect(mod.getDefaultValue('string')).toBe("''");
    });

    it('returns 0 for number type', () => {
      expect(mod.getDefaultValue('number')).toBe('0');
    });

    it('returns false for boolean type', () => {
      expect(mod.getDefaultValue('boolean')).toBe('false');
    });

    it('returns null for date type', () => {
      expect(mod.getDefaultValue('date')).toBe('null');
    });

    it('returns {} for object type', () => {
      expect(mod.getDefaultValue('object')).toBe('{}');
    });

    it('returns [] for array type', () => {
      expect(mod.getDefaultValue('array')).toBe('[]');
    });

    it('returns null for unknown type', () => {
      expect(mod.getDefaultValue('unknown')).toBe('null');
    });
  });

  // ── getValidator ────────────────────────────────────────────────────────
  describe('getValidator', () => {
    it('returns string validator', () => {
      expect(mod.getValidator('name', 'string')).toContain("typeof data.name === 'string'");
    });

    it('returns number validator', () => {
      expect(mod.getValidator('age', 'number')).toContain("typeof data.age === 'number'");
    });

    it('returns boolean validator', () => {
      expect(mod.getValidator('active', 'boolean')).toContain("typeof data.active === 'boolean'");
    });

    it('returns true for unknown type', () => {
      expect(mod.getValidator('x', 'unknown')).toBe('true');
    });
  });

  // ── listModels ──────────────────────────────────────────────────────────
  describe('listModels', () => {
    it('returns empty array for non-existent dir', () => {
      expect(mod.listModels('/non/existent')).toEqual([]);
    });

    it('lists directories', () => {
      const dir = path.join(tmpDir, 'models');
      fs.mkdirSync(path.join(dir, 'user'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'post'), { recursive: true });
      expect(mod.listModels(dir)).toEqual(['post', 'user']);
    });
  });

  // ── generateModel ──────────────────────────────────────────────────────
  describe('generateModel', () => {
    it('generates model with fields', () => {
      const content = mod.generateModel('user', [{ name: 'name', type: 'string' }], false);
      expect(content).toContain("'use strict'");
      expect(content).toContain('validate');
      expect(content).toContain('create');
      expect(content).toContain('module.exports');
    });

    it('includes timestamps when enabled', () => {
      const content = mod.generateModel('user', [], true);
      expect(content).toContain('createdAt');
      expect(content).toContain('updatedAt');
    });

    it('does not include timestamps when disabled', () => {
      const content = mod.generateModel('user', [{ name: 'name', type: 'string' }], false);
      expect(content).not.toContain('createdAt');
    });
  });

  // ── generateModelTest ──────────────────────────────────────────────────
  describe('generateModelTest', () => {
    it('generates test content', () => {
      const content = mod.generateModelTest('user', [{ name: 'name', type: 'string' }], false);
      expect(content).toContain('describe');
      expect(content).toContain('validate');
      expect(content).toContain('create');
    });
  });

  // ── runGenModel ─────────────────────────────────────────────────────────
  describe('runGenModel', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenModel([]);
      expect(spy.mock.calls[0][0]).toContain('Usage');
      spy.mockRestore();
    });

    it('generates model files', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenModel(['user', '--fields', 'id:number,name:string']);
      const modelDir = path.join(tmpDir, 'generated', 'models', 'user');
      expect(fs.existsSync(path.join(modelDir, 'model.js'))).toBe(true);
      expect(fs.existsSync(path.join(modelDir, 'model.test.js'))).toBe(true);
      spy.mockRestore();
    });

    it('generates with timestamps', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenModel(['user', '--fields', 'id:number', '--timestamps']);
      const modelDir = path.join(tmpDir, 'generated', 'models', 'user');
      const model = fs.readFileSync(path.join(modelDir, 'model.js'), 'utf8');
      expect(model).toContain('createdAt');
      expect(model).toContain('updatedAt');
      spy.mockRestore();
    });

    it('lists models with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenModel(['user', '--fields', 'id:number']);
      spy.mockClear();
      mod.runGenModel(['--list']);
      expect(spy).toHaveBeenCalledWith('Generated models:');
      spy.mockRestore();
    });

    it('shows no models message when empty', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenModel(['--list']);
      expect(spy).toHaveBeenCalledWith('No generated models found.');
      spy.mockRestore();
    });

    it('reports error for missing name', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runGenModel(['--fields', 'id:number']);
      expect(spy).toHaveBeenCalledWith('Error: model name is required');
      spy.mockRestore();
    });

    it('VALID_TYPES contains expected types', () => {
      expect(mod.VALID_TYPES).toContain('string');
      expect(mod.VALID_TYPES).toContain('number');
      expect(mod.VALID_TYPES).toContain('boolean');
    });
  });
});
