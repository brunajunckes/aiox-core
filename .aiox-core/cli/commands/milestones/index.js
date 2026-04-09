/**
 * Milestone Tracker Command Module
 *
 * Subcommands:
 *   aiox milestones add "<name>" --target "2026-05-01"  — add milestone
 *   aiox milestones list                                 — list all milestones with progress
 *   aiox milestones update <id> --progress 75            — update progress %
 *   aiox milestones complete <id>                        — mark as done
 *   aiox milestones remove <id>                          — delete
 *   aiox milestones --format json                        — as JSON
 *
 * @module cli/commands/milestones
 * @version 1.0.0
 * @story 27.1 — Milestone Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const MILESTONES_FILE = () => path.join(process.cwd(), '.aiox', 'milestones.json');

const HELP_TEXT = `
MILESTONE TRACKER

USAGE:
  aiox milestones add "<name>" --target "2026-05-01"  Add milestone with target date
  aiox milestones list                                 List all milestones with progress
  aiox milestones list --format json                   List as JSON
  aiox milestones update <id> --progress 75            Update progress percentage
  aiox milestones complete <id>                        Mark milestone as done
  aiox milestones remove <id>                          Delete a milestone
  aiox milestones --help                               Show this help

EXAMPLES:
  aiox milestones add "MVP Launch" --target "2026-05-01"
  aiox milestones update abc123 --progress 50
  aiox milestones complete abc123
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

function loadMilestones() {
  const filePath = MILESTONES_FILE();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMilestones(milestones) {
  const filePath = MILESTONES_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(milestones, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addMilestone(name, args) {
  if (!name) {
    console.error('Error: name is required. Usage: aiox milestones add "<name>" --target "2026-05-01"');
    return null;
  }

  const target = extractFlag(args, '--target') || '';

  const milestone = {
    id: generateId(),
    name,
    target,
    progress: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const milestones = loadMilestones();
  milestones.push(milestone);
  saveMilestones(milestones);

  console.log(`Milestone added: ${milestone.id} — ${milestone.name}`);
  return milestone;
}

function listMilestones(args) {
  const milestones = loadMilestones();
  const format = extractFlag(args, '--format');

  if (milestones.length === 0) {
    if (format === 'json') {
      console.log('[]');
    } else {
      console.log('No milestones found.');
    }
    return [];
  }

  if (format === 'json') {
    console.log(JSON.stringify(milestones, null, 2));
    return milestones;
  }

  console.log(`\nMilestones (${milestones.length}):\n`);
  for (const m of milestones) {
    const bar = renderProgressBar(m.progress);
    const status = m.status === 'done' ? '[DONE]' : `${m.progress}%`;
    const target = m.target ? ` (target: ${m.target})` : '';
    console.log(`  ${m.id}  ${bar} ${status} ${m.name}${target}`);
  }
  console.log('');

  return milestones;
}

function updateMilestone(id, args) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox milestones update <id> --progress 75');
    return null;
  }

  const milestones = loadMilestones();
  const milestone = milestones.find(m => m.id === id);

  if (!milestone) {
    console.error(`Milestone not found: ${id}`);
    return null;
  }

  const progressStr = extractFlag(args, '--progress');
  if (progressStr !== null) {
    const progress = parseInt(progressStr, 10);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      console.error('Error: progress must be a number between 0 and 100');
      return null;
    }
    milestone.progress = progress;
  }

  saveMilestones(milestones);
  console.log(`Milestone updated: ${milestone.id} — ${milestone.name} (${milestone.progress}%)`);
  return milestone;
}

function completeMilestone(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox milestones complete <id>');
    return null;
  }

  const milestones = loadMilestones();
  const milestone = milestones.find(m => m.id === id);

  if (!milestone) {
    console.error(`Milestone not found: ${id}`);
    return null;
  }

  milestone.status = 'done';
  milestone.progress = 100;
  milestone.completedAt = new Date().toISOString();

  saveMilestones(milestones);
  console.log(`Milestone completed: ${milestone.id} — ${milestone.name}`);
  return milestone;
}

function removeMilestone(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox milestones remove <id>');
    return false;
  }

  const milestones = loadMilestones();
  const idx = milestones.findIndex(m => m.id === id);

  if (idx === -1) {
    console.error(`Milestone not found: ${id}`);
    return false;
  }

  const removed = milestones.splice(idx, 1)[0];
  saveMilestones(milestones);
  console.log(`Milestone removed: ${removed.id} — ${removed.name}`);
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  if (!args) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function renderProgressBar(progress) {
  const width = 20;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runMilestones(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (args.includes('--format')) {
      return listMilestones(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addMilestone(args[1], args.slice(2));
    case 'list':
      return listMilestones(args.slice(1));
    case 'update':
      return updateMilestone(args[1], args.slice(2));
    case 'complete':
      return completeMilestone(args[1]);
    case 'remove':
      return removeMilestone(args[1]);
    default:
      console.error(`Unknown milestones subcommand: ${sub}`);
      console.log('Run "aiox milestones --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runMilestones,
  loadMilestones,
  saveMilestones,
  addMilestone,
  listMilestones,
  updateMilestone,
  completeMilestone,
  removeMilestone,
  generateId,
  renderProgressBar,
  HELP_TEXT,
};
