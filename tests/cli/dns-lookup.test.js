/**
 * Tests for DNS Lookup Command Module
 * @story 30.4 — DNS Lookup
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-dns-lookup-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/dns-lookup/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/dns-lookup/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('dns-lookup command', () => {
  // ── parseArgs ─────────────────────────────────────────────────────────
  describe('parseArgs', () => {
    it('parses domain as positional argument', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.domain).toBe('example.com');
    });

    it('parses --type flag and uppercases', () => {
      const opts = mod.parseArgs(['example.com', '--type', 'mx']);
      expect(opts.type).toBe('MX');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['example.com', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --all flag', () => {
      const opts = mod.parseArgs(['example.com', '--all']);
      expect(opts.all).toBe(true);
    });

    it('returns null domain for empty args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.domain).toBeNull();
    });

    it('defaults type to null', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.type).toBeNull();
    });

    it('defaults format to text', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.format).toBe('text');
    });

    it('defaults all to false', () => {
      const opts = mod.parseArgs(['example.com']);
      expect(opts.all).toBe(false);
    });
  });

  // ── resolveType ───────────────────────────────────────────────────────
  describe('resolveType', () => {
    it('resolves A records for localhost', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['127.0.0.1']);
      const result = await mod.resolveType('localhost', 'A');
      expect(result.type).toBe('A');
      expect(result.records).toEqual(['127.0.0.1']);
      expect(result.error).toBeNull();
    });

    it('resolves AAAA records', async () => {
      jest.spyOn(dns.promises, 'resolve6').mockResolvedValue(['::1']);
      const result = await mod.resolveType('localhost', 'AAAA');
      expect(result.records).toEqual(['::1']);
    });

    it('resolves MX records', async () => {
      jest.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
      const result = await mod.resolveType('example.com', 'MX');
      expect(result.records[0].exchange).toBe('mail.example.com');
    });

    it('resolves NS records', async () => {
      jest.spyOn(dns.promises, 'resolveNs').mockResolvedValue(['ns1.example.com']);
      const result = await mod.resolveType('example.com', 'NS');
      expect(result.records).toEqual(['ns1.example.com']);
    });

    it('resolves TXT records', async () => {
      jest.spyOn(dns.promises, 'resolveTxt').mockResolvedValue([['v=spf1 include:example.com']]);
      const result = await mod.resolveType('example.com', 'TXT');
      expect(result.records).toHaveLength(1);
    });

    it('resolves CNAME records', async () => {
      jest.spyOn(dns.promises, 'resolveCname').mockResolvedValue(['alias.example.com']);
      const result = await mod.resolveType('www.example.com', 'CNAME');
      expect(result.records).toEqual(['alias.example.com']);
    });

    it('resolves SOA records', async () => {
      jest.spyOn(dns.promises, 'resolveSoa').mockResolvedValue({ nsname: 'ns1.example.com', hostmaster: 'admin.example.com' });
      const result = await mod.resolveType('example.com', 'SOA');
      expect(result.records[0].nsname).toBe('ns1.example.com');
    });

    it('resolves SRV records', async () => {
      jest.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([{ name: 'sip.example.com', port: 5060, priority: 10, weight: 100 }]);
      const result = await mod.resolveType('_sip._tcp.example.com', 'SRV');
      expect(result.records[0].port).toBe(5060);
    });

    it('returns error for unsupported type', async () => {
      const result = await mod.resolveType('example.com', 'INVALID');
      expect(result.error).toContain('Unsupported');
      expect(result.records).toEqual([]);
    });

    it('handles DNS errors gracefully', async () => {
      const err = new Error('DNS error');
      err.code = 'ENOTFOUND';
      jest.spyOn(dns.promises, 'resolve4').mockRejectedValue(err);
      const result = await mod.resolveType('nonexistent.invalid', 'A');
      expect(result.error).toBe('ENOTFOUND');
      expect(result.records).toEqual([]);
    });
  });

  // ── dnsLookup ─────────────────────────────────────────────────────────
  describe('dnsLookup', () => {
    it('resolves multiple types', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['1.2.3.4']);
      jest.spyOn(dns.promises, 'resolveNs').mockResolvedValue(['ns1.test.com']);
      const data = await mod.dnsLookup('test.com', ['A', 'NS']);
      expect(data.domain).toBe('test.com');
      expect(data.types).toEqual(['A', 'NS']);
      expect(data.results).toHaveLength(2);
      expect(data.totalRecords).toBe(2);
      expect(data.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('counts errors correctly', async () => {
      const err = new Error('fail');
      err.code = 'ENOTFOUND';
      jest.spyOn(dns.promises, 'resolve4').mockRejectedValue(err);
      jest.spyOn(dns.promises, 'resolve6').mockRejectedValue(err);
      const data = await mod.dnsLookup('bad.invalid', ['A', 'AAAA']);
      expect(data.errors).toBe(2);
      expect(data.resolved).toBe(0);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats results with records', () => {
      const data = {
        domain: 'example.com',
        types: ['A', 'MX'],
        elapsed: 10,
        totalRecords: 2,
        results: [
          { type: 'A', records: ['1.2.3.4'], error: null },
          { type: 'MX', records: [{ exchange: 'mail.example.com', priority: 10 }], error: null },
        ],
      };
      const text = mod.formatText(data);
      expect(text).toContain('DNS LOOKUP example.com');
      expect(text).toContain('1.2.3.4');
      expect(text).toContain('10 mail.example.com');
      expect(text).toContain('2 records found');
    });

    it('formats error results', () => {
      const data = {
        domain: 'bad.invalid',
        types: ['A'],
        elapsed: 5,
        totalRecords: 0,
        results: [{ type: 'A', records: [], error: 'ENOTFOUND' }],
      };
      const text = mod.formatText(data);
      expect(text).toContain('ENOTFOUND');
    });

    it('formats TXT records (array of arrays)', () => {
      const data = {
        domain: 'example.com',
        types: ['TXT'],
        elapsed: 5,
        totalRecords: 1,
        results: [{ type: 'TXT', records: [['v=spf1', ' include:test.com']], error: null }],
      };
      const text = mod.formatText(data);
      expect(text).toContain('v=spf1 include:test.com');
    });

    it('formats SOA records', () => {
      const data = {
        domain: 'example.com',
        types: ['SOA'],
        elapsed: 5,
        totalRecords: 1,
        results: [{ type: 'SOA', records: [{ nsname: 'ns1.example.com', hostmaster: 'admin.example.com' }], error: null }],
      };
      const text = mod.formatText(data);
      expect(text).toContain('ns1.example.com admin.example.com');
    });

    it('formats SRV records', () => {
      const data = {
        domain: 'example.com',
        types: ['SRV'],
        elapsed: 5,
        totalRecords: 1,
        results: [{ type: 'SRV', records: [{ name: 'sip.example.com', port: 5060, priority: 10, weight: 100 }], error: null }],
      };
      const text = mod.formatText(data);
      expect(text).toContain('10 100 5060 sip.example.com');
    });
  });

  // ── formatJson ────────────────────────────────────────────────────────
  describe('formatJson', () => {
    it('returns valid JSON', () => {
      const data = { domain: 'test.com', results: [] };
      expect(() => JSON.parse(mod.formatJson(data))).not.toThrow();
    });
  });

  // ── runDnsLookup (integration) ────────────────────────────────────────
  describe('runDnsLookup', () => {
    it('prints error for missing domain', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runDnsLookup([]);
      expect(result.error).toBe('No domain specified');
      spy.mockRestore();
    });

    it('prints error for unsupported type', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runDnsLookup(['example.com', '--type', 'INVALID']);
      expect(result.error).toBe('Unsupported type');
      spy.mockRestore();
    });

    it('handles null argv', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      const result = await mod.runDnsLookup(null);
      expect(result.error).toBe('No domain specified');
      spy.mockRestore();
    });

    it('uses DEFAULT_TYPES when no --type or --all', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['1.2.3.4']);
      jest.spyOn(dns.promises, 'resolve6').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveMx').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveNs').mockResolvedValue(['ns1.test.com']);
      jest.spyOn(dns.promises, 'resolveTxt').mockRejectedValue(new Error('none'));
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runDnsLookup(['test.com']);
      expect(result.types).toEqual(mod.DEFAULT_TYPES);
      logSpy.mockRestore();
    });

    it('uses ALL_TYPES when --all flag set', async () => {
      // Mock all resolvers
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['1.2.3.4']);
      jest.spyOn(dns.promises, 'resolve6').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveMx').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveNs').mockResolvedValue(['ns1.test.com']);
      jest.spyOn(dns.promises, 'resolveTxt').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveCname').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveSoa').mockRejectedValue(new Error('none'));
      jest.spyOn(dns.promises, 'resolveSrv').mockRejectedValue(new Error('none'));
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runDnsLookup(['test.com', '--all']);
      expect(result.types).toEqual(mod.ALL_TYPES);
      logSpy.mockRestore();
    });

    it('outputs JSON format', async () => {
      jest.spyOn(dns.promises, 'resolve4').mockResolvedValue(['1.2.3.4']);
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const result = await mod.runDnsLookup(['test.com', '--type', 'A', '--format', 'json']);
      const output = logSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      logSpy.mockRestore();
    });
  });

  // ── Constants ─────────────────────────────────────────────────────────
  describe('constants', () => {
    it('exports ALL_TYPES', () => {
      expect(mod.ALL_TYPES).toEqual(['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'SRV']);
    });

    it('exports DEFAULT_TYPES', () => {
      expect(mod.DEFAULT_TYPES).toEqual(['A', 'AAAA', 'MX', 'NS', 'TXT']);
    });
  });
});
