const path = require('path');
const fs = require('fs');
const { ConstitutionalEnforcer } = require('../constitution-enforce/enforcer');

/**
 * GovernanceAudit
 * Runs full governance audit and calculates compliance score
 */
class GovernanceAudit {
  constructor(options = {}) {
    this.options = {
      json: false,
      verbose: false,
      cwd: process.cwd(),
      ...options,
    };
  }

  async run() {
    const enforcer = new ConstitutionalEnforcer({
      fix: false,
      verbose: this.options.verbose,
      cwd: this.options.cwd,
    });

    const enforcement = await enforcer.validate();

    // Calculate compliance score (0-100)
    const complianceScore = this._calculateCompliance(enforcement);

    // Categorize violations
    const byCategory = this._categorizeViolations(enforcement.violations);

    return {
      timestamp: new Date().toISOString(),
      complianceScore,
      complianceLevel: this._getLevel(complianceScore),
      enforcement,
      violations: {
        total: enforcement.violations.length,
        byCategory,
      },
      recommendations: this._getRecommendations(enforcement.violations),
      passed: {
        total: enforcement.passed.length,
      },
    };
  }

  _calculateCompliance(enforcement) {
    const total = enforcement.passed.length + enforcement.violations.length;
    if (total === 0) return 100;

    const weights = {
      high: 3,
      medium: 2,
      low: 1,
    };

    let penalty = 0;
    enforcement.violations.forEach(v => {
      penalty += (weights[v.severity] || 1) * 10;
    });

    const score = Math.max(0, 100 - Math.min(100, penalty));
    return Math.round(score);
  }

  _getLevel(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 50) return 'Poor';
    return 'Critical';
  }

  _categorizeViolations(violations) {
    const categories = {
      'CLI First': [],
      'Agent Authority': [],
      'Story-Driven': [],
      'No Invention': [],
      'Quality First': [],
    };

    violations.forEach(v => {
      if (categories[v.principle]) {
        categories[v.principle].push(v);
      }
    });

    return categories;
  }

  _getRecommendations(violations) {
    const recommendations = new Map();

    violations.forEach(v => {
      if (v.suggestion) {
        if (!recommendations.has(v.suggestion)) {
          recommendations.set(v.suggestion, {
            description: v.suggestion,
            principle: v.principle,
            severity: v.severity,
          });
        }
      }
    });

    return Array.from(recommendations.values())
      .sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);
  }
}

module.exports = { GovernanceAudit };
