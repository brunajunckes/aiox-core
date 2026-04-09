/**
 * Version Manager
 *
 * View, bump, and inspect version history for AIOX projects.
 *
 * @module cli/commands/version-mgr
 * @version 1.0.0
 * @story 20.1 - Version Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load package.json from the project root.
 * @param {object} [options]
 * @param {string} [options.cwd] - Working directory
 * @returns {{ path: string, data: object }|null}
 */
function loadPackageJson(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    return { path: pkgPath, data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

/**
 * Parse a semver string into components.
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number }|null}
 */
function parseSemver(version) {
  if (!version || typeof version !== 'string') return null;
  const clean = version.replace(/^v/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Bump a semver version.
 * @param {string} current - Current version string
 * @param {'patch'|'minor'|'major'} level - Bump level
 * @returns {string|null}
 */
function bumpVersion(current, level) {
  const parsed = parseSemver(current);
  if (!parsed) return null;

  switch (level) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      return null;
  }
}

/**
 * Write new version to package.json.
 * @param {string} pkgPath - Path to package.json
 * @param {object} pkgData - Parsed package.json content
 * @param {string} newVersion - New version string
 */
function writeVersion(pkgPath, pkgData, newVersion) {
  pkgData.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
}

/**
 * Get version history from git tags.
 * @param {object} [options]
 * @param {function} [options.execFn] - Custom exec function for testing
 * @returns {Array<{ tag: string, date: string }>}
 */
function getVersionHistory(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const raw = exec('git tag -l "v*" --sort=-version:refname --format="%(refname:short)|%(creatordate:short)"', {
      encoding: 'utf8',
    }).trim();
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const idx = line.indexOf('|');
      if (idx === -1) return { tag: line.trim(), date: '' };
      return { tag: line.slice(0, idx).trim(), date: line.slice(idx + 1).trim() };
    });
  } catch {
    return [];
  }
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Run the version command.
 * @param {string[]} argv - Command arguments
 * @param {object} [options]
 * @param {function} [options.log] - Custom log function
 * @param {string} [options.cwd] - Working directory
 * @param {function} [options.execFn] - Custom exec function
 * @returns {string}
 */
function runVersionMgr(argv = [], options = {}) {
  const log = options.log || console.log;
  const sub = argv[0];

  if (sub === '--help' || sub === '-h') {
    log(getHelpText());
    return '';
  }

  // aiox version bump <level> [--dry-run]
  if (sub === 'bump') {
    const level = argv[1];
    const dryRun = argv.includes('--dry-run');

    if (!level || !['patch', 'minor', 'major'].includes(level)) {
      log('Error: specify bump level — patch, minor, or major');
      return '';
    }

    const pkg = loadPackageJson(options);
    if (!pkg) {
      log('Error: package.json not found');
      return '';
    }

    const newVer = bumpVersion(pkg.data.version, level);
    if (!newVer) {
      log(`Error: invalid current version "${pkg.data.version}"`);
      return '';
    }

    if (dryRun) {
      const msg = `Would bump ${pkg.data.version} -> ${newVer} (${level})`;
      log(msg);
      return msg;
    }

    writeVersion(pkg.path, pkg.data, newVer);
    const msg = `Bumped ${pkg.data.version} -> ${newVer} (${level})`;
    // Note: msg already shows the OLD version because we re-read data ref before write
    // Actually writeVersion mutates pkgData, so pkg.data.version is now newVer
    const resultMsg = `Bumped version to ${newVer} (${level})`;
    log(resultMsg);
    return resultMsg;
  }

  // aiox version history
  if (sub === 'history') {
    const history = getVersionHistory(options);
    if (history.length === 0) {
      log('No version tags found.');
      return 'No version tags found.';
    }
    const lines = ['Version History:', ''];
    for (const entry of history) {
      lines.push(`  ${entry.tag}  ${entry.date}`);
    }
    const out = lines.join('\n');
    log(out);
    return out;
  }

  // Default: show current version
  const pkg = loadPackageJson(options);
  if (!pkg) {
    log('Error: package.json not found');
    return '';
  }
  log(pkg.data.version);
  return pkg.data.version;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `
AIOX Version Manager

USAGE:
  aiox version                      Show current version
  aiox version bump patch           Bump patch (5.0.3 -> 5.0.4)
  aiox version bump minor           Bump minor (5.0.3 -> 5.1.0)
  aiox version bump major           Bump major (5.0.3 -> 6.0.0)
  aiox version bump patch --dry-run Preview without writing
  aiox version history              Show version history from git tags

OPTIONS:
  --dry-run     Preview bump without writing
  -h, --help    Show this help
`.trim();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  loadPackageJson,
  parseSemver,
  bumpVersion,
  writeVersion,
  getVersionHistory,
  runVersionMgr,
  getHelpText,
};
