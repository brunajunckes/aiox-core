/**
 * Changelog Auto-Generator
 *
 * Generates changelog from conventional commits since last tag.
 * Groups by: Features, Bug Fixes, Documentation, Testing, Chores.
 *
 * @module cli/commands/auto-changelog
 * @version 1.0.0
 * @story 14.4 — Changelog Auto-Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
CHANGELOG AUTO-GENERATOR

USAGE:
  aiox auto-changelog                  Generate changelog from conventional commits since last tag
  aiox auto-changelog --since v5.0.0   From a specific tag
  aiox auto-changelog --write          Append to CHANGELOG.md
  aiox auto-changelog --format json    Output as JSON
  aiox auto-changelog --help           Show this help

Groups commits into: Features, Bug Fixes, Documentation, Testing, Chores, Other.
`.trim();

const CATEGORY_MAP = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  test: 'Testing',
  chore: 'Chores',
  refactor: 'Refactoring',
  perf: 'Performance',
  ci: 'CI/CD',
  style: 'Style',
  build: 'Build',
  revert: 'Reverts',
};

const DISPLAY_ORDER = [
  'Features', 'Bug Fixes', 'Documentation', 'Testing',
  'Refactoring', 'Performance', 'Chores', 'CI/CD',
  'Style', 'Build', 'Reverts', 'Other',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get latest git tag.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {string|null}
 */
function getLatestTag(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const tag = exec('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * Get git commits since a ref (or all if null).
 * @param {string|null} since
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {Array<{ hash: string, message: string }>}
 */
function getCommitsSince(since, options = {}) {
  const exec = options.execFn || execSync;
  const range = since ? `${since}..HEAD` : 'HEAD';
  try {
    const output = exec(`git log ${range} --format="%H|%s" --no-merges`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(Boolean).map(line => {
      const sep = line.indexOf('|');
      if (sep < 0) return { hash: '', message: line };
      return { hash: line.substring(0, sep), message: line.substring(sep + 1) };
    });
  } catch {
    return [];
  }
}

/**
 * Parse a conventional commit message.
 * @param {string} message
 * @returns {{ type: string|null, scope: string|null, description: string, breaking: boolean }}
 */
function parseCommit(message) {
  if (!message || typeof message !== 'string') {
    return { type: null, scope: null, description: message || '', breaking: false };
  }
  const match = message.match(/^(\w+)(\(([^)]*)\))?(!)?:\s*(.+)$/);
  if (!match) {
    return { type: null, scope: null, description: message, breaking: false };
  }
  return {
    type: match[1],
    scope: match[3] || null,
    description: match[5],
    breaking: match[4] === '!',
  };
}

/**
 * Group commits by category.
 * @param {Array<{ hash: string, message: string }>} commits
 * @returns {object} Map of category -> entries
 */
function groupCommits(commits) {
  const groups = {};
  for (const commit of commits) {
    const parsed = parseCommit(commit.message);
    const category = (parsed.type && CATEGORY_MAP[parsed.type]) || 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push({
      hash: commit.hash,
      type: parsed.type,
      scope: parsed.scope,
      description: parsed.description,
      breaking: parsed.breaking,
    });
  }
  return groups;
}

/**
 * Format changelog as markdown.
 * @param {object} groups
 * @param {object} [meta]
 * @param {string} [meta.since]
 * @param {string} [meta.date]
 * @returns {string}
 */
function formatChangelog(groups, meta = {}) {
  const lines = [];
  const date = meta.date || new Date().toISOString().substring(0, 10);
  const since = meta.since || 'beginning';
  lines.push(`# Changelog (since ${since})`);
  lines.push(`Generated: ${date}`);
  lines.push('');

  let hasContent = false;
  for (const category of DISPLAY_ORDER) {
    const entries = groups[category];
    if (!entries || entries.length === 0) continue;
    hasContent = true;
    lines.push(`## ${category}`);
    lines.push('');
    for (const entry of entries) {
      const scope = entry.scope ? `**${entry.scope}:** ` : '';
      const breaking = entry.breaking ? ' [BREAKING]' : '';
      const hash = entry.hash ? ` (${entry.hash.substring(0, 7)})` : '';
      lines.push(`- ${scope}${entry.description}${breaking}${hash}`);
    }
    lines.push('');
  }

  if (!hasContent) {
    lines.push('No conventional commits found.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format as JSON structure.
 * @param {object} groups
 * @param {object} [meta]
 * @returns {object}
 */
function formatJSON(groups, meta = {}) {
  return {
    since: meta.since || null,
    date: meta.date || new Date().toISOString().substring(0, 10),
    categories: groups,
  };
}

/**
 * Write changelog to file.
 * @param {string} filePath
 * @param {string} content
 * @param {object} [options]
 * @param {function} [options.writeFile]
 * @param {function} [options.readFile]
 * @param {function} [options.existsSync]
 */
function writeChangelog(filePath, content, options = {}) {
  const writeFile = options.writeFile || fs.writeFileSync;
  const readFile = options.readFile || fs.readFileSync;
  const existsSync = options.existsSync || fs.existsSync;

  let existing = '';
  if (existsSync(filePath)) {
    try {
      existing = readFile(filePath, 'utf8');
    } catch { /* ignore */ }
  }
  writeFile(filePath, content + '\n---\n\n' + existing);
}

/**
 * Main entry point.
 * @param {string[]} argv
 * @param {object} [options]
 */
function runAutoChangelog(argv = [], options = {}) {
  const log = options.log || console.log;
  const projectRoot = options.projectRoot || process.cwd();

  if (argv.includes('--help') || argv.includes('-h')) {
    log(HELP_TEXT);
    return;
  }

  const isJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const isWrite = argv.includes('--write');
  const sinceIdx = argv.indexOf('--since');
  const sinceTag = sinceIdx >= 0 ? argv[sinceIdx + 1] : null;

  const since = sinceTag || getLatestTag(options);
  const commits = getCommitsSince(since, options);
  const groups = groupCommits(commits);
  const meta = { since: since || 'beginning', date: new Date().toISOString().substring(0, 10) };

  if (isJson) {
    log(JSON.stringify(formatJSON(groups, meta), null, 2));
    return;
  }

  const content = formatChangelog(groups, meta);

  if (isWrite) {
    const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
    writeChangelog(changelogPath, content, options);
    log(`Changelog written to ${changelogPath}`);
    return;
  }

  log(content);
}

function getHelpText() {
  return HELP_TEXT;
}

module.exports = {
  getLatestTag,
  getCommitsSince,
  parseCommit,
  groupCommits,
  formatChangelog,
  formatJSON,
  writeChangelog,
  runAutoChangelog,
  getHelpText,
  HELP_TEXT,
  CATEGORY_MAP,
  DISPLAY_ORDER,
};
