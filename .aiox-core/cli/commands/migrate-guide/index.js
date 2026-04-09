/**
 * Migration Guide Generator
 *
 * Generates migration guides from breaking changes detected in git history.
 *
 * @module cli/commands/migrate-guide
 * @version 1.0.0
 * @story 20.2 - Migration Guide Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Git Operations ────────────────────────────────────────────────────────────

/**
 * Get commits between two refs (or all if no refs).
 * @param {object} [options]
 * @param {string} [options.from] - Starting ref
 * @param {string} [options.to] - Ending ref (default HEAD)
 * @param {function} [options.execFn] - Custom exec function
 * @returns {Array<{ hash: string, message: string, body: string }>}
 */
function getCommits(options = {}) {
  const exec = options.execFn || execSync;
  const to = options.to || 'HEAD';
  const range = options.from ? `${options.from}..${to}` : to;
  const sep = '---AIOX-SEP---';

  try {
    const raw = exec(`git log --format="%H|%s|%b${sep}" ${range}`, { encoding: 'utf8' }).trim();
    if (!raw) return [];
    return raw.split(sep).filter(Boolean).map((entry) => {
      const trimmed = entry.trim();
      const firstPipe = trimmed.indexOf('|');
      const secondPipe = trimmed.indexOf('|', firstPipe + 1);
      if (firstPipe === -1 || secondPipe === -1) return null;
      return {
        hash: trimmed.slice(0, firstPipe),
        message: trimmed.slice(firstPipe + 1, secondPipe),
        body: trimmed.slice(secondPipe + 1).trim(),
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Detect breaking changes from commits.
 * @param {Array<{ hash: string, message: string, body: string }>} commits
 * @returns {Array<{ hash: string, description: string, type: string }>}
 */
function detectBreakingChanges(commits) {
  if (!Array.isArray(commits)) return [];
  const changes = [];

  for (const commit of commits) {
    const msg = commit.message || '';
    const body = commit.body || '';

    // Check for BREAKING CHANGE in body
    if (body.includes('BREAKING CHANGE') || body.includes('BREAKING-CHANGE')) {
      changes.push({
        hash: commit.hash,
        description: msg,
        type: 'breaking-change',
      });
      continue;
    }

    // Check for ! in conventional commit (e.g., feat!: ...)
    if (/^\w+(\([^)]*\))?!\s*:/.test(msg)) {
      changes.push({
        hash: commit.hash,
        description: msg.replace(/^\w+(\([^)]*\))?!\s*:\s*/, ''),
        type: 'breaking-commit',
      });
      continue;
    }

    // Check for keywords in message
    const lower = msg.toLowerCase();
    if (lower.includes('removed') || lower.includes('deprecated') || lower.includes('breaking')) {
      changes.push({
        hash: commit.hash,
        description: msg,
        type: 'keyword-detected',
      });
    }
  }

  return changes;
}

/**
 * Format migration guide as markdown.
 * @param {Array} changes - Breaking changes
 * @param {object} [options]
 * @param {string} [options.from]
 * @param {string} [options.to]
 * @returns {string}
 */
function formatMarkdown(changes, options = {}) {
  const from = options.from || 'previous';
  const to = options.to || 'current';
  const lines = [];

  lines.push(`# Migration Guide: ${from} -> ${to}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  if (changes.length === 0) {
    lines.push('No breaking changes detected.');
    return lines.join('\n');
  }

  lines.push(`## Breaking Changes (${changes.length})`);
  lines.push('');

  for (const change of changes) {
    const hashShort = change.hash ? change.hash.slice(0, 7) : '';
    lines.push(`- **${change.description}** (${hashShort}) [${change.type}]`);
  }

  lines.push('');
  lines.push('## Migration Steps');
  lines.push('');
  lines.push('Review each breaking change above and update your code accordingly.');

  return lines.join('\n');
}

/**
 * Format migration guide as JSON.
 * @param {Array} changes
 * @param {object} [options]
 * @returns {string}
 */
function formatJSON(changes, options = {}) {
  return JSON.stringify({
    generated: new Date().toISOString(),
    from: options.from || null,
    to: options.to || null,
    breakingChanges: changes,
    count: changes.length,
  }, null, 2);
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Run the migrate-guide command.
 * @param {string[]} argv
 * @param {object} [options]
 * @param {function} [options.log]
 * @param {function} [options.execFn]
 * @returns {string}
 */
function runMigrateGuide(argv = [], options = {}) {
  const log = options.log || console.log;

  let from = null;
  let to = null;
  let format = 'markdown';
  let outputPath = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) { from = argv[++i]; }
    else if (argv[i] === '--to' && argv[i + 1]) { to = argv[++i]; }
    else if (argv[i] === '--format' && argv[i + 1]) { format = argv[++i].toLowerCase(); }
    else if (argv[i] === '--output' && argv[i + 1]) { outputPath = argv[++i]; }
    else if (argv[i] === '--help' || argv[i] === '-h') {
      log(getHelpText());
      return '';
    }
  }

  const commits = getCommits({ from, to, execFn: options.execFn });
  const changes = detectBreakingChanges(commits);

  let output;
  if (format === 'json') {
    output = formatJSON(changes, { from, to });
  } else {
    output = formatMarkdown(changes, { from, to });
  }

  if (outputPath) {
    const absPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, output, 'utf8');
    log(`Migration guide written to ${outputPath}`);
    return output;
  }

  log(output);
  return output;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `
AIOX Migration Guide Generator

USAGE:
  aiox migrate-guide                            Generate from all history
  aiox migrate-guide --from v5.0.0 --to v6.0.0  Specific version range
  aiox migrate-guide --format markdown           Markdown output (default)
  aiox migrate-guide --format json               JSON output
  aiox migrate-guide --output docs/migration.md  Write to file

OPTIONS:
  --from <ref>      Starting version/ref
  --to <ref>        Ending version/ref (default: HEAD)
  --format <fmt>    Output format: markdown (default), json
  --output <path>   Write output to file
  -h, --help        Show this help
`.trim();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getCommits,
  detectBreakingChanges,
  formatMarkdown,
  formatJSON,
  runMigrateGuide,
  getHelpText,
};
