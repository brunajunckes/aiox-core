/**
 * Changelog & Release Notes Generator
 *
 * Generates changelogs from git history using conventional commits.
 * Supports markdown and JSON output formats.
 *
 * @module cli/commands/changelog
 * @version 1.0.0
 * @story 5.2 - Changelog & Release Notes Generator
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

const COMMIT_FORMAT = '%H|%s';

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
 * @param {string|null} since - Starting ref (tag, commit, branch). If null, returns all commits.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @returns {Array<{hash: string, message: string}>}
 */
function getGitLog(since, options = {}) {
  const exec = options.execFn || execSync;
  const range = since ? `${since}..HEAD` : 'HEAD';
  try {
    const raw = exec(`git log --oneline --format="${COMMIT_FORMAT}" ${range}`, { encoding: 'utf8' }).trim();
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const pipeIndex = line.indexOf('|');
      if (pipeIndex === -1) return null;
      return {
        hash: line.slice(0, pipeIndex),
        message: line.slice(pipeIndex + 1),
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────────

/**
 * Parse a conventional commit message.
 * @param {string} message - Commit message
 * @returns {{type: string|null, scope: string|null, description: string, breaking: boolean}}
 */
function parseConventionalCommit(message) {
  if (!message || typeof message !== 'string') {
    return { type: null, scope: null, description: '', breaking: false };
  }

  const trimmed = message.trim();

  // Pattern: type(scope)!: description  OR  type!: description  OR  type(scope): description  OR  type: description
  const match = trimmed.match(/^(\w+)(?:\(([^)]*)\))?(!)?\s*:\s*(.*)$/);

  if (!match) {
    return { type: null, scope: null, description: trimmed, breaking: false };
  }

  const [, rawType, scope, bang, description] = match;
  const type = rawType.toLowerCase();
  const breaking = bang === '!' || description.startsWith('BREAKING CHANGE');

  return {
    type: CONVENTIONAL_TYPES[type] ? type : null,
    scope: scope || null,
    description: description.trim(),
    breaking,
  };
}

// ── Grouping ───────────────────────────────────────────────────────────────────

/**
 * Group parsed commits by conventional type.
 * @param {Array<{hash: string, message: string}>} commits
 * @returns {Object<string, Array<{hash: string, scope: string|null, description: string, breaking: boolean}>>}
 */
function groupByType(commits) {
  if (!Array.isArray(commits)) return {};

  const groups = {};

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message);
    const key = parsed.type || 'other';

    if (!groups[key]) groups[key] = [];
    groups[key].push({
      hash: commit.hash,
      scope: parsed.scope,
      description: parsed.description || commit.message,
      breaking: parsed.breaking,
    });
  }

  return groups;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

/**
 * Format grouped commits as markdown changelog.
 * @param {Object} groups - Grouped commits from groupByType
 * @param {object} [options]
 * @param {string} [options.title] - Changelog title
 * @param {boolean} [options.includeHash] - Include commit hash
 * @param {string} [options.since] - Since ref for subtitle
 * @returns {string}
 */
function formatChangelog(groups, options = {}) {
  const { title = 'Changelog', includeHash = false, since } = options;

  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');

  if (since) {
    lines.push(`Changes since \`${since}\``);
    lines.push('');
  }

  const hasContent = Object.keys(groups).length > 0;

  if (!hasContent) {
    lines.push('No changes found.');
    return lines.join('\n');
  }

  // Ordered types first, then 'other' at the end
  const orderedKeys = TYPE_ORDER.filter((k) => groups[k]);
  if (groups.other) orderedKeys.push('other');

  for (const key of orderedKeys) {
    const sectionTitle = CONVENTIONAL_TYPES[key] || 'Other';
    const items = groups[key];

    lines.push(`## ${sectionTitle}`);
    lines.push('');

    for (const item of items) {
      const scopePrefix = item.scope ? `**${item.scope}:** ` : '';
      const hashSuffix = includeHash ? ` (${item.hash.slice(0, 7)})` : '';
      const breakingPrefix = item.breaking ? '**BREAKING** ' : '';
      lines.push(`- ${breakingPrefix}${scopePrefix}${item.description}${hashSuffix}`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Format grouped commits as JSON.
 * @param {Object} groups - Grouped commits from groupByType
 * @param {object} [options]
 * @param {string} [options.since] - Since ref
 * @returns {string}
 */
function formatJSON(groups, options = {}) {
  const { since } = options;
  const output = {
    generated: new Date().toISOString(),
    since: since || null,
    sections: {},
  };

  for (const [key, items] of Object.entries(groups)) {
    const sectionTitle = CONVENTIONAL_TYPES[key] || 'Other';
    output.sections[sectionTitle] = items.map((item) => ({
      hash: item.hash,
      scope: item.scope,
      description: item.description,
      breaking: item.breaking,
    }));
  }

  return JSON.stringify(output, null, 2);
}

// ── CLI Handler ────────────────────────────────────────────────────────────────

/**
 * Run the changelog command.
 * @param {string[]} argv - Command arguments
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @param {function} [options.log] - Custom log function for testing
 * @returns {string} Generated output
 */
function runChangelog(argv = [], options = {}) {
  const log = options.log || console.log;

  // Parse flags
  let since = null;
  let format = 'md';
  let includeHash = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--since' && argv[i + 1]) {
      since = argv[i + 1];
      i++;
    } else if (argv[i] === '--format' && argv[i + 1]) {
      format = argv[i + 1].toLowerCase();
      i++;
    } else if (argv[i] === '--hash') {
      includeHash = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      log(getHelpText());
      return '';
    }
  }

  // Determine the starting ref
  if (!since) {
    since = getLatestTag(options);
  }

  // Get commits
  const commits = getGitLog(since, options);

  // Group by type
  const groups = groupByType(commits);

  // Format output
  let output;
  if (format === 'json') {
    output = formatJSON(groups, { since });
  } else {
    output = formatChangelog(groups, { includeHash, since });
  }

  log(output);
  return output;
}

/**
 * Get help text for the changelog command.
 * @returns {string}
 */
function getHelpText() {
  return `
AIOX Changelog Generator

USAGE:
  aiox changelog                    # From last tag to HEAD
  aiox changelog --since <ref>      # From specific ref
  aiox changelog --format md        # Markdown output (default)
  aiox changelog --format json      # JSON output
  aiox changelog --hash             # Include commit hashes

OPTIONS:
  --since <ref>     Starting reference (tag, commit, branch)
  --format <fmt>    Output format: md (default), json
  --hash            Include abbreviated commit hashes
  -h, --help        Show this help
`.trim();
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  getLatestTag,
  getGitLog,
  parseConventionalCommit,
  groupByType,
  formatChangelog,
  formatJSON,
  runChangelog,
  getHelpText,
  CONVENTIONAL_TYPES,
  TYPE_ORDER,
};
