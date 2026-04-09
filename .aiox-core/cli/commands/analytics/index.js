/**
 * Project Analytics Dashboard
 *
 * Shows project stats: files, LOC, tests, stories, commands, dependencies.
 * Supports JSON output and trend tracking.
 *
 * @module cli/commands/analytics
 * @version 1.0.0
 * @story 14.1 — Project Analytics Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
PROJECT ANALYTICS DASHBOARD

USAGE:
  aiox analytics                Show project stats
  aiox analytics --format json  Output as JSON
  aiox analytics --trend        Show growth over time from history
  aiox analytics --help         Show this help

METRICS:
  Total files, lines of code by extension (js, ts, md, yaml),
  test count, story count, command count, dependency count.
`.trim();

const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];
const DOC_EXTENSIONS = ['.md'];
const CONFIG_EXTENSIONS = ['.yaml', '.yml'];
const ALL_TRACKED = [...CODE_EXTENSIONS, ...DOC_EXTENSIONS, ...CONFIG_EXTENSIONS];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collect files from a directory, skipping node_modules/.git.
 * @param {string} dir
 * @param {object} [options]
 * @param {function} [options.readdir]
 * @param {function} [options.stat]
 * @returns {string[]}
 */
function collectFiles(dir, options = {}) {
  const readdir = options.readdir || fs.readdirSync;
  const stat = options.stat || fs.statSync;
  const results = [];

  let entries;
  try {
    entries = readdir(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.aiox') continue;
    const full = path.join(dir, entry);
    let st;
    try {
      st = stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      results.push(...collectFiles(full, options));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Count lines in a file.
 * @param {string} filePath
 * @param {object} [options]
 * @param {function} [options.readFile]
 * @returns {number}
 */
function countLines(filePath, options = {}) {
  const readFile = options.readFile || fs.readFileSync;
  try {
    const content = readFile(filePath, 'utf8');
    if (!content) return 0;
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Count files by extension category.
 * @param {string[]} files
 * @returns {{ js: number, ts: number, md: number, yaml: number, other: number }}
 */
function countByExtension(files) {
  const counts = { js: 0, ts: 0, md: 0, yaml: 0, other: 0 };
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.js' || ext === '.jsx') counts.js++;
    else if (ext === '.ts' || ext === '.tsx') counts.ts++;
    else if (ext === '.md') counts.md++;
    else if (ext === '.yaml' || ext === '.yml') counts.yaml++;
    else counts.other++;
  }
  return counts;
}

/**
 * Count lines of code grouped by type.
 * @param {string[]} files
 * @param {object} [options]
 * @param {function} [options.readFile]
 * @returns {{ js: number, ts: number, md: number, yaml: number, other: number, total: number }}
 */
function countLOC(files, options = {}) {
  const loc = { js: 0, ts: 0, md: 0, yaml: 0, other: 0, total: 0 };
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const lines = countLines(f, options);
    loc.total += lines;
    if (ext === '.js' || ext === '.jsx') loc.js += lines;
    else if (ext === '.ts' || ext === '.tsx') loc.ts += lines;
    else if (ext === '.md') loc.md += lines;
    else if (ext === '.yaml' || ext === '.yml') loc.yaml += lines;
    else loc.other += lines;
  }
  return loc;
}

/**
 * Count test files (*.test.js, *.test.ts, *.spec.js, *.spec.ts).
 * @param {string[]} files
 * @returns {number}
 */
function countTests(files) {
  return files.filter(f => /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(f)).length;
}

/**
 * Count story files (*.story.md).
 * @param {string[]} files
 * @returns {number}
 */
function countStories(files) {
  return files.filter(f => f.endsWith('.story.md')).length;
}

/**
 * Count CLI command directories.
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {function} [options.readdir]
 * @returns {number}
 */
function countCommands(projectRoot, options = {}) {
  const readdir = options.readdir || fs.readdirSync;
  const cmdDir = path.join(projectRoot, '.aiox-core', 'cli', 'commands');
  try {
    return readdir(cmdDir).length;
  } catch {
    return 0;
  }
}

/**
 * Count dependencies from package.json.
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {function} [options.readFile]
 * @returns {number}
 */
function countDependencies(projectRoot, options = {}) {
  const readFile = options.readFile || fs.readFileSync;
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    const pkg = JSON.parse(readFile(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    return deps + devDeps;
  } catch {
    return 0;
  }
}

/**
 * Gather all analytics for a project.
 * @param {string} projectRoot
 * @param {object} [options]
 * @returns {object}
 */
function gatherAnalytics(projectRoot, options = {}) {
  const files = collectFiles(projectRoot, options);
  const byExtension = countByExtension(files);
  const loc = countLOC(files, options);
  const testCount = countTests(files);
  const storyCount = countStories(files);
  const commandCount = countCommands(projectRoot, options);
  const dependencyCount = countDependencies(projectRoot, options);

  return {
    totalFiles: files.length,
    filesByExtension: byExtension,
    linesOfCode: loc,
    testCount,
    storyCount,
    commandCount,
    dependencyCount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format analytics as a human-readable string.
 * @param {object} analytics
 * @returns {string}
 */
function formatAnalytics(analytics) {
  const lines = [];
  lines.push('PROJECT ANALYTICS DASHBOARD');
  lines.push('='.repeat(40));
  lines.push('');
  lines.push(`Total Files:    ${analytics.totalFiles}`);
  lines.push(`  JavaScript:   ${analytics.filesByExtension.js}`);
  lines.push(`  TypeScript:   ${analytics.filesByExtension.ts}`);
  lines.push(`  Markdown:     ${analytics.filesByExtension.md}`);
  lines.push(`  YAML:         ${analytics.filesByExtension.yaml}`);
  lines.push(`  Other:        ${analytics.filesByExtension.other}`);
  lines.push('');
  lines.push(`Lines of Code:  ${analytics.linesOfCode.total}`);
  lines.push(`  JavaScript:   ${analytics.linesOfCode.js}`);
  lines.push(`  TypeScript:   ${analytics.linesOfCode.ts}`);
  lines.push(`  Markdown:     ${analytics.linesOfCode.md}`);
  lines.push(`  YAML:         ${analytics.linesOfCode.yaml}`);
  lines.push(`  Other:        ${analytics.linesOfCode.other}`);
  lines.push('');
  lines.push(`Test Files:     ${analytics.testCount}`);
  lines.push(`Stories:        ${analytics.storyCount}`);
  lines.push(`CLI Commands:   ${analytics.commandCount}`);
  lines.push(`Dependencies:   ${analytics.dependencyCount}`);
  return lines.join('\n');
}

/**
 * Load trend history from .aiox/analytics-history.jsonl
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {function} [options.readFile]
 * @returns {object[]}
 */
function loadTrend(projectRoot, options = {}) {
  const readFile = options.readFile || fs.readFileSync;
  const histPath = path.join(projectRoot, '.aiox', 'analytics-history.jsonl');
  try {
    const content = readFile(histPath, 'utf8');
    return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Append analytics record to history.
 * @param {string} projectRoot
 * @param {object} analytics
 * @param {object} [options]
 * @param {function} [options.appendFile]
 * @param {function} [options.mkdirSync]
 */
function appendToHistory(projectRoot, analytics, options = {}) {
  const appendFile = options.appendFile || fs.appendFileSync;
  const mkdirSync = options.mkdirSync || fs.mkdirSync;
  const dir = path.join(projectRoot, '.aiox');
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  const histPath = path.join(dir, 'analytics-history.jsonl');
  appendFile(histPath, JSON.stringify(analytics) + '\n');
}

/**
 * Format trend data for display.
 * @param {object[]} entries
 * @returns {string}
 */
function formatTrend(entries) {
  if (!entries || entries.length === 0) {
    return 'No trend data available. Run `aiox analytics` to start recording.';
  }
  const lines = [];
  lines.push('ANALYTICS TREND');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push('Date                 | Files | LOC    | Tests | Stories');
  lines.push('-'.repeat(50));
  for (const entry of entries) {
    const date = entry.timestamp ? entry.timestamp.substring(0, 19) : 'unknown';
    const files = String(entry.totalFiles || 0).padStart(5);
    const loc = String((entry.linesOfCode && entry.linesOfCode.total) || 0).padStart(6);
    const tests = String(entry.testCount || 0).padStart(5);
    const stories = String(entry.storyCount || 0).padStart(7);
    lines.push(`${date} | ${files} | ${loc} | ${tests} | ${stories}`);
  }
  return lines.join('\n');
}

/**
 * Main entry point for the analytics command.
 * @param {string[]} argv
 * @param {object} [options]
 */
function runAnalytics(argv = [], options = {}) {
  const log = options.log || console.log;
  const projectRoot = options.projectRoot || process.cwd();

  if (argv.includes('--help') || argv.includes('-h')) {
    log(HELP_TEXT);
    return;
  }

  const isJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const isTrend = argv.includes('--trend');

  if (isTrend) {
    const entries = loadTrend(projectRoot, options);
    if (isJson) {
      log(JSON.stringify(entries, null, 2));
    } else {
      log(formatTrend(entries));
    }
    return;
  }

  const analytics = gatherAnalytics(projectRoot, options);

  // Append to history
  try {
    appendToHistory(projectRoot, analytics, options);
  } catch { /* non-critical */ }

  if (isJson) {
    log(JSON.stringify(analytics, null, 2));
  } else {
    log(formatAnalytics(analytics));
  }
}

function getHelpText() {
  return HELP_TEXT;
}

module.exports = {
  collectFiles,
  countLines,
  countByExtension,
  countLOC,
  countTests,
  countStories,
  countCommands,
  countDependencies,
  gatherAnalytics,
  formatAnalytics,
  loadTrend,
  appendToHistory,
  formatTrend,
  runAnalytics,
  getHelpText,
  HELP_TEXT,
};
