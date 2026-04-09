/**
 * Tests for Man Page Generator Command Module
 * @story 19.1 — Man Page Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-man-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/man/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/man/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('man command', () => {
  describe('getRegistry', () => {
    it('returns an array of commands', () => {
      const reg = mod.getRegistry();
      expect(Array.isArray(reg)).toBe(true);
      expect(reg.length).toBeGreaterThan(0);
    });

    it('each command has required fields', () => {
      for (const cmd of mod.getRegistry()) {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('synopsis');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('category');
      }
    });
  });

  describe('getCategories', () => {
    it('returns an object with category labels', () => {
      const cats = mod.getCategories();
      expect(typeof cats).toBe('object');
      expect(cats).toHaveProperty('core');
      expect(cats).toHaveProperty('dev');
    });
  });

  describe('findCommand', () => {
    it('finds existing command', () => {
      const cmd = mod.findCommand('config');
      expect(cmd).not.toBeNull();
      expect(cmd.name).toBe('config');
    });

    it('returns null for nonexistent command', () => {
      expect(mod.findCommand('nonexistent-xyz')).toBeNull();
    });

    it('returns null for empty/null input', () => {
      expect(mod.findCommand(null)).toBeNull();
      expect(mod.findCommand('')).toBeNull();
      expect(mod.findCommand(undefined)).toBeNull();
    });
  });

  describe('formatManPage', () => {
    it('formats a command man page', () => {
      const cmd = mod.findCommand('config');
      const page = mod.formatManPage(cmd);
      expect(page).toContain('AIOX-CONFIG(1)');
      expect(page).toContain('NAME');
      expect(page).toContain('SYNOPSIS');
      expect(page).toContain('DESCRIPTION');
    });

    it('includes options when present', () => {
      const cmd = mod.findCommand('doctor');
      const page = mod.formatManPage(cmd);
      expect(page).toContain('OPTIONS');
    });

    it('includes examples when present', () => {
      const cmd = mod.findCommand('install');
      const page = mod.formatManPage(cmd);
      expect(page).toContain('EXAMPLES');
      expect(page).toContain('$ aiox install');
    });

    it('includes category', () => {
      const cmd = mod.findCommand('config');
      const page = mod.formatManPage(cmd);
      expect(page).toContain('CATEGORY');
    });

    it('returns empty string for null input', () => {
      expect(mod.formatManPage(null)).toBe('');
      expect(mod.formatManPage({})).toBe('');
    });
  });

  describe('formatOverview', () => {
    it('returns overview with all sections', () => {
      const overview = mod.formatOverview();
      expect(overview).toContain('AIOX(1)');
      expect(overview).toContain('DESCRIPTION');
      expect(overview).toContain('SEE ALSO');
    });

    it('groups commands by category', () => {
      const overview = mod.formatOverview();
      expect(overview).toContain('CORE COMMANDS');
    });
  });

  describe('listManPages', () => {
    it('lists all commands', () => {
      const list = mod.listManPages();
      expect(list).toContain('Available man pages');
      expect(list).toContain('config');
      expect(list).toContain('Total:');
    });
  });

  describe('generateManPages', () => {
    it('generates man page files', () => {
      const result = mod.generateManPages({ baseDir: tmpDir });
      expect(result.count).toBeGreaterThan(1);
      expect(result.files).toContain('aiox.1');
      expect(result.files).toContain('aiox-config.1');

      const manDir = path.join(tmpDir, '.aiox', 'man');
      expect(fs.existsSync(manDir)).toBe(true);
      expect(fs.existsSync(path.join(manDir, 'aiox.1'))).toBe(true);
    });

    it('creates directory if missing', () => {
      const manDir = path.join(tmpDir, '.aiox', 'man');
      expect(fs.existsSync(manDir)).toBe(false);
      mod.generateManPages({ baseDir: tmpDir });
      expect(fs.existsSync(manDir)).toBe(true);
    });

    it('overview file contains command listing', () => {
      mod.generateManPages({ baseDir: tmpDir });
      const content = fs.readFileSync(path.join(tmpDir, '.aiox', 'man', 'aiox.1'), 'utf8');
      expect(content).toContain('AIOX(1)');
    });
  });

  describe('runMan', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMan(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      spy.mockRestore();
    });

    it('shows overview with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMan([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('AIOX(1)'));
      spy.mockRestore();
    });

    it('shows specific command man page', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMan(['install']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('AIOX-INSTALL(1)'));
      spy.mockRestore();
    });

    it('shows error for unknown command', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runMan(['nonexistent-xyz']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No man page found'));
      spy.mockRestore();
    });

    it('lists pages with --list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMan(['--list']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Available man pages'));
      spy.mockRestore();
    });

    it('generates pages with --generate', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMan(['--generate']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Generated'));
      const manDir = path.join(tmpDir, '.aiox', 'man');
      expect(fs.existsSync(manDir)).toBe(true);
      spy.mockRestore();
    });
  });
});
