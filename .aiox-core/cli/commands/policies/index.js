#!/usr/bin/env node

const path = require('path');
const { PolicyManager } = require('./manager');

/**
 * aiox policies
 * List and enforce platform policies
 * Usage:
 *   aiox policies list              # List all active policies
 *   aiox policies enforce <policy>  # Enforce specific policy
 *   aiox policies list --json       # JSON output
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const policyName = args[1];

  const options = {
    json: args.includes('--json'),
    cwd: process.cwd(),
  };

  try {
    const manager = new PolicyManager(options);

    if (command === 'list') {
      const policies = await manager.list();
      if (options.json) {
        console.log(JSON.stringify(policies, null, 2));
      } else {
        console.log('\n=== ACTIVE POLICIES ===\n');
        policies.forEach(p => {
          const status = p.enabled ? '✅' : '⏸️';
          console.log(`${status} ${p.name}`);
          console.log(`   ID: ${p.id}`);
          if (p.description) console.log(`   Description: ${p.description}`);
          console.log();
        });
      }
    } else if (command === 'enforce') {
      if (!policyName) {
        console.error('❌ Policy name required: aiox policies enforce <policy>');
        process.exit(1);
      }
      const results = await manager.enforce(policyName);
      console.log(`\n=== POLICY: ${policyName} ===\n`);
      console.log(`Status: ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Violations: ${results.violations.length}`);
      if (results.violations.length > 0) {
        console.log('\nViolations:');
        results.violations.forEach(v => {
          console.log(`  • ${v.message}`);
        });
      }
      console.log();
      process.exit(results.passed ? 0 : 1);
    } else {
      console.error('❌ Unknown command. Use: list or enforce');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Policy Manager Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
