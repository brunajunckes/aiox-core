/**
 * Focus Mode Command Module
 *
 * Subcommands:
 *   aiox focus on              — enable focus mode
 *   aiox focus off             — disable, show duration
 *   aiox focus status          — show if active and for how long
 *   aiox focus history         — show focus sessions
 *   aiox focus stats           — total focus time today/week/month
 *   aiox focus --format json   — as JSON
 *
 * @module cli/commands/focus
 * @version 1.0.0
 * @story 31.2 — Focus Mode
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const STATE_FILE = () => path.join(process.cwd(), '.aiox', 'focus-state.json');
const HISTORY_FILE = () => path.join(process.cwd(), '.aiox', 'focus-history.jsonl');

const HELP_TEXT = `
FOCUS MODE

USAGE:
  aiox focus on                Enable focus mode
  aiox focus off               Disable focus mode, show duration
  aiox focus status            Show if active and for how long
  aiox focus history           Show focus sessions
  aiox focus stats             Total focus time today/week/month
  aiox focus --format json     Output as JSON
  aiox focus --help            Show this help

EXAMPLES:
  aiox focus on
  aiox focus status
  aiox focus off
  aiox focus stats --format json
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

function hasFlag(args, flag) {
  return args.includes(flag);
}

// ── State Operations ─────────────────────────────────────────────────────────

function loadState() {
  const filePath = STATE_FILE();
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  const filePath = STATE_FILE();
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function clearState() {
  const filePath = STATE_FILE();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ── History Operations ───────────────────────────────────────────────────────

function loadHistory() {
  const filePath = HISTORY_FILE();
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

function appendHistory(entry) {
  const filePath = HISTORY_FILE();
  ensureDir(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function focusOn() {
  const existing = loadState();
  if (existing && existing.active) {
    console.error('Error: Focus mode already active. Use "aiox focus off" first.');
    return null;
  }

  const state = {
    active: true,
    startedAt: new Date().toISOString(),
  };

  saveState(state);
  console.log('Focus mode enabled.');
  return state;
}

function focusOff() {
  const state = loadState();
  if (!state || !state.active) {
    console.error('Error: Focus mode is not active.');
    return null;
  }

  const startedAt = new Date(state.startedAt);
  const now = new Date();
  const durationMs = now.getTime() - startedAt.getTime();
  const durationMin = Math.round(durationMs / 60000);

  const entry = {
    startedAt: state.startedAt,
    endedAt: now.toISOString(),
    durationMin,
  };

  appendHistory(entry);
  clearState();

  console.log(`Focus mode disabled. Duration: ${durationMin} min.`);
  return entry;
}

function focusStatus(args) {
  const state = loadState();
  const format = extractFlag(args, '--format');

  if (!state || !state.active) {
    const result = { active: false };
    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Focus mode is not active.');
    }
    return result;
  }

  const now = new Date();
  const startedAt = new Date(state.startedAt);
  const elapsedMin = Math.round((now.getTime() - startedAt.getTime()) / 60000);

  const result = {
    active: true,
    startedAt: state.startedAt,
    elapsedMin,
  };

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Focus mode active for ${elapsedMin} min (since ${state.startedAt}).`);
  }
  return result;
}

function focusHistory(args) {
  const entries = loadHistory();
  const format = extractFlag(args, '--format');

  if (format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
    return entries;
  }

  if (entries.length === 0) {
    console.log('No focus history.');
    return [];
  }

  console.log(`\nFocus History (${entries.length}):\n`);
  for (const e of entries) {
    console.log(`  ${e.startedAt}  ${e.durationMin} min`);
  }
  console.log('');
  return entries;
}

function focusStats(args) {
  const entries = loadHistory();
  const format = extractFlag(args, '--format');
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayMin = 0;
  let weekMin = 0;
  let monthMin = 0;
  let totalMin = 0;

  for (const e of entries) {
    const started = new Date(e.startedAt);
    const dur = e.durationMin || 0;
    totalMin += dur;
    if (started >= monthStart) monthMin += dur;
    if (started >= weekStart) weekMin += dur;
    if (started >= todayStart) todayMin += dur;
  }

  const result = {
    today: todayMin,
    week: weekMin,
    month: monthMin,
    total: totalMin,
    sessions: entries.length,
  };

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Focus Stats:`);
    console.log(`  Today: ${todayMin} min`);
    console.log(`  Week:  ${weekMin} min`);
    console.log(`  Month: ${monthMin} min`);
    console.log(`  Total: ${totalMin} min (${entries.length} sessions)`);
  }
  return result;
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runFocus(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (hasFlag(args, '--format')) {
      return focusStatus(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'on':
      return focusOn();
    case 'off':
      return focusOff();
    case 'status':
      return focusStatus(args.slice(1));
    case 'history':
      return focusHistory(args.slice(1));
    case 'stats':
      return focusStats(args.slice(1));
    default:
      console.error(`Unknown focus subcommand: ${sub}`);
      console.log('Run "aiox focus --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runFocus,
  focusOn,
  focusOff,
  focusStatus,
  focusHistory,
  focusStats,
  loadState,
  saveState,
  clearState,
  loadHistory,
  appendHistory,
  HELP_TEXT,
};
