/**
 * Tests for CLI Backup & Restore Command
 * @story 17.4 — Backup & Restore
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let backupModule;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-backup-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/backup/index.js');
  delete require.cache[modulePath];
  backupModule = require('../../.aiox-core/cli/commands/backup/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Helper: create a .aiox/ directory with some content */
function createAioxDir() {
  const aioxDir = path.join(tmpDir, '.aiox');
  fs.mkdirSync(aioxDir, { recursive: true });
  fs.writeFileSync(path.join(aioxDir, 'kv-store.json'), '{"test":"data"}', 'utf8');
  fs.writeFileSync(path.join(aioxDir, 'config.yaml'), 'key: value\n', 'utf8');
  return aioxDir;
}

describe('backup command', () => {
  describe('generateBackupName', () => {
    it('generates a name with backup- prefix', () => {
      const name = backupModule.generateBackupName();
      expect(name).toMatch(/^backup-.*\.tar\.gz$/);
    });

    it('includes ISO-like timestamp', () => {
      const name = backupModule.generateBackupName();
      // Should contain date pattern like 2026-04-08
      expect(name).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('backupCreate', () => {
    it('creates a tar.gz backup file', () => {
      createAioxDir();
      const result = backupModule.backupCreate();
      expect(result.name).toMatch(/^backup-.*\.tar\.gz$/);
      expect(fs.existsSync(result.path)).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('creates backups/ directory if missing', () => {
      createAioxDir();
      backupModule.backupCreate();
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'backups'))).toBe(true);
    });

    it('throws when .aiox/ does not exist', () => {
      expect(() => backupModule.backupCreate()).toThrow('.aiox/ directory not found');
    });

    it('excludes backups/ directory from archive', () => {
      createAioxDir();
      // Create first backup, then create second
      backupModule.backupCreate();
      const result2 = backupModule.backupCreate();
      const contents = backupModule.backupContents(result2.path);
      // Should not contain any backups/ path
      const hasBackups = contents.some(f => f.includes('backups'));
      expect(hasBackups).toBe(false);
    });
  });

  describe('backupList', () => {
    it('returns empty array when no backups', () => {
      expect(backupModule.backupList()).toEqual([]);
    });

    it('lists backups sorted newest first', () => {
      createAioxDir();
      backupModule.backupCreate();
      // Small delay to ensure different timestamps on filesystem
      const backupDir = path.join(tmpDir, '.aiox', 'backups');
      fs.writeFileSync(
        path.join(backupDir, 'backup-2020-01-01T00-00-00-000Z.tar.gz'),
        'fake',
        'utf8',
      );
      const list = backupModule.backupList();
      expect(list.length).toBeGreaterThanOrEqual(2);
      // First should be the real one (newer mtime)
      expect(list[0].createdAt.getTime()).toBeGreaterThanOrEqual(list[1].createdAt.getTime());
    });

    it('only includes backup-*.tar.gz files', () => {
      createAioxDir();
      const backupDir = path.join(tmpDir, '.aiox', 'backups');
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, 'notes.txt'), 'hi', 'utf8');
      fs.writeFileSync(path.join(backupDir, 'backup-test.tar.gz'), 'fake', 'utf8');
      const list = backupModule.backupList();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('backup-test.tar.gz');
    });
  });

  describe('backupRestore', () => {
    it('restores files from backup', () => {
      createAioxDir();
      const created = backupModule.backupCreate();
      // Delete a file
      fs.unlinkSync(path.join(tmpDir, '.aiox', 'kv-store.json'));
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'kv-store.json'))).toBe(false);

      const result = backupModule.backupRestore(created.name);
      expect(result.restored).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'kv-store.json'))).toBe(true);
    });

    it('dry run lists files without restoring', () => {
      createAioxDir();
      const created = backupModule.backupCreate();
      fs.unlinkSync(path.join(tmpDir, '.aiox', 'config.yaml'));

      const result = backupModule.backupRestore(created.name, { dryRun: true });
      expect(result.restored).toBe(false);
      expect(result.files.length).toBeGreaterThan(0);
      // File should still be missing
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'config.yaml'))).toBe(false);
    });

    it('throws for non-existent backup', () => {
      createAioxDir();
      fs.mkdirSync(path.join(tmpDir, '.aiox', 'backups'), { recursive: true });
      expect(() => backupModule.backupRestore('nonexistent.tar.gz')).toThrow('Backup not found');
    });
  });

  describe('backupClean', () => {
    it('removes oldest backups exceeding keep count', () => {
      createAioxDir();
      backupModule.backupCreate();
      backupModule.backupCreate();
      backupModule.backupCreate();

      const result = backupModule.backupClean(1);
      expect(result.kept).toBe(1);
      expect(result.removed).toHaveLength(2);
      expect(backupModule.backupList()).toHaveLength(1);
    });

    it('keeps all when count <= keep', () => {
      createAioxDir();
      backupModule.backupCreate();
      const result = backupModule.backupClean(5);
      expect(result.kept).toBe(1);
      expect(result.removed).toHaveLength(0);
    });

    it('handles empty backup directory', () => {
      const result = backupModule.backupClean(3);
      expect(result.kept).toBe(0);
      expect(result.removed).toHaveLength(0);
    });
  });

  describe('formatBytes', () => {
    it('formats zero', () => {
      expect(backupModule.formatBytes(0)).toBe('0 B');
    });

    it('formats KB', () => {
      expect(backupModule.formatBytes(2048)).toBe('2.0 KB');
    });
  });

  describe('runBackup', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      backupModule.runBackup([]);
      expect(spy.mock.calls[0][0]).toContain('BACKUP & RESTORE');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      backupModule.runBackup(['--help']);
      expect(spy.mock.calls[0][0]).toContain('BACKUP & RESTORE');
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
      backupModule.runBackup(['unknown']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown backup subcommand'));
      spy.mockRestore();
    });
  });
});
