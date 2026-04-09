/**
 * Package Size Analyzer Command Module
 *
 * Shows package size: install size, publish size, file count.
 *
 * Subcommands:
 *   aiox pkg-size              — show package size summary
 *   aiox pkg-size --details    — per-directory breakdown
 *   aiox pkg-size --format json — output as JSON
 *   aiox pkg-size --limit 1mb  — warn if over limit
 *   aiox pkg-size --treemap    — ASCII treemap visualization
 *
 * @module cli/commands/pkg-size
 * @version 1.0.0
 * @story 23.2 — Package Size Analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', '.next', 'build', '.aiox']);
const NPMIGNORE_DEFAULTS = new Set(['node_modules', '.git', 'test', 'tests', '__tests__', 'coverage', '.github', '.vscode']);

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Parse a human-readable size string (e.g., "1mb", "500kb") to bytes.
 * @param {string} sizeStr
 * @returns {number} bytes
 */
function parseSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;

  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  return Math.round(value * (multipliers[unit] || 1));
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Walk directory and collect file sizes.
 * @param {string} dir
 * @param {Set<string>} skipDirs
 * @param {object} result - { totalSize, fileCount, dirs: { [dirPath]: { size, count } } }
 * @param {string} rootDir
 * @returns {object}
 */
function walkDir(dir, skipDirs, result, rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        walkDir(full, skipDirs, result, rootDir);
      }
    } else if (entry.isFile()) {
      let size;
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
      result.totalSize += size;
      result.fileCount++;

      const relDir = path.relative(rootDir, dir) || '.';
      if (!result.dirs[relDir]) {
        result.dirs[relDir] = { size: 0, count: 0 };
      }
      result.dirs[relDir].size += size;
      result.dirs[relDir].count++;
    }
  }

  return result;
}

/**
 * Estimate publish size by excluding test/config directories.
 * @param {string} dir
 * @returns {{ totalSize: number, fileCount: number, dirs: object }}
 */
function estimatePublishSize(dir) {
  const result = { totalSize: 0, fileCount: 0, dirs: {} };
  const skipAll = new Set([...SKIP_DIRS, ...NPMIGNORE_DEFAULTS]);
  return walkDir(dir, skipAll, result, dir);
}

/**
 * Analyze package size.
 * @param {object} options
 * @param {string} [options.cwd]
 * @param {boolean} [options.details]
 * @param {string} [options.limit]
 * @param {boolean} [options.treemap]
 * @returns {object}
 */
function analyzeSize(options = {}) {
  const cwd = options.cwd || process.cwd();

  // Install size: everything except node_modules and .git
  const installResult = { totalSize: 0, fileCount: 0, dirs: {} };
  walkDir(cwd, SKIP_DIRS, installResult, cwd);

  // Publish size: exclude tests, configs, etc.
  const publishResult = estimatePublishSize(cwd);

  const result = {
    installSize: installResult.totalSize,
    installFileCount: installResult.fileCount,
    publishSize: publishResult.totalSize,
    publishFileCount: publishResult.fileCount,
  };

  if (options.details) {
    result.directories = installResult.dirs;
  }

  if (options.limit) {
    const limitBytes = parseSize(options.limit);
    result.limit = {
      value: options.limit,
      bytes: limitBytes,
      exceeded: installResult.totalSize > limitBytes,
    };
  }

  if (options.treemap) {
    result.treemapData = installResult.dirs;
  }

  return result;
}

/**
 * Generate an ASCII treemap from directory sizes.
 * @param {object} dirs - { [dirPath]: { size, count } }
 * @param {number} totalSize
 * @param {number} width - total width in characters
 * @returns {string}
 */
function generateTreemap(dirs, totalSize, width = 60) {
  const entries = Object.entries(dirs)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 15); // Top 15 directories

  if (entries.length === 0) return 'No files found.';

  const lines = [];
  lines.push('Treemap (top directories by size):');
  lines.push('='.repeat(width));

  for (const entry of entries) {
    const pct = totalSize > 0 ? (entry.size / totalSize) : 0;
    const barLen = Math.max(1, Math.round(pct * (width - 30)));
    const bar = '#'.repeat(barLen);
    const label = entry.name.length > 20 ? entry.name.slice(0, 20) + '..' : entry.name.padEnd(22);
    lines.push(`${label} ${bar} ${formatBytes(entry.size)} (${Math.round(pct * 100)}%)`);
  }

  return lines.join('\n');
}

/**
 * Format analysis results as text.
 * @param {object} result
 * @returns {string}
 */
function formatText(result) {
  const lines = [];
  lines.push('Package Size Analysis');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Install size:   ${formatBytes(result.installSize)} (${result.installFileCount} files)`);
  lines.push(`Publish size:   ${formatBytes(result.publishSize)} (${result.publishFileCount} files)`);

  if (result.limit) {
    const status = result.limit.exceeded ? 'EXCEEDED' : 'OK';
    lines.push('');
    lines.push(`Size limit:     ${result.limit.value} (${status})`);
    if (result.limit.exceeded) {
      lines.push(`  WARNING: Package size ${formatBytes(result.installSize)} exceeds limit ${result.limit.value}`);
    }
  }

  if (result.directories) {
    lines.push('');
    lines.push('Directory Breakdown:');
    lines.push('-'.repeat(50));
    const sorted = Object.entries(result.directories)
      .sort(([, a], [, b]) => b.size - a.size);
    for (const [dir, data] of sorted) {
      lines.push(`  ${formatBytes(data.size).padEnd(12)} ${data.count} files  ${dir}`);
    }
  }

  if (result.treemapData) {
    lines.push('');
    lines.push(generateTreemap(result.treemapData, result.installSize));
  }

  return lines.join('\n');
}

/**
 * Parse CLI args and run package size analysis.
 * @param {string[]} argv
 */
function runPkgSize(argv = []) {
  const options = { format: 'text' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--details') {
      options.details = true;
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--limit' && argv[i + 1]) {
      options.limit = argv[++i];
    } else if (arg === '--treemap') {
      options.treemap = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox pkg-size [--details] [--format json] [--limit 1mb] [--treemap]');
      return;
    }
  }

  const result = analyzeSize(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatText(result));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runPkgSize,
  analyzeSize,
  parseSize,
  formatBytes,
  walkDir,
  estimatePublishSize,
  generateTreemap,
  formatText,
};
