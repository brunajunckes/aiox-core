/**
 * Team Notes & Knowledge Base Command Module
 *
 * Subcommands:
 *   aiox notes add <title> --content "text"  — add a note
 *   aiox notes list                          — list all notes
 *   aiox notes get <id>                      — show note content
 *   aiox notes search <term>                 — search notes
 *   aiox notes remove <id>                   — delete note
 *   aiox notes export                        — export all as JSON
 *   aiox notes --tags "bug,feature"          — filter by tags
 *
 * @module cli/commands/notes
 * @version 1.0.0
 * @story 25.1 — Team Notes & Knowledge Base
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const NOTES_FILE = () => path.join(process.cwd(), '.aiox', 'notes.json');

const HELP_TEXT = `
TEAM NOTES & KNOWLEDGE BASE

USAGE:
  aiox notes add <title> --content "text"   Add a new note
  aiox notes add <title> --tags "a,b"       Add note with tags
  aiox notes list                           List all notes
  aiox notes list --tags "bug,feature"      Filter by tags
  aiox notes get <id>                       Show note details
  aiox notes search <term>                  Search notes by title/content
  aiox notes remove <id>                    Delete a note
  aiox notes export                         Export all notes as JSON
  aiox notes --help                         Show this help

EXAMPLES:
  aiox notes add "API Design" --content "Use REST for public endpoints"
  aiox notes add "Bug Fix" --content "Memory leak in parser" --tags "bug,urgent"
  aiox notes list --tags "bug"
  aiox notes search "API"
  aiox notes export > backup.json
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

function loadNotes() {
  const filePath = NOTES_FILE();
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

function saveNotes(notes) {
  const filePath = NOTES_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(notes, null, 2), 'utf8');
}

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ── Commands ─────────────────────────────────────────────────────────────────

function addNote(title, args) {
  if (!title) {
    console.error('Error: title is required. Usage: aiox notes add <title> --content "text"');
    return null;
  }

  const content = extractFlag(args, '--content') || '';
  const tagsRaw = extractFlag(args, '--tags') || '';
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const note = {
    id: generateId(),
    title,
    content,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const notes = loadNotes();
  notes.push(note);
  saveNotes(notes);

  console.log(`Note added: ${note.id} — ${note.title}`);
  return note;
}

function listNotes(args) {
  const notes = loadNotes();
  const tagsRaw = extractFlag(args, '--tags') || '';
  const filterTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  let filtered = notes;
  if (filterTags.length > 0) {
    filtered = notes.filter(n =>
      n.tags && filterTags.some(t => n.tags.includes(t)),
    );
  }

  if (filtered.length === 0) {
    console.log('No notes found.');
    return [];
  }

  console.log(`\nNotes (${filtered.length}):\n`);
  for (const note of filtered) {
    const tags = note.tags && note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : '';
    console.log(`  ${note.id}  ${note.title}${tags}`);
  }
  console.log('');

  return filtered;
}

function getNote(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox notes get <id>');
    return null;
  }

  const notes = loadNotes();
  const note = notes.find(n => n.id === id);

  if (!note) {
    console.error(`Note not found: ${id}`);
    return null;
  }

  console.log(`\nID:      ${note.id}`);
  console.log(`Title:   ${note.title}`);
  console.log(`Content: ${note.content}`);
  console.log(`Tags:    ${note.tags && note.tags.length > 0 ? note.tags.join(', ') : '(none)'}`);
  console.log(`Created: ${note.createdAt}`);
  console.log(`Updated: ${note.updatedAt}\n`);

  return note;
}

function searchNotes(term) {
  if (!term) {
    console.error('Error: search term is required. Usage: aiox notes search <term>');
    return [];
  }

  const notes = loadNotes();
  const lower = term.toLowerCase();
  const results = notes.filter(n =>
    n.title.toLowerCase().includes(lower) ||
    (n.content && n.content.toLowerCase().includes(lower)),
  );

  if (results.length === 0) {
    console.log(`No notes matching "${term}".`);
    return [];
  }

  console.log(`\nSearch results for "${term}" (${results.length}):\n`);
  for (const note of results) {
    console.log(`  ${note.id}  ${note.title}`);
  }
  console.log('');

  return results;
}

function removeNote(id) {
  if (!id) {
    console.error('Error: id is required. Usage: aiox notes remove <id>');
    return false;
  }

  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === id);

  if (idx === -1) {
    console.error(`Note not found: ${id}`);
    return false;
  }

  const removed = notes.splice(idx, 1)[0];
  saveNotes(notes);
  console.log(`Note removed: ${removed.id} — ${removed.title}`);
  return true;
}

function exportNotes() {
  const notes = loadNotes();
  const json = JSON.stringify(notes, null, 2);
  console.log(json);
  return notes;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runNotes(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    // Check for --tags at top level: aiox notes --tags "x"
    if (sub === '--tags' || args.includes('--tags')) {
      return listNotes(args);
    }
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'add':
      return addNote(args[1], args.slice(2));
    case 'list':
      return listNotes(args.slice(1));
    case 'get':
      return getNote(args[1]);
    case 'search':
      return searchNotes(args[1]);
    case 'remove':
      return removeNote(args[1]);
    case 'export':
      return exportNotes();
    default:
      console.error(`Unknown notes subcommand: ${sub}`);
      console.log('Run "aiox notes --help" for usage.');
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runNotes,
  loadNotes,
  saveNotes,
  addNote,
  listNotes,
  getNote,
  searchNotes,
  removeNote,
  exportNotes,
  generateId,
  HELP_TEXT,
};
