/**
 * Health Check Endpoint
 *
 * Subcommands:
 *   aiox healthcheck          — Run comprehensive health check
 *   aiox healthcheck --json   — Output as JSON
 *   aiox healthcheck --ci     — Exit 1 if any check fails
 *
 * Checks: Node version, npm, git, .aiox-core, stories dir, tests, disk, memory
 *
 * @module cli/commands/healthcheck
 * @version 1.0.0
 * @story 16.4 — Health Check Endpoint
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
HEALTH CHECK

USAGE:
  aiox healthcheck          Run comprehensive health check report
  aiox healthcheck --json   Output results as JSON
  aiox healthcheck --ci     Exit with code 1 if any check fails
  aiox healthcheck --help   Show this help

CHECKS:
  - Node.js version (>= 18)
  - npm available
  - git available
  - .aiox-core directory exists
  - docs/stories directory exists
  - Tests configuration exists
  - Disk space (warn < 1GB)
  - Memory usage
`.trim();

// ── Individual Checks ────────────────────────────────────────────────────────

/**
 * Check Node.js version.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  return {
    name: 'Node.js Version',
    status: major >= 18 ? 'pass' : 'fail',
    detail: `${version} (minimum: v18)`,
  };
}

/**
 * Check if npm is available.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkNpm() {
  try {
    const version = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
    return { name: 'npm', status: 'pass', detail: `v${version}` };
  } catch (_e) {
    return { name: 'npm', status: 'fail', detail: 'not found' };
  }
}

/**
 * Check if git is available.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkGit() {
  try {
    const version = execSync('git --version', { encoding: 'utf8', timeout: 5000 }).trim();
    return { name: 'git', status: 'pass', detail: version };
  } catch (_e) {
    return { name: 'git', status: 'fail', detail: 'not found' };
  }
}

/**
 * Check if .aiox-core directory exists.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkAioxCore() {
  const dir = path.join(process.cwd(), '.aiox-core');
  const exists = fs.existsSync(dir);
  return {
    name: '.aiox-core Directory',
    status: exists ? 'pass' : 'fail',
    detail: exists ? 'found' : 'not found',
  };
}

/**
 * Check if docs/stories directory exists.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkStoriesDir() {
  const dir = path.join(process.cwd(), 'docs', 'stories');
  const exists = fs.existsSync(dir);
  let count = 0;
  if (exists) {
    try {
      count = fs.readdirSync(dir).filter(f => f.endsWith('.story.md')).length;
    } catch (_e) { /* ignore */ }
  }
  return {
    name: 'Stories Directory',
    status: exists ? 'pass' : 'warn',
    detail: exists ? `found (${count} stories)` : 'not found',
  };
}

/**
 * Check if test configuration exists.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkTests() {
  const root = process.cwd();
  const jestConfig = fs.existsSync(path.join(root, 'jest.config.js'));
  const pkgPath = path.join(root, 'package.json');
  let hasTestScript = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    hasTestScript = !!(pkg.scripts && pkg.scripts.test);
  } catch (_e) { /* no package.json */ }

  const ok = jestConfig || hasTestScript;
  return {
    name: 'Test Configuration',
    status: ok ? 'pass' : 'warn',
    detail: jestConfig ? 'jest.config.js found' : hasTestScript ? 'test script found' : 'no test config found',
  };
}

/**
 * Check available disk space.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkDiskSpace() {
  const free = os.freemem();
  try {
    // Use df on unix systems
    const dfOutput = execSync('df -k . 2>/dev/null || echo ""', { encoding: 'utf8', timeout: 5000 });
    const lines = dfOutput.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const availKB = parseInt(parts[3], 10);
      if (!isNaN(availKB)) {
        const availGB = (availKB / 1024 / 1024).toFixed(2);
        const status = availKB < 1024 * 1024 ? 'warn' : 'pass';
        return { name: 'Disk Space', status, detail: `${availGB} GB available` };
      }
    }
  } catch (_e) { /* fallback */ }

  // Fallback: just report free memory
  const freeGB = (free / 1024 / 1024 / 1024).toFixed(2);
  return { name: 'Disk Space', status: 'warn', detail: `Unable to determine (free mem: ${freeGB} GB)` };
}

/**
 * Check memory usage.
 * @returns {{ name: string, status: string, detail: string }}
 */
function checkMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPct = ((used / total) * 100).toFixed(1);
  const freeGB = (free / 1024 / 1024 / 1024).toFixed(2);
  const totalGB = (total / 1024 / 1024 / 1024).toFixed(2);

  const status = free < 256 * 1024 * 1024 ? 'warn' : 'pass';
  return {
    name: 'Memory',
    status,
    detail: `${freeGB}/${totalGB} GB free (${usedPct}% used)`,
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────

/**
 * Run all health checks.
 * @returns {{ checks: object[], summary: { pass: number, warn: number, fail: number } }}
 */
function runAllChecks() {
  const checks = [
    checkNodeVersion(),
    checkNpm(),
    checkGit(),
    checkAioxCore(),
    checkStoriesDir(),
    checkTests(),
    checkDiskSpace(),
    checkMemory(),
  ];

  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) {
    summary[check.status] = (summary[check.status] || 0) + 1;
  }

  return { checks, summary };
}

/**
 * Format health check results for terminal.
 * @param {{ checks: object[], summary: object }} result
 * @returns {string}
 */
function formatText(result) {
  const lines = [];
  lines.push('AIOX HEALTH CHECK REPORT');
  lines.push('=' .repeat(50));
  lines.push('');

  const icons = { pass: '[PASS]', warn: '[WARN]', fail: '[FAIL]' };
  for (const check of result.checks) {
    lines.push(`  ${icons[check.status] || '[????]'}  ${check.name}: ${check.detail}`);
  }

  lines.push('');
  lines.push('-'.repeat(50));
  lines.push(`  Pass: ${result.summary.pass}  Warn: ${result.summary.warn}  Fail: ${result.summary.fail}`);

  if (result.summary.fail > 0) {
    lines.push('\n  Some checks FAILED. Review the issues above.');
  } else if (result.summary.warn > 0) {
    lines.push('\n  All critical checks passed with warnings.');
  } else {
    lines.push('\n  All checks passed.');
  }

  return lines.join('\n');
}

/**
 * Format health check results as JSON.
 * @param {{ checks: object[], summary: object }} result
 * @returns {string}
 */
function formatJsonOutput(result) {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      ...result,
    },
    null,
    2,
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * @param {string[]} args
 */
function runHealthcheck(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const result = runAllChecks();
  const isJson = args.includes('--json');
  const isCi = args.includes('--ci');

  if (isJson) {
    console.log(formatJsonOutput(result));
  } else {
    console.log(formatText(result));
  }

  if (isCi && result.summary.fail > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  runHealthcheck,
  checkNodeVersion,
  checkNpm,
  checkGit,
  checkAioxCore,
  checkStoriesDir,
  checkTests,
  checkDiskSpace,
  checkMemory,
  runAllChecks,
  formatText,
  formatJsonOutput,
  HELP_TEXT,
};
