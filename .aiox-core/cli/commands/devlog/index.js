/**
 * Development Log Command Module
 *
 * Subcommands:
 *   aiox devlog add "<message>"            — add log entry
 *   aiox devlog add "<message>" --tag feat — with tag
 *   aiox devlog list                       — show recent entries
 *   aiox devlog list --tag bug             — filter by tag
 *   aiox devlog search <term>              — search entries
 *   aiox devlog export                     — export as JSON
 *   aiox devlog clear                      — clear log
 *
 * @module cli/commands/devlog
 * @version 1.0.0
 * @story 31.3 — Development Log
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const LOG_FILE = () => path.join(process.cwd(), '.aiox', 'devlog.jsonl');

const HELP_TEXT = `
DEVELOPMENT LOG

USAGE:
  aiox devlog add "<message>"              Add log entry with timestamp
  aiox devlog add "<message>" --tag feat   Add entry with tag
  aiox devlog list                         Show recent entries
  aiox devlog list --tag bug               Filter by tag
  aiox devlog search <term>                Search entries
  aiox devlog export                       Export all as JSON
  aiox devlog clear                        Clear log
  aiox devlog --help                       Show this help

EXAMPLES:
  aiox devlog add "Fixed auth bug"
  aiox devlog add "New API endpoint" --tag feature
  aiox devlog list --tag bug
  aiox devlog search "auth"
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Store Operations ─────────────────────────────────────────────────────────

function loadEntries() {
  const filePath = LOG_FILE();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];
    return raw.split('\n').map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function appendEntry(entry) {
  const filePath = LOG_FILE();
  ensureDir(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

function saveEntries(entries) {
  const filePath = LOG_FILE();
  ensureDir(filePath);
  const data = entries.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(filePath, data ? data + '\n' : '', 'utf8');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addEntry(message, args) {
  if (!message) {
    console.error('Error: message is required. Usage: aiox devlog add "<message>"');
    return null;
  }

  const tag = extractFlag(args, '--tag') || null;

  const entry = {
    id: generateId(),
    message,
    tag,
    timestamp: new Date().toISOString(),
  };

  appendEntry(entry);
  console.log(`Log entry added: ${entry.id}`);
  return entry;
}

function listEntries(args) {
  const entries = loadEntries();
  const tag = extractFlag(args, '--tag');

  let filtered = entries;
  if (tag) {
    filtered = entries.filter(e => e.tag === tag);
  }

  if (filtered.length === 0) {
    console.log('No log entries found.');
    return [];
  }

  console.log(`\nDev Log (${filtered.length}):\n`);
  for (const e of filtered) {
    const tagStr = e.tag ? ` [${e.tag}]` : '';
    console.log(`  ${e.timestamp}  ${e.message}${tagStr}`);
  }
  console.log('');
  return filtered;
}

function searchEntries(term) {
  if (!term) {
    console.error('Error: search term is required. Usage: aiox devlog search <term>');
    return [];
  }

  const entries = loadEntries();
  const lower = term.toLowerCase();
  const results = entries.filter(e =>
    e.message.toLowerCase().includes(lower) ||
    (e.tag && e.tag.toLowerCase().includes(lower)),
  );

  if (results.length === 0) {
    console.log(`No entries matching "${term}".`);
    return [];
  }

  console.log(`\nSearch results for "${term}" (${results.length}):\n`);
  for (const e of results) {
    const tagStr = e.tag ? ` [${e.tag}]` : '';
    console.log(`  ${e.timestamp}  ${e.message}${tagStr}`);
  }
  console.log('');
  return results;
}

function exportEntries() {
  const entries = loadEntries();
  const json = JSON.stringify(entries, null, 2);
  console.log(json);
  return entries;
}

function clearEntries() {
  const filePath = LOG_FILE();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  console.log('Dev log cleared.');
  return true;
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runDevlog(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addEntry(args[1], args.slice(2));
    case 'list':
      return listEntries(args.slice(1));
    case 'search':
      return searchEntries(args[1]);
    case 'export':
      return exportEntries();
    case 'clear':
      return clearEntries();
    default:
      console.error(`Unknown devlog subcommand: ${sub}`);
      console.log('Run "aiox devlog --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDevlog,
  addEntry,
  listEntries,
  searchEntries,
  exportEntries,
  clearEntries,
  loadEntries,
  appendEntry,
  saveEntries,
  generateId,
  HELP_TEXT,
};
