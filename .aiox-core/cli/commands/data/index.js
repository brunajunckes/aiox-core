/**
 * Data Export/Import
 *
 * Subcommands:
 *   aiox data export                   — export all AIOX data as JSON
 *   aiox data export --output file.json — write to file
 *   aiox data import <file>            — import data from backup JSON
 *   aiox data import <file> --dry-run  — preview import
 *   aiox data diff <file>              — show differences between current and backup
 *
 * @module cli/commands/data
 * @version 1.0.0
 * @story 17.3 — Data Export/Import
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const AIOX_DIR = () => path.join(process.cwd(), '.aiox');

const DATA_SOURCES = [
  { key: 'config', file: 'config.yaml' },
  { key: 'profiles', file: 'profiles.json' },
  { key: 'aliases', file: 'aliases.yaml' },
  { key: 'history', file: 'history.json' },
  { key: 'kv-store', file: 'kv-store.json' },
];

const HELP_TEXT = `
DATA EXPORT/IMPORT

USAGE:
  aiox data export                      Export all AIOX data as JSON to stdout
  aiox data export --output <file>      Export to a file
  aiox data import <file>               Import data from a backup JSON file
  aiox data import <file> --dry-run     Preview import without writing
  aiox data diff <file>                 Show differences between current state and backup
  aiox data --help                      Show this help

EXAMPLES:
  aiox data export --output backup.json
  aiox data import backup.json --dry-run
  aiox data diff backup.json
`.trim();

// ── Data Operations ──────────────────────────────────────────────────────────

/**
 * Collect all AIOX data into a single object.
 * @returns {Object} { _meta: {...}, config: ..., profiles: ..., ... }
 */
function collectData() {
  const aioxDir = AIOX_DIR();
  const result = {
    _meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      sources: [],
    },
  };

  for (const source of DATA_SOURCES) {
    const filePath = path.join(aioxDir, source.file);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8').trim();
        if (raw) {
          // Try JSON first, then store as raw string
          try {
            result[source.key] = JSON.parse(raw);
          } catch {
            result[source.key] = raw;
          }
          result._meta.sources.push(source.key);
        }
      }
    } catch { /* skip unreadable files */ }
  }

  return result;
}

/**
 * Export data as JSON string.
 * @returns {string}
 */
function dataExport() {
  const data = collectData();
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from a parsed object.
 * @param {Object} data - parsed backup object
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @returns {{restored: string[], skipped: string[], errors: string[]}}
 */
function dataImport(data, options = {}) {
  const dryRun = options.dryRun || false;
  const aioxDir = AIOX_DIR();
  const restored = [];
  const skipped = [];
  const errors = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { restored: [], skipped: [], errors: ['Invalid backup format: expected object'] };
  }

  for (const source of DATA_SOURCES) {
    if (!(source.key in data)) {
      skipped.push(source.key);
      continue;
    }

    try {
      const value = data[source.key];
      const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      const filePath = path.join(aioxDir, source.file);

      if (!dryRun) {
        if (!fs.existsSync(aioxDir)) {
          fs.mkdirSync(aioxDir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf8');
      }
      restored.push(source.key);
    } catch (err) {
      errors.push(`${source.key}: ${err.message}`);
    }
  }

  return { restored, skipped, errors };
}

/**
 * Compute diff between current state and backup.
 * @param {Object} backupData - parsed backup object
 * @returns {Array<{key: string, status: string, details: string}>}
 */
function dataDiff(backupData) {
  const current = collectData();
  const diffs = [];

  if (typeof backupData !== 'object' || backupData === null || Array.isArray(backupData)) {
    return [{ key: '_format', status: 'error', details: 'Invalid backup format' }];
  }

  for (const source of DATA_SOURCES) {
    const currentVal = current[source.key];
    const backupVal = backupData[source.key];
    const currentStr = currentVal !== undefined ? JSON.stringify(currentVal) : undefined;
    const backupStr = backupVal !== undefined ? JSON.stringify(backupVal) : undefined;

    if (currentStr === undefined && backupStr === undefined) {
      diffs.push({ key: source.key, status: 'both-missing', details: 'Not present in either' });
    } else if (currentStr === undefined) {
      diffs.push({ key: source.key, status: 'only-in-backup', details: 'Would be added from backup' });
    } else if (backupStr === undefined) {
      diffs.push({ key: source.key, status: 'only-in-current', details: 'Not in backup (would be kept)' });
    } else if (currentStr === backupStr) {
      diffs.push({ key: source.key, status: 'identical', details: 'No changes' });
    } else {
      diffs.push({ key: source.key, status: 'different', details: 'Content differs' });
    }
  }

  return diffs;
}

// ── CLI Runner ───────────────────────────────────────────────────────────────

/**
 * Run the data command.
 * @param {string[]} argv - arguments after "aiox data"
 */
function runData(argv) {
  const sub = argv[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'export': {
      const outputIdx = argv.indexOf('--output');
      const json = dataExport();
      if (outputIdx !== -1 && argv[outputIdx + 1]) {
        const outFile = path.isAbsolute(argv[outputIdx + 1])
          ? argv[outputIdx + 1]
          : path.join(process.cwd(), argv[outputIdx + 1]);
        fs.writeFileSync(outFile, json, 'utf8');
        console.log(`Exported to ${outFile}`);
      } else {
        console.log(json);
      }
      break;
    }

    case 'import': {
      const file = argv[1];
      if (!file) {
        console.error('Usage: aiox data import <file> [--dry-run]');
        process.exitCode = 1;
        return;
      }
      const absPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exitCode = 1;
        return;
      }

      let data;
      try {
        data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      } catch (err) {
        console.error(`Invalid JSON: ${err.message}`);
        process.exitCode = 1;
        return;
      }

      const dryRun = argv.includes('--dry-run');
      const result = dataImport(data, { dryRun });

      if (dryRun) console.log('[DRY RUN]');
      if (result.restored.length > 0) console.log(`Restored: ${result.restored.join(', ')}`);
      if (result.skipped.length > 0) console.log(`Skipped: ${result.skipped.join(', ')}`);
      if (result.errors.length > 0) {
        console.error(`Errors: ${result.errors.join('; ')}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'diff': {
      const file = argv[1];
      if (!file) {
        console.error('Usage: aiox data diff <file>');
        process.exitCode = 1;
        return;
      }
      const absPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      if (!fs.existsSync(absPath)) {
        console.error(`File not found: ${absPath}`);
        process.exitCode = 1;
        return;
      }

      let data;
      try {
        data = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      } catch (err) {
        console.error(`Invalid JSON: ${err.message}`);
        process.exitCode = 1;
        return;
      }

      const diffs = dataDiff(data);
      console.log('DATA DIFF:');
      for (const d of diffs) {
        const icon = d.status === 'identical' ? '=' : d.status === 'different' ? '~' : d.status === 'only-in-backup' ? '+' : '-';
        console.log(`  ${icon} ${d.key}: ${d.details}`);
      }
      break;
    }

    default:
      console.error(`Unknown data subcommand: ${sub}`);
      console.log(HELP_TEXT);
      process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runData,
  collectData,
  dataExport,
  dataImport,
  dataDiff,
  DATA_SOURCES,
  AIOX_DIR,
};
