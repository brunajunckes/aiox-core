/**
 * CLI Stats & Summary
 *
 * Comprehensive project summary: commands, tests, stories, LOC, and more.
 *
 * @module cli/commands/stats-summary
 * @version 1.0.0
 * @story 20.4 - CLI Stats & Summary
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Data Collection ───────────────────────────────────────────────────────────

/**
 * Count registered commands in bin/aiox.js.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {number}
 */
function countCommands(options = {}) {
  const cwd = options.cwd || process.cwd();
  const aioxPath = path.join(cwd, 'bin', 'aiox.js');
  try {
    const content = fs.readFileSync(aioxPath, 'utf8');
    const matches = content.match(/case\s+'[^']+'/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Count test files.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {number}
 */
function countTestFiles(options = {}) {
  const cwd = options.cwd || process.cwd();
  const testsDir = path.join(cwd, 'tests');
  let count = 0;
  try {
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          walk(full);
        } else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
          count++;
        }
      }
    };
    if (fs.existsSync(testsDir)) walk(testsDir);
  } catch {
    // ignore
  }
  return count;
}

/**
 * Count story files.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {number}
 */
function countStories(options = {}) {
  const cwd = options.cwd || process.cwd();
  const storiesDir = path.join(cwd, 'docs', 'stories');
  try {
    if (!fs.existsSync(storiesDir)) return 0;
    return fs.readdirSync(storiesDir).filter((f) => f.endsWith('.story.md')).length;
  } catch {
    return 0;
  }
}

/**
 * Count lines of code (JS/TS files).
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {number}
 */
function countLinesOfCode(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const result = exec(
      'find .aiox-core/cli bin packages -name "*.js" -o -name "*.ts" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1',
      { encoding: 'utf8' },
    ).trim();
    const match = result.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Count dependencies from package.json.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{ deps: number, devDeps: number }}
 */
function countDependencies(options = {}) {
  const cwd = options.cwd || process.cwd();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    return {
      deps: pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
      devDeps: pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0,
    };
  } catch {
    return { deps: 0, devDeps: 0 };
  }
}

/**
 * Count merged PRs.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {number}
 */
function countMergedPRs(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const result = exec('git log --oneline --merges | wc -l', { encoding: 'utf8' }).trim();
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Count sprints from story file naming (N.X.story.md — N is sprint).
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {number}
 */
function countSprints(options = {}) {
  const cwd = options.cwd || process.cwd();
  const storiesDir = path.join(cwd, 'docs', 'stories');
  try {
    if (!fs.existsSync(storiesDir)) return 0;
    const files = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.story.md'));
    const sprintNums = new Set();
    for (const f of files) {
      const match = f.match(/^(\d+)\./);
      if (match) sprintNums.add(match[1]);
    }
    return sprintNums.size;
  } catch {
    return 0;
  }
}

/**
 * Collect all stats.
 * @param {object} [options]
 * @returns {object}
 */
function collectStats(options = {}) {
  const deps = countDependencies(options);
  return {
    commands: countCommands(options),
    testFiles: countTestFiles(options),
    stories: countStories(options),
    linesOfCode: countLinesOfCode(options),
    sprints: countSprints(options),
    mergedPRs: countMergedPRs(options),
    dependencies: deps.deps,
    devDependencies: deps.devDeps,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format stats as text.
 * @param {object} stats
 * @returns {string}
 */
function formatText(stats) {
  const lines = [
    'AIOX Project Summary',
    '====================',
    '',
    `  Commands:         ${stats.commands}`,
    `  Test Files:       ${stats.testFiles}`,
    `  Stories:          ${stats.stories}`,
    `  Lines of Code:    ${stats.linesOfCode}`,
    `  Sprints:          ${stats.sprints}`,
    `  Merged PRs:       ${stats.mergedPRs}`,
    `  Dependencies:     ${stats.dependencies}`,
    `  Dev Dependencies: ${stats.devDependencies}`,
  ];
  return lines.join('\n');
}

/**
 * Format stats as JSON.
 * @param {object} stats
 * @returns {string}
 */
function formatJSON(stats) {
  return JSON.stringify({
    generated: new Date().toISOString(),
    ...stats,
  }, null, 2);
}

/**
 * Generate badge URLs.
 * @param {object} stats
 * @returns {string}
 */
function generateBadges(stats) {
  const base = 'https://img.shields.io/badge';
  const lines = [
    'AIOX Badge URLs:',
    '',
    `  Commands:  ${base}/commands-${stats.commands}-blue`,
    `  Tests:     ${base}/tests-${stats.testFiles}-green`,
    `  Stories:   ${base}/stories-${stats.stories}-orange`,
    `  Sprints:   ${base}/sprints-${stats.sprints}-purple`,
    `  LOC:       ${base}/LOC-${stats.linesOfCode}-lightgrey`,
  ];
  return lines.join('\n');
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Run the stats-summary command.
 * @param {string[]} argv
 * @param {object} [options]
 * @param {function} [options.log]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {string}
 */
function runStatsSummary(argv = [], options = {}) {
  const log = options.log || console.log;

  if (argv.includes('--help') || argv.includes('-h')) {
    log(getHelpText());
    return '';
  }

  const format = argv.includes('--format') ? argv[argv.indexOf('--format') + 1] : 'text';
  const badge = argv.includes('--badge');
  const outputPath = argv.includes('--output') ? argv[argv.indexOf('--output') + 1] : null;

  const stats = collectStats(options);

  let output;
  if (badge) {
    output = generateBadges(stats);
  } else if (format === 'json') {
    output = formatJSON(stats);
  } else {
    output = formatText(stats);
  }

  if (outputPath) {
    const absPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(absPath, output, 'utf8');
    log(`Summary written to ${outputPath}`);
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
AIOX CLI Stats & Summary

USAGE:
  aiox stats-summary                           Comprehensive project summary
  aiox stats-summary --format json             JSON output
  aiox stats-summary --badge                   Generate badge URLs
  aiox stats-summary --output .aiox/stats.json Save to file

METRICS:
  - Total CLI commands (from bin/aiox.js)
  - Total test files
  - Total stories
  - Lines of code
  - Sprints completed
  - PRs merged
  - Dependencies count

OPTIONS:
  --format <fmt>    Output format: text (default), json
  --badge           Generate badge URLs for README
  --output <path>   Save output to file
  -h, --help        Show this help
`.trim();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  countCommands,
  countTestFiles,
  countStories,
  countLinesOfCode,
  countDependencies,
  countMergedPRs,
  countSprints,
  collectStats,
  formatText,
  formatJSON,
  generateBadges,
  runStatsSummary,
  getHelpText,
};
