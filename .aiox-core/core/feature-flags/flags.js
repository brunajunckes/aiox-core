/**
 * Feature Flags Module
 *
 * Provides feature flag management with atomic writes and environment overrides.
 * Flags are persisted in .aiox/feature-flags.json as JSON.
 *
 * @module core/feature-flags
 * @version 1.0.0
 * @story 16.4 - Feature Flags
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Create a feature flags manager
 * @param {object} options - Configuration options
 * @param {string} options.flagsDir - Directory for flags file - default: .aiox
 * @param {object} options.defaults - Default flag values
 * @returns {object} Feature flags manager with methods: setFlag, getFlag, isEnabled, listFlags, deleteFlag, toggleFlag, getOverrides
 */
function createFeatureFlags(options = {}) {
  const flagsDir = options.flagsDir || path.join(process.cwd(), '.aiox');
  const flagsFile = path.join(flagsDir, 'feature-flags.json');
  const defaults = options.defaults || {};

  // Ensure flags directory exists
  if (!fs.existsSync(flagsDir)) {
    fs.mkdirSync(flagsDir, { recursive: true });
  }

  /**
   * Load flags from file
   */
  function loadFlags() {
    if (!fs.existsSync(flagsFile)) {
      return {};
    }

    try {
      const content = fs.readFileSync(flagsFile, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      // Return empty if file is invalid
      return {};
    }
  }

  /**
   * Save flags to file atomically
   */
  function saveFlags(flags) {
    try {
      // Write to temp file first
      const tempFile = flagsFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(flags, null, 2));
      // Atomic rename
      fs.renameSync(tempFile, flagsFile);
    } catch (err) {
      throw new Error(`Failed to save flags: ${err.message}`);
    }
  }

  /**
   * Get environment variable override for a flag
   * Looks for AIOX_FLAG_<UPPERCASED_NAME>
   */
  function getEnvOverride(name) {
    const envKey = `AIOX_FLAG_${name.toUpperCase().replace(/-/g, '_')}`;
    const envValue = process.env[envKey];

    if (envValue === undefined) {
      return undefined;
    }

    // Parse the value
    if (envValue === 'true') return true;
    if (envValue === 'false') return false;
    if (envValue === 'null') return null;
    if (!isNaN(envValue) && envValue !== '') return Number(envValue);
    return envValue;
  }

  const manager = {
    /**
     * Set a flag value
     * @param {string} name - Flag name
     * @param {*} value - Flag value (boolean, string, number)
     */
    setFlag(name, value) {
      if (!name || typeof name !== 'string') {
        throw new Error('Flag name must be a non-empty string');
      }

      const flags = loadFlags();
      flags[name] = value;
      saveFlags(flags);
    },

    /**
     * Get a flag value
     * Checks environment variable override first, then file, then defaults
     * @param {string} name - Flag name
     * @param {*} defaultValue - Default value if flag not set
     * @returns {*} Flag value
     */
    getFlag(name, defaultValue = undefined) {
      if (!name || typeof name !== 'string') {
        throw new Error('Flag name must be a non-empty string');
      }

      // Check environment override first
      const envOverride = getEnvOverride(name);
      if (envOverride !== undefined) {
        return envOverride;
      }

      // Check file
      const flags = loadFlags();
      if (name in flags) {
        return flags[name];
      }

      // Check defaults
      if (name in defaults) {
        return defaults[name];
      }

      // Return provided default or undefined
      return defaultValue;
    },

    /**
     * Check if a flag is enabled (boolean value is true)
     * @param {string} name - Flag name
     * @returns {boolean} True if flag value is exactly true
     */
    isEnabled(name) {
      return this.getFlag(name, false) === true;
    },

    /**
     * Get all flags (including defaults, excluding env overrides)
     * @returns {object} Object with all flag names and values
     */
    listFlags() {
      const flags = loadFlags();
      // Merge with defaults, giving precedence to loaded flags
      return { ...defaults, ...flags };
    },

    /**
     * Delete a flag
     * @param {string} name - Flag name
     */
    deleteFlag(name) {
      if (!name || typeof name !== 'string') {
        throw new Error('Flag name must be a non-empty string');
      }

      const flags = loadFlags();
      if (!(name in flags)) {
        throw new Error(`Flag not found: ${name}`);
      }

      delete flags[name];
      saveFlags(flags);
    },

    /**
     * Toggle a boolean flag
     * @param {string} name - Flag name
     * @returns {boolean} New flag value
     */
    toggleFlag(name) {
      if (!name || typeof name !== 'string') {
        throw new Error('Flag name must be a non-empty string');
      }

      const current = this.getFlag(name, false);
      const newValue = !current;
      this.setFlag(name, newValue);
      return newValue;
    },

    /**
     * Get all environment variable overrides
     * Returns map of flag name to override value
     * @returns {object} Object with overridden flag names and values
     */
    getOverrides() {
      const overrides = {};
      const flagNames = new Set();

      // Get all flag names from file and defaults
      const flags = loadFlags();
      Object.keys(flags).forEach(name => flagNames.add(name));
      Object.keys(defaults).forEach(name => flagNames.add(name));

      // Check for env overrides
      for (const name of flagNames) {
        const override = getEnvOverride(name);
        if (override !== undefined) {
          overrides[name] = override;
        }
      }

      return overrides;
    },

    /**
     * Get the flags file path
     * @returns {string} Full path to flags file
     */
    getFlagsFilePath() {
      return flagsFile;
    },
  };

  return manager;
}

module.exports = {
  createFeatureFlags,
};
