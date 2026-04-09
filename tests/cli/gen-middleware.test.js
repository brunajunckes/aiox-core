/**
 * Tests for Middleware Generator Command Module
 * @story 28.3 -- Middleware Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-gen-mw-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/gen-middleware/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/gen-middleware/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('gen-middleware command', () => {
  // ── toPascalCase ────────────────────────────────────────────────────────
  describe('toPascalCase', () => {
    it('converts hyphenated names', () => {
      expect(mod.toPascalCase('rate-limiter')).toBe('RateLimiter');
    });

    it('returns empty for null', () => {
      expect(mod.toPascalCase(null)).toBe('');
    });
  });

  // ── toCamelCase ─────────────────────────────────────────────────────────
  describe('toCamelCase', () => {
    it('converts names correctly', () => {
      expect(mod.toCamelCase('rate-limiter')).toBe('rateLimiter');
    });

    it('returns empty for empty string', () => {
      expect(mod.toCamelCase('')).toBe('');
    });
  });

  // ── parseType ───────────────────────────────────────────────────────────
  describe('parseType', () => {
    it('returns valid type', () => {
      expect(mod.parseType('auth')).toBe('auth');
      expect(mod.parseType('logging')).toBe('logging');
      expect(mod.parseType('validation')).toBe('validation');
      expect(mod.parseType('cors')).toBe('cors');
    });

    it('returns generic for null', () => {
      expect(mod.parseType(null)).toBe('generic');
    });

    it('returns generic for invalid type', () => {
      expect(mod.parseType('invalid')).toBe('generic');
    });

    it('normalizes case', () => {
      expect(mod.parseType('AUTH')).toBe('auth');
      expect(mod.parseType('Logging')).toBe('logging');
    });
  });

  // ── getOutputDir ────────────────────────────────────────────────────────
  describe('getOutputDir', () => {
    it('returns default output dir', () => {
      const dir = mod.getOutputDir([]);
      expect(dir).toBe(path.resolve(tmpDir, 'generated', 'middlewares'));
    });

    it('uses custom --output dir', () => {
      const dir = mod.getOutputDir(['--output', '/custom']);
      expect(dir).toBe('/custom');
    });
  });

  // ── listMiddlewares ────────────────────────────────────────────────────
  describe('listMiddlewares', () => {
    it('returns empty for non-existent dir', () => {
      expect(mod.listMiddlewares('/non/existent')).toEqual([]);
    });

    it('lists directories', () => {
      const dir = path.join(tmpDir, 'mw');
      fs.mkdirSync(path.join(dir, 'auth'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'cors'), { recursive: true });
      expect(mod.listMiddlewares(dir)).toEqual(['auth', 'cors']);
    });
  });

  // ── getMiddlewareBody ──────────────────────────────────────────────────
  describe('getMiddlewareBody', () => {
    it('generates auth body', () => {
      const body = mod.getMiddlewareBody('auth');
      expect(body).toContain('authorization');
      expect(body).toContain('401');
    });

    it('generates logging body', () => {
      const body = mod.getMiddlewareBody('logging');
      expect(body).toContain('Date.now');
    });

    it('generates validation body', () => {
      const body = mod.getMiddlewareBody('validation');
      expect(body).toContain('400');
    });

    it('generates cors body', () => {
      const body = mod.getMiddlewareBody('cors');
      expect(body).toContain('Access-Control');
    });

    it('generates generic body with next()', () => {
      const body = mod.getMiddlewareBody('generic');
      expect(body).toContain('next()');
    });
  });

  // ── generateMiddleware ─────────────────────────────────────────────────
  describe('generateMiddleware', () => {
    it('generates middleware with auth type', () => {
      const content = mod.generateMiddleware('auth-check', 'auth');
      expect(content).toContain("'use strict'");
      expect(content).toContain('authCheck');
      expect(content).toContain('module.exports');
      expect(content).toContain('authorization');
    });

    it('generates middleware with cors type', () => {
      const content = mod.generateMiddleware('cors-handler', 'cors');
      expect(content).toContain('corsHandler');
      expect(content).toContain('Access-Control');
    });

    it('generates generic middleware', () => {
      const content = mod.generateMiddleware('custom', 'generic');
      expect(content).toContain('custom');
      expect(content).toContain('next()');
    });
  });

  // ── generateMiddlewareTest ─────────────────────────────────────────────
  describe('generateMiddlewareTest', () => {
    it('generates test for auth type', () => {
      const content = mod.generateMiddlewareTest('auth-check', 'auth');
      expect(content).toContain('describe');
      expect(content).toContain('401');
    });

    it('generates test for validation type', () => {
      const content = mod.generateMiddlewareTest('validator', 'validation');
      expect(content).toContain('400');
    });

    it('generates test for cors type', () => {
      const content = mod.generateMiddlewareTest('cors-mw', 'cors');
      expect(content).toContain('OPTIONS');
    });

    it('generates test for generic type', () => {
      const content = mod.generateMiddlewareTest('custom', 'generic');
      expect(content).toContain('next');
    });
  });

  // ── runGenMiddleware ───────────────────────────────────────────────────
  describe('runGenMiddleware', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware([]);
      expect(spy.mock.calls[0][0]).toContain('Usage');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('generates middleware files', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware(['auth-guard']);
      const mwDir = path.join(tmpDir, 'generated', 'middlewares', 'auth-guard');
      expect(fs.existsSync(path.join(mwDir, 'middleware.js'))).toBe(true);
      expect(fs.existsSync(path.join(mwDir, 'middleware.test.js'))).toBe(true);
      spy.mockRestore();
    });

    it('generates with specific type', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware(['my-auth', '--type', 'auth']);
      const mwDir = path.join(tmpDir, 'generated', 'middlewares', 'my-auth');
      const content = fs.readFileSync(path.join(mwDir, 'middleware.js'), 'utf8');
      expect(content).toContain('authorization');
      spy.mockRestore();
    });

    it('lists middlewares with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware(['test-mw']);
      spy.mockClear();
      mod.runGenMiddleware(['--list']);
      expect(spy).toHaveBeenCalledWith('Generated middlewares:');
      spy.mockRestore();
    });

    it('shows no middlewares message', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runGenMiddleware(['--list']);
      expect(spy).toHaveBeenCalledWith('No generated middlewares found.');
      spy.mockRestore();
    });

    it('reports error for missing name', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runGenMiddleware(['--type', 'auth']);
      expect(spy).toHaveBeenCalledWith('Error: middleware name is required');
      spy.mockRestore();
    });

    it('VALID_TYPES contains all types', () => {
      expect(mod.VALID_TYPES).toContain('auth');
      expect(mod.VALID_TYPES).toContain('logging');
      expect(mod.VALID_TYPES).toContain('validation');
      expect(mod.VALID_TYPES).toContain('cors');
      expect(mod.VALID_TYPES).toContain('generic');
    });

    it('DEFAULT_TYPE is generic', () => {
      expect(mod.DEFAULT_TYPE).toBe('generic');
    });
  });
});
