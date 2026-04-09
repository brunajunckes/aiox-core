/**
 * File Diff Tool
 *
 * Shows unified diff between two files with context, JSON format, and stats.
 *
 * @module cli/commands/file-diff
 * @version 1.0.0
 * @story 29.2 - File Diff Tool
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Parse CLI args for file-diff command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const opts = { file1: null, file2: null, format: 'text', stats: false, context: 3 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format' && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === '--stats') {
      opts.stats = true;
    } else if (a === '--context' && argv[i + 1]) {
      opts.context = parseInt(argv[++i], 10);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }
  opts.file1 = positional[0] || null;
  opts.file2 = positional[1] || null;
  return opts;
}

/**
 * Compute diff between two arrays of lines.
 * Returns array of { type: 'added'|'removed'|'unchanged', line: string, lineNum1?, lineNum2? }
 * Uses simple LCS-based diff.
 * @param {string[]} lines1
 * @param {string[]} lines2
 * @returns {Array<{ type: string, value: string }>}
 */
function computeDiff(lines1, lines2) {
  const m = lines1.length;
  const n = lines2.length;

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const result = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      result.unshift({ type: 'unchanged', value: lines1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', value: lines2[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', value: lines1[i - 1] });
      i--;
    }
  }

  return result;
}

/**
 * Compute stats from diff result.
 * @param {Array<{ type: string, value: string }>} diff
 * @returns {{ added: number, removed: number, unchanged: number }}
 */
function computeStats(diff) {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const d of diff) {
    if (d.type === 'added') added++;
    else if (d.type === 'removed') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
}

/**
 * Format diff as unified text with context lines.
 * @param {Array<{ type: string, value: string }>} diff
 * @param {string} file1
 * @param {string} file2
 * @param {number} contextLines
 * @returns {string}
 */
function formatUnified(diff, file1, file2, contextLines) {
  const lines = [];
  lines.push(`--- ${file1}`);
  lines.push(`+++ ${file2}`);

  // Find hunks: groups of changes with context
  const changes = [];
  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type !== 'unchanged') {
      changes.push(i);
    }
  }

  if (changes.length === 0) {
    lines.push('');
    lines.push('Files are identical.');
    return lines.join('\n');
  }

  // Group changes into hunks
  const hunks = [];
  let hunkStart = Math.max(0, changes[0] - contextLines);
  let hunkEnd = Math.min(diff.length - 1, changes[0] + contextLines);

  for (let c = 1; c < changes.length; c++) {
    const nextStart = Math.max(0, changes[c] - contextLines);
    if (nextStart <= hunkEnd + 1) {
      // Merge with current hunk
      hunkEnd = Math.min(diff.length - 1, changes[c] + contextLines);
    } else {
      hunks.push({ start: hunkStart, end: hunkEnd });
      hunkStart = nextStart;
      hunkEnd = Math.min(diff.length - 1, changes[c] + contextLines);
    }
  }
  hunks.push({ start: hunkStart, end: hunkEnd });

  for (const hunk of hunks) {
    // Count lines in hunk for header
    let oldCount = 0;
    let newCount = 0;
    for (let i = hunk.start; i <= hunk.end; i++) {
      if (diff[i].type === 'removed') oldCount++;
      else if (diff[i].type === 'added') newCount++;
      else { oldCount++; newCount++; }
    }

    lines.push(`@@ -${hunk.start + 1},${oldCount} +${hunk.start + 1},${newCount} @@`);

    for (let i = hunk.start; i <= hunk.end; i++) {
      const d = diff[i];
      if (d.type === 'removed') lines.push(`-${d.value}`);
      else if (d.type === 'added') lines.push(`+${d.value}`);
      else lines.push(` ${d.value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Run file-diff command.
 * @param {string[]} argv
 */
function runFileDiff(argv) {
  const opts = parseArgs(argv);

  if (!opts.file1 || !opts.file2) {
    console.error('Usage: aiox file-diff <file1> <file2> [--format json] [--stats] [--context N]');
    process.exit(1);
  }

  const f1 = path.resolve(opts.file1);
  const f2 = path.resolve(opts.file2);

  if (!fs.existsSync(f1)) {
    console.error(`Error: file not found: ${f1}`);
    process.exit(1);
  }
  if (!fs.existsSync(f2)) {
    console.error(`Error: file not found: ${f2}`);
    process.exit(1);
  }

  const content1 = fs.readFileSync(f1, 'utf8');
  const content2 = fs.readFileSync(f2, 'utf8');
  const lines1 = content1.split('\n');
  const lines2 = content2.split('\n');

  const diff = computeDiff(lines1, lines2);
  const stats = computeStats(diff);

  if (opts.stats) {
    if (opts.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(`Added:     ${stats.added}`);
      console.log(`Removed:   ${stats.removed}`);
      console.log(`Unchanged: ${stats.unchanged}`);
    }
    return;
  }

  if (opts.format === 'json') {
    console.log(JSON.stringify({ file1: opts.file1, file2: opts.file2, stats, diff }, null, 2));
    return;
  }

  const output = formatUnified(diff, opts.file1, opts.file2, opts.context);
  console.log(output);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runFileDiff,
  parseArgs,
  computeDiff,
  computeStats,
  formatUnified,
};
