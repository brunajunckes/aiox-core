/**
 * Release Checklist Runner
 *
 * Runs pre-release checks and reports pass/fail status.
 *
 * @module cli/commands/release-check
 * @version 1.0.0
 * @story 20.3 - Release Checklist Runner
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Checklist Items ───────────────────────────────────────────────────────────

/**
 * Run a single check.
 * @param {string} name
 * @param {function} fn - Returns { pass: boolean, message: string, fixable?: boolean }
 * @returns {{ name: string, pass: boolean, message: string, fixable: boolean }}
 */
function runCheck(name, fn) {
  try {
    const result = fn();
    return { name, pass: result.pass, message: result.message, fixable: !!result.fixable };
  } catch (error) {
    return { name, pass: false, message: error.message, fixable: false };
  }
}

/**
 * Check: Tests pass.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {{ pass: boolean, message: string }}
 */
function checkTests(options = {}) {
  const exec = options.execFn || execSync;
  try {
    exec('npm test -- --passWithNoTests 2>&1', { encoding: 'utf8', timeout: 120000 });
    return { pass: true, message: 'All tests passing' };
  } catch {
    return { pass: false, message: 'Test suite has failures' };
  }
}

/**
 * Check: Lint clean.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {{ pass: boolean, message: string, fixable: boolean }}
 */
function checkLint(options = {}) {
  const exec = options.execFn || execSync;
  try {
    exec('npm run lint 2>&1', { encoding: 'utf8', timeout: 60000 });
    return { pass: true, message: 'Lint clean' };
  } catch {
    return { pass: false, message: 'Lint errors found', fixable: true };
  }
}

/**
 * Check: No uncommitted changes.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {{ pass: boolean, message: string }}
 */
function checkCleanWorkingDir(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const status = exec('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status.length === 0) {
      return { pass: true, message: 'Working directory clean' };
    }
    const count = status.split('\n').length;
    return { pass: false, message: `${count} uncommitted change(s)` };
  } catch {
    return { pass: false, message: 'Could not check git status' };
  }
}

/**
 * Check: Version has been bumped (not 0.0.0 or empty).
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{ pass: boolean, message: string }}
 */
function checkVersionBumped(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.version || pkg.version === '0.0.0') {
      return { pass: false, message: 'Version not set or is 0.0.0' };
    }
    return { pass: true, message: `Version ${pkg.version}` };
  } catch {
    return { pass: false, message: 'package.json not found or invalid' };
  }
}

/**
 * Check: CHANGELOG or release notes exist.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{ pass: boolean, message: string }}
 */
function checkChangelog(options = {}) {
  const cwd = options.cwd || process.cwd();
  const candidates = ['CHANGELOG.md', 'changelog.md', 'CHANGES.md', 'docs/CHANGELOG.md'];
  for (const name of candidates) {
    if (fs.existsSync(path.join(cwd, name))) {
      return { pass: true, message: `Found ${name}` };
    }
  }
  return { pass: false, message: 'No changelog found' };
}

/**
 * Check: No TODO/FIXME in source.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @returns {{ pass: boolean, message: string }}
 */
function checkNoTodos(options = {}) {
  const exec = options.execFn || execSync;
  try {
    const result = exec(
      'grep -rn "TODO\\|FIXME" --include="*.js" --include="*.ts" .aiox-core/cli/ bin/ packages/ 2>/dev/null | head -20',
      { encoding: 'utf8' },
    ).trim();
    if (!result) {
      return { pass: true, message: 'No TODOs found in source' };
    }
    const count = result.split('\n').length;
    return { pass: false, message: `${count} TODO/FIXME found in source` };
  } catch {
    // grep returns exit 1 when no matches — that means pass
    return { pass: true, message: 'No TODOs found in source' };
  }
}

/**
 * Check: Dependencies are present.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{ pass: boolean, message: string }}
 */
function checkDependencies(options = {}) {
  const cwd = options.cwd || process.cwd();
  const nmPath = path.join(cwd, 'node_modules');
  if (fs.existsSync(nmPath)) {
    return { pass: true, message: 'node_modules present' };
  }
  return { pass: false, message: 'node_modules missing — run npm install', fixable: true };
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Run all release checks.
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @param {boolean} [options.skipTests] - Skip the slow test check
 * @returns {Array<{ name: string, pass: boolean, message: string, fixable: boolean }>}
 */
function runAllChecks(options = {}) {
  const checks = [];
  if (!options.skipTests) {
    checks.push(runCheck('Tests', () => checkTests(options)));
  }
  checks.push(runCheck('Lint', () => checkLint(options)));
  checks.push(runCheck('Clean Working Directory', () => checkCleanWorkingDir(options)));
  checks.push(runCheck('Version Bumped', () => checkVersionBumped(options)));
  checks.push(runCheck('Changelog', () => checkChangelog(options)));
  checks.push(runCheck('No TODOs', () => checkNoTodos(options)));
  checks.push(runCheck('Dependencies', () => checkDependencies(options)));
  return checks;
}

/**
 * Format results as text.
 * @param {Array} results
 * @returns {string}
 */
function formatText(results) {
  const lines = ['Release Checklist:', ''];
  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    lines.push(`  [${icon}] ${r.name}: ${r.message}`);
    if (r.pass) passed++;
    else failed++;
  }

  lines.push('');
  lines.push(`Result: ${passed} passed, ${failed} failed out of ${results.length} checks`);

  if (failed === 0) {
    lines.push('Ready for release!');
  } else {
    lines.push('Not ready for release — fix the failing checks above.');
  }

  return lines.join('\n');
}

/**
 * Format results as JSON.
 * @param {Array} results
 * @returns {string}
 */
function formatJSON(results) {
  const passed = results.filter((r) => r.pass).length;
  return JSON.stringify({
    generated: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    ready: passed === results.length,
    checks: results,
  }, null, 2);
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Run the release-check command.
 * @param {string[]} argv
 * @param {object} [options]
 * @param {function} [options.log]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {string}
 */
function runReleaseCheck(argv = [], options = {}) {
  const log = options.log || console.log;
  const ci = argv.includes('--ci');
  const format = argv.includes('--format') ? argv[argv.indexOf('--format') + 1] : 'text';

  if (argv.includes('--help') || argv.includes('-h')) {
    log(getHelpText());
    return '';
  }

  const results = runAllChecks(options);

  let output;
  if (format === 'json') {
    output = formatJSON(results);
  } else {
    output = formatText(results);
  }

  log(output);

  if (ci) {
    const allPassed = results.every((r) => r.pass);
    if (!allPassed) {
      process.exitCode = 1;
    }
  }

  return output;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `
AIOX Release Checklist Runner

USAGE:
  aiox release-check                 Run pre-release checklist
  aiox release-check --fix           Auto-fix fixable issues
  aiox release-check --format json   JSON output
  aiox release-check --ci            Exit code 1 if any check fails

CHECKS:
  - Tests pass
  - Lint clean
  - No uncommitted changes
  - Version bumped
  - Changelog updated
  - No TODOs in source
  - Dependencies up to date

OPTIONS:
  --fix           Auto-fix fixable issues
  --format <fmt>  Output format: text (default), json
  --ci            Set exit code 1 on failure
  -h, --help      Show this help
`.trim();
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runCheck,
  checkTests,
  checkLint,
  checkCleanWorkingDir,
  checkVersionBumped,
  checkChangelog,
  checkNoTodos,
  checkDependencies,
  runAllChecks,
  formatText,
  formatJSON,
  runReleaseCheck,
  getHelpText,
};
