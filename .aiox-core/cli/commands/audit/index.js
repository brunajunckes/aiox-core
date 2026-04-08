/**
 * Dependency Audit & Security Scanner Command Module
 *
 * Subcommands:
 *   aiox audit            — Full audit (npm audit + outdated check)
 *   aiox audit report     — Generate markdown report to stdout
 *   aiox audit --fix      — Run npm audit fix
 *   aiox audit --json     — JSON output
 *   aiox audit --help     — Show help
 *
 * @module cli/commands/audit
 * @version 1.0.0
 * @story 7.2 — Dependency Audit & Security Scanner
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];

const SEVERITY_LABELS = {
  critical: 'CRITICAL',
  high: 'HIGH',
  moderate: 'MODERATE',
  low: 'LOW',
  info: 'INFO',
};

const HELP_TEXT = `
AIOX Dependency Audit & Security Scanner

Usage:
  aiox audit              Run full audit (vulnerabilities + outdated)
  aiox audit report       Generate markdown report to stdout
  aiox audit --fix        Attempt to auto-fix vulnerabilities
  aiox audit --json       Output results as JSON
  aiox audit --help       Show this help message

Examples:
  aiox audit              # Quick security overview
  aiox audit report       # Detailed markdown report
  aiox audit --fix        # Auto-fix what npm can
  aiox audit --json       # Machine-readable output
`.trim();

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Execute npm audit --json and parse the output.
 * npm audit exits non-zero when vulnerabilities exist, so we catch that.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {{ vulnerabilities: Object, metadata: Object, raw: Object }}
 */
function runNpmAudit(cwd) {
  const projectRoot = cwd || process.cwd();
  let rawOutput;

  try {
    rawOutput = execSync('npm audit --json 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    // npm audit returns non-zero when vulnerabilities found — that is expected
    rawOutput = error.stdout || error.output?.[1] || '{}';
  }

  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (_parseErr) {
    parsed = {};
  }

  const vulnerabilities = parsed.vulnerabilities || {};
  const metadata = parsed.metadata || {};

  // Build severity summary from metadata or by counting
  const severityCounts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };

  if (metadata.vulnerabilities) {
    Object.assign(severityCounts, metadata.vulnerabilities);
  } else {
    // Fall back to counting from vulnerabilities object
    for (const [, vuln] of Object.entries(vulnerabilities)) {
      const sev = (vuln.severity || 'info').toLowerCase();
      if (severityCounts[sev] !== undefined) {
        severityCounts[sev]++;
      }
    }
  }

  // Build details list
  const details = [];
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    const sev = (vuln.severity || 'info').toLowerCase();
    const range = vuln.range || '*';
    const fixAvailable = vuln.fixAvailable;
    const via = Array.isArray(vuln.via)
      ? vuln.via
          .filter((v) => typeof v === 'object')
          .map((v) => v.title || v.url || '')
          .filter(Boolean)
      : [];

    details.push({
      name,
      severity: sev,
      range,
      fixAvailable: !!fixAvailable,
      advisories: via,
    });
  }

  // Sort by severity
  details.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  return {
    severityCounts,
    details,
    total: metadata.vulnerabilities?.total || details.length,
    raw: parsed,
  };
}

/**
 * Execute npm outdated --json and parse the output.
 * npm outdated exits non-zero when outdated packages exist.
 *
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {{ packages: Array, total: number, raw: Object }}
 */
function checkOutdated(cwd) {
  const projectRoot = cwd || process.cwd();
  let rawOutput;

  try {
    rawOutput = execSync('npm outdated --json 2>/dev/null', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    // npm outdated returns non-zero when outdated packages exist
    rawOutput = error.stdout || error.output?.[1] || '{}';
  }

  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (_parseErr) {
    parsed = {};
  }

  const packages = [];
  for (const [name, info] of Object.entries(parsed)) {
    packages.push({
      name,
      current: info.current || 'N/A',
      wanted: info.wanted || 'N/A',
      latest: info.latest || 'N/A',
      type: info.type || 'dependencies',
      homepage: info.homepage || null,
    });
  }

  return {
    packages,
    total: packages.length,
    raw: parsed,
  };
}

/**
 * Run npm audit fix.
 *
 * @param {string} [cwd] - Working directory
 * @returns {{ success: boolean, output: string }}
 */
function runAuditFix(cwd) {
  const projectRoot = cwd || process.cwd();

  try {
    const output = execSync('npm audit fix 2>&1', {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 120000,
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message || 'Unknown error during npm audit fix',
    };
  }
}

/**
 * Format combined audit + outdated results as a markdown report.
 *
 * @param {{ audit: Object, outdated: Object }} results
 * @returns {string} Markdown formatted report
 */
function formatAuditReport(results) {
  const { audit, outdated } = results;
  const lines = [];

  lines.push('# AIOX Dependency Audit Report');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Vulnerability summary
  lines.push('## Vulnerability Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of SEVERITY_ORDER) {
    const count = audit.severityCounts[sev] || 0;
    if (count > 0) {
      lines.push(`| ${SEVERITY_LABELS[sev]} | ${count} |`);
    }
  }
  const totalVulns = audit.total || 0;
  lines.push(`| **Total** | **${totalVulns}** |`);
  lines.push('');

  // Vulnerability details
  if (audit.details.length > 0) {
    lines.push('## Vulnerability Details');
    lines.push('');
    lines.push('| Package | Severity | Range | Fix Available | Advisory |');
    lines.push('|---------|----------|-------|---------------|----------|');
    for (const d of audit.details) {
      const advisory = d.advisories.length > 0 ? d.advisories[0] : '-';
      lines.push(
        `| ${d.name} | ${SEVERITY_LABELS[d.severity]} | ${d.range} | ${d.fixAvailable ? 'Yes' : 'No'} | ${advisory} |`
      );
    }
    lines.push('');
  }

  // Outdated packages
  lines.push('## Outdated Packages');
  lines.push('');
  if (outdated.packages.length === 0) {
    lines.push('All packages are up to date.');
  } else {
    lines.push(`**${outdated.total}** packages outdated.`);
    lines.push('');
    lines.push('| Package | Current | Wanted | Latest | Type |');
    lines.push('|---------|---------|--------|--------|------|');
    for (const pkg of outdated.packages) {
      lines.push(`| ${pkg.name} | ${pkg.current} | ${pkg.wanted} | ${pkg.latest} | ${pkg.type} |`);
    }
  }
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  if ((audit.severityCounts.critical || 0) > 0) {
    lines.push(
      `- **CRITICAL:** ${audit.severityCounts.critical} critical vulnerabilities require immediate attention. Run \`aiox audit --fix\` or manually update affected packages.`
    );
  }
  if ((audit.severityCounts.high || 0) > 0) {
    lines.push(
      `- **HIGH:** ${audit.severityCounts.high} high-severity vulnerabilities should be resolved before release.`
    );
  }
  if (outdated.total > 0) {
    lines.push(
      `- **OUTDATED:** ${outdated.total} packages have newer versions available. Run \`npm update\` for compatible updates.`
    );
  }
  if (
    totalVulns === 0 &&
    outdated.total === 0
  ) {
    lines.push('No issues found. Dependencies are clean and up to date.');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format results as CLI-friendly console output.
 *
 * @param {{ audit: Object, outdated: Object }} results
 * @returns {string}
 */
function formatConsoleOutput(results) {
  const { audit, outdated } = results;
  const lines = [];

  lines.push('');
  lines.push('AIOX Security Audit');
  lines.push('\u2501'.repeat(40));

  // Severity line
  const sevParts = SEVERITY_ORDER.filter((s) => (audit.severityCounts[s] || 0) > 0).map(
    (s) => `${audit.severityCounts[s]} ${s}`
  );

  if (sevParts.length > 0) {
    lines.push(`  Vulnerabilities:  ${sevParts.join(', ')}`);
  } else {
    lines.push('  Vulnerabilities:  None found');
  }

  lines.push(`  Outdated deps:    ${outdated.total} package${outdated.total !== 1 ? 's' : ''}`);
  lines.push('');

  // Details for high/critical
  const importantDetails = audit.details.filter(
    (d) => d.severity === 'critical' || d.severity === 'high'
  );

  if (importantDetails.length > 0) {
    lines.push('  Details:');
    for (const d of importantDetails) {
      const advisory = d.advisories.length > 0 ? ` (${d.advisories[0]})` : '';
      lines.push(`    [${SEVERITY_LABELS[d.severity]}] ${d.name}@${d.range}${advisory}`);
    }
    lines.push('');
  }

  // Outdated summary (show first 10)
  if (outdated.packages.length > 0) {
    lines.push('  Outdated:');
    const shown = outdated.packages.slice(0, 10);
    for (const pkg of shown) {
      lines.push(`    ${pkg.name}: ${pkg.current} -> ${pkg.latest}`);
    }
    if (outdated.packages.length > 10) {
      lines.push(`    ... and ${outdated.packages.length - 10} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Main CLI handler for the audit command.
 *
 * @param {string[]} argv - Arguments after 'audit'
 */
function runAudit(argv) {
  const subArgs = argv || [];

  // Parse flags
  const hasFlag = (flag) => subArgs.includes(flag);
  const isHelp = hasFlag('--help') || hasFlag('-h');
  const isJson = hasFlag('--json');
  const isFix = hasFlag('--fix');
  const isReport = subArgs[0] === 'report';

  if (isHelp) {
    console.log(HELP_TEXT);
    return;
  }

  if (isFix) {
    console.log('Running npm audit fix...');
    const fixResult = runAuditFix();
    if (fixResult.success) {
      console.log('Audit fix completed successfully.');
      console.log(fixResult.output);
    } else {
      console.error('Audit fix encountered issues:');
      console.error(fixResult.output);
      process.exitCode = 1;
    }
    return;
  }

  // Run both audit and outdated
  const audit = runNpmAudit();
  const outdated = checkOutdated();
  const results = { audit, outdated };

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (isReport) {
    console.log(formatAuditReport(results));
    return;
  }

  // Default: console output
  console.log(formatConsoleOutput(results));
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runAudit,
  runNpmAudit,
  checkOutdated,
  runAuditFix,
  formatAuditReport,
  formatConsoleOutput,
};
