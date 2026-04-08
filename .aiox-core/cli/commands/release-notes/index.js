/**
 * Release Notes Generator Command Module
 *
 * Generates release notes from git log since last tag using conventional commits.
 *
 * Subcommands:
 *   aiox release-notes                  — Generate release notes from last tag
 *   aiox release-notes --format markdown — Output as markdown (default)
 *   aiox release-notes --format json    — Output as JSON
 *   aiox release-notes --since <tag>    — Custom starting point
 *   aiox release-notes --help           — Show help
 *
 * @module cli/commands/release-notes
 * @version 1.0.0
 * @story 10.1 — Version Bump & Release Notes Generator
 */

'use strict';

const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const CONVENTIONAL_TYPES = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  test: 'Tests',
  chore: 'Chores',
  refactor: 'Refactoring',
  perf: 'Performance',
  ci: 'CI/CD',
  style: 'Style',
  build: 'Build',
  revert: 'Reverts',
};

const TYPE_ORDER = [
  'feat', 'fix', 'docs', 'refactor', 'perf',
  'test', 'ci', 'build', 'style', 'chore', 'revert',
];

// ── Git Operations ─────────────────────────────────────────────────────────────

/**
 * Get the latest git tag. Returns null if no tags exist.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @returns {string|null}
 */
function getLatestTag(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const tag = exec('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf8' }).trim();
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * Get git log entries between a ref and HEAD.
 * @param {string|null} since - Starting ref. If null, returns all commits.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @returns {Array<{hash: string, message: string}>}
 */
function getGitLog(since, options = {}) {
  const exec = options.execFn || execSync;
  try {
    const range = since ? `${since}..HEAD` : 'HEAD';
    const raw = exec(`git log ${range} --pretty=format:"%H|%s"`, { encoding: 'utf8' }).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      const sepIdx = line.indexOf('|');
      return {
        hash: line.substring(0, sepIdx),
        message: line.substring(sepIdx + 1),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Parse a conventional commit message.
 * @param {string} message - Commit message
 * @returns {{type: string|null, scope: string|null, description: string, breaking: boolean}}
 */
function parseConventionalCommit(message) {
  const match = message.match(/^(\w+)(?:\(([^)]*)\))?(!?):\s*(.*)$/);
  if (!match) {
    return { type: null, scope: null, description: message, breaking: false };
  }
  return {
    type: match[1],
    scope: match[2] || null,
    description: match[4],
    breaking: match[3] === '!',
  };
}

/**
 * Categorize commits by conventional type.
 * @param {Array<{hash: string, message: string}>} commits
 * @returns {Object} - Map of type -> array of parsed commits
 */
function categorizeCommits(commits) {
  const categories = {};
  const uncategorized = [];

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message);
    if (parsed.type && CONVENTIONAL_TYPES[parsed.type]) {
      if (!categories[parsed.type]) categories[parsed.type] = [];
      categories[parsed.type].push({
        hash: commit.hash,
        ...parsed,
      });
    } else {
      uncategorized.push({
        hash: commit.hash,
        ...parsed,
        type: parsed.type || 'other',
      });
    }
  }

  if (uncategorized.length > 0) {
    categories['other'] = uncategorized;
  }

  return categories;
}

/**
 * Format release notes as markdown.
 * @param {Object} categories - Categorized commits
 * @param {object} [options]
 * @param {string} [options.since] - Starting ref
 * @returns {string}
 */
function formatMarkdown(categories, options = {}) {
  const lines = [];
  const date = new Date().toISOString().split('T')[0];
  lines.push(`# Release Notes (${date})`);
  if (options.since) {
    lines.push(`\nChanges since \`${options.since}\``);
  }
  lines.push('');

  for (const type of TYPE_ORDER) {
    if (!categories[type]) continue;
    const label = CONVENTIONAL_TYPES[type];
    lines.push(`## ${label}`);
    lines.push('');
    for (const c of categories[type]) {
      const scope = c.scope ? `**${c.scope}:** ` : '';
      const breaking = c.breaking ? ' **BREAKING**' : '';
      const shortHash = c.hash.substring(0, 7);
      lines.push(`- ${scope}${c.description}${breaking} (${shortHash})`);
    }
    lines.push('');
  }

  if (categories['other']) {
    lines.push('## Other');
    lines.push('');
    for (const c of categories['other']) {
      const shortHash = c.hash.substring(0, 7);
      lines.push(`- ${c.description} (${shortHash})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format release notes as JSON.
 * @param {Object} categories - Categorized commits
 * @param {object} [options]
 * @param {string} [options.since] - Starting ref
 * @returns {string}
 */
function formatJSON(categories, options = {}) {
  const date = new Date().toISOString().split('T')[0];
  const output = {
    date,
    since: options.since || null,
    categories: {},
  };

  for (const type of TYPE_ORDER) {
    if (!categories[type]) continue;
    output.categories[type] = categories[type].map(c => ({
      hash: c.hash.substring(0, 7),
      scope: c.scope,
      description: c.description,
      breaking: c.breaking,
    }));
  }

  if (categories['other']) {
    output.categories['other'] = categories['other'].map(c => ({
      hash: c.hash.substring(0, 7),
      description: c.description,
    }));
  }

  return JSON.stringify(output, null, 2);
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the release-notes command.
 * @param {string[]} argv - CLI arguments (after command name)
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 */
function runReleaseNotes(argv = [], options = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Usage: aiox release-notes [options]

Generate release notes from git log using conventional commits.

Options:
  --format <type>   Output format: markdown (default) or json
  --since <tag>     Custom starting point (tag or commit ref)
  --help, -h        Show this help message
`);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 && argv[formatIdx + 1] ? argv[formatIdx + 1] : 'markdown';

  const sinceIdx = argv.indexOf('--since');
  const sinceArg = sinceIdx !== -1 && argv[sinceIdx + 1] ? argv[sinceIdx + 1] : null;

  const execOpts = options.execFn ? { execFn: options.execFn } : {};

  const since = sinceArg || getLatestTag(execOpts);
  const commits = getGitLog(since, execOpts);

  if (commits.length === 0) {
    console.log('No commits found since ' + (since || 'beginning') + '.');
    return;
  }

  const categories = categorizeCommits(commits);
  const fmtOptions = { since };

  if (format === 'json') {
    console.log(formatJSON(categories, fmtOptions));
  } else {
    console.log(formatMarkdown(categories, fmtOptions));
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runReleaseNotes,
  getLatestTag,
  getGitLog,
  parseConventionalCommit,
  categorizeCommits,
  formatMarkdown,
  formatJSON,
  CONVENTIONAL_TYPES,
  TYPE_ORDER,
};
