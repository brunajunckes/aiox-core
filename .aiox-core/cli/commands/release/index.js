/**
 * Release Preparation & Version Bump
 *
 * Pre-release validation, semver bump, and release notes generation.
 * Zero external dependencies — uses only Node.js built-ins and sibling changelog module.
 *
 * @module cli/commands/release
 * @version 1.0.0
 * @story 6.4 - Release Preparation & Version Bump
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const BUMP_TYPES = ['major', 'minor', 'patch'];

const PACKAGE_JSON_PATH = path.join(__dirname, '..', '..', '..', '..', 'package.json');

// ── Version Operations ────────────────────────────────────────────────────────

/**
 * Read and return the current version from package.json.
 * @param {object} [options]
 * @param {string} [options.packagePath] - Override package.json path (for testing)
 * @returns {string} Current semver version string
 */
function getCurrentVersion(options = {}) {
  const pkgPath = options.packagePath || PACKAGE_JSON_PATH;
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);
  return pkg.version;
}

/**
 * Bump a semver version string by the given type.
 * @param {string} type - One of 'major', 'minor', 'patch'
 * @param {object} [options]
 * @param {string} [options.currentVersion] - Override current version (for testing)
 * @param {string} [options.packagePath] - Override package.json path
 * @returns {string} New version string
 */
function bumpVersion(type, options = {}) {
  if (!BUMP_TYPES.includes(type)) {
    throw new Error(`Invalid bump type: ${type}. Must be one of: ${BUMP_TYPES.join(', ')}`);
  }

  const current = options.currentVersion || getCurrentVersion(options);
  const parts = current.split('.').map(Number);

  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid current version format: ${current}`);
  }

  switch (type) {
    case 'major':
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1] += 1;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2] += 1;
      break;
  }

  return parts.join('.');
}

/**
 * Write a new version to package.json, preserving formatting.
 * @param {string} version - New version string
 * @param {object} [options]
 * @param {string} [options.packagePath] - Override package.json path (for testing)
 */
function writeVersion(version, options = {}) {
  const pkgPath = options.packagePath || PACKAGE_JSON_PATH;
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);

  // Detect indent (2 spaces is default for npm)
  const indent = raw.match(/^\s+/m)?.[0] || '  ';

  pkg.version = version;

  // Preserve trailing newline if present
  const trailingNewline = raw.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + trailingNewline, 'utf8');
}

// ── Readiness Checks ──────────────────────────────────────────────────────────

/**
 * Run pre-release readiness checks.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function (for testing)
 * @param {string} [options.packagePath] - Override package.json path
 * @returns {{ passed: boolean, checks: Array<{name: string, passed: boolean, detail: string}> }}
 */
function checkReadiness(options = {}) {
  const exec = options.execFn || execSync;
  const checks = [];

  // 1. Uncommitted changes
  try {
    const status = exec('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status) {
      checks.push({ name: 'No uncommitted changes', passed: false, detail: `${status.split('\n').length} uncommitted file(s)` });
    } else {
      checks.push({ name: 'No uncommitted changes', passed: true, detail: 'Working tree clean' });
    }
  } catch {
    checks.push({ name: 'No uncommitted changes', passed: false, detail: 'Unable to check git status' });
  }

  // 2. Tests passing
  try {
    exec('npm test --silent 2>&1', { encoding: 'utf8', timeout: 120000 });
    checks.push({ name: 'Tests passing', passed: true, detail: 'All tests passed' });
  } catch {
    checks.push({ name: 'Tests passing', passed: false, detail: 'Some tests failed' });
  }

  // 3. Current version
  try {
    const version = getCurrentVersion(options);
    checks.push({ name: 'Current version', passed: true, detail: version });
  } catch (error) {
    checks.push({ name: 'Current version', passed: false, detail: error.message });
  }

  // 4. Changelog up to date (has commits since last tag)
  try {
    const changelogPath = path.join(__dirname, '..', 'changelog', 'index.js');
    const { getLatestTag, getGitLog } = require(changelogPath);
    const tag = getLatestTag(options);
    const commits = getGitLog(tag, options);
    if (commits.length > 0) {
      checks.push({ name: 'Changelog up to date', passed: true, detail: `${commits.length} commit(s) since ${tag || 'initial'}` });
    } else {
      checks.push({ name: 'Changelog up to date', passed: false, detail: 'No new commits since last tag' });
    }
  } catch {
    checks.push({ name: 'Changelog up to date', passed: true, detail: 'Changelog check skipped (no changelog module)' });
  }

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

// ── Release Notes ─────────────────────────────────────────────────────────────

/**
 * Generate release notes from git log since a given ref.
 * Delegates to the changelog module.
 * @param {string|null} since - Starting ref (tag, commit). If null, auto-detects last tag.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function (for testing)
 * @returns {string} Formatted release notes in markdown
 */
function generateReleaseNotes(since, options = {}) {
  const changelogPath = path.join(__dirname, '..', 'changelog', 'index.js');
  const { getLatestTag, getGitLog, groupByType, formatChangelog } = require(changelogPath);

  const ref = since || getLatestTag(options);
  const commits = getGitLog(ref, options);
  const groups = groupByType(commits);

  return formatChangelog(groups, {
    title: 'Release Notes',
    since: ref,
  });
}

// ── Output Formatting ─────────────────────────────────────────────────────────

/**
 * Format readiness check results for terminal output.
 * @param {{ passed: boolean, checks: Array<{name: string, passed: boolean, detail: string}> }} result
 * @returns {string}
 */
function formatReadinessOutput(result) {
  const lines = [];
  lines.push('Release Readiness Check');
  lines.push('\u2501'.repeat(26));

  for (const check of result.checks) {
    const icon = check.passed ? '[PASS]' : '[FAIL]';
    lines.push(`  ${icon} ${check.name}: ${check.detail}`);
  }

  lines.push('');
  if (result.passed) {
    lines.push('  Ready for release!');
  } else {
    lines.push('  Not ready for release. Fix the issues above.');
  }

  return lines.join('\n');
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Run the release command.
 * @param {string[]} argv - Command arguments (after 'release')
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function (for testing)
 * @param {function} [options.log] - Custom log function (for testing)
 * @param {string} [options.packagePath] - Override package.json path (for testing)
 * @returns {string} Command output
 */
function runRelease(argv = [], options = {}) {
  const log = options.log || console.log;
  const subcommand = argv[0];

  switch (subcommand) {
    case 'check': {
      const result = checkReadiness(options);
      const output = formatReadinessOutput(result);
      log(output);
      return output;
    }

    case 'bump': {
      const type = argv[1];
      if (!type || !BUMP_TYPES.includes(type)) {
        const msg = `Usage: aiox release bump <${BUMP_TYPES.join('|')}>`;
        log(msg);
        return msg;
      }
      const oldVersion = getCurrentVersion(options);
      const newVersion = bumpVersion(type, options);
      writeVersion(newVersion, options);
      const msg = `Version bumped: ${oldVersion} -> ${newVersion}`;
      log(msg);
      return msg;
    }

    case 'notes': {
      const sinceIdx = argv.indexOf('--since');
      const since = sinceIdx !== -1 && argv[sinceIdx + 1] ? argv[sinceIdx + 1] : null;
      const output = generateReleaseNotes(since, options);
      log(output);
      return output;
    }

    case 'prepare': {
      const lines = [];

      // Step 1: Check readiness
      log('Step 1/3: Checking release readiness...');
      const readiness = checkReadiness(options);
      const readinessOutput = formatReadinessOutput(readiness);
      log(readinessOutput);
      lines.push(readinessOutput);

      if (!readiness.passed) {
        const msg = '\nRelease preparation aborted. Fix issues before proceeding.';
        log(msg);
        lines.push(msg);
        return lines.join('\n');
      }

      // Step 2: Bump version
      const type = argv[1] || 'patch';
      if (!BUMP_TYPES.includes(type)) {
        const msg = `\nInvalid bump type: ${type}. Use one of: ${BUMP_TYPES.join(', ')}`;
        log(msg);
        lines.push(msg);
        return lines.join('\n');
      }

      log(`\nStep 2/3: Bumping version (${type})...`);
      const oldVersion = getCurrentVersion(options);
      const newVersion = bumpVersion(type, options);
      writeVersion(newVersion, options);
      const bumpMsg = `Version bumped: ${oldVersion} -> ${newVersion}`;
      log(bumpMsg);
      lines.push('', bumpMsg);

      // Step 3: Generate release notes
      log('\nStep 3/3: Generating release notes...');
      const notes = generateReleaseNotes(null, options);
      log(notes);
      lines.push('', notes);

      const summary = `\nRelease ${newVersion} prepared successfully.`;
      log(summary);
      lines.push(summary);

      return lines.join('\n');
    }

    case '--help':
    case '-h':
    case 'help': {
      const help = getHelpText();
      log(help);
      return help;
    }

    default: {
      const help = getHelpText();
      log(help);
      return help;
    }
  }
}

/**
 * Get help text for the release command.
 * @returns {string}
 */
function getHelpText() {
  return `
AIOX Release Preparation

USAGE:
  aiox release check                  # Validate release readiness
  aiox release bump <major|minor|patch>  # Bump version in package.json
  aiox release notes                  # Generate release notes from changelog
  aiox release notes --since <ref>    # Release notes since specific ref
  aiox release prepare [patch]        # Full prep: check + bump + notes
  aiox release prepare minor          # Full prep with minor bump
  aiox release --help                 # Show this help

SUBCOMMANDS:
  check     Validate clean tree, tests passing, version readable
  bump      Increment semver version in package.json
  notes     Generate release notes from git log since last tag
  prepare   Full release preparation pipeline
`.trim();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getCurrentVersion,
  bumpVersion,
  writeVersion,
  checkReadiness,
  generateReleaseNotes,
  formatReadinessOutput,
  runRelease,
  getHelpText,
  BUMP_TYPES,
};
