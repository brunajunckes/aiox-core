/**
 * Code Duplication Finder Command Module
 *
 * Finds duplicate code blocks (3+ consecutive identical lines).
 *
 * Subcommands:
 *   aiox duplicates              — find duplicate code blocks
 *   aiox duplicates --min-lines 5 — minimum block size
 *   aiox duplicates --format json — output as JSON
 *   aiox duplicates --type js    — filter by file type
 *   aiox duplicates --threshold 80 — similarity threshold %
 *
 * @module cli/commands/duplicates
 * @version 1.0.0
 * @story 22.2 — Code Duplication Finder
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const EXTENSION_MAP = {
  js: new Set(['.js', '.mjs', '.cjs']),
  ts: new Set(['.ts', '.tsx']),
};

const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

const DEFAULT_MIN_LINES = 3;
const DEFAULT_THRESHOLD = 100;

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Walk directory collecting files by extension set.
 * @param {string} dir
 * @param {Set<string>} extensions
 * @param {string[]} results
 * @returns {string[]}
 */
function collectFiles(dir, extensions, results = []) {
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
        collectFiles(full, extensions, results);
      }
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      results.push(full);
    }
  }

  return results;
}

/**
 * Normalize a line for comparison (trim, collapse whitespace).
 * @param {string} line
 * @returns {string}
 */
function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ');
}

/**
 * Calculate similarity between two strings (0-100).
 * Uses character-level comparison.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function calculateSimilarity(a, b) {
  if (a === b) return 100;
  if (!a.length || !b.length) return 0;

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;

  if (longer.length === 0) return 100;

  // Simple character overlap similarity
  let matches = 0;
  const longerChars = longer.split('');
  const shorterChars = shorter.split('');
  const used = new Set();

  for (let i = 0; i < shorterChars.length; i++) {
    for (let j = 0; j < longerChars.length; j++) {
      if (!used.has(j) && shorterChars[i] === longerChars[j]) {
        matches++;
        used.add(j);
        break;
      }
    }
  }

  return Math.round((matches / longer.length) * 100);
}

/**
 * Extract code blocks (consecutive non-empty lines) from source.
 * @param {string} source
 * @param {number} minLines
 * @returns {Array<{lines: string[], startLine: number, endLine: number, normalized: string}>}
 */
function extractBlocks(source, minLines) {
  const allLines = source.split('\n');
  const blocks = [];

  // Sliding window approach: extract all possible blocks of minLines length
  for (let i = 0; i <= allLines.length - minLines; i++) {
    const blockLines = allLines.slice(i, i + minLines);
    const normalized = blockLines.map(normalizeLine);

    // Skip blocks that are mostly empty or just braces/comments
    const meaningful = normalized.filter(l => l.length > 2 && !l.match(/^[{}();\s]*$/) && !l.startsWith('//') && !l.startsWith('*'));
    if (meaningful.length < Math.ceil(minLines / 2)) continue;

    blocks.push({
      lines: blockLines,
      startLine: i + 1,
      endLine: i + minLines,
      normalized: normalized.join('\n'),
    });
  }

  return blocks;
}

/**
 * Find duplicate code blocks across files.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.type] - file type filter
 * @param {number} [options.minLines] - minimum block size (default 3)
 * @param {number} [options.threshold] - similarity threshold % (default 100)
 * @param {string} [options.format] - 'text' or 'json'
 * @returns {Array<{fileA: string, fileB: string, lineA: number, lineB: number, lines: number, similarity: number, block: string}>}
 */
function findDuplicates(options = {}) {
  const cwd = options.cwd || process.cwd();
  const minLines = options.minLines || DEFAULT_MIN_LINES;
  const threshold = options.threshold != null ? options.threshold : DEFAULT_THRESHOLD;
  const extensions = options.type && EXTENSION_MAP[options.type]
    ? EXTENSION_MAP[options.type]
    : DEFAULT_EXTENSIONS;

  const files = collectFiles(cwd, extensions);

  // Build block index per file
  const fileBlocks = [];
  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const blocks = extractBlocks(source, minLines);
    fileBlocks.push({ file, blocks });
  }

  // Compare blocks across files (and within same file at different positions)
  const duplicates = [];
  const seen = new Set();

  for (let i = 0; i < fileBlocks.length; i++) {
    for (let j = i; j < fileBlocks.length; j++) {
      const a = fileBlocks[i];
      const b = fileBlocks[j];

      for (const blockA of a.blocks) {
        for (const blockB of b.blocks) {
          // Skip self-comparison at same position
          if (a.file === b.file && blockA.startLine === blockB.startLine) continue;

          // Skip overlapping blocks in same file
          if (a.file === b.file) {
            if (blockA.startLine < blockB.endLine && blockB.startLine < blockA.endLine) continue;
          }

          let similarity;
          if (threshold >= 100) {
            // Exact match only
            if (blockA.normalized !== blockB.normalized) continue;
            similarity = 100;
          } else {
            similarity = calculateSimilarity(blockA.normalized, blockB.normalized);
            if (similarity < threshold) continue;
          }

          // Dedup key to avoid reporting A-B and B-A
          const key = [
            a.file, blockA.startLine,
            b.file, blockB.startLine,
          ].sort().join(':');

          if (seen.has(key)) continue;
          seen.add(key);

          duplicates.push({
            fileA: a.file,
            fileB: b.file,
            lineA: blockA.startLine,
            lineB: blockB.startLine,
            lines: minLines,
            similarity,
            block: blockA.lines.join('\n'),
          });
        }
      }
    }
  }

  // Sort by similarity descending
  duplicates.sort((a, b) => b.similarity - a.similarity);

  return duplicates;
}

/**
 * Format duplication results as text.
 * @param {Array} results
 * @param {string} cwd
 * @returns {string}
 */
function formatText(results, cwd) {
  if (results.length === 0) {
    return 'No duplicate code blocks found.';
  }

  const lines = [];
  lines.push('Code Duplication Report');
  lines.push('='.repeat(70));
  lines.push('');

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const relA = path.relative(cwd, r.fileA);
    const relB = path.relative(cwd, r.fileB);
    lines.push(`Duplicate #${i + 1} (${r.similarity}% similar, ${r.lines} lines)`);
    lines.push(`  File A: ${relA}:${r.lineA}`);
    lines.push(`  File B: ${relB}:${r.lineB}`);
    lines.push('');
  }

  lines.push(`Total duplicates found: ${results.length}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run duplication finder.
 * @param {string[]} argv
 */
function runDuplicates(argv = []) {
  const options = { format: 'text' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--min-lines' && argv[i + 1]) {
      options.minLines = parseInt(argv[++i], 10);
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--type' && argv[i + 1]) {
      options.type = argv[++i];
    } else if (arg === '--threshold' && argv[i + 1]) {
      options.threshold = parseInt(argv[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox duplicates [--min-lines N] [--format json] [--type js] [--threshold N]');
      return;
    }
  }

  const cwd = process.cwd();
  options.cwd = cwd;
  const results = findDuplicates(options);

  if (options.format === 'json') {
    const jsonResults = results.map(r => ({
      ...r,
      fileA: path.relative(cwd, r.fileA),
      fileB: path.relative(cwd, r.fileB),
    }));
    console.log(JSON.stringify(jsonResults, null, 2));
  } else {
    console.log(formatText(results, cwd));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDuplicates,
  findDuplicates,
  extractBlocks,
  collectFiles,
  normalizeLine,
  calculateSimilarity,
  formatText,
};
