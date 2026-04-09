/**
 * TODO/FIXME Tracker Command Module
 *
 * Lists all TODO, FIXME, HACK, XXX comments in source code.
 *
 * Subcommands:
 *   aiox todos                    — list all tagged comments
 *   aiox todos --type TODO        — filter by type
 *   aiox todos --format json      — output as JSON
 *   aiox todos --assignee <name>  — filter by assignee
 *   aiox todos --count            — just show counts
 *   aiox todos --sort priority    — sort by type priority
 *
 * @module cli/commands/todos
 * @version 1.0.0
 * @story 22.3 — TODO/FIXME Tracker
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.yaml', '.yml', '.md', '.sh']);

/**
 * Priority map for tag types (lower = higher priority).
 */
const PRIORITY_MAP = {
  FIXME: 1,
  TODO: 2,
  HACK: 3,
  XXX: 4,
};

const TAG_TYPES = Object.keys(PRIORITY_MAP);

/**
 * Pattern to match tagged comments: TODO, FIXME, HACK, XXX
 * Optionally captures assignee: TODO(@name) or TODO(name)
 */
const TAG_PATTERN = /\b(FIXME|TODO|HACK|XXX)\s*(?:\((@?\w+)\))?\s*[:\-]?\s*(.*)/;

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Walk directory collecting source files.
 * @param {string} dir
 * @param {string[]} results
 * @returns {string[]}
 */
function collectFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectFiles(full, results);
      }
    } else if (entry.isFile() && DEFAULT_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }

  return results;
}

/**
 * Parse a single file for tagged comments.
 * @param {string} filePath
 * @returns {Array<{file: string, line: number, type: string, assignee: string|null, text: string}>}
 */
function parseFile(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const results = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TAG_PATTERN);
    if (match) {
      const type = match[1];
      let assignee = match[2] || null;
      if (assignee && assignee.startsWith('@')) {
        assignee = assignee.slice(1);
      }
      const text = (match[3] || '').trim();

      results.push({
        file: filePath,
        line: i + 1,
        type,
        assignee,
        text,
      });
    }
  }

  return results;
}

/**
 * Find all tagged comments across the project.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.type] - filter by tag type (TODO, FIXME, etc.)
 * @param {string} [options.assignee] - filter by assignee name
 * @param {string} [options.sort] - 'priority' to sort by type priority
 * @returns {Array<{file: string, line: number, type: string, assignee: string|null, text: string}>}
 */
function findTodos(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = collectFiles(cwd);

  let results = [];
  for (const file of files) {
    results = results.concat(parseFile(file));
  }

  // Filter by type
  if (options.type) {
    const filterType = options.type.toUpperCase();
    results = results.filter(r => r.type === filterType);
  }

  // Filter by assignee
  if (options.assignee) {
    const filterAssignee = options.assignee.toLowerCase();
    results = results.filter(r => r.assignee && r.assignee.toLowerCase() === filterAssignee);
  }

  // Sort by priority
  if (options.sort === 'priority') {
    results.sort((a, b) => {
      const pa = PRIORITY_MAP[a.type] || 99;
      const pb = PRIORITY_MAP[b.type] || 99;
      return pa - pb;
    });
  }

  return results;
}

/**
 * Count todos grouped by type.
 * @param {Array} results
 * @returns {Object<string, number>}
 */
function countByType(results) {
  const counts = {};
  for (const r of results) {
    counts[r.type] = (counts[r.type] || 0) + 1;
  }
  return counts;
}

/**
 * Format results as text.
 * @param {Array} results
 * @param {string} cwd
 * @param {boolean} countOnly
 * @returns {string}
 */
function formatText(results, cwd, countOnly) {
  if (countOnly) {
    const counts = countByType(results);
    const lines = ['TODO/FIXME Summary', '='.repeat(30), ''];
    for (const type of TAG_TYPES) {
      if (counts[type]) {
        lines.push(`${type}: ${counts[type]}`);
      }
    }
    lines.push('', `Total: ${results.length}`);
    return lines.join('\n');
  }

  if (results.length === 0) {
    return 'No TODO/FIXME/HACK/XXX comments found.';
  }

  const lines = [];
  lines.push('TODO/FIXME Tracker');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(`${'Type'.padEnd(8)} ${'Line'.toString().padEnd(6)} ${'Assignee'.padEnd(12)} ${'File'.padEnd(25)} Text`);
  lines.push('-'.repeat(70));

  for (const r of results) {
    const relFile = path.relative(cwd, r.file);
    const type = r.type.padEnd(8);
    const line = String(r.line).padEnd(6);
    const assignee = (r.assignee || '-').padEnd(12);
    const file = relFile.length > 23 ? '...' + relFile.slice(-22) : relFile.padEnd(25);
    const text = r.text.length > 40 ? r.text.slice(0, 40) + '...' : r.text;
    lines.push(`${type} ${line} ${assignee} ${file} ${text}`);
  }

  lines.push('');
  lines.push(`Total: ${results.length}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run todos tracker.
 * @param {string[]} argv
 */
function runTodos(argv = []) {
  const options = { format: 'text', count: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) {
      options.type = argv[++i];
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--assignee' && argv[i + 1]) {
      options.assignee = argv[++i];
    } else if (arg === '--count') {
      options.count = true;
    } else if (arg === '--sort' && argv[i + 1]) {
      options.sort = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox todos [--type TODO] [--format json] [--assignee name] [--count] [--sort priority]');
      return;
    }
  }

  const cwd = process.cwd();
  options.cwd = cwd;
  const results = findTodos(options);

  if (options.format === 'json') {
    if (options.count) {
      console.log(JSON.stringify(countByType(results), null, 2));
    } else {
      const jsonResults = results.map(r => ({
        ...r,
        file: path.relative(cwd, r.file),
      }));
      console.log(JSON.stringify(jsonResults, null, 2));
    }
  } else {
    console.log(formatText(results, cwd, options.count));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runTodos,
  findTodos,
  parseFile,
  collectFiles,
  countByType,
  formatText,
  PRIORITY_MAP,
  TAG_TYPES,
};
