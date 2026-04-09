/**
 * Tests for Webhook Handler Command Module
 *
 * @module tests/cli/webhooks
 * @story 16.2 — Webhook Handler
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-webhooks-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/webhooks/index.js');

// ── Path Helpers ─────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getWebhooksFile', () => {
  test('returns webhooks.yaml inside .aiox', () => {
    expect(mod.getWebhooksFile()).toBe(path.join(tmpDir, '.aiox', 'webhooks.yaml'));
  });
});

// ── loadWebhooks / saveWebhooks ──────────────────────────────────────────────

describe('loadWebhooks', () => {
  test('returns empty array when no file', () => {
    expect(mod.loadWebhooks()).toEqual([]);
  });

  test('returns empty array for empty file', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'webhooks.yaml'), '', 'utf8');
    expect(mod.loadWebhooks()).toEqual([]);
  });
});

describe('saveWebhooks', () => {
  test('creates .aiox dir and writes file', () => {
    const wh = [{ id: 'abc', url: 'https://example.com', event: 'test.passed', created: '2026-01-01T00:00:00.000Z' }];
    mod.saveWebhooks(wh);
    expect(fs.existsSync(mod.getWebhooksFile())).toBe(true);
    const loaded = mod.loadWebhooks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('abc');
    expect(loaded[0].url).toBe('https://example.com');
    expect(loaded[0].event).toBe('test.passed');
  });

  test('round-trips multiple webhooks', () => {
    const whs = [
      { id: 'a1', url: 'https://a.com', event: 'test.passed', created: '2026-01-01T00:00:00.000Z' },
      { id: 'b2', url: 'https://b.com', event: 'test.failed', created: '2026-01-02T00:00:00.000Z' },
    ];
    mod.saveWebhooks(whs);
    const loaded = mod.loadWebhooks();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('a1');
    expect(loaded[1].id).toBe('b2');
  });
});

// ── generateId ───────────────────────────────────────────────────────────────

describe('generateId', () => {
  test('returns 8-char hex string', () => {
    const id = mod.generateId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  test('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 20 }, () => mod.generateId()));
    expect(ids.size).toBe(20);
  });
});

// ── addWebhook ───────────────────────────────────────────────────────────────

describe('addWebhook', () => {
  test('adds webhook and returns it', () => {
    const wh = mod.addWebhook('https://example.com/hook', 'test.passed');
    expect(wh.id).toBeDefined();
    expect(wh.url).toBe('https://example.com/hook');
    expect(wh.event).toBe('test.passed');
    expect(wh.created).toBeDefined();
  });

  test('throws on missing URL', () => {
    expect(() => mod.addWebhook('', 'test.passed')).toThrow('URL is required');
  });

  test('throws on invalid event', () => {
    expect(() => mod.addWebhook('https://example.com', 'invalid.event')).toThrow('Invalid event');
  });

  test('persists webhook to file', () => {
    mod.addWebhook('https://example.com/a', 'test.passed');
    mod.addWebhook('https://example.com/b', 'test.failed');
    const loaded = mod.loadWebhooks();
    expect(loaded).toHaveLength(2);
  });
});

// ── removeWebhook ────────────────────────────────────────────────────────────

describe('removeWebhook', () => {
  test('removes existing webhook', () => {
    const wh = mod.addWebhook('https://example.com', 'test.passed');
    expect(mod.removeWebhook(wh.id)).toBe(true);
    expect(mod.loadWebhooks()).toHaveLength(0);
  });

  test('returns false for non-existent ID', () => {
    expect(mod.removeWebhook('nonexistent')).toBe(false);
  });
});

// ── getWebhook ───────────────────────────────────────────────────────────────

describe('getWebhook', () => {
  test('finds webhook by ID', () => {
    const wh = mod.addWebhook('https://example.com', 'test.passed');
    const found = mod.getWebhook(wh.id);
    expect(found).not.toBeNull();
    expect(found.url).toBe('https://example.com');
  });

  test('returns null for unknown ID', () => {
    expect(mod.getWebhook('nope')).toBeNull();
  });
});

// ── getWebhooksForEvent ──────────────────────────────────────────────────────

describe('getWebhooksForEvent', () => {
  test('filters by event', () => {
    mod.addWebhook('https://a.com', 'test.passed');
    mod.addWebhook('https://b.com', 'test.failed');
    mod.addWebhook('https://c.com', 'test.passed');
    const hooks = mod.getWebhooksForEvent('test.passed');
    expect(hooks).toHaveLength(2);
  });

  test('returns empty for unmatched event', () => {
    mod.addWebhook('https://a.com', 'test.passed');
    expect(mod.getWebhooksForEvent('deploy.started')).toHaveLength(0);
  });
});

// ── buildTestPayload / buildFirePayload ──────────────────────────────────────

describe('buildTestPayload', () => {
  test('builds test payload with webhook info', () => {
    const wh = { id: 'abc', event: 'test.passed', url: 'https://example.com' };
    const payload = mod.buildTestPayload(wh);
    expect(payload.event).toBe('test.passed');
    expect(payload.test).toBe(true);
    expect(payload.webhookId).toBe('abc');
    expect(payload.timestamp).toBeDefined();
  });
});

describe('buildFirePayload', () => {
  test('builds fire payload with event and data', () => {
    const payload = mod.buildFirePayload('test.failed', { suite: 'unit' });
    expect(payload.event).toBe('test.failed');
    expect(payload.test).toBe(false);
    expect(payload.data.suite).toBe('unit');
  });

  test('defaults data to empty object', () => {
    const payload = mod.buildFirePayload('test.passed');
    expect(payload.data).toEqual({});
  });
});

// ── formatWebhook ────────────────────────────────────────────────────────────

describe('formatWebhook', () => {
  test('formats webhook as string', () => {
    const formatted = mod.formatWebhook({ id: 'abc123', event: 'test.passed', url: 'https://x.com' });
    expect(formatted).toContain('abc123');
    expect(formatted).toContain('test.passed');
    expect(formatted).toContain('https://x.com');
  });
});

// ── parseData / parseEvent ───────────────────────────────────────────────────

describe('parseData', () => {
  test('parses JSON from --data flag', () => {
    const data = mod.parseData(['--data', '{"key":"val"}']);
    expect(data.key).toBe('val');
  });

  test('returns empty object when no --data', () => {
    expect(mod.parseData([])).toEqual({});
  });

  test('throws on invalid JSON', () => {
    expect(() => mod.parseData(['--data', 'notjson'])).toThrow('Invalid JSON data');
  });
});

describe('parseEvent', () => {
  test('parses --event flag', () => {
    expect(mod.parseEvent(['--event', 'test.passed'])).toBe('test.passed');
  });

  test('returns null when missing', () => {
    expect(mod.parseEvent([])).toBeNull();
  });
});

// ── VALID_EVENTS ─────────────────────────────────────────────────────────────

describe('VALID_EVENTS', () => {
  test('includes expected events', () => {
    expect(mod.VALID_EVENTS).toContain('story.completed');
    expect(mod.VALID_EVENTS).toContain('test.passed');
    expect(mod.VALID_EVENTS).toContain('test.failed');
    expect(mod.VALID_EVENTS).toContain('deploy.started');
  });
});
