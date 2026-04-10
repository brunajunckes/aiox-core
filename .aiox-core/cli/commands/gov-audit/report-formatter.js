/**
 * Report Formatter
 * Formats governance audit results as human-readable text
 */

function format(results, options = {}) {
  let output = '';

  // Header
  output += '\n=== GOVERNANCE AUDIT REPORT ===\n\n';

  // Compliance Score
  output += formatComplianceScore(results);

  // Violations Summary
  output += formatViolationsSummary(results);

  // Detailed Violations
  if (options.verbose && results.violations.total > 0) {
    output += formatDetailedViolations(results);
  }

  // Recommendations
  if (results.recommendations.length > 0) {
    output += formatRecommendations(results);
  }

  // Summary
  output += '\n=== SUMMARY ===\n';
  output += `Total Checks: ${results.enforcement.passed.length + results.violations.total}\n`;
  output += `Passed: ${results.enforcement.passed.length}\n`;
  output += `Violations: ${results.violations.total}\n`;
  output += `Audit Time: ${new Date(results.timestamp).toLocaleString()}\n\n`;

  return output;
}

function formatComplianceScore(results) {
  const score = results.complianceScore;
  const level = results.complianceLevel;

  let icon = '❌';
  if (score >= 90) icon = '✅';
  else if (score >= 80) icon = '✅';
  else if (score >= 70) icon = '⚠️';

  return `${icon} Compliance Score: ${score}% (${level})\n\n`;
}

function formatViolationsSummary(results) {
  let output = '=== VIOLATIONS SUMMARY ===\n';

  if (results.violations.total === 0) {
    output += 'No violations found!\n\n';
    return output;
  }

  output += `Total: ${results.violations.total}\n\n`;

  const categories = results.violations.byCategory;
  for (const [principle, violations] of Object.entries(categories)) {
    if (violations.length > 0) {
      output += `${principle}: ${violations.length}\n`;
    }
  }

  output += '\n';
  return output;
}

function formatDetailedViolations(results) {
  let output = '=== DETAILED VIOLATIONS ===\n\n';

  const categories = results.violations.byCategory;
  for (const [principle, violations] of Object.entries(categories)) {
    if (violations.length > 0) {
      output += `${principle}:\n`;
      violations.forEach((v, i) => {
        output += `  ${i + 1}. [${v.severity.toUpperCase()}] ${v.message}\n`;
        if (v.location) output += `     Location: ${v.location}\n`;
        if (v.suggestion) output += `     Fix: ${v.suggestion}\n`;
      });
      output += '\n';
    }
  }

  return output;
}

function formatRecommendations(results) {
  let output = '=== TOP RECOMMENDATIONS ===\n';
  output += `(${results.recommendations.length} recommendations)\n\n`;

  results.recommendations.forEach((rec, i) => {
    output += `${i + 1}. [${rec.severity.toUpperCase()}] ${rec.description}\n`;
    output += `   Principle: ${rec.principle}\n\n`;
  });

  return output;
}

module.exports = { format };
