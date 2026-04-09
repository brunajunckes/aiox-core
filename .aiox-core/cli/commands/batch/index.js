/**
 * Batch File Operations
 *
 * Subcommands:
 *   aiox batch rename "*.test.js" --prefix "unit-"    — batch rename files
 *   aiox batch find "TODO" --type js                  — find pattern in files
 *   aiox batch replace "old" "new" --glob "src/*.js"  — batch search/replace
 *   aiox batch count --type js                        — count files by type
 *   aiox batch --dry-run                              — preview without executing
 *   aiox batch --help                                 — show help
 *
 * @module cli/commands/batch
 * @version 1.0.0
 * @story 15.4 — Batch File Operations
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const IGNORE_DIRS = ['node_modules', '.git', 'coverage', 'dist'];

const HELP_TEXT = `
BATCH FILE OPERATIONS

USAGE:
  aiox batch rename "<glob>" --prefix "<prefix>"      Batch rename with prefix
  aiox batch rename "<glob>" --suffix "<suffix>"      Batch rename with suffix
  aiox batch find "<pattern>" --type <ext>             Find pattern in files by type
  aiox batch replace "<old>" "<new>" --glob "<glob>"   Batch search/replace in files
  aiox batch count --type <ext>                        Count files by extension
  aiox batch --dry-run <subcommand> [args]             Preview without executing
  aiox batch --help                                    Show this help

EXAMPLES:
  aiox batch rename "*.test.js" --prefix "unit-"
  aiox batch find "TODO" --type js
  aiox batch replace "oldFunc" "newFunc" --glob "src/**/*.js"
  aiox batch count --type js
  aiox batch --dry-run rename "*.txt" --prefix "old-"
`.trim();

// ── File Discovery ──────────────────────────────────────────────────────────

/**
 * Check if a directory should be ignored.
 * @param {string} dirName
 * @returns {boolean}
 */
function shouldIgnoreDir(dirName) {
  return IGNORE_DIRS.includes(dirName);
}

/**
 * Recursively collect files matching a condition.
 * @param {string} dir
 * @param {function} filter - (filePath, fileName) => boolean
 * @param {string[]} [result]
 * @returns {string[]}
 */
function collectFiles(dir, filter, result = []) {
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (!shouldIgnoreDir(entry)) {
            collectFiles(full, filter, result);
          }
        } else if (stat.isFile()) {
          if (filter(full, entry)) {
            result.push(full);
          }
        }
      } catch {
        // Skip inaccessible
      }
    }
  } catch {
    // Skip unreadable dirs
  }
  return result;
}

/**
 * Match a filename against a simple glob pattern.
 * Supports: *.js, *.test.js, src/*.js, **\/*.ts
 * @param {string} filePath
 * @param {string} pattern
 * @returns {boolean}
 */
function matchGlob(filePath, pattern) {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = path.basename(normalized);

  // Simple extension match: *.ext
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1); // .ext
    return fileName.endsWith(ext);
  }

  // Convert glob to regex
  let regex = pattern
    .replace(/\\/g, '/')
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');

  try {
    // Try matching against full path and basename
    const fullRegex = new RegExp('^(' + regex + ')$');
    return fullRegex.test(normalized) || fullRegex.test(fileName);
  } catch {
    return false;
  }
}

/**
 * Find files by extension type.
 * @param {string} dir
 * @param {string} ext - Extension without dot (e.g. "js")
 * @returns {string[]}
 */
function findFilesByType(dir, ext) {
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  return collectFiles(dir, (filePath, fileName) => fileName.endsWith(dotExt));
}

/**
 * Find files matching a glob pattern.
 * @param {string} dir
 * @param {string} pattern
 * @returns {string[]}
 */
function findFilesByGlob(dir, pattern) {
  return collectFiles(dir, (filePath, fileName) => matchGlob(filePath, pattern));
}

// ── Batch Operations ────────────────────────────────────────────────────────

/**
 * Batch rename files with prefix/suffix.
 * @param {string} dir
 * @param {string} glob
 * @param {object} options
 * @param {string} [options.prefix]
 * @param {string} [options.suffix]
 * @param {boolean} [options.dryRun]
 * @returns {Array<{from: string, to: string, done: boolean}>}
 */
function batchRename(dir, glob, options = {}) {
  const files = findFilesByGlob(dir, glob);
  const results = [];

  for (const filePath of files) {
    const dirName = path.dirname(filePath);
    const baseName = path.basename(filePath);
    const ext = path.extname(baseName);
    const nameWithoutExt = baseName.slice(0, baseName.length - ext.length);

    let newName = baseName;
    if (options.prefix) {
      newName = options.prefix + baseName;
    }
    if (options.suffix) {
      newName = nameWithoutExt + options.suffix + ext;
    }

    const newPath = path.join(dirName, newName);
    const entry = { from: filePath, to: newPath, done: false };

    if (!options.dryRun && filePath !== newPath) {
      try {
        fs.renameSync(filePath, newPath);
        entry.done = true;
      } catch {
        entry.done = false;
      }
    } else if (options.dryRun) {
      entry.done = false; // dry-run, not executed
    }

    results.push(entry);
  }

  return results;
}

/**
 * Find a text pattern in files of a given type.
 * @param {string} dir
 * @param {string} pattern - Text pattern to search for
 * @param {string} ext - File extension (e.g. "js")
 * @returns {Array<{file: string, line: number, content: string}>}
 */
function batchFind(dir, pattern, ext) {
  const files = findFilesByType(dir, ext);
  const matches = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
          matches.push({
            file: filePath,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return matches;
}

/**
 * Batch search and replace in files.
 * @param {string} dir
 * @param {string} oldText
 * @param {string} newText
 * @param {string} glob
 * @param {object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Array<{file: string, replacements: number, done: boolean}>}
 */
function batchReplace(dir, oldText, newText, glob, options = {}) {
  const files = findFilesByGlob(dir, glob);
  const results = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const count = content.split(oldText).length - 1;

      if (count > 0) {
        const entry = { file: filePath, replacements: count, done: false };

        if (!options.dryRun) {
          const newContent = content.split(oldText).join(newText);
          fs.writeFileSync(filePath, newContent, 'utf8');
          entry.done = true;
        }

        results.push(entry);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

/**
 * Count files by extension type.
 * @param {string} dir
 * @param {string} ext
 * @returns {{ count: number, files: string[] }}
 */
function batchCount(dir, ext) {
  const files = findFilesByType(dir, ext);
  return { count: files.length, files };
}

// ── Formatters ──────────────────────────────────────────────────────────────

/**
 * Format rename results.
 * @param {Array} results
 * @param {boolean} dryRun
 * @returns {string}
 */
function formatRenameResults(results, dryRun) {
  if (!results.length) return 'No files matched the pattern.';
  const prefix = dryRun ? '[DRY-RUN] ' : '';
  const lines = [`${prefix}Rename results (${results.length} files):`];
  for (const r of results) {
    const fromBase = path.basename(r.from);
    const toBase = path.basename(r.to);
    const status = dryRun ? 'PREVIEW' : (r.done ? 'OK' : 'SKIP');
    lines.push(`  ${status}: ${fromBase} -> ${toBase}`);
  }
  return lines.join('\n');
}

/**
 * Format find results.
 * @param {Array} results
 * @returns {string}
 */
function formatFindResults(results) {
  if (!results.length) return 'No matches found.';
  const lines = [`Found ${results.length} matches:`];
  for (const r of results) {
    const rel = path.basename(r.file);
    lines.push(`  ${rel}:${r.line}: ${r.content}`);
  }
  return lines.join('\n');
}

/**
 * Format replace results.
 * @param {Array} results
 * @param {boolean} dryRun
 * @returns {string}
 */
function formatReplaceResults(results, dryRun) {
  if (!results.length) return 'No replacements needed.';
  const prefix = dryRun ? '[DRY-RUN] ' : '';
  const total = results.reduce((sum, r) => sum + r.replacements, 0);
  const lines = [`${prefix}Replace results: ${total} replacements in ${results.length} files`];
  for (const r of results) {
    const rel = path.basename(r.file);
    const status = dryRun ? 'PREVIEW' : (r.done ? 'OK' : 'SKIP');
    lines.push(`  ${status}: ${rel} (${r.replacements} replacements)`);
  }
  return lines.join('\n');
}

/**
 * Format count results.
 * @param {{ count: number, files: string[] }} result
 * @param {string} ext
 * @returns {string}
 */
function formatCountResults(result, ext) {
  return `Found ${result.count} .${ext} files`;
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Parse batch arguments.
 * @param {string[]} argv
 * @returns {object}
 */
function parseBatchArgs(argv) {
  const result = {
    help: false,
    dryRun: false,
    sub: null,
    args: [],
    prefix: null,
    suffix: null,
    type: null,
    glob: null,
  };

  if (!argv || !argv.length) {
    result.help = true;
    return result;
  }

  const filtered = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--prefix' && argv[i + 1]) {
      result.prefix = argv[++i];
    } else if (arg === '--suffix' && argv[i + 1]) {
      result.suffix = argv[++i];
    } else if (arg === '--type' && argv[i + 1]) {
      result.type = argv[++i];
    } else if (arg === '--glob' && argv[i + 1]) {
      result.glob = argv[++i];
    } else {
      filtered.push(arg);
    }
  }

  result.sub = filtered[0] || null;
  result.args = filtered.slice(1);
  return result;
}

/**
 * Main entry point for the batch command.
 * @param {string[]} argv
 */
function runBatch(argv) {
  const parsed = parseBatchArgs(argv);

  if (parsed.help) {
    console.log(HELP_TEXT);
    return;
  }

  const cwd = process.cwd();

  switch (parsed.sub) {
    case 'rename': {
      const pattern = parsed.args[0];
      if (!pattern) {
        console.error('Error: Glob pattern required. Usage: aiox batch rename "<glob>" --prefix "<prefix>"');
        process.exitCode = 1;
        return;
      }
      if (!parsed.prefix && !parsed.suffix) {
        console.error('Error: --prefix or --suffix required');
        process.exitCode = 1;
        return;
      }
      const results = batchRename(cwd, pattern, {
        prefix: parsed.prefix,
        suffix: parsed.suffix,
        dryRun: parsed.dryRun,
      });
      console.log(formatRenameResults(results, parsed.dryRun));
      break;
    }

    case 'find': {
      const pattern = parsed.args[0];
      if (!pattern) {
        console.error('Error: Search pattern required. Usage: aiox batch find "<pattern>" --type <ext>');
        process.exitCode = 1;
        return;
      }
      if (!parsed.type) {
        console.error('Error: --type required. Usage: aiox batch find "<pattern>" --type <ext>');
        process.exitCode = 1;
        return;
      }
      const results = batchFind(cwd, pattern, parsed.type);
      console.log(formatFindResults(results));
      break;
    }

    case 'replace': {
      const oldText = parsed.args[0];
      const newText = parsed.args[1];
      if (!oldText || !newText) {
        console.error('Error: Old and new text required. Usage: aiox batch replace "<old>" "<new>" --glob "<glob>"');
        process.exitCode = 1;
        return;
      }
      if (!parsed.glob) {
        console.error('Error: --glob required. Usage: aiox batch replace "<old>" "<new>" --glob "<glob>"');
        process.exitCode = 1;
        return;
      }
      const results = batchReplace(cwd, oldText, newText, parsed.glob, { dryRun: parsed.dryRun });
      console.log(formatReplaceResults(results, parsed.dryRun));
      break;
    }

    case 'count': {
      if (!parsed.type) {
        console.error('Error: --type required. Usage: aiox batch count --type <ext>');
        process.exitCode = 1;
        return;
      }
      const result = batchCount(cwd, parsed.type);
      console.log(formatCountResults(result, parsed.type));
      break;
    }

    default: {
      if (!parsed.sub) {
        console.log(HELP_TEXT);
      } else {
        console.error(`Unknown subcommand: ${parsed.sub}`);
        console.log('Run "aiox batch --help" for usage');
        process.exitCode = 1;
      }
      break;
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  shouldIgnoreDir,
  collectFiles,
  matchGlob,
  findFilesByType,
  findFilesByGlob,
  batchRename,
  batchFind,
  batchReplace,
  batchCount,
  formatRenameResults,
  formatFindResults,
  formatReplaceResults,
  formatCountResults,
  parseBatchArgs,
  runBatch,
  getHelpText: () => HELP_TEXT,
  IGNORE_DIRS,
};
