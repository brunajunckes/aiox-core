/**
 * Feature Flags Command Module
 *
 * CLI commands for managing feature flags.
 * Subcommands: set, get, list, toggle, delete
 *
 * @module cli/commands/feature-flags
 * @version 1.0.0
 * @story 16.4 - Feature Flags
 */

'use strict';

const { Command } = require('commander');
const { createFeatureFlags } = require('../../core/feature-flags');

/**
 * Set a feature flag
 */
function setAction(name, value, options) {
  try {
    const flags = createFeatureFlags();

    // Parse value
    let parsedValue = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (value === 'null') parsedValue = null;
    else if (!isNaN(value) && value !== '') parsedValue = Number(value);

    flags.setFlag(name, parsedValue);

    console.log(`Set flag: ${name} = ${JSON.stringify(parsedValue)}`);

    if (options.verbose) {
      console.log(`File: ${flags.getFlagsFilePath()}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get a feature flag
 */
function getAction(name, options) {
  try {
    const flags = createFeatureFlags();
    const value = flags.getFlag(name);

    if (value === undefined) {
      if (options.strict) {
        console.error(`Flag not found: ${name}`);
        process.exit(1);
      }
      console.log('undefined');
    } else {
      console.log(JSON.stringify(value));
    }

    if (options.verbose) {
      console.log(`File: ${flags.getFlagsFilePath()}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * List all feature flags
 */
function listAction(options) {
  try {
    const flags = createFeatureFlags();
    const allFlags = flags.listFlags();
    const overrides = flags.getOverrides();

    if (Object.keys(allFlags).length === 0) {
      console.log('No flags set.');
      return;
    }

    console.log('Feature Flags:');
    console.log('='.repeat(60));

    for (const [name, value] of Object.entries(allFlags)) {
      let display = JSON.stringify(value);
      let suffix = '';

      if (name in overrides) {
        suffix = ` [env override: ${JSON.stringify(overrides[name])}]`;
      }

      console.log(`  ${name}: ${display}${suffix}`);
    }

    if (options.json) {
      console.log('\nJSON:');
      console.log(JSON.stringify(allFlags, null, 2));
    }

    if (options.verbose) {
      console.log(`\nFile: ${flags.getFlagsFilePath()}`);
      if (Object.keys(overrides).length > 0) {
        console.log(`\nEnvironment Overrides: ${Object.keys(overrides).length}`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Toggle a boolean feature flag
 */
function toggleAction(name, options) {
  try {
    const flags = createFeatureFlags();
    const newValue = flags.toggleFlag(name);

    console.log(`Toggled flag: ${name} = ${newValue}`);

    if (options.verbose) {
      console.log(`File: ${flags.getFlagsFilePath()}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Delete a feature flag
 */
function deleteAction(name, options) {
  try {
    const flags = createFeatureFlags();

    // Check if flag exists
    if (flags.getFlag(name) === undefined) {
      console.error(`Flag not found: ${name}`);
      process.exit(1);
    }

    if (options.dryRun) {
      console.log(`Would delete flag: ${name}`);
      return;
    }

    flags.deleteFlag(name);
    console.log(`Deleted flag: ${name}`);

    if (options.verbose) {
      console.log(`File: ${flags.getFlagsFilePath()}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create the feature-flags command with all subcommands
 * @returns {Command}
 */
function createFeatureFlagsCommand() {
  const ffCmd = new Command('feature-flags')
    .alias('flags')
    .description('Manage feature flags');

  // aiox feature-flags set
  ffCmd
    .command('set <name> <value>')
    .description('Set a feature flag')
    .option('-v, --verbose', 'Show file path')
    .action(setAction);

  // aiox feature-flags get
  ffCmd
    .command('get <name>')
    .description('Get a feature flag value')
    .option('-s, --strict', 'Exit with error if flag not found')
    .option('-v, --verbose', 'Show file path')
    .action(getAction);

  // aiox feature-flags list
  ffCmd
    .command('list')
    .description('List all feature flags')
    .option('-j, --json', 'Output as JSON')
    .option('-v, --verbose', 'Show file path and environment overrides')
    .action(listAction);

  // aiox feature-flags toggle
  ffCmd
    .command('toggle <name>')
    .description('Toggle a boolean flag')
    .option('-v, --verbose', 'Show file path')
    .action(toggleAction);

  // aiox feature-flags delete
  ffCmd
    .command('delete <name>')
    .alias('del')
    .description('Delete a feature flag')
    .option('--dry-run', 'Preview deletion without making changes')
    .option('-v, --verbose', 'Show file path')
    .action(deleteAction);

  return ffCmd;
}

module.exports = {
  createFeatureFlagsCommand,
};
