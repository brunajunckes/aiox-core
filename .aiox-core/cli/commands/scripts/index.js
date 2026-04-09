/**
 * Script Runner & Discovery Command Module
 *
 * Lists, searches, runs, and audits npm scripts from package.json.
 *
 * Subcommands:
 *   aiox scripts               — list all npm scripts
 *   aiox scripts run <name>    — run npm script
 *   aiox scripts search <term> — search scripts by name/command
 *   aiox scripts audit         — find scripts with potential issues
 *   aiox scripts --format json — output as JSON
 *
 * @module cli/commands/scripts
 * @version 1.0.0
 * @story 23.4 — Script Runner & Discovery
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Read and parse package.json from cwd.
 * @param {string} cwd
 * @returns {object|null}
 */
function readPackageJson(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List all scripts from package.json.
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ scripts: Array<{name: string, command: string}>, total: number }}
 */
function listScripts(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = readPackageJson(cwd);

  if (!pkg || !pkg.scripts) {
    return { scripts: [], total: 0 };
  }

  const scripts = Object.entries(pkg.scripts).map(([name, command]) => ({
    name,
    command,
  }));

  return { scripts, total: scripts.length };
}

/**
 * Search scripts by name or command content.
 * @param {string} term
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ results: Array<{name: string, command: string, matchType: string}>, total: number }}
 */
function searchScripts(term, options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = readPackageJson(cwd);

  if (!pkg || !pkg.scripts || !term) {
    return { results: [], total: 0 };
  }

  const lowerTerm = term.toLowerCase();
  const results = [];

  for (const [name, command] of Object.entries(pkg.scripts)) {
    const nameMatch = name.toLowerCase().includes(lowerTerm);
    const cmdMatch = command.toLowerCase().includes(lowerTerm);

    if (nameMatch || cmdMatch) {
      results.push({
        name,
        command,
        matchType: nameMatch && cmdMatch ? 'both' : nameMatch ? 'name' : 'command',
      });
    }
  }

  return { results, total: results.length };
}

/**
 * Run an npm script by name.
 * @param {string} scriptName
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ success: boolean, scriptName: string, output: string, error: string }}
 */
function runScript(scriptName, options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = readPackageJson(cwd);

  if (!pkg || !pkg.scripts || !pkg.scripts[scriptName]) {
    return {
      success: false,
      scriptName,
      output: '',
      error: `Script "${scriptName}" not found in package.json`,
    };
  }

  try {
    const output = execSync(`npm run ${scriptName}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, scriptName, output: output.trim(), error: '' };
  } catch (err) {
    return {
      success: false,
      scriptName,
      output: err.stdout ? err.stdout.trim() : '',
      error: err.stderr ? err.stderr.trim() : err.message,
    };
  }
}

/**
 * Audit scripts for potential issues.
 * Checks for: missing deps in commands, suspicious patterns, long commands.
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ issues: Array<{script: string, severity: string, message: string}>, total: number }}
 */
function auditScripts(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = readPackageJson(cwd);

  if (!pkg || !pkg.scripts) {
    return { issues: [], total: 0 };
  }

  const issues = [];
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  for (const [name, command] of Object.entries(pkg.scripts)) {
    // Check for very long commands (potential maintenance issue)
    if (command.length > 200) {
      issues.push({
        script: name,
        severity: 'warning',
        message: `Command is very long (${command.length} chars) — consider a script file`,
      });
    }

    // Check for common CLI tools that should be in devDependencies
    const cliTools = ['eslint', 'prettier', 'jest', 'mocha', 'tsc', 'webpack', 'vite', 'rollup', 'esbuild'];
    for (const tool of cliTools) {
      if (command.includes(tool) && !allDeps[tool] && !command.includes('npx')) {
        issues.push({
          script: name,
          severity: 'warning',
          message: `Uses "${tool}" but it's not in dependencies (may need npx or install)`,
        });
      }
    }

    // Check for rm -rf (dangerous in scripts)
    if (command.includes('rm -rf') || command.includes('rm -r')) {
      issues.push({
        script: name,
        severity: 'info',
        message: 'Uses destructive rm command — verify paths are safe',
      });
    }

    // Check for hardcoded paths
    if (command.includes('C:\\') || command.includes('/Users/') || command.includes('/home/')) {
      issues.push({
        script: name,
        severity: 'error',
        message: 'Contains hardcoded absolute path — not portable',
      });
    }

    // Check for duplicate script names (pre/post variants without base)
    if (name.startsWith('pre') || name.startsWith('post')) {
      const baseName = name.startsWith('pre') ? name.slice(3) : name.slice(4);
      if (baseName && !pkg.scripts[baseName]) {
        issues.push({
          script: name,
          severity: 'warning',
          message: `Lifecycle hook for "${baseName}" but "${baseName}" script not found`,
        });
      }
    }
  }

  return { issues, total: issues.length };
}

/**
 * Format list results as text.
 * @param {object} result
 * @returns {string}
 */
function formatListText(result) {
  const lines = [];
  lines.push('NPM Scripts');
  lines.push('='.repeat(60));

  if (result.scripts.length === 0) {
    lines.push('\nNo scripts found in package.json.');
    return lines.join('\n');
  }

  lines.push('');
  for (const s of result.scripts) {
    const nameStr = s.name.padEnd(20);
    const cmd = s.command.length > 50 ? s.command.slice(0, 50) + '...' : s.command;
    lines.push(`  ${nameStr} ${cmd}`);
  }

  lines.push('');
  lines.push(`Total: ${result.total} scripts`);

  return lines.join('\n');
}

/**
 * Format search results as text.
 * @param {object} result
 * @param {string} term
 * @returns {string}
 */
function formatSearchText(result, term) {
  const lines = [];
  lines.push(`Search Results for "${term}"`);
  lines.push('='.repeat(50));

  if (result.results.length === 0) {
    lines.push('\nNo matching scripts found.');
    return lines.join('\n');
  }

  lines.push('');
  for (const r of result.results) {
    lines.push(`  ${r.name} [${r.matchType}]`);
    lines.push(`    ${r.command}`);
  }

  lines.push('');
  lines.push(`Found: ${result.total} matches`);

  return lines.join('\n');
}

/**
 * Format audit results as text.
 * @param {object} result
 * @returns {string}
 */
function formatAuditText(result) {
  const lines = [];
  lines.push('Script Audit');
  lines.push('='.repeat(50));

  if (result.issues.length === 0) {
    lines.push('\nNo issues found. All scripts look good.');
    return lines.join('\n');
  }

  lines.push('');
  const severityIcon = { error: 'ERROR', warning: 'WARN', info: 'INFO' };
  for (const issue of result.issues) {
    lines.push(`  [${severityIcon[issue.severity] || issue.severity}] ${issue.script}: ${issue.message}`);
  }

  lines.push('');
  lines.push(`Total issues: ${result.total}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run scripts command.
 * @param {string[]} argv
 */
function runScripts(argv = []) {
  const subcommand = argv[0] || 'list';
  const format = argv.includes('--format') ? argv[argv.indexOf('--format') + 1] : 'text';

  if (subcommand === '--help' || subcommand === '-h') {
    console.log('Usage: aiox scripts [list|run <name>|search <term>|audit] [--format json]');
    return;
  }

  // Handle --format as first arg
  if (subcommand === '--format') {
    const result = listScripts();
    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatListText(result));
    }
    return;
  }

  switch (subcommand) {
    case 'list': {
      const result = listScripts();
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatListText(result));
      }
      break;
    }
    case 'run': {
      const scriptName = argv[1];
      if (!scriptName) {
        console.error('Usage: aiox scripts run <script-name>');
        return;
      }
      const result = runScript(scriptName);
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(result.output);
        } else {
          console.error(result.error);
        }
      }
      break;
    }
    case 'search': {
      const term = argv[1];
      if (!term) {
        console.error('Usage: aiox scripts search <term>');
        return;
      }
      const result = searchScripts(term);
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatSearchText(result, term));
      }
      break;
    }
    case 'audit': {
      const result = auditScripts();
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatAuditText(result));
      }
      break;
    }
    default: {
      // Treat unknown subcommand as list
      const result = listScripts();
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatListText(result));
      }
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runScripts,
  readPackageJson,
  listScripts,
  searchScripts,
  runScript,
  auditScripts,
  formatListText,
  formatSearchText,
  formatAuditText,
};
