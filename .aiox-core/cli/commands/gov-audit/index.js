#!/usr/bin/env node

const path = require('path');
const { GovernanceAudit } = require('./audit');

/**
 * aiox gov-audit
 * Full platform governance audit with compliance score
 * Usage:
 *   aiox gov-audit              # Display audit report
 *   aiox gov-audit --json       # JSON output for CI/CD
 *   aiox gov-audit --verbose    # Detailed results
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes('--json'),
    verbose: args.includes('--verbose'),
    cwd: process.cwd(),
  };

  try {
    const audit = new GovernanceAudit(options);
    const results = await audit.run();

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const report = require('./report-formatter').format(results, options);
      console.log(report);
    }

    // Exit with code based on compliance
    const exitCode = results.complianceScore < 70 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Governance Audit Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
