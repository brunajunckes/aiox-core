/**
 * Git Hooks Manager Command Module
 *
 * Manages AIOX git hooks (pre-commit, pre-push).
 *
 * Subcommands:
 *   aiox githooks list      — Show installed git hooks
 *   aiox githooks install   — Install AIOX hooks
 *   aiox githooks remove    — Remove AIOX hooks
 *   aiox githooks status    — Show hook status details
 *   aiox githooks --help    — Show help
 *
 * @module cli/commands/githooks
 * @version 1.0.0
 * @story 12.3 — Git Hooks Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const AIOX_MARKER = '# AIOX-MANAGED-HOOK';

const HOOK_DEFINITIONS = {
  'pre-commit': {
    description: 'Runs lint + typecheck before commit',
    script: `#!/bin/sh
${AIOX_MARKER}
# Pre-commit hook installed by AIOX
# Runs lint and typecheck before allowing commit

echo "AIOX pre-commit: Running lint..."
npm run lint --silent 2>/dev/null
LINT_EXIT=$?

echo "AIOX pre-commit: Running typecheck..."
npm run typecheck --silent 2>/dev/null
TYPE_EXIT=$?

if [ $LINT_EXIT -ne 0 ] || [ $TYPE_EXIT -ne 0 ]; then
  echo "AIOX pre-commit: Checks failed. Commit aborted."
  exit 1
fi

echo "AIOX pre-commit: All checks passed."
exit 0
`,
  },
  'pre-push': {
    description: 'Runs tests before push',
    script: `#!/bin/sh
${AIOX_MARKER}
# Pre-push hook installed by AIOX
# Runs tests before allowing push

echo "AIOX pre-push: Running tests..."
npm test --silent 2>/dev/null
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  echo "AIOX pre-push: Tests failed. Push aborted."
  exit 1
fi

echo "AIOX pre-push: All tests passed."
exit 0
`,
  },
};

const HELP_TEXT = `
AIOX Git Hooks Manager

Usage:
  aiox githooks list       Show installed git hooks
  aiox githooks install    Install AIOX pre-commit and pre-push hooks
  aiox githooks remove     Remove AIOX-managed hooks
  aiox githooks status     Show detailed hook status
  aiox githooks --help     Show this help

Hooks installed:
  pre-commit   Runs lint + typecheck
  pre-push     Runs tests
`.trim();

// ── Path Helpers ─────────────────────────────────────────────────────────────

/**
 * Get the .git/hooks directory.
 * @param {string} [rootDir] - Project root
 * @returns {string}
 */
function getHooksDir(rootDir) {
  rootDir = rootDir || process.cwd();
  return path.join(rootDir, '.git', 'hooks');
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a hook file is AIOX-managed.
 * @param {string} hookPath - Path to hook file
 * @returns {boolean}
 */
function isAioxHook(hookPath) {
  try {
    const content = fs.readFileSync(hookPath, 'utf8');
    return content.includes(AIOX_MARKER);
  } catch (_e) {
    return false;
  }
}

/**
 * List all hooks in .git/hooks.
 * @param {string} [rootDir] - Project root
 * @returns {Array<{ name: string, exists: boolean, isAiox: boolean, executable: boolean }>}
 */
function listHooks(rootDir) {
  const hooksDir = getHooksDir(rootDir);
  const hookNames = ['pre-commit', 'pre-push', 'commit-msg', 'post-commit', 'post-merge', 'pre-rebase', 'post-checkout'];
  const results = [];

  for (const name of hookNames) {
    const hookPath = path.join(hooksDir, name);
    const exists = fs.existsSync(hookPath);
    let isAiox = false;
    let executable = false;

    if (exists) {
      isAiox = isAioxHook(hookPath);
      try {
        fs.accessSync(hookPath, fs.constants.X_OK);
        executable = true;
      } catch (_e) {
        executable = false;
      }
    }

    results.push({ name, exists, isAiox, executable });
  }

  return results;
}

/**
 * Install AIOX hooks.
 * @param {string} [rootDir] - Project root
 * @returns {{ installed: string[], skipped: string[], errors: string[] }}
 */
function installHooks(rootDir) {
  const hooksDir = getHooksDir(rootDir);
  const result = { installed: [], skipped: [], errors: [] };

  // Ensure hooks dir exists
  try {
    fs.mkdirSync(hooksDir, { recursive: true });
  } catch (_e) {
    result.errors.push(`Cannot create hooks directory: ${hooksDir}`);
    return result;
  }

  for (const [hookName, hookDef] of Object.entries(HOOK_DEFINITIONS)) {
    const hookPath = path.join(hooksDir, hookName);

    // Check if non-AIOX hook exists
    if (fs.existsSync(hookPath) && !isAioxHook(hookPath)) {
      result.skipped.push(hookName);
      continue;
    }

    try {
      fs.writeFileSync(hookPath, hookDef.script, { mode: 0o755 });
      result.installed.push(hookName);
    } catch (e) {
      result.errors.push(`${hookName}: ${e.message}`);
    }
  }

  return result;
}

/**
 * Remove AIOX-managed hooks.
 * @param {string} [rootDir] - Project root
 * @returns {{ removed: string[], skipped: string[] }}
 */
function removeHooks(rootDir) {
  const hooksDir = getHooksDir(rootDir);
  const result = { removed: [], skipped: [] };

  for (const hookName of Object.keys(HOOK_DEFINITIONS)) {
    const hookPath = path.join(hooksDir, hookName);

    if (!fs.existsSync(hookPath)) {
      result.skipped.push(hookName);
      continue;
    }

    if (!isAioxHook(hookPath)) {
      result.skipped.push(hookName);
      continue;
    }

    try {
      fs.unlinkSync(hookPath);
      result.removed.push(hookName);
    } catch (_e) {
      result.skipped.push(hookName);
    }
  }

  return result;
}

/**
 * Get detailed status of AIOX hooks.
 * @param {string} [rootDir] - Project root
 * @returns {Array<{ name: string, installed: boolean, isAiox: boolean, description: string, content: string|null }>}
 */
function getStatus(rootDir) {
  const hooksDir = getHooksDir(rootDir);
  const statuses = [];

  for (const [hookName, hookDef] of Object.entries(HOOK_DEFINITIONS)) {
    const hookPath = path.join(hooksDir, hookName);
    const exists = fs.existsSync(hookPath);
    const isAiox = exists ? isAioxHook(hookPath) : false;
    let content = null;

    if (exists) {
      try {
        content = fs.readFileSync(hookPath, 'utf8');
      } catch (_e) {
        content = null;
      }
    }

    statuses.push({
      name: hookName,
      installed: exists,
      isAiox,
      description: hookDef.description,
      content,
    });
  }

  return statuses;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format hook list for console.
 * @param {Array} hooks
 * @returns {string}
 */
function formatListConsole(hooks) {
  const lines = ['Git Hooks:\n'];
  for (const h of hooks) {
    const status = h.exists ? (h.isAiox ? 'AIOX' : 'custom') : 'not installed';
    const exec = h.exists ? (h.executable ? 'executable' : 'not executable') : '';
    lines.push(`  ${h.name}: ${status}${exec ? ` (${exec})` : ''}`);
  }
  return lines.join('\n');
}

/**
 * Format status for console.
 * @param {Array} statuses
 * @returns {string}
 */
function formatStatusConsole(statuses) {
  const lines = ['AIOX Hook Status:\n'];
  for (const s of statuses) {
    const state = s.installed ? (s.isAiox ? 'Active (AIOX)' : 'Active (custom)') : 'Not installed';
    lines.push(`  ${s.name}: ${state}`);
    lines.push(`    Purpose: ${s.description}`);
  }
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Run the githooks command.
 * @param {string[]} argv - Arguments after 'githooks'
 */
function runGithooks(argv) {
  argv = argv || [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sub = argv[0];

  switch (sub) {
    case 'list': {
      const hooks = listHooks();
      console.log(formatListConsole(hooks));
      break;
    }

    case 'install': {
      const result = installHooks();
      if (result.installed.length > 0) {
        console.log(`Installed hooks: ${result.installed.join(', ')}`);
      }
      if (result.skipped.length > 0) {
        console.log(`Skipped (existing non-AIOX hooks): ${result.skipped.join(', ')}`);
      }
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.join(', ')}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'remove': {
      const result = removeHooks();
      if (result.removed.length > 0) {
        console.log(`Removed hooks: ${result.removed.join(', ')}`);
      }
      if (result.skipped.length > 0) {
        console.log(`Skipped: ${result.skipped.join(', ')}`);
      }
      break;
    }

    case 'status': {
      const statuses = getStatus();
      console.log(formatStatusConsole(statuses));
      break;
    }

    default: {
      console.error(sub ? `Unknown subcommand: ${sub}` : 'Please specify a subcommand: list, install, remove, status');
      console.log('Run aiox githooks --help for usage');
      process.exitCode = 1;
      break;
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getHooksDir,
  isAioxHook,
  listHooks,
  installHooks,
  removeHooks,
  getStatus,
  formatListConsole,
  formatStatusConsole,
  runGithooks,
  AIOX_MARKER,
  HOOK_DEFINITIONS,
  HELP_TEXT,
};
