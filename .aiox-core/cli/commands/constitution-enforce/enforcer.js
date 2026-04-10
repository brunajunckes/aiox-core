const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const validators = {
  'CLI First': require('./validators/cli-first'),
  'Agent Authority': require('./validators/agent-authority'),
  'Story-Driven': require('./validators/story-driven'),
  'No Invention': require('./validators/no-invention'),
  'Quality First': require('./validators/quality-first'),
};

/**
 * ConstitutionalEnforcer
 * Validates codebase against 5 Constitutional principles
 * Supports auto-fixing when possible
 */
class ConstitutionalEnforcer {
  constructor(options = {}) {
    this.options = {
      fix: false,
      verbose: false,
      cwd: process.cwd(),
      ...options,
    };
    this.results = {
      passed: [],
      violations: [],
      fixes: [],
    };
  }

  async validate() {
    // Run all validators
    for (const [principle, validator] of Object.entries(validators)) {
      const principleResults = await this._runValidator(principle, validator);
      this.results.passed.push(...principleResults.passed);
      this.results.violations.push(...principleResults.violations);
      if (this.options.fix) {
        const fixes = await this._applyFixes(principle, principleResults.violations);
        this.results.fixes.push(...fixes);
      }
    }

    return this.results;
  }

  async _runValidator(principle, validator) {
    const passed = [];
    const violations = [];

    try {
      const result = await validator.validate(this.options.cwd);

      if (Array.isArray(result)) {
        result.forEach(r => {
          if (r.type === 'pass') {
            passed.push({ principle, message: r.message });
          } else {
            violations.push({
              principle,
              severity: r.severity || 'medium',
              message: r.message,
              location: r.location,
              suggestion: r.suggestion,
            });
          }
        });
      }
    } catch (error) {
      violations.push({
        principle,
        severity: 'high',
        message: `Validator error: ${error.message}`,
      });
    }

    return { passed, violations };
  }

  async _applyFixes(principle, violations) {
    const fixes = [];

    for (const violation of violations) {
      if (violation.autoFix) {
        try {
          const fixed = await violation.autoFix(this.options.cwd);
          if (fixed) {
            fixes.push({
              principle,
              description: `Fixed: ${violation.message}`,
              filesModified: fixed.filesModified || [],
            });
          }
        } catch (error) {
          // Silently skip fixes that fail
        }
      }
    }

    return fixes;
  }
}

module.exports = { ConstitutionalEnforcer };
