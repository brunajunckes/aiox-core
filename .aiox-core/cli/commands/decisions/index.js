/**
 * Decision Log Command Module
 *
 * Subcommands:
 *   aiox decisions add "<title>" --context "<why>" --outcome "<what>"  — log a decision
 *   aiox decisions list                                                — list all decisions
 *   aiox decisions get <id>                                            — show decision details
 *   aiox decisions search <term>                                       — search decisions
 *   aiox decisions remove <id>                                         — delete a decision
 *   aiox decisions --format json                                       — output as JSON
 *
 * @module cli/commands/decisions
 * @version 1.0.0
 * @story 25.2 — Decision Log
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const DECISIONS_FILE = () => path.join(process.cwd(), '.aiox', 'decisions.json');

const HELP_TEXT = `
DECISION LOG

USAGE:
  aiox decisions add "<title>" --context "<why>" --outcome "<what>"  Log a decision
  aiox decisions add "<title>" --alternatives "a,b"                  With alternatives
  aiox decisions add "<title>" --author "name"                       With author
  aiox decisions list                                                List all decisions
  aiox decisions list --format json                                  List as JSON
  aiox decisions get <id>                                            Show decision details
  aiox decisions search <term>                                       Search decisions
  aiox decisions remove <id>                                         Delete a decision
  aiox decisions --help                                              Show this help

EXAMPLES:
  aiox decisions add "Use PostgreSQL" --context "Need ACID compliance" --outcome "PostgreSQL selected"
  aiox decisions list --format json
  aiox decisions search "database"
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

function loadDecisions() {
  const filePath = DECISIONS_FILE();
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

function saveDecisions(decisions) {
  const filePath = DECISIONS_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(decisions, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addDecision(title, args) {
  if (!title) {
    console.error('Error: title is required. Usage: aiox decisions add "<title>" --context "<why>" --outcome "<what>"');
    return null;
  }

  const context = extractFlag(args, '--context') || '';
  const outcome = extractFlag(args, '--outcome') || '';
  const alternativesRaw = extractFlag(args, '--alternatives') || '';
  const alternatives = alternativesRaw ? alternativesRaw.split(',').map(a => a.trim()).filter(Boolean) : [];
  const author = extractFlag(args, '--author') || '';

  const decision = {
    id: generateId(),
    title,
    context,
    outcome,
    alternatives,
    date: new Date().toISOString(),
    author,
  };

  const decisions = loadDecisions();
  decisions.push(decision);
  saveDecisions(decisions);

  console.log(`Decision logged: ${decision.id} — ${decision.title}`);
  return decision;
}

function listDecisions(args) {
  const decisions = loadDecisions();
  const format = extractFlag(args, '--format');

  if (decisions.length === 0) {
    if (format === 'json') {
      console.log('[]');
    } else {
      console.log('No decisions logged.');
    }
    return [];
  }

  if (format === 'json') {
    console.log(JSON.stringify(decisions, null, 2));
    return decisions;
  }

  console.log(`\nDecisions (${decisions.length}):\n`);
  for (const d of decisions) {
    const date = d.date ? d.date.split('T')[0] : 'unknown';
    console.log(`  ${d.id}  [${date}] ${d.title}`);
  }
  console.log('');

  return decisions;
}

function getDecision(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox decisions get <id>');
    return null;
  }

  const decisions = loadDecisions();
  const decision = decisions.find(d => d.id === id);

  if (!decision) {
    console.error(`Decision not found: ${id}`);
    return null;
  }

  console.log(`\nID:           ${decision.id}`);
  console.log(`Title:        ${decision.title}`);
  console.log(`Context:      ${decision.context || '(none)'}`);
  console.log(`Outcome:      ${decision.outcome || '(none)'}`);
  console.log(`Alternatives: ${decision.alternatives && decision.alternatives.length > 0 ? decision.alternatives.join(', ') : '(none)'}`);
  console.log(`Date:         ${decision.date}`);
  console.log(`Author:       ${decision.author || '(none)'}\n`);

  return decision;
}

function searchDecisions(term) {
  if (!term) {
    console.error('Error: search term is required. Usage: aiox decisions search <term>');
    return [];
  }

  const decisions = loadDecisions();
  const lower = term.toLowerCase();
  const results = decisions.filter(d =>
    d.title.toLowerCase().includes(lower) ||
    (d.context && d.context.toLowerCase().includes(lower)) ||
    (d.outcome && d.outcome.toLowerCase().includes(lower)),
  );

  if (results.length === 0) {
    console.log(`No decisions matching "${term}".`);
    return [];
  }

  console.log(`\nSearch results for "${term}" (${results.length}):\n`);
  for (const d of results) {
    console.log(`  ${d.id}  ${d.title}`);
  }
  console.log('');

  return results;
}

function removeDecision(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox decisions remove <id>');
    return false;
  }

  const decisions = loadDecisions();
  const idx = decisions.findIndex(d => d.id === id);

  if (idx === -1) {
    console.error(`Decision not found: ${id}`);
    return false;
  }

  const removed = decisions.splice(idx, 1)[0];
  saveDecisions(decisions);
  console.log(`Decision removed: ${removed.id} — ${removed.title}`);
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  if (!args) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runDecisions(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (args.includes('--format')) {
      return listDecisions(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addDecision(args[1], args.slice(2));
    case 'list':
      return listDecisions(args.slice(1));
    case 'get':
      return getDecision(args[1]);
    case 'search':
      return searchDecisions(args[1]);
    case 'remove':
      return removeDecision(args[1]);
    default:
      console.error(`Unknown decisions subcommand: ${sub}`);
      console.log('Run "aiox decisions --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDecisions,
  loadDecisions,
  saveDecisions,
  addDecision,
  listDecisions,
  getDecision,
  searchDecisions,
  removeDecision,
  generateId,
  HELP_TEXT,
};
