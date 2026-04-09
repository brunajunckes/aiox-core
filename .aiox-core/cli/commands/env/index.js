/**
 * Environment Info & Diagnostics Export Command Module
 *
 * Shows environment information and runs health checks.
 *
 * Subcommands:
 *   aiox env           — Show full environment info
 *   aiox env --export  — Export as JSON to stdout
 *   aiox env --check   — Run basic health checks
 *   aiox env --report  — Generate support report file
 *
 * @module cli/commands/env
 * @version 1.0.0
 * @story 11.4 — Environment Info & Diagnostics Export
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getReportPath() {
  return path.join(getAioxDir(), 'env-report.json');
}

// ── Data Collectors ──────────────────────────────────────────────────────────

/**
 * Safely execute a command and return trimmed stdout.
 * @param {string} cmd
 * @returns {string|null}
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Get Node.js version.
 * @returns {string}
 */
function getNodeVersion() {
  return process.version;
}

/**
 * Get npm version.
 * @returns {string|null}
 */
function getNpmVersion() {
  return safeExec('npm --version');
}

/**
 * Get git version.
 * @returns {string|null}
 */
function getGitVersion() {
  const raw = safeExec('git --version');
  if (!raw) return null;
  const match = raw.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : raw;
}

/**
 * Get OS info.
 * @returns {{ platform: string, release: string, arch: string }}
 */
function getOsInfo() {
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
  };
}

/**
 * Get shell info.
 * @returns {string}
 */
function getShell() {
  return process.env.SHELL || process.env.ComSpec || 'unknown';
}

/**
 * Get AIOX version from package.json.
 * @returns {string|null}
 */
function getAioxVersion() {
  const pkgPath = path.join(process.cwd(), 'package.json');
  try {
    if (!fs.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Count installed plugins.
 * @returns {number}
 */
function getPluginCount() {
  const pluginsDir = path.join(getAioxDir(), 'plugins');
  try {
    if (!fs.existsSync(pluginsDir)) return 0;
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Count story files.
 * @returns {number}
 */
function getStoryCount() {
  const storiesDir = path.join(process.cwd(), 'docs', 'stories');
  try {
    if (!fs.existsSync(storiesDir)) return 0;
    const files = fs.readdirSync(storiesDir);
    return files.filter(f => f.endsWith('.story.md')).length;
  } catch {
    return 0;
  }
}

/**
 * Collect all environment info.
 * @returns {object}
 */
function collectEnvInfo() {
  return {
    node: getNodeVersion(),
    npm: getNpmVersion(),
    git: getGitVersion(),
    os: getOsInfo(),
    shell: getShell(),
    aioxVersion: getAioxVersion(),
    pluginCount: getPluginCount(),
    storyCount: getStoryCount(),
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  };
}

// ── Health Checks ────────────────────────────────────────────────────────────

/**
 * Run a single health check.
 * @param {string} name
 * @param {function} checkFn - Returns { ok: boolean, message: string }
 * @returns {{ name: string, ok: boolean, message: string }}
 */
function runCheck(name, checkFn) {
  try {
    const result = checkFn();
    return { name, ...result };
  } catch (error) {
    return { name, ok: false, message: error.message };
  }
}

/**
 * Check if Node.js version >= 18.
 * @returns {{ ok: boolean, message: string }}
 */
function checkNodeVersion() {
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    return { ok: true, message: `Node.js ${process.version} (>= 18)` };
  }
  return { ok: false, message: `Node.js ${process.version} is below minimum 18` };
}

/**
 * Check if git is available.
 * @returns {{ ok: boolean, message: string }}
 */
function checkGitAvailable() {
  const version = getGitVersion();
  if (version) {
    return { ok: true, message: `git ${version} available` };
  }
  return { ok: false, message: 'git not found in PATH' };
}

/**
 * Check if npm is available.
 * @returns {{ ok: boolean, message: string }}
 */
function checkNpmAvailable() {
  const version = getNpmVersion();
  if (version) {
    return { ok: true, message: `npm ${version} available` };
  }
  return { ok: false, message: 'npm not found in PATH' };
}

/**
 * Check if .aiox-core directory exists.
 * @returns {{ ok: boolean, message: string }}
 */
function checkAioxCore() {
  const coreDir = path.join(process.cwd(), '.aiox-core');
  if (fs.existsSync(coreDir)) {
    return { ok: true, message: '.aiox-core directory exists' };
  }
  return { ok: false, message: '.aiox-core directory not found' };
}

/**
 * Run all health checks.
 * @returns {Array<{ name: string, ok: boolean, message: string }>}
 */
function runHealthChecks() {
  return [
    runCheck('node-version', checkNodeVersion),
    runCheck('git-available', checkGitAvailable),
    runCheck('npm-available', checkNpmAvailable),
    runCheck('aiox-core', checkAioxCore),
  ];
}

// ── Display Helpers ──────────────────────────────────────────────────────────

function formatEnvInfo(info) {
  const lines = [
    'AIOX Environment Info',
    '=====================',
    `Node.js:      ${info.node}`,
    `npm:          ${info.npm || 'not found'}`,
    `git:          ${info.git || 'not found'}`,
    `OS:           ${info.os.platform} ${info.os.release} (${info.os.arch})`,
    `Shell:        ${info.shell}`,
    `AIOX Version: ${info.aioxVersion || 'unknown'}`,
    `Plugins:      ${info.pluginCount}`,
    `Stories:      ${info.storyCount}`,
    `CWD:          ${info.cwd}`,
  ];
  return lines.join('\n');
}

function formatHealthChecks(checks) {
  const lines = ['Health Checks', '============='];
  let allOk = true;
  for (const check of checks) {
    const icon = check.ok ? 'PASS' : 'FAIL';
    lines.push(`  [${icon}] ${check.name}: ${check.message}`);
    if (!check.ok) allOk = false;
  }
  lines.push('');
  lines.push(allOk ? 'All checks passed.' : 'Some checks failed.');
  return lines.join('\n');
}

// ── Main Runner ──────────────────────────────────────────────────────────────

/**
 * Run the env command.
 * @param {string[]} argv
 */
function runEnv(argv = []) {
  const flags = {};
  for (const arg of argv) {
    if (arg === '--export') flags.export = true;
    if (arg === '--check') flags.check = true;
    if (arg === '--report') flags.report = true;
  }

  if (flags.check) {
    const checks = runHealthChecks();
    console.log(formatHealthChecks(checks));
    const failed = checks.filter(c => !c.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const info = collectEnvInfo();

  if (flags.export) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (flags.report) {
    const dir = getAioxDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const report = {
      ...info,
      healthChecks: runHealthChecks(),
    };
    fs.writeFileSync(getReportPath(), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Report saved to ${getReportPath()}`);
    return;
  }

  console.log(formatEnvInfo(info));
}

module.exports = {
  getAioxDir,
  getReportPath,
  safeExec,
  getNodeVersion,
  getNpmVersion,
  getGitVersion,
  getOsInfo,
  getShell,
  getAioxVersion,
  getPluginCount,
  getStoryCount,
  collectEnvInfo,
  runCheck,
  checkNodeVersion,
  checkGitAvailable,
  checkNpmAvailable,
  checkAioxCore,
  runHealthChecks,
  formatEnvInfo,
  formatHealthChecks,
  runEnv,
};
