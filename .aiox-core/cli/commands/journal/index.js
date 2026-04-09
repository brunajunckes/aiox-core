/**
 * Daily Journal Command Module
 *
 * Subcommands:
 *   aiox journal add "<entry>"           — add today's journal entry
 *   aiox journal today                   — show today's entries
 *   aiox journal list                    — show all entries grouped by date
 *   aiox journal list --date 2026-04-09  — specific date
 *   aiox journal search <term>           — search
 *   aiox journal export                  — export as JSON
 *
 * @module cli/commands/journal
 * @version 1.0.0
 * @story 31.4 — Daily Journal
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const JOURNAL_FILE = () => path.join(process.cwd(), '.aiox', 'journal.jsonl');

const HELP_TEXT = `
DAILY JOURNAL

USAGE:
  aiox journal add "<entry>"              Add today's journal entry
  aiox journal today                      Show today's entries
  aiox journal list                       Show all entries grouped by date
  aiox journal list --date 2026-04-09     Show entries for specific date
  aiox journal search <term>              Search entries
  aiox journal export                     Export all as JSON
  aiox journal --help                     Show this help

EXAMPLES:
  aiox journal add "Started sprint 31 implementation"
  aiox journal today
  aiox journal list --date 2026-04-08
  aiox journal search "sprint"
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

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

// ── Store Operations ─────────────────────────────────────────────────────────

function loadEntries() {
  const filePath = JOURNAL_FILE();
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
  const filePath = JOURNAL_FILE();
  ensureDir(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addJournalEntry(text) {
  if (!text) {
    console.error('Error: entry text is required. Usage: aiox journal add "<entry>"');
    return null;
  }

  const now = new Date();
  const entry = {
    id: generateId(),
    text,
    date: toDateStr(now),
    timestamp: now.toISOString(),
  };

  appendEntry(entry);
  console.log(`Journal entry added: ${entry.id}`);
  return entry;
}

function showToday() {
  const entries = loadEntries();
  const today = toDateStr(new Date());
  const todayEntries = entries.filter(e => e.date === today);

  if (todayEntries.length === 0) {
    console.log('No journal entries for today.');
    return [];
  }

  console.log(`\nJournal — ${today} (${todayEntries.length}):\n`);
  for (const e of todayEntries) {
    console.log(`  ${e.timestamp.slice(11, 19)}  ${e.text}`);
  }
  console.log('');
  return todayEntries;
}

function listEntries(args) {
  const entries = loadEntries();
  const dateFilter = extractFlag(args, '--date');

  if (dateFilter) {
    const filtered = entries.filter(e => e.date === dateFilter);
    if (filtered.length === 0) {
      console.log(`No entries for ${dateFilter}.`);
      return [];
    }
    console.log(`\nJournal — ${dateFilter} (${filtered.length}):\n`);
    for (const e of filtered) {
      console.log(`  ${e.timestamp.slice(11, 19)}  ${e.text}`);
    }
    console.log('');
    return filtered;
  }

  if (entries.length === 0) {
    console.log('No journal entries.');
    return [];
  }

  // Group by date
  const grouped = {};
  for (const e of entries) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }

  const dates = Object.keys(grouped).sort().reverse();
  console.log(`\nJournal (${entries.length} entries, ${dates.length} days):\n`);
  for (const date of dates) {
    console.log(`  ${date}:`);
    for (const e of grouped[date]) {
      console.log(`    ${e.timestamp.slice(11, 19)}  ${e.text}`);
    }
  }
  console.log('');
  return entries;
}

function searchEntries(term) {
  if (!term) {
    console.error('Error: search term is required. Usage: aiox journal search <term>');
    return [];
  }

  const entries = loadEntries();
  const lower = term.toLowerCase();
  const results = entries.filter(e =>
    e.text.toLowerCase().includes(lower),
  );

  if (results.length === 0) {
    console.log(`No entries matching "${term}".`);
    return [];
  }

  console.log(`\nSearch results for "${term}" (${results.length}):\n`);
  for (const e of results) {
    console.log(`  ${e.date} ${e.timestamp.slice(11, 19)}  ${e.text}`);
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

// ── Runner ───────────────────────────────────────────────────────────────────

function runJournal(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addJournalEntry(args[1]);
    case 'today':
      return showToday();
    case 'list':
      return listEntries(args.slice(1));
    case 'search':
      return searchEntries(args[1]);
    case 'export':
      return exportEntries();
    default:
      console.error(`Unknown journal subcommand: ${sub}`);
      console.log('Run "aiox journal --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runJournal,
  addJournalEntry,
  showToday,
  listEntries,
  searchEntries,
  exportEntries,
  loadEntries,
  appendEntry,
  generateId,
  toDateStr,
  HELP_TEXT,
};
