/**
 * Coverage Report Module — Barrel Export
 *
 * Exports all coverage analysis functionality from the coverage-report core module.
 *
 * @module core/coverage-report
 */

'use strict';

const {
  parseCoverageJson,
  calculateSummary,
  checkThresholds,
  getUncoveredFiles,
  generateTextReport,
  generateJsonReport,
  DEFAULT_THRESHOLDS,
} = require('./coverage-analyzer');

module.exports = {
  parseCoverageJson,
  calculateSummary,
  checkThresholds,
  getUncoveredFiles,
  generateTextReport,
  generateJsonReport,
  DEFAULT_THRESHOLDS,
};
