/**
 * Code Snippet Manager Command Module
 *
 * Save, retrieve, search, and manage code snippets.
 *
 * Subcommands:
 *   aiox snippets list                         — list saved snippets
 *   aiox snippets add <name> --file <path> --lines 10-20 — save from file
 *   aiox snippets add <name> --content "code"  — save inline
 *   aiox snippets get <name>                   — output snippet content
 *   aiox snippets remove <name>                — delete snippet
 *   aiox snippets search <term>                — search names and content
 *   aiox snippets export                       — export all as JSON
 *
 * @module cli/commands/snippets
 * @version 1.0.0
 * @story 21.4 — Code Snippet Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SNIPPETS_FILENAME = '.aiox/snippets.json';

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get snippets file path.
 * @param {string} [cwd]
 * @returns {string}
 */
function getSnippetsPath(cwd) {
  return path.join(cwd || process.cwd(), SNIPPETS_FILENAME);
}

/**
 * Load snippets from disk.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {object} snippets map { name: { content, language, createdAt, tags, source } }
 */
function loadSnippets(options = {}) {
  const filePath = getSnippetsPath(options.cwd);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Save snippets to disk.
 * @param {object} snippets
 * @param {object} [options]
 * @param {string} [options.cwd]
 */
function saveSnippets(snippets, options = {}) {
  const filePath = getSnippetsPath(options.cwd);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2));
}

/**
 * Add a snippet.
 * @param {string} name
 * @param {object} data
 * @param {string} data.content
 * @param {string} [data.language]
 * @param {string[]} [data.tags]
 * @param {string} [data.source]
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {object} the saved snippet
 */
function addSnippet(name, data, options = {}) {
  const snippets = loadSnippets(options);
  const snippet = {
    content: data.content,
    language: data.language || detectLanguage(data.source || ''),
    createdAt: new Date().toISOString(),
    tags: data.tags || [],
    source: data.source || null,
  };
  snippets[name] = snippet;
  saveSnippets(snippets, options);
  return snippet;
}

/**
 * Get a snippet by name.
 * @param {string} name
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {object|null}
 */
function getSnippet(name, options = {}) {
  const snippets = loadSnippets(options);
  return snippets[name] || null;
}

/**
 * Remove a snippet by name.
 * @param {string} name
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {boolean} true if removed
 */
function removeSnippet(name, options = {}) {
  const snippets = loadSnippets(options);
  if (!(name in snippets)) return false;
  delete snippets[name];
  saveSnippets(snippets, options);
  return true;
}

/**
 * List all snippet names.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<{name: string, language: string, createdAt: string}>}
 */
function listSnippets(options = {}) {
  const snippets = loadSnippets(options);
  return Object.entries(snippets).map(([name, s]) => ({
    name,
    language: s.language || 'unknown',
    createdAt: s.createdAt || 'unknown',
    contentLength: (s.content || '').length,
  }));
}

/**
 * Search snippets by term (name and content).
 * @param {string} term
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<{name: string, snippet: object}>}
 */
function searchSnippets(term, options = {}) {
  const snippets = loadSnippets(options);
  const lowerTerm = term.toLowerCase();
  const results = [];

  for (const [name, snippet] of Object.entries(snippets)) {
    const nameMatch = name.toLowerCase().includes(lowerTerm);
    const contentMatch = (snippet.content || '').toLowerCase().includes(lowerTerm);
    const tagMatch = (snippet.tags || []).some((t) => t.toLowerCase().includes(lowerTerm));

    if (nameMatch || contentMatch || tagMatch) {
      results.push({ name, snippet });
    }
  }

  return results;
}

/**
 * Extract lines from a file.
 * @param {string} filePath
 * @param {string} lineRange - e.g. "10-20"
 * @param {string} [cwd]
 * @returns {string}
 */
function extractFileLines(filePath, lineRange, cwd) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(cwd || process.cwd(), filePath);
  const source = fs.readFileSync(absPath, 'utf8');
  const lines = source.split('\n');

  if (!lineRange) return source;

  const parts = lineRange.split('-').map(Number);
  const start = Math.max(1, parts[0]) - 1;
  const end = parts[1] ? Math.min(lines.length, parts[1]) : start + 1;

  return lines.slice(start, end).join('\n');
}

/**
 * Detect language from file extension.
 * @param {string} filePath
 * @returns {string}
 */
function detectLanguage(filePath) {
  if (!filePath) return 'text';
  const ext = path.extname(filePath);
  const map = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.css': 'css',
    '.html': 'html',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.md': 'markdown',
  };
  return map[ext] || 'text';
}

/**
 * Parse CLI args and run snippets command.
 * @param {string[]} argv
 */
function runSnippets(argv = []) {
  const subcommand = argv[0];
  const cwd = process.cwd();
  const opts = { cwd };

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log('Usage: aiox snippets <list|add|get|remove|search|export> [options]');
    return;
  }

  switch (subcommand) {
    case 'list': {
      const items = listSnippets(opts);
      if (items.length === 0) {
        console.log('No snippets saved.');
      } else {
        console.log(`Snippets (${items.length}):\n`);
        for (const item of items) {
          console.log(`  ${item.name} [${item.language}] (${item.contentLength} chars)`);
        }
      }
      break;
    }

    case 'add': {
      const name = argv[1];
      if (!name) {
        console.error('Error: snippet name required');
        return;
      }

      let content = null;
      let filePath = null;
      let lineRange = null;

      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--file' && argv[i + 1]) {
          filePath = argv[++i];
        } else if (argv[i] === '--lines' && argv[i + 1]) {
          lineRange = argv[++i];
        } else if (argv[i] === '--content' && argv[i + 1]) {
          content = argv[++i];
        }
      }

      if (filePath) {
        try {
          content = extractFileLines(filePath, lineRange, cwd);
        } catch (e) {
          console.error(`Error reading file: ${e.message}`);
          return;
        }
      }

      if (!content) {
        console.error('Error: --content or --file required');
        return;
      }

      addSnippet(name, { content, source: filePath }, opts);
      console.log(`Snippet '${name}' saved.`);
      break;
    }

    case 'get': {
      const name = argv[1];
      if (!name) {
        console.error('Error: snippet name required');
        return;
      }
      const snippet = getSnippet(name, opts);
      if (!snippet) {
        console.error(`Snippet '${name}' not found.`);
        return;
      }
      console.log(snippet.content);
      break;
    }

    case 'remove': {
      const name = argv[1];
      if (!name) {
        console.error('Error: snippet name required');
        return;
      }
      const removed = removeSnippet(name, opts);
      if (removed) {
        console.log(`Snippet '${name}' removed.`);
      } else {
        console.error(`Snippet '${name}' not found.`);
      }
      break;
    }

    case 'search': {
      const term = argv[1];
      if (!term) {
        console.error('Error: search term required');
        return;
      }
      const results = searchSnippets(term, opts);
      if (results.length === 0) {
        console.log('No matching snippets found.');
      } else {
        console.log(`Found ${results.length} snippet(s):\n`);
        for (const r of results) {
          console.log(`  ${r.name} [${r.snippet.language || 'text'}]`);
        }
      }
      break;
    }

    case 'export': {
      const snippets = loadSnippets(opts);
      console.log(JSON.stringify(snippets, null, 2));
      break;
    }

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.log('Usage: aiox snippets <list|add|get|remove|search|export>');
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runSnippets,
  loadSnippets,
  saveSnippets,
  addSnippet,
  getSnippet,
  removeSnippet,
  listSnippets,
  searchSnippets,
  extractFileLines,
  detectLanguage,
  getSnippetsPath,
};
