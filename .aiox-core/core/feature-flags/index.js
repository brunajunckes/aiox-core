/**
 * Feature Flags Module - Barrel Export
 *
 * @module core/feature-flags
 */

const { createFeatureFlags } = require('./flags');

module.exports = {
  createFeatureFlags,
};
