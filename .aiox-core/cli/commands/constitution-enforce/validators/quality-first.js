const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Quality First Validator (Article V)
 * Checks: Tests exist, linting configured, type checking enabled
 */

async function validate(cwd) {
  const results = [];

  // Check 1: Tests directory exists
  const testsPath = path.join(cwd, 'tests');
  if (fs.existsSync(testsPath)) {
    const testFiles = fs.readdirSync(testsPath).filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js'));
    if (testFiles.length > 0) {
      results.push({
        type: 'pass',
        message: `Tests found (${testFiles.length} test files)`,
      });
    } else {
      results.push({
        type: 'violation',
        severity: 'medium',
        message: 'Tests directory exists but empty',
        suggestion: 'Write tests for your code',
      });
    }
  } else {
    results.push({
      type: 'violation',
      severity: 'high',
      message: 'Tests directory missing',
      suggestion: 'Create tests/ directory and write test files',
    });
  }

  // Check 2: package.json has lint script
  const packagePath = path.join(cwd, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (pkg.scripts && pkg.scripts.lint) {
      results.push({
        type: 'pass',
        message: 'Linting configured (npm run lint)',
      });
    } else {
      results.push({
        type: 'violation',
        severity: 'medium',
        message: 'Lint script missing from package.json',
        suggestion: 'Add "lint": "eslint ." to scripts',
      });
    }

    if (pkg.scripts && pkg.scripts.typecheck) {
      results.push({
        type: 'pass',
        message: 'Type checking configured (npm run typecheck)',
      });
    }

    if (pkg.scripts && pkg.scripts.test) {
      results.push({
        type: 'pass',
        message: 'Test script configured (npm run test)',
      });
    }
  } else {
    results.push({
      type: 'violation',
      severity: 'high',
      message: 'package.json not found',
    });
  }

  // Check 3: ESLint config exists
  const eslintPath = path.join(cwd, '.eslintrc.json');
  if (fs.existsSync(eslintPath)) {
    results.push({
      type: 'pass',
      message: 'ESLint configured (.eslintrc.json)',
    });
  } else {
    results.push({
      type: 'violation',
      severity: 'medium',
      message: 'ESLint config missing',
      suggestion: 'Create .eslintrc.json',
    });
  }

  // Check 4: Pre-commit hooks may be configured
  const huskyPath = path.join(cwd, '.husky');
  if (fs.existsSync(huskyPath)) {
    results.push({
      type: 'pass',
      message: 'Git hooks configured (husky)',
    });
  }

  return results;
}

module.exports = { validate };
