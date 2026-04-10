const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * CLI First Validator (Article I)
 * Checks: CLI is the primary interface, UI is secondary
 */

async function validate(cwd) {
  const results = [];

  // Check 1: CLI commands exist
  const binPath = path.join(cwd, 'bin');
  if (fs.existsSync(binPath)) {
    const binFiles = fs.readdirSync(binPath).filter(f => f.endsWith('.js'));
    if (binFiles.length > 0) {
      results.push({
        type: 'pass',
        message: 'CLI entry points defined (bin/ directory)',
      });
    }
  }

  // Check 2: CLI commands are documented
  const cliPath = path.join(cwd, '.aiox-core/cli/commands');
  if (fs.existsSync(cliPath)) {
    const dirs = fs.readdirSync(cliPath);
    if (dirs.length > 0) {
      results.push({
        type: 'pass',
        message: `CLI commands implemented (${dirs.length} commands)`,
      });
    }
  } else {
    results.push({
      type: 'violation',
      severity: 'medium',
      message: 'CLI commands directory missing',
      suggestion: 'Create .aiox-core/cli/commands directory structure',
    });
  }

  // Check 3: No UI should block CLI functionality
  const readmePath = path.join(cwd, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf8');
    if (content.includes('CLI is the primary interface')) {
      results.push({
        type: 'pass',
        message: 'CLI-first principle documented in README',
      });
    }
  }

  // Check 4: All new features should be CLI-first
  // (This requires checking recent commits for features added without CLI)
  try {
    const output = execSync('git log --oneline --since="7 days ago" -- packages/ squads/ apps/', {
      cwd,
      encoding: 'utf8',
    });
    if (output && output.includes('feat:')) {
      results.push({
        type: 'pass',
        message: 'Recent development tracked in git history',
      });
    }
  } catch (error) {
    // Not in a git repo
  }

  return results;
}

module.exports = { validate };
