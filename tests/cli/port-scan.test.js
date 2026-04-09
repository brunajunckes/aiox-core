/**
 * Tests for Port Scanner Command Module
 * @story 30.3 — Port Scanner
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-port-scan-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/port-scan/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/port-scan/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('port-scan command', () => {
  // ── parseArgs ─────────────────────────────────────────────────────────
  describe('parseArgs', () => {
    it('parses host as positional argument', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.host).toBe('example.com');
    });

    it('parses --range flag', () => {
      const opts = mod.parseArgs(['example.com', '--range', '1-100']);
      expect(opts.range).toBe('1-100');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['example.com', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --timeout flag', () => {
      const opts = mod.parseArgs(['example.com', '--timeout', '500']);
      expect(opts.timeout).toBe(500);
    });

    it('returns null host for empty args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.host).toBeNull();
    });

    it('defaults range to null', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.range).toBeNull();
    });

    it('defaults format to text', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.format).toBe('text');
    });
  });

  // ── parseRange ────────────────────────────────────────────────────────
  describe('parseRange', () => {
    it('parses valid range', () => {
      const ports = mod.parseRange('1-5');
      expect(ports).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses single port range', () => {
      const ports = mod.parseRange('80-80');
      expect(ports).toEqual([80]);
    });

    it('returns null for null input', () => {
      expect(mod.parseRange(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(mod.parseRange('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(mod.parseRange('abc')).toBeNull();
    });

    it('returns null for reversed range', () => {
      expect(mod.parseRange('100-1')).toBeNull();
    });

    it('returns null for port 0', () => {
      expect(mod.parseRange('0-10')).toBeNull();
    });

    it('returns null for port > 65535', () => {
      expect(mod.parseRange('1-70000')).toBeNull();
    });
  });

  // ── checkPort ─────────────────────────────────────────────────────────
  describe('checkPort', () => {
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

    it('reports open port', async () => {
      const result = await mod.checkPort('127.0.0.1', serverPort, 5000);
      expect(result.open).toBe(true);
      expect(result.port).toBe(serverPort);
      expect(result.error).toBeNull();
    });

    it('reports closed port', async () => {
      const result = await mod.checkPort('127.0.0.1', 1, 1000);
      expect(result.open).toBe(false);
    });
  });

  // ── scanPorts ─────────────────────────────────────────────────────────
  describe('scanPorts', () => {
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

    it('scans ports and returns summary', async () => {
      const closedPort = serverPort + 1000 > 65535 ? serverPort - 1000 : serverPort + 1000;
      const stats = await mod.scanPorts('127.0.0.1', [serverPort, closedPort], 1000);
      expect(stats.host).toBe('127.0.0.1');
      expect(stats.scanned).toBe(2);
      expect(stats.results).toHaveLength(2);
      expect(stats.openPorts).toContain(serverPort);
    });

    it('returns all closed for unreachable', async () => {
      const stats = await mod.scanPorts('127.0.0.1', [1], 200);
      expect(stats.open).toBe(0);
      expect(stats.closed).toBe(1);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats scan results', () => {
      const stats = {
        host: '127.0.0.1',
        scanned: 2,
        open: 1,
        closed: 1,
        results: [
          { port: 80, open: true, error: null },
          { port: 443, open: false, error: 'timeout' },
        ],
        openPorts: [80],
      };
      const text = mod.formatText(stats);
      expect(text).toContain('PORT SCAN 127.0.0.1');
      expect(text).toContain('OPEN');
      expect(text).toContain('CLOSED');
      expect(text).toContain('1 open, 1 closed');
    });
  });

  // ── formatJson ────────────────────────────────────────────────────────
  describe('formatJson', () => {
    it('returns valid JSON', () => {
      const stats = { host: '127.0.0.1', results: [] };
      expect(() => JSON.parse(mod.formatJson(stats))).not.toThrow();
    });
  });

  // ── runPortScan (integration) ─────────────────────────────────────────
  describe('runPortScan', () => {
    it('prints error for missing host', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPortScan([]);
      expect(result.error).toBe('No host specified');
      spy.mockRestore();
    });

    it('prints error for invalid range', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPortScan(['host', '--range', 'bad']);
      expect(result.error).toBe('Invalid range');
      spy.mockRestore();
    });

    it('handles null argv', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runPortScan(null);
      expect(result.error).toBe('No host specified');
      spy.mockRestore();
    });

    it('uses common ports by default', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runPortScan(['127.0.0.1', '--timeout', '200']);
      expect(result.scanned).toBe(mod.COMMON_PORTS.length);
      logSpy.mockRestore();
    });

    it('outputs JSON format', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runPortScan(['127.0.0.1', '--range', '1-3', '--timeout', '200', '--format', 'json']);
      const output = logSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      logSpy.mockRestore();
    });
  });

  // ── Constants ─────────────────────────────────────────────────────────
  describe('constants', () => {
    it('exports COMMON_PORTS', () => {
      expect(mod.COMMON_PORTS).toEqual([22, 80, 443, 3000, 5432, 8080]);
    });

    it('exports DEFAULT_TIMEOUT', () => {
      expect(mod.DEFAULT_TIMEOUT).toBe(2000);
    });
  });
});
