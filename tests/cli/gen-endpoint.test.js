/**
 * Tests for API Endpoint Generator Command Module
 * @story 28.1 -- API Endpoint Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-gen-endpoint-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/gen-endpoint/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/gen-endpoint/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('gen-endpoint command', () => {
  // ── toCamelCase ─────────────────────────────────────────────────────────
  describe('toCamelCase', () => {
    it('converts hyphenated names', () => {
      expect(mod.toCamelCase('user-profile')).toBe('userProfile');
    });

    it('converts underscored names', () => {
      expect(mod.toCamelCase('user_profile')).toBe('userProfile');
    });

    it('returns empty string for null/undefined', () => {
      expect(mod.toCamelCase(null)).toBe('');
      expect(mod.toCamelCase(undefined)).toBe('');
    });

    it('handles single word', () => {
      expect(mod.toCamelCase('users')).toBe('users');
    });
  });

  // ── toPascalCase ────────────────────────────────────────────────────────
  describe('toPascalCase', () => {
    it('converts hyphenated names', () => {
      expect(mod.toPascalCase('user-profile')).toBe('UserProfile');
    });

    it('returns empty string for empty input', () => {
      expect(mod.toPascalCase('')).toBe('');
    });
  });

  // ── parseMethods ────────────────────────────────────────────────────────
  describe('parseMethods', () => {
    it('parses valid methods string', () => {
      expect(mod.parseMethods('GET,POST,PUT')).toEqual(['GET', 'POST', 'PUT']);
    });

    it('returns default for null', () => {
      expect(mod.parseMethods(null)).toEqual(['GET']);
    });

    it('returns default for empty string', () => {
      expect(mod.parseMethods('')).toEqual(['GET']);
    });

    it('filters invalid methods', () => {
      expect(mod.parseMethods('GET,INVALID,POST')).toEqual(['GET', 'POST']);
    });

    it('normalizes to uppercase', () => {
      expect(mod.parseMethods('get,post')).toEqual(['GET', 'POST']);
    });

    it('returns default when all invalid', () => {
      expect(mod.parseMethods('INVALID,BAD')).toEqual(['GET']);
    });
  });

  // ── getOutputDir ────────────────────────────────────────────────────────
  describe('getOutputDir', () => {
    it('returns default output dir', () => {
      const dir = mod.getOutputDir([]);
      expect(dir).toBe(path.resolve(tmpDir, 'generated', 'endpoints'));
    });

    it('uses custom --output dir', () => {
      const dir = mod.getOutputDir(['--output', '/custom/dir']);
      expect(dir).toBe('/custom/dir');
    });

    it('resolves relative --output dir', () => {
      const dir = mod.getOutputDir(['--output', 'my-dir']);
      expect(dir).toBe(path.resolve(tmpDir, 'my-dir'));
    });
  });

  // ── listEndpoints ──────────────────────────────────────────────────────
  describe('listEndpoints', () => {
    it('returns empty array for non-existent dir', () => {
      expect(mod.listEndpoints('/non/existent')).toEqual([]);
    });

    it('lists directories only', () => {
      const dir = path.join(tmpDir, 'eps');
      fs.mkdirSync(path.join(dir, 'users'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'posts'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'file.txt'), 'test');
      const list = mod.listEndpoints(dir);
      expect(list).toEqual(['posts', 'users']);
    });
  });

  // ── generateHandler ─────────────────────────────────────────────────────
  describe('generateHandler', () => {
    it('generates handler with single method', () => {
      const content = mod.generateHandler('users', ['GET']);
      expect(content).toContain("'use strict'");
      expect(content).toContain('handleGet');
      expect(content).toContain('module.exports');
    });

    it('generates handler with multiple methods', () => {
      const content = mod.generateHandler('users', ['GET', 'POST', 'DELETE']);
      expect(content).toContain('handleGet');
      expect(content).toContain('handlePost');
      expect(content).toContain('handleDelete');
    });

    it('includes endpoint name in response', () => {
      const content = mod.generateHandler('user-profile', ['GET']);
      expect(content).toContain('userProfile');
    });
  });

  // ── generateHandlerTest ─────────────────────────────────────────────────
  describe('generateHandlerTest', () => {
    it('generates test file with describe blocks', () => {
      const content = mod.generateHandlerTest('users', ['GET']);
      expect(content).toContain('describe');
      expect(content).toContain('handleGet');
    });

    it('generates tests for each method', () => {
      const content = mod.generateHandlerTest('users', ['GET', 'POST']);
      expect(content).toContain('handleGet');
      expect(content).toContain('handlePost');
    });
  });

  // ── runGenEndpoint ──────────────────────────────────────────────────────
  describe('runGenEndpoint', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint([]);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('Usage');
      spy.mockRestore();
    });

    it('shows help with --help flag', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('generates endpoint files', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint(['users']);
      const endpointDir = path.join(tmpDir, 'generated', 'endpoints', 'users');
      expect(fs.existsSync(path.join(endpointDir, 'handler.js'))).toBe(true);
      expect(fs.existsSync(path.join(endpointDir, 'handler.test.js'))).toBe(true);
      spy.mockRestore();
    });

    it('generates with custom methods', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint(['users', '--methods', 'GET,POST,DELETE']);
      const endpointDir = path.join(tmpDir, 'generated', 'endpoints', 'users');
      const handler = fs.readFileSync(path.join(endpointDir, 'handler.js'), 'utf8');
      expect(handler).toContain('handleGet');
      expect(handler).toContain('handlePost');
      expect(handler).toContain('handleDelete');
      spy.mockRestore();
    });

    it('generates with custom output dir', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const customDir = path.join(tmpDir, 'custom');
      mod.runGenEndpoint(['users', '--output', customDir]);
      expect(fs.existsSync(path.join(customDir, 'users', 'handler.js'))).toBe(true);
      spy.mockRestore();
    });

    it('lists endpoints with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint(['users']);
      spy.mockClear();
      mod.runGenEndpoint(['--list']);
      expect(spy).toHaveBeenCalledWith('Generated endpoints:');
      spy.mockRestore();
    });

    it('shows no endpoints message when empty', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenEndpoint(['--list']);
      expect(spy).toHaveBeenCalledWith('No generated endpoints found.');
      spy.mockRestore();
    });

    it('reports error for missing name with flag-like arg', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runGenEndpoint(['--methods', 'GET']);
      expect(spy).toHaveBeenCalledWith('Error: endpoint name is required');
      spy.mockRestore();
    });

    it('VALID_METHODS contains standard HTTP methods', () => {
      expect(mod.VALID_METHODS).toContain('GET');
      expect(mod.VALID_METHODS).toContain('POST');
      expect(mod.VALID_METHODS).toContain('PUT');
      expect(mod.VALID_METHODS).toContain('DELETE');
      expect(mod.VALID_METHODS).toContain('PATCH');
    });

    it('DEFAULT_METHODS is GET only', () => {
      expect(mod.DEFAULT_METHODS).toEqual(['GET']);
    });
  });
});
