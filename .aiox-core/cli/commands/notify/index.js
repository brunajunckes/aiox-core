/**
 * Notification System Command Module
 *
 * Manages notifications in .aiox/notifications.jsonl.
 *
 * Subcommands:
 *   aiox notify              — Show unread notifications
 *   aiox notify --all        — Show all notifications
 *   aiox notify --mark-read  — Mark all as read
 *   aiox notify --clear      — Clear all notifications
 *
 * @module cli/commands/notify
 * @version 1.0.0
 * @story 11.3 — Notification System
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getNotificationsFile() {
  return path.join(getAioxDir(), 'notifications.jsonl');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const VALID_TYPES = ['info', 'success', 'warning', 'error'];

/**
 * Generate a unique notification ID.
 * @returns {string}
 */
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Read all notifications from file.
 * @returns {Array<object>}
 */
function readNotifications() {
  const filePath = getNotificationsFile();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Write all notifications to file (overwrite).
 * @param {Array<object>} notifications
 */
function writeNotifications(notifications) {
  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const content = notifications.map(n => JSON.stringify(n)).join('\n');
  fs.writeFileSync(getNotificationsFile(), content ? content + '\n' : '', 'utf8');
}

/**
 * Add a notification.
 * @param {string} title
 * @param {string} body
 * @param {string} [type='info']
 * @returns {object} The created notification
 */
function addNotification(title, body, type = 'info') {
  if (!title || typeof title !== 'string') {
    throw new Error('Title is required and must be a string');
  }
  if (!body || typeof body !== 'string') {
    throw new Error('Body is required and must be a string');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const notification = {
    id: generateId(),
    title,
    body,
    type,
    read: false,
    timestamp: new Date().toISOString(),
  };

  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(getNotificationsFile(), JSON.stringify(notification) + '\n', 'utf8');
  return notification;
}

/**
 * Get unread notifications.
 * @returns {Array<object>}
 */
function getUnread() {
  return readNotifications().filter(n => !n.read);
}

/**
 * Mark all notifications as read.
 * @returns {number} Number of notifications marked
 */
function markAllRead() {
  const notifications = readNotifications();
  let count = 0;
  for (const n of notifications) {
    if (!n.read) {
      n.read = true;
      count++;
    }
  }
  writeNotifications(notifications);
  return count;
}

/**
 * Clear all notifications.
 * @returns {boolean} true if cleared, false if nothing to clear
 */
function clearNotifications() {
  const filePath = getNotificationsFile();
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return false;
  fs.writeFileSync(filePath, '', 'utf8');
  return true;
}

/**
 * Format a notification for display.
 * @param {object} notification
 * @returns {string}
 */
function formatNotification(notification) {
  const readMark = notification.read ? ' ' : '*';
  const typeTag = `[${(notification.type || 'info').toUpperCase()}]`;
  const ts = notification.timestamp || '';
  return `${readMark} ${typeTag} ${notification.title}\n    ${notification.body}  (${ts})`;
}

// ── Main Runner ──────────────────────────────────────────────────────────────

/**
 * Run the notify command.
 * @param {string[]} argv
 */
function runNotify(argv = []) {
  const flags = {};
  for (const arg of argv) {
    if (arg === '--all') flags.all = true;
    if (arg === '--mark-read') flags.markRead = true;
    if (arg === '--clear') flags.clear = true;
  }

  if (flags.clear) {
    const cleared = clearNotifications();
    if (cleared) {
      console.log('All notifications cleared.');
    } else {
      console.log('No notifications to clear.');
    }
    return;
  }

  if (flags.markRead) {
    const count = markAllRead();
    console.log(`Marked ${count} notification(s) as read.`);
    return;
  }

  const notifications = flags.all ? readNotifications() : getUnread();

  if (notifications.length === 0) {
    console.log(flags.all ? 'No notifications.' : 'No unread notifications.');
    return;
  }

  const label = flags.all ? 'All notifications' : 'Unread notifications';
  console.log(`${label} (${notifications.length}):\n`);
  for (const n of notifications) {
    console.log(formatNotification(n));
    console.log('');
  }
}

module.exports = {
  getAioxDir,
  getNotificationsFile,
  generateId,
  readNotifications,
  writeNotifications,
  addNotification,
  getUnread,
  markAllRead,
  clearNotifications,
  formatNotification,
  runNotify,
  VALID_TYPES,
};
