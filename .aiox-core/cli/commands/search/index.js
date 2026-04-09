/**
 * Code Search Engine Command Module
 *
 * Regex search across project files with filtering and context.
 *
 * Subcommands:
 *   aiox search <pattern>                — regex search across project
 *   aiox search <pattern> --type js      — filter by file type
 *   aiox search <pattern> --ignore "dir" — ignore directories
 *   aiox search <pattern> --context 3    — show N lines of context
 *   aiox search <pattern> --format json  — output as JSON
 *   aiox search <pattern> --count        — just show match count
 *
 * @module cli/commands/search
 * @version 1.0.0
 * @story 21.3 — Code Search Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_IGNORE = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx',
]);

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Walk directory collecting files.
 * @param {string} dir
 * @param {Set<string>} ignoreDirs
 * @param {string|null} typeFilter - extension filter (e.g. 'js')
 * @param {string[]} results
 * @returns {string[]}
 */
function collectFiles(dir, ignoreDirs, typeFilter, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        collectFiles(full, ignoreDirs, typeFilter, results);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (BINARY_EXTENSIONS.has(ext)) continue;
      if (typeFilter && ext !== `.${typeFilter}`) continue;
      results.push(full);
    }
  }
  return results;
}

/**
 * Search a single file for pattern matches.
 * @param {string} filePath
 * @param {RegExp} regex
 * @param {number} contextLines
 * @returns {Array<{file: string, line: number, content: string, context: string[]}>}
 */
function searchFile(filePath, regex, contextLines) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = source.split('\n');
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      const match = {
        file: filePath,
        line: i + 1,
        content: lines[i],
      };

      if (contextLines > 0) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        match.context = [];
        for (let j = start; j <= end; j++) {
          match.context.push(`${j + 1}: ${lines[j]}`);
        }
      }

      matches.push(match);
    }
    // Reset regex lastIndex for global regex
    regex.lastIndex = 0;
  }

  return matches;
}

/**
 * Search across project files.
 * @param {string} pattern - regex pattern string
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.type] - file extension filter
 * @param {string} [options.ignore] - comma-separated dirs to ignore
 * @param {number} [options.context] - context lines
 * @param {string} [options.format] - 'text' or 'json'
 * @param {boolean} [options.count] - count only mode
 * @returns {object} search results
 */
function searchProject(pattern, options = {}) {
  const cwd = options.cwd || process.cwd();

  // Build ignore set
  const ignoreDirs = new Set(DEFAULT_IGNORE);
  if (options.ignore) {
    for (const dir of options.ignore.split(',')) {
      ignoreDirs.add(dir.trim());
    }
  }

  // Compile regex
  let regex;
  try {
    regex = new RegExp(pattern, 'g');
  } catch (e) {
    return { error: `Invalid regex: ${e.message}`, matches: [], totalMatches: 0, filesSearched: 0 };
  }

  const files = collectFiles(cwd, ignoreDirs, options.type || null);
  const contextLines = options.context || 0;

  let allMatches = [];
  for (const file of files) {
    const matches = searchFile(file, regex, contextLines);
    allMatches = allMatches.concat(matches);
  }

  return {
    pattern,
    totalMatches: allMatches.length,
    filesSearched: files.length,
    filesWithMatches: new Set(allMatches.map((m) => m.file)).size,
    matches: allMatches,
  };
}

/**
 * Format search results as text.
 * @param {object} results
 * @param {string} cwd
 * @returns {string}
 */
function formatText(results, cwd) {
  if (results.error) {
    return `Error: ${results.error}`;
  }

  const lines = [];
  lines.push(`Search: /${results.pattern}/`);
  lines.push(`Files searched: ${results.filesSearched} | Matches: ${results.totalMatches} in ${results.filesWithMatches} file(s)`);
  lines.push('');

  let currentFile = null;
  for (const match of results.matches) {
    const relFile = path.relative(cwd, match.file);
    if (relFile !== currentFile) {
      if (currentFile !== null) lines.push('');
      lines.push(`--- ${relFile} ---`);
      currentFile = relFile;
    }

    if (match.context && match.context.length > 0) {
      for (const ctx of match.context) {
        lines.push(`  ${ctx}`);
      }
      lines.push('');
    } else {
      lines.push(`  ${match.line}: ${match.content}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse CLI args and run search.
 * @param {string[]} argv
 */
function runSearch(argv = []) {
  const options = { format: 'text' };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) {
      options.type = argv[++i];
    } else if (arg === '--ignore' && argv[i + 1]) {
      options.ignore = argv[++i];
    } else if (arg === '--context' && argv[i + 1]) {
      options.context = parseInt(argv[++i], 10);
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--count') {
      options.count = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox search <pattern> [--type ext] [--ignore dirs] [--context N] [--format json] [--count]');
      return;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    console.error('Error: search pattern required');
    console.log('Usage: aiox search <pattern>');
    return;
  }

  const cwd = process.cwd();
  options.cwd = cwd;
  const results = searchProject(positional[0], options);

  if (options.count) {
    if (options.format === 'json') {
      console.log(JSON.stringify({
        pattern: results.pattern,
        totalMatches: results.totalMatches,
        filesWithMatches: results.filesWithMatches,
        filesSearched: results.filesSearched,
      }, null, 2));
    } else {
      console.log(`${results.totalMatches} match(es) in ${results.filesWithMatches} file(s)`);
    }
    return;
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatText(results, cwd));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runSearch,
  searchProject,
  searchFile,
  collectFiles,
  formatText,
};
