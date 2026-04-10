#!/usr/bin/env node

const path = require('path');
const { ConstitutionalEnforcer } = require('./enforcer');

/**
 * aiox constitution-enforce
 * Validates all code against AIOX Constitution (5 principles)
 * Usage:
 *   aiox constitution-enforce              # Validate only
 *   aiox constitution-enforce --fix        # Auto-fix violations
 *   aiox constitution-enforce --verbose    # Show all checks
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose'),
    cwd: process.cwd(),
  };

  try {
    const enforcer = new ConstitutionalEnforcer(options);
    const results = await enforcer.validate();

    // Print results
    printResults(results, options);

    // Exit with appropriate code
    process.exit(results.violations.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Constitutional Enforcement Error:', error.message);
    process.exit(1);
  }
}

function printResults(results, options) {
  const { passed, violations, fixes } = results;

  console.log('\n=== CONSTITUTIONAL ENFORCEMENT REPORT ===\n');

  if (options.verbose) {
    console.log(`Checks Run: ${passed.length + violations.length}`);
    console.log(`Passed: ${passed.length}`);
    console.log(`Violations: ${violations.length}`);
    console.log(`Fixes Applied: ${fixes.length}\n`);
  }

  if (passed.length > 0 && options.verbose) {
    console.log('✅ PASSED CHECKS:');
    passed.forEach(p => console.log(`  • ${p.principle}: ${p.message}`));
    console.log();
  }

  if (violations.length > 0) {
    console.log('❌ VIOLATIONS:');
    violations.forEach(v => {
      console.log(`  • ${v.principle} (${v.severity}): ${v.message}`);
      if (v.location) console.log(`    Location: ${v.location}`);
      if (v.suggestion) console.log(`    Fix: ${v.suggestion}`);
    });
    console.log();
  }

  if (fixes.length > 0) {
    console.log('🔧 FIXES APPLIED:');
    fixes.forEach(f => {
      console.log(`  • ${f.principle}: ${f.description}`);
      if (f.filesModified) console.log(`    Files: ${f.filesModified.join(', ')}`);
    });
    console.log();
  }

  if (violations.length === 0) {
    console.log('✅ All Constitutional principles validated successfully!\n');
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
