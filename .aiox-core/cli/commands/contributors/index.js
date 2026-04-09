/**
 * Contributor Stats
 *
 * Shows contributor list with commit counts from git log.
 * Supports filtering by time period and top N.
 *
 * @module cli/commands/contributors
 * @version 1.0.0
 * @story 14.3 — Contributor Stats
 */

'use strict';

const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
CONTRIBUTOR STATS

USAGE:
  aiox contributors                Show all contributors with commit counts
  aiox contributors --format json  Output as JSON
  aiox contributors --since 30d   Filter by time period (e.g. 7d, 4w, 6m, 1y)
  aiox contributors --top N       Show top N contributors
  aiox contributors --help        Show this help

Uses git shortlog internally to gather commit statistics.
`.trim();

const PERIOD_MAP = {
  d: 'days',
  w: 'weeks',
  m: 'months',
  y: 'years',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a time period string like "30d", "4w", "6m", "1y" into git --since format.
 * @param {string} period
 * @returns {string|null}
 */
function parsePeriod(period) {
  if (!period || typeof period !== 'string') return null;
  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) return null;
  const num = match[1];
  const unit = PERIOD_MAP[match[2]];
  if (!unit) return null;
  return `${num}.${unit}.ago`;
}

/**
 * Run git shortlog to get contributor stats.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.since] - git --since value
 * @returns {Array<{ name: string, commits: number }>}
 */
function getContributors(options = {}) {
  const exec = options.execFn || execSync;
  const sinceArg = options.since ? ` --since="${options.since}"` : '';
  try {
    const output = exec(
      `git shortlog -sn --no-merges HEAD${sinceArg}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (!output) return [];
    return parseShortlog(output);
  } catch {
    return [];
  }
}

/**
 * Parse git shortlog output into structured data.
 * @param {string} output
 * @returns {Array<{ name: string, commits: number }>}
 */
function parseShortlog(output) {
  if (!output || typeof output !== 'string') return [];
  return output
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      return { commits: parseInt(match[1], 10), name: match[2].trim() };
    })
    .filter(Boolean);
}

/**
 * Apply top N filter.
 * @param {Array<{ name: string, commits: number }>} contributors
 * @param {number|null} topN
 * @returns {Array<{ name: string, commits: number }>}
 */
function applyTop(contributors, topN) {
  if (!topN || topN <= 0) return contributors;
  return contributors.slice(0, topN);
}

/**
 * Format contributors for display.
 * @param {Array<{ name: string, commits: number }>} contributors
 * @returns {string}
 */
function formatContributors(contributors) {
  if (!contributors.length) {
    return 'No contributors found.';
  }
  const lines = [];
  lines.push('CONTRIBUTOR STATS');
  lines.push('='.repeat(40));
  lines.push('');
  lines.push('Commits | Contributor');
  lines.push('-'.repeat(40));
  for (const c of contributors) {
    lines.push(`${String(c.commits).padStart(7)} | ${c.name}`);
  }
  lines.push('');
  const total = contributors.reduce((s, c) => s + c.commits, 0);
  lines.push(`Total: ${total} commits from ${contributors.length} contributors`);
  return lines.join('\n');
}

/**
 * Main entry point.
 * @param {string[]} argv
 * @param {object} [options]
 */
function runContributors(argv = [], options = {}) {
  const log = options.log || console.log;

  if (argv.includes('--help') || argv.includes('-h')) {
    log(HELP_TEXT);
    return;
  }

  const isJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const sinceIdx = argv.indexOf('--since');
  const sinceRaw = sinceIdx >= 0 ? argv[sinceIdx + 1] : null;
  const topIdx = argv.indexOf('--top');
  const topN = topIdx >= 0 ? parseInt(argv[topIdx + 1], 10) : null;

  const gitSince = sinceRaw ? parsePeriod(sinceRaw) : null;
  let contributors = getContributors({ ...options, since: gitSince });
  contributors = applyTop(contributors, topN);

  if (isJson) {
    log(JSON.stringify(contributors, null, 2));
  } else {
    log(formatContributors(contributors));
  }
}

function getHelpText() {
  return HELP_TEXT;
}

module.exports = {
  parsePeriod,
  getContributors,
  parseShortlog,
  applyTop,
  formatContributors,
  runContributors,
  getHelpText,
  HELP_TEXT,
  PERIOD_MAP,
};
