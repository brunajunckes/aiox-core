/**
 * File Cache Manager
 *
 * Subcommands:
 *   aiox cache stats                    — show cache stats
 *   aiox cache clear                    — clear all cached files
 *   aiox cache clear --older-than 7d    — clear files older than N days
 *   aiox cache list                     — list cached files with sizes
 *   aiox cache set <key> <value>        — cache a value with TTL
 *   aiox cache get <key>                — get cached value (null if expired)
 *
 * @module cli/commands/cache
 * @version 1.0.0
 * @story 17.2 — File Cache Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const CACHE_DIR = () => path.join(process.cwd(), '.aiox', 'cache');
const CACHE_META = () => path.join(CACHE_DIR(), '_meta.json');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const HELP_TEXT = `
FILE CACHE MANAGER

USAGE:
  aiox cache stats                       Show cache size, file count, oldest/newest
  aiox cache clear                       Clear all cached files
  aiox cache clear --older-than <Nd>     Clear files older than N days
  aiox cache list                        List cached files with sizes
  aiox cache set <key> <value>           Cache a value (default TTL: 24h)
  aiox cache set <key> <value> --ttl 2h  Cache with custom TTL (e.g., 1h, 30m, 7d)
  aiox cache get <key>                   Get cached value (null if expired)
  aiox cache --help                      Show this help

EXAMPLES:
  aiox cache set api_token "abc123" --ttl 1h
  aiox cache get api_token
  aiox cache stats
  aiox cache clear --older-than 7d
`.trim();

// ── TTL Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a duration string into milliseconds.
 * Supports: Ns (seconds), Nm (minutes), Nh (hours), Nd (days)
 * @param {string} str
 * @returns {number} milliseconds
 */
function parseDuration(str) {
  const match = String(str).match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return DEFAULT_TTL_MS;
  const num = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return DEFAULT_TTL_MS;
  }
}

// ── Meta Operations ──────────────────────────────────────────────────────────

/**
 * Load cache metadata.
 * @returns {Object} { entries: { key: { value, expiresAt, createdAt } } }
 */
function loadMeta() {
  const metaPath = CACHE_META();
  try {
    if (!fs.existsSync(metaPath)) return { entries: {} };
    const raw = fs.readFileSync(metaPath, 'utf8').trim();
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw);
    return parsed && parsed.entries ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

/**
 * Save cache metadata.
 * @param {Object} meta
 */
function saveMeta(meta) {
  const dir = CACHE_DIR();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CACHE_META(), JSON.stringify(meta, null, 2), 'utf8');
}

// ── Cache Operations ─────────────────────────────────────────────────────────

/**
 * Set a cache entry with TTL.
 * @param {string} key
 * @param {string} value
 * @param {number} [ttlMs] - TTL in milliseconds
 */
function cacheSet(key, value, ttlMs) {
  const ttl = ttlMs || DEFAULT_TTL_MS;
  const now = Date.now();
  const meta = loadMeta();
  meta.entries[key] = {
    value,
    createdAt: now,
    expiresAt: now + ttl,
  };
  saveMeta(meta);
}

/**
 * Get a cache entry (returns null if expired or missing).
 * @param {string} key
 * @returns {string|null}
 */
function cacheGet(key) {
  const meta = loadMeta();
  const entry = meta.entries[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    // Expired — clean up
    delete meta.entries[key];
    saveMeta(meta);
    return null;
  }
  return entry.value;
}

/**
 * List all cache entries (including expired status).
 * @returns {Array<{key: string, value: string, createdAt: number, expiresAt: number, expired: boolean}>}
 */
function cacheList() {
  const meta = loadMeta();
  const now = Date.now();
  return Object.entries(meta.entries).map(([key, entry]) => ({
    key,
    value: entry.value,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    expired: now > entry.expiresAt,
  }));
}

/**
 * Get cache stats.
 * @returns {{totalEntries: number, activeEntries: number, expiredEntries: number, oldestEntry: number|null, newestEntry: number|null, totalSize: number}}
 */
function cacheStats() {
  const meta = loadMeta();
  const now = Date.now();
  const entries = Object.values(meta.entries);
  let active = 0;
  let expired = 0;
  let oldest = null;
  let newest = null;

  for (const entry of entries) {
    if (now > entry.expiresAt) {
      expired++;
    } else {
      active++;
    }
    if (oldest === null || entry.createdAt < oldest) oldest = entry.createdAt;
    if (newest === null || entry.createdAt > newest) newest = entry.createdAt;
  }

  // Calculate size of cache dir
  let totalSize = 0;
  const cacheDir = CACHE_DIR();
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(cacheDir, f));
        totalSize += stat.size;
      } catch { /* ignore */ }
    }
  }

  return {
    totalEntries: entries.length,
    activeEntries: active,
    expiredEntries: expired,
    oldestEntry: oldest,
    newestEntry: newest,
    totalSize,
  };
}

/**
 * Clear cache entries.
 * @param {number} [olderThanMs] - if set, only clear entries older than this
 * @returns {number} number of entries cleared
 */
function cacheClear(olderThanMs) {
  const meta = loadMeta();
  const now = Date.now();
  let cleared = 0;

  if (olderThanMs !== undefined) {
    const cutoff = now - olderThanMs;
    for (const [key, entry] of Object.entries(meta.entries)) {
      if (entry.createdAt < cutoff) {
        delete meta.entries[key];
        cleared++;
      }
    }
    saveMeta(meta);
  } else {
    cleared = Object.keys(meta.entries).length;
    saveMeta({ entries: {} });
  }

  return cleared;
}

// ── CLI Runner ───────────────────────────────────────────────────────────────

/**
 * Format bytes to human-readable.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Run the cache command.
 * @param {string[]} argv - arguments after "aiox cache"
 */
function runCache(argv) {
  const sub = argv[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'stats': {
      const stats = cacheStats();
      console.log('CACHE STATS:');
      console.log(`  Total entries:   ${stats.totalEntries}`);
      console.log(`  Active entries:  ${stats.activeEntries}`);
      console.log(`  Expired entries: ${stats.expiredEntries}`);
      console.log(`  Total size:      ${formatBytes(stats.totalSize)}`);
      if (stats.oldestEntry) {
        console.log(`  Oldest entry:    ${new Date(stats.oldestEntry).toISOString()}`);
      }
      if (stats.newestEntry) {
        console.log(`  Newest entry:    ${new Date(stats.newestEntry).toISOString()}`);
      }
      break;
    }

    case 'clear': {
      const olderIdx = argv.indexOf('--older-than');
      if (olderIdx !== -1 && argv[olderIdx + 1]) {
        const durationMs = parseDuration(argv[olderIdx + 1]);
        const cleared = cacheClear(durationMs);
        console.log(`Cleared ${cleared} entries older than ${argv[olderIdx + 1]}`);
      } else {
        const cleared = cacheClear();
        console.log(`Cleared ${cleared} entries`);
      }
      break;
    }

    case 'list': {
      const items = cacheList();
      if (items.length === 0) {
        console.log('(empty cache)');
        return;
      }
      console.log('CACHED ENTRIES:');
      for (const item of items) {
        const status = item.expired ? '[EXPIRED]' : '[ACTIVE]';
        const preview = String(item.value).substring(0, 50);
        console.log(`  ${item.key} ${status} = ${preview}`);
      }
      console.log(`\nTotal: ${items.length} entries`);
      break;
    }

    case 'set': {
      const key = argv[1];
      const ttlIdx = argv.indexOf('--ttl');
      let valueEnd = ttlIdx !== -1 ? ttlIdx : argv.length;
      const value = argv.slice(2, valueEnd).join(' ');
      if (!key || value === '') {
        console.error('Usage: aiox cache set <key> <value> [--ttl <duration>]');
        process.exitCode = 1;
        return;
      }
      const ttlMs = ttlIdx !== -1 && argv[ttlIdx + 1] ? parseDuration(argv[ttlIdx + 1]) : DEFAULT_TTL_MS;
      cacheSet(key, value, ttlMs);
      console.log(`Cached "${key}"`);
      break;
    }

    case 'get': {
      const key = argv[1];
      if (!key) {
        console.error('Usage: aiox cache get <key>');
        process.exitCode = 1;
        return;
      }
      const value = cacheGet(key);
      if (value === null) {
        console.log('(not found or expired)');
      } else {
        console.log(value);
      }
      break;
    }

    default:
      console.error(`Unknown cache subcommand: ${sub}`);
      console.log(HELP_TEXT);
      process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runCache,
  cacheSet,
  cacheGet,
  cacheList,
  cacheStats,
  cacheClear,
  loadMeta,
  saveMeta,
  parseDuration,
  formatBytes,
  CACHE_DIR,
  CACHE_META,
  DEFAULT_TTL_MS,
};
