/**
 * Tests for HTTP Health Checker Command Module
 * @story 30.2 — HTTP Health Checker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-http-check-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/http-check/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/http-check/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('http-check command', () => {
  // ── parseArgs ─────────────────────────────────────────────────────────
  describe('parseArgs', () => {
    it('parses url as positional argument', () => {
      const opts = mod.parseArgs(['http://example.com']);
      expect(opts.url).toBe('http://example.com');
    });

    it('parses --expect flag', () => {
      const opts = mod.parseArgs(['http://example.com', '--expect', '200']);
      expect(opts.expect).toBe(200);
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['http://example.com', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --headers flag', () => {
      const opts = mod.parseArgs(['http://example.com', '--headers']);
      expect(opts.headers).toBe(true);
    });

    it('parses --timeout flag', () => {
      const opts = mod.parseArgs(['http://example.com', '--timeout', '5000']);
      expect(opts.timeout).toBe(5000);
    });

    it('returns null url for empty args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.url).toBeNull();
    });

    it('defaults format to text', () => {
      const opts = mod.parseArgs(['http://example.com']);
      expect(opts.format).toBe('text');
    });

    it('defaults headers to false', () => {
      const opts = mod.parseArgs(['http://example.com']);
      expect(opts.headers).toBe(false);
    });

    it('defaults expect to null', () => {
      const opts = mod.parseArgs(['http://example.com']);
      expect(opts.expect).toBeNull();
    });
  });

  // ── parseUrl ──────────────────────────────────────────────────────────
  describe('parseUrl', () => {
    it('parses http URL', () => {
      const parsed = mod.parseUrl('http://example.com/path?q=1');
      expect(parsed.protocol).toBe('http:');
      expect(parsed.hostname).toBe('example.com');
      expect(parsed.path).toBe('/path?q=1');
    });

    it('parses https URL with default port', () => {
      const parsed = mod.parseUrl('https://example.com');
      expect(parsed.port).toBe(443);
    });

    it('parses http URL with default port', () => {
      const parsed = mod.parseUrl('http://example.com');
      expect(parsed.port).toBe(80);
    });

    it('parses explicit port', () => {
      const parsed = mod.parseUrl('http://example.com:3000');
      expect(parsed.port).toBe('3000');
    });

    it('returns null for invalid URL', () => {
      expect(mod.parseUrl('not-a-url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(mod.parseUrl('')).toBeNull();
    });
  });

  // ── httpCheck ─────────────────────────────────────────────────────────
  describe('httpCheck', () => {
    let server;
    let baseUrl;

    beforeEach((done) => {
      server = http.createServer((req, res) => {
        if (req.url === '/ok') {
          res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Test': 'hello' });
          res.end('OK');
        } else if (req.url === '/error') {
          res.writeHead(500);
          res.end('Error');
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    afterEach((done) => {
      server.close(done);
    });

    it('returns success with status code for valid URL', async () => {
      const result = await mod.httpCheck(`${baseUrl}/ok`, 5000);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('returns 500 status code for error endpoint', async () => {
      const result = await mod.httpCheck(`${baseUrl}/error`, 5000);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(500);
    });

    it('returns response headers', async () => {
      const result = await mod.httpCheck(`${baseUrl}/ok`, 5000);
      expect(result.headers['x-test']).toBe('hello');
    });

    it('returns body size', async () => {
      const result = await mod.httpCheck(`${baseUrl}/ok`, 5000);
      expect(result.bodySize).toBe(2); // "OK"
    });

    it('returns failure for invalid URL', async () => {
      const result = await mod.httpCheck('not-a-url', 5000);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL');
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats successful result', () => {
      const result = {
        success: true,
        url: 'http://example.com',
        statusCode: 200,
        statusMessage: 'OK',
        responseTime: 42,
        bodySize: 100,
        headers: {},
      };
      const text = mod.formatText(result, false);
      expect(text).toContain('OK');
      expect(text).toContain('200');
      expect(text).toContain('42ms');
    });

    it('formats failed result', () => {
      const result = {
        success: false,
        url: 'http://example.com',
        error: 'Connection refused',
      };
      const text = mod.formatText(result, false);
      expect(text).toContain('FAIL');
      expect(text).toContain('Connection refused');
    });

    it('shows headers when requested', () => {
      const result = {
        success: true,
        url: 'http://example.com',
        statusCode: 200,
        statusMessage: 'OK',
        responseTime: 10,
        bodySize: 50,
        headers: { 'content-type': 'text/html', 'x-custom': 'val' },
      };
      const text = mod.formatText(result, true);
      expect(text).toContain('Headers:');
      expect(text).toContain('content-type: text/html');
    });

    it('shows FAIL indicator for 4xx/5xx', () => {
      const result = {
        success: true,
        url: 'http://example.com',
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        responseTime: 10,
        bodySize: 0,
        headers: {},
      };
      const text = mod.formatText(result, false);
      expect(text).toContain('FAIL');
    });
  });

  // ── formatJson ────────────────────────────────────────────────────────
  describe('formatJson', () => {
    it('returns valid JSON', () => {
      const result = { success: true, url: 'http://test.com', statusCode: 200 };
      expect(() => JSON.parse(mod.formatJson(result))).not.toThrow();
    });
  });

  // ── runHttpCheck (integration) ────────────────────────────────────────
  describe('runHttpCheck', () => {
    it('prints error for missing URL', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runHttpCheck([]);
      expect(result.error).toBe('No URL specified');
      spy.mockRestore();
    });

    it('handles null argv', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runHttpCheck(null);
      expect(result.error).toBe('No URL specified');
      spy.mockRestore();
    });

    it('sets exit code on expect mismatch', async () => {
      const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
      await new Promise(r => server.listen(0, '127.0.0.1', r));
      const port = server.address().port;

      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      process.exitCode = 0;
      const result = await mod.runHttpCheck([`http://127.0.0.1:${port}`, '--expect', '200']);
      expect(result.expectMismatch).toBe(true);
      expect(process.exitCode).toBe(1);
      logSpy.mockRestore();
      process.exitCode = 0;
      await new Promise(r => server.close(r));
    });

    it('outputs JSON format', async () => {
      const server = http.createServer((req, res) => { res.writeHead(200); res.end('hi'); });
      await new Promise(r => server.listen(0, '127.0.0.1', r));
      const port = server.address().port;

      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      await mod.runHttpCheck([`http://127.0.0.1:${port}`, '--format', 'json']);
      const output = logSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.statusCode).toBe(200);
      logSpy.mockRestore();
      await new Promise(r => server.close(r));
    });
  });

  // ── Constants ─────────────────────────────────────────────────────────
  describe('constants', () => {
    it('exports DEFAULT_TIMEOUT', () => {
      expect(mod.DEFAULT_TIMEOUT).toBe(10000);
    });
  });
});
