/**
 * Tests for Symlink Manager Command Module
 * @story 29.3 — Symlink Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-symlinks-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/symlinks/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/symlinks/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('symlinks command', () => {
  describe('parseArgs', () => {
    it('returns defaults with no args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.subcommand).toBeNull();
      expect(opts.format).toBe('text');
    });

    it('parses list subcommand', () => {
      const opts = mod.parseArgs(['list']);
      expect(opts.subcommand).toBe('list');
    });

    it('parses check subcommand', () => {
      const opts = mod.parseArgs(['check']);
      expect(opts.subcommand).toBe('check');
    });

    it('parses create subcommand with target and link', () => {
      const opts = mod.parseArgs(['create', '/target', '/link']);
      expect(opts.subcommand).toBe('create');
      expect(opts.target).toBe('/target');
      expect(opts.link).toBe('/link');
    });

    it('parses remove subcommand with link', () => {
      const opts = mod.parseArgs(['remove', '/link']);
      expect(opts.subcommand).toBe('remove');
      expect(opts.link).toBe('/link');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['list', '--format', 'json']);
      expect(opts.format).toBe('json');
    });
  });

  describe('findSymlinks', () => {
    it('returns empty for directory with no symlinks', () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'data');
      const result = mod.findSymlinks(tmpDir);
      expect(result).toEqual([]);
    });

    it('finds symlinks in directory', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'link.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, link);
      const result = mod.findSymlinks(tmpDir);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe(link);
      expect(result[0].exists).toBe(true);
    });

    it('finds broken symlinks', () => {
      const link = path.join(tmpDir, 'broken.txt');
      fs.symlinkSync('/nonexistent/path', link);
      const result = mod.findSymlinks(tmpDir);
      expect(result.length).toBe(1);
      expect(result[0].exists).toBe(false);
    });

    it('finds symlinks in subdirectories', () => {
      const sub = path.join(tmpDir, 'sub');
      fs.mkdirSync(sub);
      const target = path.join(sub, 'real.txt');
      const link = path.join(sub, 'link.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, link);
      const result = mod.findSymlinks(tmpDir);
      expect(result.length).toBe(1);
    });

    it('ignores specified directories', () => {
      const ignored = path.join(tmpDir, 'node_modules');
      fs.mkdirSync(ignored);
      const target = path.join(ignored, 'real.txt');
      const link = path.join(ignored, 'link.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, link);
      const result = mod.findSymlinks(tmpDir, ['node_modules']);
      expect(result.length).toBe(0);
    });
  });

  describe('listSymlinks', () => {
    it('returns count and empty list', () => {
      const result = mod.listSymlinks(tmpDir);
      expect(result.count).toBe(0);
      expect(result.symlinks).toEqual([]);
    });

    it('returns found symlinks with count', () => {
      const target = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, path.join(tmpDir, 'link1.txt'));
      fs.symlinkSync(target, path.join(tmpDir, 'link2.txt'));
      const result = mod.listSymlinks(tmpDir);
      expect(result.count).toBe(2);
    });
  });

  describe('checkSymlinks', () => {
    it('returns all valid when all resolve', () => {
      const target = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, path.join(tmpDir, 'link.txt'));
      const result = mod.checkSymlinks(tmpDir);
      expect(result.total).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.broken.length).toBe(0);
    });

    it('finds broken symlinks', () => {
      fs.symlinkSync('/nonexistent', path.join(tmpDir, 'broken.txt'));
      const result = mod.checkSymlinks(tmpDir);
      expect(result.total).toBe(1);
      expect(result.valid).toBe(0);
      expect(result.broken.length).toBe(1);
    });
  });

  describe('createSymlink', () => {
    it('creates a symlink successfully', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'new-link.txt');
      fs.writeFileSync(target, 'data');
      const result = mod.createSymlink(target, link);
      expect(result.success).toBe(true);
      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    });

    it('fails if link path already exists', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'existing.txt');
      fs.writeFileSync(target, 'data');
      fs.writeFileSync(link, 'existing');
      const result = mod.createSymlink(target, link);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('creates parent directories if needed', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'deep', 'nested', 'link.txt');
      fs.writeFileSync(target, 'data');
      const result = mod.createSymlink(target, link);
      expect(result.success).toBe(true);
    });
  });

  describe('removeSymlink', () => {
    it('removes a symlink successfully', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'link.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, link);
      const result = mod.removeSymlink(link);
      expect(result.success).toBe(true);
      expect(fs.existsSync(link)).toBe(false);
    });

    it('fails if path is not a symlink', () => {
      const file = path.join(tmpDir, 'regular.txt');
      fs.writeFileSync(file, 'data');
      const result = mod.removeSymlink(file);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a symlink');
    });

    it('fails if path does not exist', () => {
      const result = mod.removeSymlink(path.join(tmpDir, 'nope.txt'));
      expect(result.success).toBe(false);
    });
  });

  describe('formatSymlinks', () => {
    it('returns message for empty list', () => {
      expect(mod.formatSymlinks([], tmpDir)).toBe('No symlinks found.');
    });

    it('formats symlinks with status', () => {
      const symlinks = [
        { path: path.join(tmpDir, 'link.txt'), target: '/target', exists: true },
        { path: path.join(tmpDir, 'broken.txt'), target: '/missing', exists: false },
      ];
      const output = mod.formatSymlinks(symlinks, tmpDir);
      expect(output).toContain('[OK]');
      expect(output).toContain('[BROKEN]');
    });
  });
});
