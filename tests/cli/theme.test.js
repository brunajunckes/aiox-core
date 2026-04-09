/**
 * Tests for CLI Output Formatter & Themes
 *
 * @module tests/cli/theme
 * @story 13.4 — CLI Output Formatter & Themes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadThemeConfig,
  saveThemeConfig,
  getTheme,
  listThemes,
  setTheme,
  formatThemeDisplay,
  runTheme,
  getHelpText,
  getThemeFile,
  AVAILABLE_THEMES,
  DEFAULT_THEME_NAME,
} = require('../../.aiox-core/cli/commands/theme/index.js');

let tmpDir;
const originalCwd = process.cwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-theme-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

// ── loadThemeConfig ──────────────────────────────────────────────────────────

describe('loadThemeConfig', () => {
  test('returns default when no config exists', () => {
    const config = loadThemeConfig(tmpDir);
    expect(config.active).toBe('default');
  });

  test('loads existing config', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ active: 'minimal' }));
    const config = loadThemeConfig(tmpDir);
    expect(config.active).toBe('minimal');
  });

  test('returns default for corrupt file', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'theme.json'), 'not valid json');
    const config = loadThemeConfig(tmpDir);
    expect(config.active).toBe('default');
  });

  test('returns default for unknown theme in config', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'theme.json'), JSON.stringify({ active: 'nonexistent' }));
    const config = loadThemeConfig(tmpDir);
    expect(config.active).toBe('default');
  });
});

// ── saveThemeConfig ──────────────────────────────────────────────────────────

describe('saveThemeConfig', () => {
  test('saves config to disk', () => {
    const result = saveThemeConfig({ active: 'json' }, tmpDir);
    expect(result).toBe(true);
    const filePath = getThemeFile(tmpDir);
    const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(loaded.active).toBe('json');
  });

  test('creates .aiox directory if needed', () => {
    saveThemeConfig({ active: 'default' }, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
  });
});

// ── getTheme ─────────────────────────────────────────────────────────────────

describe('getTheme', () => {
  test('returns default theme when no config', () => {
    const theme = getTheme(tmpDir);
    expect(theme.name).toBe('default');
    expect(theme.colors).toBe(true);
    expect(theme.tables).toBe(true);
  });

  test('returns configured theme', () => {
    saveThemeConfig({ active: 'json' }, tmpDir);
    const theme = getTheme(tmpDir);
    expect(theme.name).toBe('json');
    expect(theme.format).toBe('json');
    expect(theme.colors).toBe(false);
  });

  test('returns minimal theme properties', () => {
    saveThemeConfig({ active: 'minimal' }, tmpDir);
    const theme = getTheme(tmpDir);
    expect(theme.name).toBe('minimal');
    expect(theme.colors).toBe(false);
    expect(theme.tables).toBe(false);
    expect(theme.verbosity).toBe('quiet');
  });

  test('returns verbose theme properties', () => {
    saveThemeConfig({ active: 'verbose' }, tmpDir);
    const theme = getTheme(tmpDir);
    expect(theme.name).toBe('verbose');
    expect(theme.verbosity).toBe('verbose');
  });
});

// ── listThemes ───────────────────────────────────────────────────────────────

describe('listThemes', () => {
  test('returns all themes', () => {
    const themes = listThemes();
    expect(themes.length).toBe(4);
    const names = themes.map(t => t.name);
    expect(names).toContain('default');
    expect(names).toContain('minimal');
    expect(names).toContain('verbose');
    expect(names).toContain('json');
  });

  test('each theme has name and description', () => {
    const themes = listThemes();
    for (const t of themes) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });
});

// ── setTheme ─────────────────────────────────────────────────────────────────

describe('setTheme', () => {
  test('sets valid theme', () => {
    const result = setTheme('json', tmpDir);
    expect(result.success).toBe(true);
    const config = loadThemeConfig(tmpDir);
    expect(config.active).toBe('json');
  });

  test('rejects unknown theme', () => {
    const result = setTheme('nope', tmpDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown theme');
  });

  test('rejects empty theme name', () => {
    const result = setTheme('', tmpDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  test('rejects null theme name', () => {
    const result = setTheme(null, tmpDir);
    expect(result.success).toBe(false);
  });
});

// ── formatThemeDisplay ───────────────────────────────────────────────────────

describe('formatThemeDisplay', () => {
  test('formats theme for display', () => {
    const output = formatThemeDisplay(AVAILABLE_THEMES.default);
    expect(output).toContain('CURRENT THEME');
    expect(output).toContain('default');
    expect(output).toContain('Colors');
    expect(output).toContain('Verbosity');
  });
});

// ── runTheme ─────────────────────────────────────────────────────────────────

describe('runTheme', () => {
  test('shows current theme with no args', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme([], { baseDir: tmpDir });
    expect(result.action).toBe('show');
    expect(result.theme.name).toBe('default');
    spy.mockRestore();
  });

  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme(['--help'], { baseDir: tmpDir });
    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('lists themes with list subcommand', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme(['list'], { baseDir: tmpDir });
    expect(result.action).toBe('list');
    expect(result.themes.length).toBe(4);
    spy.mockRestore();
  });

  test('sets theme with set subcommand', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme(['set', 'minimal'], { baseDir: tmpDir });
    expect(result.action).toBe('set');
    expect(result.success).toBe(true);
    spy.mockRestore();
  });

  test('errors on set without name', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme(['set'], { baseDir: tmpDir });
    expect(result).toBeNull();
    spy.mockRestore();
    logSpy.mockRestore();
  });

  test('errors on unknown subcommand', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const result = runTheme(['bogus'], { baseDir: tmpDir });
    expect(result).toBeNull();
    spy.mockRestore();
    logSpy.mockRestore();
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const text = getHelpText();
    expect(text).toContain('CLI OUTPUT FORMATTER');
    expect(text).toContain('default');
    expect(text).toContain('minimal');
    expect(text).toContain('verbose');
    expect(text).toContain('json');
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('DEFAULT_THEME_NAME is default', () => {
    expect(DEFAULT_THEME_NAME).toBe('default');
  });

  test('AVAILABLE_THEMES has 4 entries', () => {
    expect(Object.keys(AVAILABLE_THEMES)).toHaveLength(4);
  });
});
