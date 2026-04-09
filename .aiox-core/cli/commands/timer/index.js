/**
 * Pomodoro Timer Command Module
 *
 * Subcommands:
 *   aiox timer start              — start 25min pomodoro timer
 *   aiox timer start --duration 15 — custom duration
 *   aiox timer stop               — stop current timer
 *   aiox timer status             — show remaining time
 *   aiox timer history            — show completed pomodoros
 *   aiox timer --format json      — as JSON
 *
 * @module cli/commands/timer
 * @version 1.0.0
 * @story 31.1 — Pomodoro Timer
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const STATE_FILE = () => path.join(process.cwd(), '.aiox', 'timer-state.json');
const HISTORY_FILE = () => path.join(process.cwd(), '.aiox', 'timers.jsonl');
const DEFAULT_DURATION = 25;

const HELP_TEXT = `
POMODORO TIMER

USAGE:
  aiox timer start                   Start 25min pomodoro timer
  aiox timer start --duration 15     Start with custom duration (minutes)
  aiox timer stop                    Stop current timer
  aiox timer status                  Show remaining time
  aiox timer history                 Show completed pomodoros
  aiox timer --format json           Output as JSON
  aiox timer --help                  Show this help

EXAMPLES:
  aiox timer start
  aiox timer start --duration 45
  aiox timer status
  aiox timer history --format json
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

function startTimer(args) {
  const existing = loadState();
  if (existing && existing.status === 'running') {
    console.error('Error: Timer already running. Use "aiox timer stop" first.');
    return null;
  }

  const durationStr = extractFlag(args, '--duration');
  const duration = durationStr ? parseInt(durationStr, 10) : DEFAULT_DURATION;

  if (isNaN(duration) || duration <= 0) {
    console.error('Error: Duration must be a positive number.');
    return null;
  }

  const state = {
    status: 'running',
    duration,
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + duration * 60 * 1000).toISOString(),
  };

  saveState(state);
  console.log(`Timer started: ${duration} minutes`);
  return state;
}

function stopTimer() {
  const state = loadState();
  if (!state || state.status !== 'running') {
    console.error('Error: No timer is running.');
    return null;
  }

  const startedAt = new Date(state.startedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedMin = Math.round(elapsedMs / 60000);

  const entry = {
    duration: state.duration,
    startedAt: state.startedAt,
    stoppedAt: now.toISOString(),
    elapsed: elapsedMin,
    completed: elapsedMs >= state.duration * 60 * 1000,
  };

  appendHistory(entry);
  clearState();

  console.log(`Timer stopped. Elapsed: ${elapsedMin} min.`);
  return entry;
}

function timerStatus(args) {
  const state = loadState();
  const format = extractFlag(args, '--format');

  if (!state || state.status !== 'running') {
    if (format === 'json') {
      const result = { status: 'idle' };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    console.log('No timer running.');
    return { status: 'idle' };
  }

  const now = new Date();
  const endsAt = new Date(state.endsAt);
  const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
  const remainingMin = Math.ceil(remainingMs / 60000);
  const elapsed = state.duration - remainingMin;

  const result = {
    status: 'running',
    duration: state.duration,
    remaining: remainingMin,
    elapsed,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
  };

  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Timer: ${remainingMin} min remaining (${elapsed}/${state.duration} min)`);
  }
  return result;
}

function timerHistory(args) {
  const entries = loadHistory();
  const format = extractFlag(args, '--format');

  if (format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
    return entries;
  }

  if (entries.length === 0) {
    console.log('No timer history.');
    return [];
  }

  console.log(`\nTimer History (${entries.length}):\n`);
  for (const e of entries) {
    const status = e.completed ? 'completed' : 'stopped';
    console.log(`  ${e.startedAt}  ${e.duration}min  ${status}  (${e.elapsed}min elapsed)`);
  }
  console.log('');
  return entries;
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runTimer(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (hasFlag(args, '--format')) {
      return timerStatus(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'start':
      return startTimer(args.slice(1));
    case 'stop':
      return stopTimer();
    case 'status':
      return timerStatus(args.slice(1));
    case 'history':
      return timerHistory(args.slice(1));
    default:
      console.error(`Unknown timer subcommand: ${sub}`);
      console.log('Run "aiox timer --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runTimer,
  startTimer,
  stopTimer,
  timerStatus,
  timerHistory,
  loadState,
  saveState,
  clearState,
  loadHistory,
  appendHistory,
  HELP_TEXT,
  DEFAULT_DURATION,
};
