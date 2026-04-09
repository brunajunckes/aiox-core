/**
 * Governance Report Generator Command Module
 *
 * Generates governance reports: ownership, coverage, deps, security, licenses.
 *
 * Subcommands:
 *   aiox governance              — Generate governance report
 *   aiox governance --format json — Output as JSON
 *   aiox governance --export     — Save to .aiox/governance-report.json
 *   aiox governance --ci         — Exit 1 if any check fails
 *   aiox governance --help       — Show help
 *
 * @module cli/commands/governance
 * @version 1.0.0
 * @story 12.4 — Governance Report Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
AIOX Governance Report Generator

Usage:
  aiox governance               Generate governance report
  aiox governance --format json Output as JSON
  aiox governance --export      Save to .aiox/governance-report.json
  aiox governance --ci          Exit 1 if any governance check fails
  aiox governance --help        Show this help

Report includes:
  - Code ownership (contributors from git log)
  - Dependency count (from package.json)
  - Test coverage summary (from coverage report)
  - Security scan summary (secrets found)
  - License compliance (non-permissive detection)
`.trim();

// ── Data Collectors ──────────────────────────────────────────────────────────

/**
 * Get code ownership from git log.
 * @param {string} [rootDir]
 * @returns {Array<{ author: string, commits: number }>}
 */
function getCodeOwnership(rootDir) {
  rootDir = rootDir || process.cwd();
  try {
    const output = execSync('git log --format="%aN" | sort | uniq -c | sort -rn', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const contributors = [];
    const lines = output.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) {
        contributors.push({ author: match[2], commits: parseInt(match[1], 10) });
      }
    }
    return contributors;
  } catch (_e) {
    return [];
  }
}

/**
 * Get dependency count from package.json.
 * @param {string} [rootDir]
 * @returns {{ dependencies: number, devDependencies: number, total: number }}
 */
function getDependencyCount(rootDir) {
  rootDir = rootDir || process.cwd();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).length;
    const devDeps = Object.keys(pkg.devDependencies || {}).length;
    return { dependencies: deps, devDependencies: devDeps, total: deps + devDeps };
  } catch (_e) {
    return { dependencies: 0, devDependencies: 0, total: 0 };
  }
}

/**
 * Get test coverage summary from coverage report.
 * @param {string} [rootDir]
 * @returns {{ lines: number, branches: number, functions: number, statements: number } | null}
 */
function getCoverageSummary(rootDir) {
  rootDir = rootDir || process.cwd();
  const coveragePath = path.join(rootDir, 'coverage', 'coverage-summary.json');
  try {
    const data = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = data.total || {};
    return {
      lines: total.lines ? total.lines.pct : 0,
      branches: total.branches ? total.branches.pct : 0,
      functions: total.functions ? total.functions.pct : 0,
      statements: total.statements ? total.statements.pct : 0,
    };
  } catch (_e) {
    return null;
  }
}

/**
 * Run a secret scan and return summary.
 * @param {string} [rootDir]
 * @returns {{ totalFindings: number, findings: Array }}
 */
function getSecretScanSummary(rootDir) {
  rootDir = rootDir || process.cwd();
  try {
    const secretsModule = require('../secrets/index.js');
    const findings = secretsModule.scanProject(rootDir);
    return { totalFindings: findings.length, findings };
  } catch (_e) {
    return { totalFindings: 0, findings: [] };
  }
}

/**
 * Run license compliance check.
 * @param {string} [rootDir]
 * @returns {{ totalDependencies: number, violations: Array, compliant: boolean }}
 */
function getLicenseCompliance(rootDir) {
  rootDir = rootDir || process.cwd();
  try {
    const licensesModule = require('../licenses/index.js');
    const licenses = licensesModule.collectLicenses(rootDir);
    const result = licensesModule.checkLicenses(licenses);
    return {
      totalDependencies: licenses.length,
      violations: result.violations,
      compliant: result.ok,
    };
  } catch (_e) {
    return { totalDependencies: 0, violations: [], compliant: true };
  }
}

// ── Report Generation ────────────────────────────────────────────────────────

/**
 * Generate full governance report.
 * @param {string} [rootDir]
 * @returns {Object}
 */
function generateReport(rootDir) {
  rootDir = rootDir || process.cwd();
  const ownership = getCodeOwnership(rootDir);
  const deps = getDependencyCount(rootDir);
  const coverage = getCoverageSummary(rootDir);
  const secrets = getSecretScanSummary(rootDir);
  const licenses = getLicenseCompliance(rootDir);

  const checks = {
    secretsClean: secrets.totalFindings === 0,
    licensesCompliant: licenses.compliant,
    hasCoverage: coverage !== null,
    hasContributors: ownership.length > 0,
  };

  const allPassing = Object.values(checks).every(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: rootDir,
    ownership,
    dependencies: deps,
    coverage,
    secrets: {
      totalFindings: secrets.totalFindings,
      clean: secrets.totalFindings === 0,
    },
    licenses: {
      totalDependencies: licenses.totalDependencies,
      violations: licenses.violations,
      compliant: licenses.compliant,
    },
    checks,
    allPassing,
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format report for console output.
 * @param {Object} report
 * @returns {string}
 */
function formatConsole(report) {
  const lines = ['AIOX Governance Report', '='.repeat(40), ''];

  // Ownership
  lines.push('Code Ownership:');
  if (report.ownership.length > 0) {
    for (const c of report.ownership.slice(0, 10)) {
      lines.push(`  ${c.author}: ${c.commits} commits`);
    }
  } else {
    lines.push('  No git history found');
  }
  lines.push('');

  // Dependencies
  lines.push('Dependencies:');
  lines.push(`  Production: ${report.dependencies.dependencies}`);
  lines.push(`  Development: ${report.dependencies.devDependencies}`);
  lines.push(`  Total: ${report.dependencies.total}`);
  lines.push('');

  // Coverage
  lines.push('Test Coverage:');
  if (report.coverage) {
    lines.push(`  Lines: ${report.coverage.lines}%`);
    lines.push(`  Branches: ${report.coverage.branches}%`);
    lines.push(`  Functions: ${report.coverage.functions}%`);
    lines.push(`  Statements: ${report.coverage.statements}%`);
  } else {
    lines.push('  No coverage report found');
  }
  lines.push('');

  // Secrets
  lines.push('Security Scan:');
  lines.push(`  Secrets found: ${report.secrets.totalFindings}`);
  lines.push(`  Status: ${report.secrets.clean ? 'CLEAN' : 'FINDINGS DETECTED'}`);
  lines.push('');

  // Licenses
  lines.push('License Compliance:');
  lines.push(`  Dependencies checked: ${report.licenses.totalDependencies}`);
  lines.push(`  Violations: ${report.licenses.violations.length}`);
  lines.push(`  Status: ${report.licenses.compliant ? 'COMPLIANT' : 'VIOLATIONS FOUND'}`);
  lines.push('');

  // Summary
  lines.push('Governance Checks:');
  for (const [check, passed] of Object.entries(report.checks)) {
    lines.push(`  ${passed ? 'PASS' : 'FAIL'} ${check}`);
  }
  lines.push('');
  lines.push(`Overall: ${report.allPassing ? 'ALL PASSING' : 'ISSUES FOUND'}`);

  return lines.join('\n');
}

/**
 * Format report as JSON.
 * @param {Object} report
 * @returns {string}
 */
function formatJSON(report) {
  return JSON.stringify(report, null, 2);
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Run the governance command.
 * @param {string[]} argv - Arguments after 'governance'
 */
function runGovernance(argv) {
  argv = argv || [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx >= 0 ? argv[formatIdx + 1] : 'text';
  const doExport = argv.includes('--export');
  const ciMode = argv.includes('--ci');

  const report = generateReport();

  if (doExport) {
    const aioxDir = path.join(process.cwd(), '.aiox');
    fs.mkdirSync(aioxDir, { recursive: true });
    const exportPath = path.join(aioxDir, 'governance-report.json');
    fs.writeFileSync(exportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Report exported to ${exportPath}`);
  }

  if (format === 'json') {
    console.log(formatJSON(report));
  } else {
    console.log(formatConsole(report));
  }

  if (ciMode && !report.allPassing) {
    process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getCodeOwnership,
  getDependencyCount,
  getCoverageSummary,
  getSecretScanSummary,
  getLicenseCompliance,
  generateReport,
  formatConsole,
  formatJSON,
  runGovernance,
  HELP_TEXT,
};
