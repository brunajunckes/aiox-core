/**
 * Tests for Notification System Command Module
 *
 * @module tests/cli/notify
 * @story 11.3 — Notification System
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-notify-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/notify/index.js');

// ── Path Helpers ────────────────────────────────────────────────────────────

describe('getAioxDir', () => {
  test('returns .aiox inside cwd', () => {
    expect(mod.getAioxDir()).toBe(path.join(tmpDir, '.aiox'));
  });
});

describe('getNotificationsFile', () => {
  test('returns notifications.jsonl path', () => {
    expect(mod.getNotificationsFile()).toBe(path.join(tmpDir, '.aiox', 'notifications.jsonl'));
  });
});

// ── generateId ──────────────────────────────────────────────────────────────

describe('generateId', () => {
  test('generates hex string', () => {
    const id = mod.generateId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  test('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 10 }, () => mod.generateId()));
    expect(ids.size).toBe(10);
  });
});

// ── addNotification ─────────────────────────────────────────────────────────

describe('addNotification', () => {
  test('creates notification with correct fields', () => {
    const n = mod.addNotification('Title', 'Body text', 'info');
    expect(n.id).toBeDefined();
    expect(n.title).toBe('Title');
    expect(n.body).toBe('Body text');
    expect(n.type).toBe('info');
    expect(n.read).toBe(false);
    expect(n.timestamp).toBeDefined();
  });

  test('defaults to info type', () => {
    const n = mod.addNotification('T', 'B');
    expect(n.type).toBe('info');
  });

  test('persists to file', () => {
    mod.addNotification('T', 'B', 'success');
    const all = mod.readNotifications();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('success');
  });

  test('appends multiple notifications', () => {
    mod.addNotification('A', 'body1');
    mod.addNotification('B', 'body2');
    mod.addNotification('C', 'body3');
    expect(mod.readNotifications()).toHaveLength(3);
  });

  test('throws on invalid type', () => {
    expect(() => mod.addNotification('T', 'B', 'invalid')).toThrow('Invalid type');
  });

  test('throws on empty title', () => {
    expect(() => mod.addNotification('', 'B')).toThrow('Title is required');
  });

  test('throws on empty body', () => {
    expect(() => mod.addNotification('T', '')).toThrow('Body is required');
  });
});

// ── readNotifications ───────────────────────────────────────────────────────

describe('readNotifications', () => {
  test('returns empty array when file missing', () => {
    expect(mod.readNotifications()).toEqual([]);
  });

  test('returns empty array for empty file', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getNotificationsFile(), '', 'utf8');
    expect(mod.readNotifications()).toEqual([]);
  });

  test('skips malformed lines', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getNotificationsFile(), '{"title":"ok"}\nbroken\n', 'utf8');
    expect(mod.readNotifications()).toHaveLength(1);
  });
});

// ── getUnread ───────────────────────────────────────────────────────────────

describe('getUnread', () => {
  test('returns only unread notifications', () => {
    mod.addNotification('A', 'body');
    mod.addNotification('B', 'body');
    // Mark first as read manually
    const all = mod.readNotifications();
    all[0].read = true;
    mod.writeNotifications(all);
    expect(mod.getUnread()).toHaveLength(1);
    expect(mod.getUnread()[0].title).toBe('B');
  });
});

// ── markAllRead ─────────────────────────────────────────────────────────────

describe('markAllRead', () => {
  test('marks all as read and returns count', () => {
    mod.addNotification('A', 'body');
    mod.addNotification('B', 'body');
    const count = mod.markAllRead();
    expect(count).toBe(2);
    expect(mod.getUnread()).toHaveLength(0);
  });

  test('returns 0 when all already read', () => {
    mod.addNotification('A', 'body');
    mod.markAllRead();
    expect(mod.markAllRead()).toBe(0);
  });
});

// ── clearNotifications ──────────────────────────────────────────────────────

describe('clearNotifications', () => {
  test('returns false when file missing', () => {
    expect(mod.clearNotifications()).toBe(false);
  });

  test('clears all notifications', () => {
    mod.addNotification('A', 'body');
    expect(mod.clearNotifications()).toBe(true);
    expect(mod.readNotifications()).toEqual([]);
  });

  test('returns false for already empty file', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
    fs.writeFileSync(mod.getNotificationsFile(), '', 'utf8');
    expect(mod.clearNotifications()).toBe(false);
  });
});

// ── formatNotification ──────────────────────────────────────────────────────

describe('formatNotification', () => {
  test('shows unread marker for unread', () => {
    const str = mod.formatNotification({ title: 'Test', body: 'Content', type: 'info', read: false, timestamp: '2026-01-01' });
    expect(str).toContain('*');
    expect(str).toContain('[INFO]');
    expect(str).toContain('Test');
    expect(str).toContain('Content');
  });

  test('shows space for read', () => {
    const str = mod.formatNotification({ title: 'Test', body: 'Content', type: 'error', read: true, timestamp: '2026-01-01' });
    expect(str.startsWith(' ')).toBe(true);
    expect(str).toContain('[ERROR]');
  });
});

// ── runNotify ───────────────────────────────────────────────────────────────

describe('runNotify', () => {
  test('shows "No unread notifications." when empty', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runNotify([]);
    expect(spy).toHaveBeenCalledWith('No unread notifications.');
    spy.mockRestore();
  });

  test('--all shows "No notifications." when empty', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runNotify(['--all']);
    expect(spy).toHaveBeenCalledWith('No notifications.');
    spy.mockRestore();
  });

  test('--mark-read marks and reports count', () => {
    mod.addNotification('A', 'body');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runNotify(['--mark-read']);
    expect(spy).toHaveBeenCalledWith('Marked 1 notification(s) as read.');
    spy.mockRestore();
  });

  test('--clear clears notifications', () => {
    mod.addNotification('A', 'body');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runNotify(['--clear']);
    expect(spy).toHaveBeenCalledWith('All notifications cleared.');
    expect(mod.readNotifications()).toEqual([]);
    spy.mockRestore();
  });
});
