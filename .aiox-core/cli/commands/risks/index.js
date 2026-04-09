/**
 * Risk Register Command Module
 *
 * Subcommands:
 *   aiox risks add "<title>" --severity high --mitigation "<plan>"  — add risk
 *   aiox risks list                                                  — list all risks sorted by severity
 *   aiox risks update <id> --status mitigated                        — update status
 *   aiox risks remove <id>                                           — delete
 *   aiox risks --format json                                         — as JSON
 *
 * @module cli/commands/risks
 * @version 1.0.0
 * @story 27.2 — Risk Register
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const RISKS_FILE = () => path.join(process.cwd(), '.aiox', 'risks.json');

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES = ['open', 'mitigated', 'closed'];

const HELP_TEXT = `
RISK REGISTER

USAGE:
  aiox risks add "<title>" --severity high --mitigation "<plan>"  Add a risk
  aiox risks list                                                  List all risks sorted by severity
  aiox risks list --format json                                    List as JSON
  aiox risks update <id> --status mitigated                        Update risk status
  aiox risks remove <id>                                           Delete a risk
  aiox risks --help                                                Show this help

SEVERITIES: critical, high, medium, low
STATUSES:   open, mitigated, closed

EXAMPLES:
  aiox risks add "Data loss" --severity critical --mitigation "Daily backups"
  aiox risks update abc123 --status mitigated
  aiox risks list --format json
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

function loadRisks() {
  const filePath = RISKS_FILE();
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

function saveRisks(risks) {
  const filePath = RISKS_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(risks, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addRisk(title, args) {
  if (!title) {
    console.error('Error: title is required. Usage: aiox risks add "<title>" --severity high --mitigation "<plan>"');
    return null;
  }

  const severity = (extractFlag(args, '--severity') || 'medium').toLowerCase();
  if (!VALID_SEVERITIES.includes(severity)) {
    console.error(`Error: invalid severity "${severity}". Valid: ${VALID_SEVERITIES.join(', ')}`);
    return null;
  }

  const mitigation = extractFlag(args, '--mitigation') || '';

  const risk = {
    id: generateId(),
    title,
    severity,
    status: 'open',
    mitigation,
    createdAt: new Date().toISOString(),
  };

  const risks = loadRisks();
  risks.push(risk);
  saveRisks(risks);

  console.log(`Risk added: ${risk.id} — [${risk.severity.toUpperCase()}] ${risk.title}`);
  return risk;
}

function listRisks(args) {
  const risks = loadRisks();
  const format = extractFlag(args, '--format');

  if (risks.length === 0) {
    if (format === 'json') {
      console.log('[]');
    } else {
      console.log('No risks registered.');
    }
    return [];
  }

  // Sort by severity
  const sorted = [...risks].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] !== undefined ? SEVERITY_ORDER[a.severity] : 99;
    const sb = SEVERITY_ORDER[b.severity] !== undefined ? SEVERITY_ORDER[b.severity] : 99;
    return sa - sb;
  });

  if (format === 'json') {
    console.log(JSON.stringify(sorted, null, 2));
    return sorted;
  }

  console.log(`\nRisks (${sorted.length}):\n`);
  for (const r of sorted) {
    const sev = r.severity.toUpperCase().padEnd(8);
    const sts = r.status.toUpperCase().padEnd(10);
    console.log(`  ${r.id}  [${sev}] ${sts} ${r.title}`);
  }
  console.log('');

  return sorted;
}

function updateRisk(id, args) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox risks update <id> --status mitigated');
    return null;
  }

  const risks = loadRisks();
  const risk = risks.find(r => r.id === id);

  if (!risk) {
    console.error(`Risk not found: ${id}`);
    return null;
  }

  const status = extractFlag(args, '--status');
  if (status) {
    const lower = status.toLowerCase();
    if (!VALID_STATUSES.includes(lower)) {
      console.error(`Error: invalid status "${status}". Valid: ${VALID_STATUSES.join(', ')}`);
      return null;
    }
    risk.status = lower;
  }

  const severity = extractFlag(args, '--severity');
  if (severity) {
    const lower = severity.toLowerCase();
    if (!VALID_SEVERITIES.includes(lower)) {
      console.error(`Error: invalid severity "${severity}". Valid: ${VALID_SEVERITIES.join(', ')}`);
      return null;
    }
    risk.severity = lower;
  }

  const mitigation = extractFlag(args, '--mitigation');
  if (mitigation) {
    risk.mitigation = mitigation;
  }

  saveRisks(risks);
  console.log(`Risk updated: ${risk.id} — [${risk.severity.toUpperCase()}] ${risk.title} (${risk.status})`);
  return risk;
}

function removeRisk(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox risks remove <id>');
    return false;
  }

  const risks = loadRisks();
  const idx = risks.findIndex(r => r.id === id);

  if (idx === -1) {
    console.error(`Risk not found: ${id}`);
    return false;
  }

  const removed = risks.splice(idx, 1)[0];
  saveRisks(risks);
  console.log(`Risk removed: ${removed.id} — ${removed.title}`);
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

function runRisks(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    if (args.includes('--format')) {
      return listRisks(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addRisk(args[1], args.slice(2));
    case 'list':
      return listRisks(args.slice(1));
    case 'update':
      return updateRisk(args[1], args.slice(2));
    case 'remove':
      return removeRisk(args[1]);
    default:
      console.error(`Unknown risks subcommand: ${sub}`);
      console.log('Run "aiox risks --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runRisks,
  loadRisks,
  saveRisks,
  addRisk,
  listRisks,
  updateRisk,
  removeRisk,
  generateId,
  HELP_TEXT,
  VALID_SEVERITIES,
  VALID_STATUSES,
  SEVERITY_ORDER,
};
