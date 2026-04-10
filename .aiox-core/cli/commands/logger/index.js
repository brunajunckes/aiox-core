/**
 * Logger Command Module
 *
 * CLI commands for viewing and managing logs.
 * Subcommands: show, clear
 *
 * @module cli/commands/logger
 * @version 1.0.0
 * @story 16.3 - Logger with Levels
 */

'use strict';

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../../core/logger');

/**
 * Show logs from all or specific loggers
 */
function showAction(options) {
  const logsDir = path.join(process.cwd(), '.aiox', 'logs');

  if (!fs.existsSync(logsDir)) {
    console.log('No logs found. No logs have been created yet.');
    return;
  }

  try {
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));

    if (logFiles.length === 0) {
      console.log('No logs found.');
      return;
    }

    // Filter by specific logger if --logger option provided
    let filesToShow = logFiles;
    if (options.logger) {
      filesToShow = logFiles.filter(f => f === `${options.logger}.log`);
      if (filesToShow.length === 0) {
        console.error(`Logger not found: ${options.logger}`);
        process.exit(1);
      }
    }

    // Process each log file
    for (const file of filesToShow) {
      const logPath = path.join(logsDir, file);
      const content = fs.readFileSync(logPath, 'utf-8').trim();

      if (!content) {
        console.log(`\n[${file}] (empty)\n`);
        continue;
      }

      const lines = content.split('\n');
      const entries = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }

      // Apply filters
      let filtered = entries;

      if (options.level) {
        filtered = filtered.filter(e => e.level === options.level);
      }

      if (options.filter) {
        const pattern = new RegExp(options.filter, 'i');
        filtered = filtered.filter(e => pattern.test(e.message));
      }

      // Output
      console.log(`\n[${file}] - ${filtered.length} entries`);
      console.log('='.repeat(60));

      if (filtered.length === 0) {
        console.log('(no matching entries)');
      } else {
        for (const entry of filtered) {
          const levelColor = {
            debug: '\x1b[36m',    // cyan
            info: '\x1b[32m',     // green
            warn: '\x1b[33m',     // yellow
            error: '\x1b[31m',    // red
          }[entry.level] || '\x1b[0m';
          const reset = '\x1b[0m';

          const timestamp = new Date(entry.timestamp).toLocaleString();
          const levelStr = entry.level.toUpperCase().padEnd(5);
          console.log(`${levelColor}${levelStr}${reset} ${timestamp}  ${entry.message}`);

          if (entry.meta && Object.keys(entry.meta).length > 0) {
            console.log(`       meta: ${JSON.stringify(entry.meta)}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading logs: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Clear logs
 */
function clearAction(options) {
  const logsDir = path.join(process.cwd(), '.aiox', 'logs');

  if (!fs.existsSync(logsDir)) {
    console.log('No logs to clear.');
    return;
  }

  try {
    let filesToDelete = [];

    if (options.logger) {
      // Delete specific logger
      const logFile = path.join(logsDir, `${options.logger}.log`);
      if (fs.existsSync(logFile)) {
        filesToDelete = [logFile];
      } else {
        console.error(`Logger not found: ${options.logger}`);
        process.exit(1);
      }
    } else {
      // Delete all logs
      const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
      filesToDelete = logFiles.map(f => path.join(logsDir, f));
    }

    if (filesToDelete.length === 0) {
      console.log('No logs to clear.');
      return;
    }

    if (options.dryRun) {
      console.log('Dry run - would delete:');
      filesToDelete.forEach(f => console.log(`  ${path.relative(process.cwd(), f)}`));
      return;
    }

    // Confirm deletion if not --force
    if (!options.force) {
      console.log(`About to delete ${filesToDelete.length} log file(s):`);
      filesToDelete.forEach(f => console.log(`  ${path.relative(process.cwd(), f)}`));
      console.error('\nUse --force to confirm deletion.');
      process.exit(1);
    }

    for (const file of filesToDelete) {
      fs.unlinkSync(file);
    }

    console.log(`Cleared ${filesToDelete.length} log file(s)`);
  } catch (error) {
    console.error(`Error clearing logs: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create the logger command with subcommands
 * @returns {Command}
 */
function createLoggerCommand() {
  const loggerCmd = new Command('logger')
    .description('View and manage application logs');

  // aiox logger show
  loggerCmd
    .command('show')
    .description('Show logs from loggers')
    .option('-l, --logger <name>', 'Show logs from specific logger')
    .option('--level <level>', 'Filter by log level (debug, info, warn, error)')
    .option('--filter <pattern>', 'Filter by message pattern (regex)')
    .action(showAction);

  // aiox logger clear
  loggerCmd
    .command('clear')
    .description('Clear logs')
    .option('-l, --logger <name>', 'Clear logs from specific logger only')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Preview what would be deleted without deleting')
    .action(clearAction);

  return loggerCmd;
}

module.exports = {
  createLoggerCommand,
};
