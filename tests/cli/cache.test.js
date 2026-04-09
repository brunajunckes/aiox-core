/**
 * Tests for CLI File Cache Manager Command
 * @story 17.2 — File Cache Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let cacheModule;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-cache-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/cache/index.js');
  delete require.cache[modulePath];
  cacheModule = require('../../.aiox-core/cli/commands/cache/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('cache command', () => {
  describe('parseDuration', () => {
    it('parses seconds', () => {
      expect(cacheModule.parseDuration('30s')).toBe(30000);
    });

    it('parses minutes', () => {
      expect(cacheModule.parseDuration('5m')).toBe(300000);
    });

    it('parses hours', () => {
      expect(cacheModule.parseDuration('2h')).toBe(7200000);
    });

    it('parses days', () => {
      expect(cacheModule.parseDuration('7d')).toBe(604800000);
    });

    it('returns default for invalid input', () => {
      expect(cacheModule.parseDuration('abc')).toBe(cacheModule.DEFAULT_TTL_MS);
    });
  });

  describe('cacheSet / cacheGet', () => {
    it('sets and gets a value', () => {
      cacheModule.cacheSet('token', 'abc123', 60000);
      expect(cacheModule.cacheGet('token')).toBe('abc123');
    });

    it('returns null for missing key', () => {
      expect(cacheModule.cacheGet('nonexistent')).toBeNull();
    });

    it('returns null for expired entry', () => {
      cacheModule.cacheSet('old', 'value', 1); // 1ms TTL
      // Manually expire
      const meta = cacheModule.loadMeta();
      meta.entries['old'].expiresAt = Date.now() - 1000;
      cacheModule.saveMeta(meta);
      expect(cacheModule.cacheGet('old')).toBeNull();
    });

    it('creates cache directory if missing', () => {
      cacheModule.cacheSet('test', 'val');
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'cache', '_meta.json'))).toBe(true);
    });

    it('overwrites existing key', () => {
      cacheModule.cacheSet('k', 'v1');
      cacheModule.cacheSet('k', 'v2');
      expect(cacheModule.cacheGet('k')).toBe('v2');
    });
  });

  describe('cacheList', () => {
    it('returns empty array when no entries', () => {
      expect(cacheModule.cacheList()).toEqual([]);
    });

    it('returns entries with expired status', () => {
      cacheModule.cacheSet('active', 'yes', 3600000);
      cacheModule.cacheSet('expired', 'no', 1);
      // Force expire
      const meta = cacheModule.loadMeta();
      meta.entries['expired'].expiresAt = Date.now() - 1000;
      cacheModule.saveMeta(meta);

      const items = cacheModule.cacheList();
      expect(items).toHaveLength(2);
      const activeItem = items.find(i => i.key === 'active');
      const expiredItem = items.find(i => i.key === 'expired');
      expect(activeItem.expired).toBe(false);
      expect(expiredItem.expired).toBe(true);
    });
  });

  describe('cacheStats', () => {
    it('returns zero stats for empty cache', () => {
      const stats = cacheModule.cacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.activeEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });

    it('counts active and expired entries', () => {
      cacheModule.cacheSet('a', 'val', 3600000);
      cacheModule.cacheSet('b', 'val', 1);
      const meta = cacheModule.loadMeta();
      meta.entries['b'].expiresAt = Date.now() - 1000;
      cacheModule.saveMeta(meta);

      const stats = cacheModule.cacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(1);
      expect(stats.expiredEntries).toBe(1);
    });

    it('tracks oldest and newest entries', () => {
      cacheModule.cacheSet('first', 'v1');
      const meta = cacheModule.loadMeta();
      meta.entries['first'].createdAt = 1000;
      cacheModule.saveMeta(meta);
      cacheModule.cacheSet('second', 'v2');

      const stats = cacheModule.cacheStats();
      expect(stats.oldestEntry).toBe(1000);
      expect(stats.newestEntry).toBeGreaterThan(1000);
    });
  });

  describe('cacheClear', () => {
    it('clears all entries', () => {
      cacheModule.cacheSet('a', '1');
      cacheModule.cacheSet('b', '2');
      const cleared = cacheModule.cacheClear();
      expect(cleared).toBe(2);
      expect(cacheModule.cacheList()).toHaveLength(0);
    });

    it('clears only entries older than threshold', () => {
      cacheModule.cacheSet('new', 'v1');
      cacheModule.cacheSet('old', 'v2');
      // Make 'old' entry old
      const meta = cacheModule.loadMeta();
      meta.entries['old'].createdAt = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      cacheModule.saveMeta(meta);

      const cleared = cacheModule.cacheClear(7 * 24 * 60 * 60 * 1000); // older than 7d
      expect(cleared).toBe(1);
      expect(cacheModule.cacheGet('new')).toBe('v1');
    });
  });

  describe('formatBytes', () => {
    it('formats zero bytes', () => {
      expect(cacheModule.formatBytes(0)).toBe('0 B');
    });

    it('formats kilobytes', () => {
      expect(cacheModule.formatBytes(1024)).toBe('1.0 KB');
    });

    it('formats megabytes', () => {
      expect(cacheModule.formatBytes(1048576)).toBe('1.0 MB');
    });
  });

  describe('runCache', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      cacheModule.runCache([]);
      expect(spy.mock.calls[0][0]).toContain('FILE CACHE MANAGER');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      cacheModule.runCache(['--help']);
      expect(spy.mock.calls[0][0]).toContain('FILE CACHE MANAGER');
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
      cacheModule.runCache(['unknown']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown cache subcommand'));
      spy.mockRestore();
    });
  });
});
