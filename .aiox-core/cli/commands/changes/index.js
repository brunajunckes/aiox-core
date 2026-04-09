/**
 * Changelog Viewer
 *
 * Shows recent changes from CHANGELOG.md or falls back to git log.
 * Supports filtering by tag, count, and breaking changes.
 *
 * @module cli/commands/changes
 * @version 1.0.0
 * @story 19.4 - Changelog Viewer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const CHANGELOG_NAMES = ['CHANGELOG.md', 'changelog.md', 'CHANGES.md', 'changes.md'];

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Find CHANGELOG.md in the project.
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @returns {string|null}
 */
function findChangelog(options = {}) {
  const baseDir = options.baseDir || process.cwd();
  for (const name of CHANGELOG_NAMES) {
    const p = path.join(baseDir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Parse a CHANGELOG.md file into structured entries.
 * Expects Keep-a-Changelog format with ## headings.
 * @param {string} content
 * @returns {Array<{ version: string, date: string, body: string, breaking: boolean }>}
 */
function parseChangelog(content) {
  if (!content || typeof content !== 'string') return [];

  const entries = [];
  const lines = content.split('\n');
  let current = null;

  for (const line of lines) {
    // Match ## [version] - date  or  ## version - date  or  ## [version] (date)
    const match = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s*[-–—]\s*(.+))?/);
    if (match) {
      if (current) entries.push(current);
      const version = match[1];
      const date = (match[2] || '').trim();
      current = { version, date, body: '', breaking: false };
      continue;
    }
    if (current) {
      current.body += line + '\n';
      if (/BREAKING|breaking change/i.test(line)) {
        current.breaking = true;
      }
    }
  }
  if (current) entries.push(current);

  // Trim trailing whitespace from bodies
  for (const entry of entries) {
    entry.body = entry.body.trim();
  }

  return entries;
}

/**
 * Get changes from git log as fallback.
 * @param {object} [options]
 * @param {string} [options.since] - Tag or ref
 * @param {number} [options.count] - Max entries
 * @param {function} [options.execFn] - Custom exec for testing
 * @returns {Array<{ hash: string, message: string, date: string, breaking: boolean }>}
 */
function getGitChanges(options = {}) {
  const exec = options.execFn || execSync;
  const count = options.count || 50;

  try {
    let cmd;
    if (options.since) {
      cmd = `git log ${options.since}..HEAD --format="%H|%s|%ci" --max-count=${count}`;
    } else {
      cmd = `git log --format="%H|%s|%ci" --max-count=${count}`;
    }
    const output = exec(cmd, { encoding: 'utf8' }).trim();
    if (!output) return [];

    return output.split('\n').map(line => {
      const parts = line.split('|');
      const hash = parts[0] || '';
      const message = parts[1] || '';
      const date = parts[2] || '';
      const breaking = /BREAKING|!:/.test(message);
      return { hash: hash.slice(0, 8), message, date: date.split(' ')[0] || '', breaking };
    });
  } catch {
    return [];
  }
}

/**
 * Filter entries to breaking changes only.
 * @param {Array} entries
 * @returns {Array}
 */
function filterBreaking(entries) {
  return entries.filter(e => e.breaking);
}

/**
 * Filter changelog entries since a version.
 * @param {Array} entries
 * @param {string} sinceVersion
 * @returns {Array}
 */
function filterSince(entries, sinceVersion) {
  const idx = entries.findIndex(e => e.version === sinceVersion || e.version === sinceVersion.replace(/^v/, ''));
  if (idx === -1) return entries;
  return entries.slice(0, idx);
}

/**
 * Format changelog entries as text.
 * @param {Array} entries
 * @param {string} source - 'changelog' or 'git'
 * @returns {string}
 */
function formatText(entries, source) {
  if (entries.length === 0) return 'No changes found.';

  const lines = [];
  lines.push(`Changes (source: ${source})`);
  lines.push('='.repeat(50));
  lines.push('');

  if (source === 'changelog') {
    for (const e of entries) {
      const breaking = e.breaking ? ' [BREAKING]' : '';
      lines.push(`## ${e.version}${e.date ? ` (${e.date})` : ''}${breaking}`);
      if (e.body) lines.push(e.body);
      lines.push('');
    }
  } else {
    for (const e of entries) {
      const breaking = e.breaking ? ' [BREAKING]' : '';
      lines.push(`  ${e.hash}  ${e.date}  ${e.message}${breaking}`);
    }
  }

  lines.push('');
  lines.push(`Total: ${entries.length} entries`);
  return lines.join('\n');
}

/**
 * Format entries as JSON.
 * @param {Array} entries
 * @param {string} source
 * @returns {string}
 */
function formatJSON(entries, source) {
  return JSON.stringify({ source, total: entries.length, entries }, null, 2);
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `Usage: aiox changes [options]

Show recent changes from CHANGELOG.md or git log.

Options:
  --since <tag>     Changes since tag/version
  --count N         Last N entries (default: 20)
  --format json     Output as JSON
  --breaking        Show only breaking changes
  -h, --help        Show this help message

Examples:
  aiox changes                    Show recent changes
  aiox changes --since v5.0.0    Changes since v5.0.0
  aiox changes --count 10        Last 10 entries
  aiox changes --format json     As JSON
  aiox changes --breaking        Breaking changes only`;
}

/**
 * Parse a flag value from argv.
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string|null}
 */
function parseFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

/**
 * Main runner.
 * @param {string[]} argv
 */
function runChanges(argv = []) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(getHelpText());
    return;
  }

  const since = parseFlag(argv, '--since');
  const countStr = parseFlag(argv, '--count');
  const count = countStr ? parseInt(countStr, 10) : 20;
  const format = parseFlag(argv, '--format') || 'text';
  const breakingOnly = argv.includes('--breaking');

  if (format !== 'text' && format !== 'json') {
    console.error(`Invalid format: ${format}. Use text or json.`);
    process.exitCode = 1;
    return;
  }

  // Try CHANGELOG.md first
  const changelogPath = findChangelog();
  let entries;
  let source;

  if (changelogPath) {
    source = 'changelog';
    const content = fs.readFileSync(changelogPath, 'utf8');
    entries = parseChangelog(content);

    if (since) {
      entries = filterSince(entries, since);
    }
    if (count && entries.length > count) {
      entries = entries.slice(0, count);
    }
  } else {
    // Fallback to git log
    source = 'git';
    entries = getGitChanges({ since, count });
  }

  if (breakingOnly) {
    entries = filterBreaking(entries);
  }

  if (format === 'json') {
    console.log(formatJSON(entries, source));
  } else {
    console.log(formatText(entries, source));
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runChanges,
  getHelpText,
  findChangelog,
  parseChangelog,
  getGitChanges,
  filterBreaking,
  filterSince,
  formatText,
  formatJSON,
  parseFlag,
  CHANGELOG_NAMES,
};
