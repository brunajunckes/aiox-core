/**
 * Error Recovery & Diagnostics System
 *
 * Diagnose common issues and auto-fix when possible.
 *
 * Subcommands:
 *   aiox recover              - show recovery suggestions
 *   aiox recover --diagnose   - run diagnostic checks
 *   aiox recover --fix        - auto-fix detected issues
 *   aiox recover --config     - fix config file issues
 *   aiox recover --git        - fix common git issues
 *   aiox recover --log <code> - look up error code in catalog
 *
 * @module cli/commands/recover
 * @version 1.0.0
 * @story 35.4 - Error Recovery & Diagnostics System
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -- Constants ----------------------------------------------------------------

const ERROR_CATALOG_PATH = '.aiox-core/data/error-catalog.json';

const DEFAULT_ERROR_CATALOG = {
  'ERR-001': {
    code: 'ERR-001',
    title: 'Git lock file exists',
    description: 'A .git/index.lock file is blocking git operations',
    fix: 'Remove .git/index.lock',
    severity: 'high',
    category: 'git',
  },
  'ERR-002': {
    code: 'ERR-002',
    title: 'Detached HEAD state',
    description: 'Git is in detached HEAD state',
    fix: 'Run: git checkout main',
    severity: 'medium',
    category: 'git',
  },
  'ERR-003': {
    code: 'ERR-003',
    title: 'Missing node_modules',
    description: 'Node modules not installed',
    fix: 'Run: npm install',
    severity: 'high',
    category: 'node',
  },
  'ERR-004': {
    code: 'ERR-004',
    title: 'Invalid package.json',
    description: 'package.json contains invalid JSON',
    fix: 'Validate and fix package.json syntax',
    severity: 'critical',
    category: 'node',
  },
  'ERR-005': {
    code: 'ERR-005',
    title: 'Missing .aiox directory',
    description: 'AIOX runtime directory not found',
    fix: 'Run: mkdir -p .aiox',
    severity: 'medium',
    category: 'config',
  },
  'ERR-006': {
    code: 'ERR-006',
    title: 'Invalid settings.json',
    description: 'Claude settings file contains invalid JSON',
    fix: 'Validate and fix .claude/settings.json',
    severity: 'high',
    category: 'config',
  },
  'ERR-007': {
    code: 'ERR-007',
    title: 'Missing core-config.yaml',
    description: 'AIOX core configuration file not found',
    fix: 'Run: aiox install',
    severity: 'high',
    category: 'config',
  },
  'ERR-008': {
    code: 'ERR-008',
    title: 'Git not initialized',
    description: 'No .git directory found',
    fix: 'Run: git init',
    severity: 'medium',
    category: 'git',
  },
  'ERR-009': {
    code: 'ERR-009',
    title: 'Node.js not found',
    description: 'Node.js is not available in PATH',
    fix: 'Install Node.js 18+',
    severity: 'critical',
    category: 'node',
  },
  'ERR-010': {
    code: 'ERR-010',
    title: 'NPM not found',
    description: 'NPM is not available in PATH',
    fix: 'Install NPM (comes with Node.js)',
    severity: 'critical',
    category: 'node',
  },
};

// -- Core Functions -----------------------------------------------------------

/**
 * Load error catalog from disk or use defaults.
 * @param {string} root
 * @returns {object}
 */
function loadErrorCatalog(root) {
  const catalogPath = path.join(root, ERROR_CATALOG_PATH);
  if (fs.existsSync(catalogPath)) {
    try {
      return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    } catch {
      return DEFAULT_ERROR_CATALOG;
    }
  }
  return DEFAULT_ERROR_CATALOG;
}

/**
 * Ensure the error catalog file exists on disk.
 * @param {string} root
 */
function ensureErrorCatalog(root) {
  const catalogPath = path.join(root, ERROR_CATALOG_PATH);
  if (!fs.existsSync(catalogPath)) {
    const dir = path.dirname(catalogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(catalogPath, JSON.stringify(DEFAULT_ERROR_CATALOG, null, 2), 'utf8');
  }
}

/**
 * Run a shell command silently, return stdout or null.
 * @param {string} cmd
 * @returns {string|null}
 */
function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * Run all diagnostic checks.
 * @param {string} root
 * @returns {object[]} array of check results
 */
function runDiagnostics(root) {
  const checks = [];

  // Git checks
  const gitDir = path.join(root, '.git');
  checks.push({
    name: 'Git initialized',
    category: 'git',
    pass: fs.existsSync(gitDir),
    fix: 'git init',
    errorCode: 'ERR-008',
  });

  const gitLock = path.join(root, '.git', 'index.lock');
  checks.push({
    name: 'No git lock file',
    category: 'git',
    pass: !fs.existsSync(gitLock),
    fix: 'rm .git/index.lock',
    errorCode: 'ERR-001',
  });

  // Check detached HEAD
  const headRef = execSafe('git symbolic-ref HEAD 2>/dev/null');
  const isDetached = fs.existsSync(gitDir) && headRef === null;
  checks.push({
    name: 'Not in detached HEAD',
    category: 'git',
    pass: !isDetached,
    fix: 'git checkout main',
    errorCode: 'ERR-002',
  });

  // Node checks
  const nodeVersion = execSafe('node --version');
  checks.push({
    name: 'Node.js available',
    category: 'node',
    pass: nodeVersion !== null,
    detail: nodeVersion,
    fix: 'Install Node.js 18+',
    errorCode: 'ERR-009',
  });

  const npmVersion = execSafe('npm --version');
  checks.push({
    name: 'NPM available',
    category: 'node',
    pass: npmVersion !== null,
    detail: npmVersion,
    fix: 'Install NPM',
    errorCode: 'ERR-010',
  });

  const nmDir = path.join(root, 'node_modules');
  checks.push({
    name: 'node_modules exists',
    category: 'node',
    pass: fs.existsSync(nmDir),
    fix: 'npm install',
    errorCode: 'ERR-003',
  });

  // Package.json valid
  const pkgPath = path.join(root, 'package.json');
  let pkgValid = false;
  if (fs.existsSync(pkgPath)) {
    try {
      JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkgValid = true;
    } catch {
      pkgValid = false;
    }
  }
  checks.push({
    name: 'package.json valid',
    category: 'node',
    pass: pkgValid || !fs.existsSync(pkgPath),
    fix: 'Fix package.json syntax',
    errorCode: 'ERR-004',
  });

  // Config checks
  const aioxDir = path.join(root, '.aiox');
  checks.push({
    name: '.aiox directory exists',
    category: 'config',
    pass: fs.existsSync(aioxDir),
    fix: 'mkdir -p .aiox',
    errorCode: 'ERR-005',
  });

  const settingsPath = path.join(root, '.claude', 'settings.json');
  let settingsValid = true;
  if (fs.existsSync(settingsPath)) {
    try {
      JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      settingsValid = false;
    }
  }
  checks.push({
    name: 'settings.json valid',
    category: 'config',
    pass: settingsValid,
    fix: 'Validate .claude/settings.json',
    errorCode: 'ERR-006',
  });

  const configPath = path.join(root, '.aiox-core', 'core-config.yaml');
  checks.push({
    name: 'core-config.yaml exists',
    category: 'config',
    pass: fs.existsSync(configPath),
    fix: 'Run: aiox install',
    errorCode: 'ERR-007',
  });

  return checks;
}

/**
 * Auto-fix detected issues.
 * @param {object[]} checks - failed checks from runDiagnostics
 * @param {string} root
 * @returns {{ fixed: string[], failed: string[] }}
 */
function autoFix(checks, root) {
  const fixed = [];
  const failed = [];
  const failedChecks = checks.filter(c => !c.pass);

  for (const check of failedChecks) {
    try {
      switch (check.errorCode) {
        case 'ERR-001': {
          const lockFile = path.join(root, '.git', 'index.lock');
          if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
            fixed.push(check.name);
          }
          break;
        }
        case 'ERR-002': {
          execSafe('git checkout main 2>/dev/null || git checkout master 2>/dev/null');
          fixed.push(check.name);
          break;
        }
        case 'ERR-005': {
          const aioxDir = path.join(root, '.aiox');
          fs.mkdirSync(aioxDir, { recursive: true });
          fixed.push(check.name);
          break;
        }
        case 'ERR-008': {
          execSafe('git init');
          fixed.push(check.name);
          break;
        }
        default:
          failed.push(`${check.name}: ${check.fix}`);
      }
    } catch {
      failed.push(`${check.name}: auto-fix failed`);
    }
  }
  return { fixed, failed };
}

/**
 * Fix config-specific issues.
 * @param {string} root
 * @returns {string[]} actions taken
 */
function fixConfig(root) {
  const actions = [];

  // Ensure .aiox exists
  const aioxDir = path.join(root, '.aiox');
  if (!fs.existsSync(aioxDir)) {
    fs.mkdirSync(aioxDir, { recursive: true });
    actions.push('Created .aiox directory');
  }

  // Ensure .claude directory exists
  const claudeDir = path.join(root, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
    actions.push('Created .claude directory');
  }

  // Validate settings.json
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      // Backup corrupt and create minimal
      const backupPath = settingsPath + '.bak';
      fs.copyFileSync(settingsPath, backupPath);
      fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2), 'utf8');
      actions.push('Fixed corrupt settings.json (backup saved as .bak)');
    }
  }

  // Ensure error catalog
  ensureErrorCatalog(root);
  actions.push('Ensured error catalog exists');

  return actions;
}

/**
 * Fix common git issues.
 * @param {string} root
 * @returns {string[]} actions taken
 */
function fixGit(root) {
  const actions = [];

  // Remove lock file
  const lockFile = path.join(root, '.git', 'index.lock');
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    actions.push('Removed .git/index.lock');
  }

  // Fix detached HEAD
  const headRef = execSafe('git symbolic-ref HEAD 2>/dev/null');
  if (headRef === null && fs.existsSync(path.join(root, '.git'))) {
    const result = execSafe('git checkout main 2>/dev/null || git checkout master 2>/dev/null');
    if (result !== null) {
      actions.push('Resolved detached HEAD');
    }
  }

  // Prune remote tracking branches
  const pruneResult = execSafe('git remote prune origin 2>/dev/null');
  if (pruneResult !== null) {
    actions.push('Pruned stale remote tracking branches');
  }

  if (actions.length === 0) {
    actions.push('No git issues found');
  }
  return actions;
}

/**
 * Look up an error code in the catalog.
 * @param {string} code
 * @param {string} root
 * @returns {object|null}
 */
function lookupError(code, root) {
  const catalog = loadErrorCatalog(root);
  return catalog[code.toUpperCase()] || null;
}

// -- CLI Runner ---------------------------------------------------------------

/**
 * Run the recover command.
 * @param {string[]} argv
 */
function runRecover(argv) {
  const root = process.cwd();

  const isDiagnose = argv.includes('--diagnose');
  const isFix = argv.includes('--fix');
  const isConfig = argv.includes('--config');
  const isGit = argv.includes('--git');
  const logIdx = argv.indexOf('--log');

  if (logIdx !== -1) {
    const code = argv[logIdx + 1];
    if (!code) {
      console.error('Usage: aiox recover --log <error-code>');
      process.exit(1);
    }
    const entry = lookupError(code, root);
    if (!entry) {
      console.error(`Error code not found: ${code}`);
      console.log('Available codes: ERR-001 through ERR-010');
      process.exit(1);
    }
    console.log(`Error: ${entry.code} - ${entry.title}`);
    console.log(`Severity: ${entry.severity}`);
    console.log(`Category: ${entry.category}`);
    console.log(`Description: ${entry.description}`);
    console.log(`Fix: ${entry.fix}`);
    return;
  }

  if (isConfig) {
    console.log('Fixing config issues...\n');
    const actions = fixConfig(root);
    for (const a of actions) {
      console.log(`  [fixed] ${a}`);
    }
    return;
  }

  if (isGit) {
    console.log('Fixing git issues...\n');
    const actions = fixGit(root);
    for (const a of actions) {
      console.log(`  [fixed] ${a}`);
    }
    return;
  }

  // Always run diagnostics first
  const checks = runDiagnostics(root);
  const passed = checks.filter(c => c.pass);
  const failed = checks.filter(c => !c.pass);

  if (isDiagnose || (!isFix && failed.length === 0)) {
    console.log('AIOX Diagnostics Report\n');
    for (const c of checks) {
      const icon = c.pass ? 'PASS' : 'FAIL';
      const detail = c.detail ? ` (${c.detail})` : '';
      console.log(`  [${icon}] ${c.name}${detail}`);
    }
    console.log(`\n${passed.length}/${checks.length} checks passed`);
    if (failed.length > 0) {
      console.log('\nFailed checks:');
      for (const c of failed) {
        console.log(`  - ${c.name}: ${c.fix} (${c.errorCode})`);
      }
      console.log('\nRun: aiox recover --fix to auto-fix');
    }
    return;
  }

  if (isFix) {
    console.log('Auto-fixing detected issues...\n');
    const result = autoFix(checks, root);
    if (result.fixed.length > 0) {
      console.log('Fixed:');
      for (const f of result.fixed) {
        console.log(`  [fixed] ${f}`);
      }
    }
    if (result.failed.length > 0) {
      console.log('\nManual fix required:');
      for (const f of result.failed) {
        console.log(`  [manual] ${f}`);
      }
    }
    if (result.fixed.length === 0 && result.failed.length === 0) {
      console.log('No issues to fix.');
    }
    return;
  }

  // Default: show suggestions
  console.log('AIOX Recovery Suggestions\n');
  if (failed.length === 0) {
    console.log('All systems operational. No issues detected.');
    return;
  }
  console.log(`${failed.length} issue(s) detected:\n`);
  for (const c of failed) {
    console.log(`  [${c.errorCode}] ${c.name}`);
    console.log(`    Fix: ${c.fix}\n`);
  }
  console.log('Run: aiox recover --fix to auto-fix');
  console.log('Run: aiox recover --diagnose for full report');
}

module.exports = {
  runRecover,
  runDiagnostics,
  autoFix,
  fixConfig,
  fixGit,
  lookupError,
  loadErrorCatalog,
  ensureErrorCatalog,
  execSafe,
  DEFAULT_ERROR_CATALOG,
};
