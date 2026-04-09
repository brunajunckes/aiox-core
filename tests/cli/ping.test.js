/**
 * Tests for Ping & Latency Command Module
 * @story 30.1 — Ping & Latency
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-ping-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/ping/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/ping/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ping command', () => {
  // ── parseArgs ─────────────────────────────────────────────────────────
  describe('parseArgs', () => {
    it('parses host as positional argument', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.host).toBe('example.com');
    });

    it('uses default port 80', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.port).toBe(mod.DEFAULT_PORT);
    });

    it('parses --port flag', () => {
      const opts = mod.parseArgs(['example.com', '--port', '443']);
      expect(opts.port).toBe(443);
    });

    it('parses --count flag', () => {
      const opts = mod.parseArgs(['example.com', '--count', '10']);
      expect(opts.count).toBe(10);
    });

    it('parses --timeout flag', () => {
      const opts = mod.parseArgs(['example.com', '--timeout', '3000']);
      expect(opts.timeout).toBe(3000);
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['example.com', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('returns null host for empty args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.host).toBeNull();
    });

    it('uses default count of 4', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.count).toBe(mod.DEFAULT_COUNT);
    });

    it('uses default timeout of 5000', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.timeout).toBe(mod.DEFAULT_TIMEOUT);
    });

    it('defaults format to text', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.format).toBe('text');
    });
  });

  // ── tcpPing ───────────────────────────────────────────────────────────
  describe('tcpPing', () => {
    let server;
    let serverPort;

    beforeEach((done) => {
      server = net.createServer((socket) => socket.end());
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        done();
      });
    });

    afterEach((done) => {
      server.close(done);
    });

    it('returns success and latency for open port', async () => {
      const result = await mod.tcpPing('127.0.0.1', serverPort, 5000);
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeNull();
    });

    it('returns failure for closed port', async () => {
      const result = await mod.tcpPing('127.0.0.1', 1, 1000);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('returns failure on timeout', async () => {
      // Use a non-routable address to trigger timeout
      const result = await mod.tcpPing('192.0.2.1', 80, 100);
      expect(result.success).toBe(false);
    });
  });

  // ── runPings ──────────────────────────────────────────────────────────
  describe('runPings', () => {
    let server;
    let serverPort;

    beforeEach((done) => {
      server = net.createServer((socket) => socket.end());
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        done();
      });
    });

    afterEach((done) => {
      server.close(done);
    });

    it('runs multiple pings and calculates stats', async () => {
      const stats = await mod.runPings('127.0.0.1', serverPort, 3, 5000);
      expect(stats.count).toBe(3);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.results).toHaveLength(3);
      expect(stats.min).toBeGreaterThanOrEqual(0);
      expect(stats.avg).toBeGreaterThanOrEqual(0);
      expect(stats.max).toBeGreaterThanOrEqual(stats.min);
    });

    it('calculates zero stats when all fail', async () => {
      const stats = await mod.runPings('192.0.2.1', 1, 1, 100);
      expect(stats.failed).toBe(1);
      expect(stats.avg).toBe(0);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats successful ping results', () => {
      const stats = {
        host: '127.0.0.1',
        port: 80,
        count: 2,
        successful: 2,
        failed: 0,
        min: 1,
        max: 5,
        avg: 3,
        results: [
          { success: true, latency: 1, error: null },
          { success: true, latency: 5, error: null },
        ],
      };
      const text = mod.formatText(stats);
      expect(text).toContain('TCP PING 127.0.0.1:80');
      expect(text).toContain('1ms');
      expect(text).toContain('OK');
      expect(text).toContain('min/avg/max');
    });

    it('formats failed ping results', () => {
      const stats = {
        host: '192.0.2.1',
        port: 80,
        count: 1,
        successful: 0,
        failed: 1,
        min: 0,
        max: 0,
        avg: 0,
        results: [
          { success: false, latency: 100, error: 'timeout' },
        ],
      };
      const text = mod.formatText(stats);
      expect(text).toContain('timeout');
      expect(text).toContain('0 ok, 1 failed');
      expect(text).not.toContain('min/avg/max');
    });
  });

  // ── formatJson ────────────────────────────────────────────────────────
  describe('formatJson', () => {
    it('returns valid JSON', () => {
      const stats = { host: '127.0.0.1', port: 80, results: [] };
      const json = mod.formatJson(stats);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('contains all stats fields', () => {
      const stats = { host: 'test', port: 443, count: 1, results: [] };
      const parsed = JSON.parse(mod.formatJson(stats));
      expect(parsed.host).toBe('test');
      expect(parsed.port).toBe(443);
    });
  });

  // ── runPing (integration) ─────────────────────────────────────────────
  describe('runPing', () => {
    it('prints error for missing host', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPing([]);
      expect(result.error).toBe('No host specified');
      spy.mockRestore();
    });

    it('prints error for invalid port', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPing(['host', '--port', '99999']);
      expect(result.error).toBe('Invalid port');
      spy.mockRestore();
    });

    it('prints error for invalid count', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPing(['host', '--count', '0']);
      expect(result.error).toBe('Invalid count');
      spy.mockRestore();
    });

    it('runs ping with json format', async () => {
      const server = net.createServer((s) => s.end());
      await new Promise(r => server.listen(0, '127.0.0.1', r));
      const port = server.address().port;

      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runPing(['127.0.0.1', '--port', String(port), '--count', '1', '--format', 'json']);
      expect(result.successful).toBe(1);
      const output = logSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      logSpy.mockRestore();
      await new Promise(r => server.close(r));
    });

    it('handles null argv', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPing(null);
      expect(result.error).toBe('No host specified');
      spy.mockRestore();
    });
  });

  // ── Constants ─────────────────────────────────────────────────────────
  describe('constants', () => {
    it('exports DEFAULT_PORT', () => {
      expect(mod.DEFAULT_PORT).toBe(80);
    });

    it('exports DEFAULT_COUNT', () => {
      expect(mod.DEFAULT_COUNT).toBe(4);
    });

    it('exports DEFAULT_TIMEOUT', () => {
      expect(mod.DEFAULT_TIMEOUT).toBe(5000);
    });
  });
});
