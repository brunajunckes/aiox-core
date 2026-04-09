/**
 * Backup & Restore
 *
 * Subcommands:
 *   aiox backup create                     — create timestamped backup of .aiox/
 *   aiox backup list                       — list available backups
 *   aiox backup restore <name>             — restore from backup
 *   aiox backup restore <name> --dry-run   — preview restore
 *   aiox backup clean --keep 5             — keep only N most recent backups
 *
 * @module cli/commands/backup
 * @version 1.0.0
 * @story 17.4 — Backup & Restore
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const AIOX_DIR = () => path.join(process.cwd(), '.aiox');
const BACKUP_DIR = () => path.join(AIOX_DIR(), 'backups');

const HELP_TEXT = `
BACKUP & RESTORE

USAGE:
  aiox backup create                     Create timestamped backup of .aiox/ directory
  aiox backup list                       List available backups
  aiox backup restore <name>             Restore from a backup
  aiox backup restore <name> --dry-run   Preview restore without writing
  aiox backup clean --keep <N>           Keep only N most recent backups
  aiox backup --help                     Show this help

EXAMPLES:
  aiox backup create
  aiox backup list
  aiox backup restore backup-2026-04-08T12-00-00.tar.gz
  aiox backup clean --keep 3
`.trim();

// ── Backup Operations ────────────────────────────────────────────────────────

/**
 * Generate a timestamped backup filename.
 * @returns {string}
 */
function generateBackupName() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `backup-${ts}.tar.gz`;
}

/**
 * Create a backup of the .aiox/ directory.
 * Excludes the backups/ subdirectory from the archive.
 * @returns {{name: string, path: string, size: number}}
 */
function backupCreate() {
  const aioxDir = AIOX_DIR();
  const backupDir = BACKUP_DIR();

  if (!fs.existsSync(aioxDir)) {
    throw new Error('.aiox/ directory not found');
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const name = generateBackupName();
  const backupPath = path.join(backupDir, name);
  const parentDir = path.dirname(aioxDir);
  const aioxBasename = path.basename(aioxDir);

  // Create tar.gz excluding the backups subdirectory
  execSync(
    `tar -czf "${backupPath}" --exclude="${aioxBasename}/backups" -C "${parentDir}" "${aioxBasename}"`,
    { stdio: 'pipe' },
  );

  const stat = fs.statSync(backupPath);
  return { name, path: backupPath, size: stat.size };
}

/**
 * List available backups sorted by date (newest first).
 * @returns {Array<{name: string, path: string, size: number, createdAt: Date}>}
 */
function backupList() {
  const backupDir = BACKUP_DIR();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.tar.gz'));

  return files.map(f => {
    const filePath = path.join(backupDir, f);
    const stat = fs.statSync(filePath);
    return {
      name: f,
      path: filePath,
      size: stat.size,
      createdAt: stat.mtime,
    };
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * List contents of a backup archive.
 * @param {string} backupPath
 * @returns {string[]} file paths in the archive
 */
function backupContents(backupPath) {
  const output = execSync(`tar -tzf "${backupPath}"`, { encoding: 'utf8' });
  return output.trim().split('\n').filter(Boolean);
}

/**
 * Restore from a backup.
 * @param {string} backupName - filename of the backup
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @returns {{files: string[], restored: boolean}}
 */
function backupRestore(backupName, options = {}) {
  const dryRun = options.dryRun || false;
  const backupDir = BACKUP_DIR();
  const backupPath = path.join(backupDir, backupName);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupName}`);
  }

  const files = backupContents(backupPath);

  if (!dryRun) {
    const parentDir = path.dirname(AIOX_DIR());
    execSync(`tar -xzf "${backupPath}" -C "${parentDir}"`, { stdio: 'pipe' });
  }

  return { files, restored: !dryRun };
}

/**
 * Clean old backups, keeping only the N most recent.
 * @param {number} keep - number of backups to keep
 * @returns {{kept: number, removed: string[]}}
 */
function backupClean(keep) {
  const backups = backupList();
  const removed = [];

  if (backups.length <= keep) {
    return { kept: backups.length, removed: [] };
  }

  const toRemove = backups.slice(keep);
  for (const backup of toRemove) {
    fs.unlinkSync(backup.path);
    removed.push(backup.name);
  }

  return { kept: keep, removed };
}

// ── CLI Runner ───────────────────────────────────────────────────────────────

/**
 * Format bytes to human-readable.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Run the backup command.
 * @param {string[]} argv - arguments after "aiox backup"
 */
function runBackup(argv) {
  const sub = argv[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'create': {
      try {
        const result = backupCreate();
        console.log(`Backup created: ${result.name} (${formatBytes(result.size)})`);
      } catch (err) {
        console.error(`Backup failed: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'list': {
      const backups = backupList();
      if (backups.length === 0) {
        console.log('No backups found');
        return;
      }
      console.log('AVAILABLE BACKUPS:');
      for (const b of backups) {
        console.log(`  ${b.name}  ${formatBytes(b.size)}  ${b.createdAt.toISOString()}`);
      }
      console.log(`\nTotal: ${backups.length} backups`);
      break;
    }

    case 'restore': {
      const name = argv[1];
      if (!name) {
        console.error('Usage: aiox backup restore <name> [--dry-run]');
        process.exitCode = 1;
        return;
      }
      const dryRun = argv.includes('--dry-run');
      try {
        const result = backupRestore(name, { dryRun });
        if (dryRun) {
          console.log('[DRY RUN] Would restore:');
          for (const f of result.files) {
            console.log(`  ${f}`);
          }
        } else {
          console.log(`Restored ${result.files.length} files from ${name}`);
        }
      } catch (err) {
        console.error(`Restore failed: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'clean': {
      const keepIdx = argv.indexOf('--keep');
      if (keepIdx === -1 || !argv[keepIdx + 1]) {
        console.error('Usage: aiox backup clean --keep <N>');
        process.exitCode = 1;
        return;
      }
      const keep = parseInt(argv[keepIdx + 1], 10);
      if (isNaN(keep) || keep < 0) {
        console.error('--keep must be a non-negative number');
        process.exitCode = 1;
        return;
      }
      const result = backupClean(keep);
      console.log(`Kept ${result.kept} backups, removed ${result.removed.length}`);
      if (result.removed.length > 0) {
        for (const name of result.removed) {
          console.log(`  Removed: ${name}`);
        }
      }
      break;
    }

    default:
      console.error(`Unknown backup subcommand: ${sub}`);
      console.log(HELP_TEXT);
      process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runBackup,
  backupCreate,
  backupList,
  backupContents,
  backupRestore,
  backupClean,
  generateBackupName,
  formatBytes,
  AIOX_DIR,
  BACKUP_DIR,
};
