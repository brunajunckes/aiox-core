/**
 * Dependency License Checker Command Module
 *
 * Lists and validates dependency licenses from package.json + node_modules.
 *
 * Subcommands:
 *   aiox licenses              — List all dependency licenses
 *   aiox licenses --check      — Exit 1 if non-permissive license found
 *   aiox licenses --format json — Output as JSON
 *   aiox licenses --allow MIT,ISC — Set allowed licenses
 *   aiox licenses --help       — Show help
 *
 * @module cli/commands/licenses
 * @version 1.0.0
 * @story 12.2 — Dependency License Checker
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'BlueOak-1.0.0', 'Unlicense', 'CC0-1.0'];

const NON_PERMISSIVE = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only', 'GPL-2.0-or-later', 'GPL-3.0-or-later', 'AGPL-3.0-or-later'];

const HELP_TEXT = `
AIOX Dependency License Checker

Usage:
  aiox licenses                     List all dependency licenses
  aiox licenses --check             Exit 1 if non-permissive license found (GPL, AGPL)
  aiox licenses --format json       Output as JSON
  aiox licenses --allow MIT,ISC,... Set allowed licenses (comma-separated)
  aiox licenses --help              Show this help

Default allowed: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, Unlicense, CC0-1.0
Non-permissive (flagged): GPL-2.0, GPL-3.0, AGPL-3.0 and variants
`.trim();

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Read dependencies from package.json.
 * @param {string} [rootDir] - Project root
 * @returns {{ dependencies: Object, devDependencies: Object }}
 */
function readPackageJson(rootDir) {
  rootDir = rootDir || process.cwd();
  const pkgPath = path.join(rootDir, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    };
  } catch (_e) {
    return { dependencies: {}, devDependencies: {} };
  }
}

/**
 * Get license info for a single package from node_modules.
 * @param {string} pkgName - Package name
 * @param {string} rootDir - Project root
 * @returns {{ name: string, license: string, version: string }}
 */
function getPackageLicense(pkgName, rootDir) {
  rootDir = rootDir || process.cwd();
  const pkgJsonPath = path.join(rootDir, 'node_modules', pkgName, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    let license = pkg.license || 'UNKNOWN';
    // Handle object license format: { type: "MIT", url: "..." }
    if (typeof license === 'object' && license.type) {
      license = license.type;
    }
    return { name: pkgName, license: String(license), version: pkg.version || 'unknown' };
  } catch (_e) {
    return { name: pkgName, license: 'UNKNOWN', version: 'unknown' };
  }
}

/**
 * Collect license info for all dependencies.
 * @param {string} [rootDir] - Project root
 * @returns {Array<{ name: string, license: string, version: string }>}
 */
function collectLicenses(rootDir) {
  rootDir = rootDir || process.cwd();
  const { dependencies, devDependencies } = readPackageJson(rootDir);
  const allDeps = { ...dependencies, ...devDependencies };
  const names = Object.keys(allDeps).sort();
  return names.map(name => getPackageLicense(name, rootDir));
}

/**
 * Check licenses against allowed list.
 * @param {Array<{ name: string, license: string }>} licenses
 * @param {string[]} allowed - Allowed license identifiers
 * @returns {{ ok: boolean, violations: Array<{ name: string, license: string }> }}
 */
function checkLicenses(licenses, allowed) {
  allowed = allowed || DEFAULT_ALLOWED;
  const violations = [];
  for (const pkg of licenses) {
    if (pkg.license === 'UNKNOWN') continue; // Unknown is a separate concern
    if (!allowed.includes(pkg.license)) {
      violations.push(pkg);
    }
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Check if a license is non-permissive (GPL/AGPL family).
 * @param {string} license
 * @returns {boolean}
 */
function isNonPermissive(license) {
  return NON_PERMISSIVE.includes(license);
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format license list for console output.
 * @param {Array} licenses
 * @returns {string}
 */
function formatConsole(licenses) {
  if (licenses.length === 0) {
    return 'No dependencies found.';
  }
  const lines = [`Dependencies (${licenses.length}):\n`];
  for (const pkg of licenses) {
    const flag = isNonPermissive(pkg.license) ? ' [NON-PERMISSIVE]' : '';
    lines.push(`  ${pkg.name}@${pkg.version} — ${pkg.license}${flag}`);
  }
  return lines.join('\n');
}

/**
 * Format license data as JSON.
 * @param {Array} licenses
 * @param {{ ok: boolean, violations: Array }} [checkResult]
 * @returns {string}
 */
function formatJSON(licenses, checkResult) {
  const output = {
    totalDependencies: licenses.length,
    licenses,
    checkedAt: new Date().toISOString(),
  };
  if (checkResult) {
    output.check = checkResult;
  }
  return JSON.stringify(output, null, 2);
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Run the licenses command.
 * @param {string[]} argv - Arguments after 'licenses'
 */
function runLicenses(argv) {
  argv = argv || [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const doCheck = argv.includes('--check');
  const formatIdx = argv.indexOf('--format');
  const format = formatIdx >= 0 ? argv[formatIdx + 1] : 'text';
  const allowIdx = argv.indexOf('--allow');
  const allowList = allowIdx >= 0 ? argv[allowIdx + 1].split(',') : DEFAULT_ALLOWED;

  const rootDir = process.cwd();
  const licenses = collectLicenses(rootDir);

  if (doCheck) {
    const result = checkLicenses(licenses, allowList);
    if (format === 'json') {
      console.log(formatJSON(licenses, result));
    } else if (result.ok) {
      console.log('All dependency licenses are compliant.');
    } else {
      console.log(`License violations found (${result.violations.length}):\n`);
      for (const v of result.violations) {
        console.log(`  ${v.name}@${v.version} — ${v.license}`);
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (format === 'json') {
    console.log(formatJSON(licenses));
    return;
  }

  console.log(formatConsole(licenses));
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  readPackageJson,
  getPackageLicense,
  collectLicenses,
  checkLicenses,
  isNonPermissive,
  formatConsole,
  formatJSON,
  runLicenses,
  DEFAULT_ALLOWED,
  NON_PERMISSIVE,
  HELP_TEXT,
};
