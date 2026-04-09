/**
 * CLI Output Formatter & Themes
 *
 * Manage output themes that control formatting, color, and verbosity.
 *
 * Usage:
 *   aiox theme              — show current theme
 *   aiox theme list         — show available themes
 *   aiox theme set <name>   — set active theme
 *   aiox theme --help       — show help
 *
 * @module cli/commands/theme
 * @version 1.0.0
 * @story 13.4 — CLI Output Formatter & Themes
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
CLI OUTPUT FORMATTER & THEMES

USAGE:
  aiox theme              Show current theme
  aiox theme list         List available themes
  aiox theme set <name>   Set active theme
  aiox theme --help       Show this help

THEMES:
  default    — Standard output with colors and tables
  minimal    — Compact output, less decoration
  verbose    — Detailed output with extra info
  json       — JSON output for all commands

Config stored in: .aiox/theme.json
`.trim();

const AVAILABLE_THEMES = {
  default: {
    name: 'default',
    description: 'Standard output with colors and tables',
    colors: true,
    tables: true,
    verbosity: 'normal',
    format: 'text',
  },
  minimal: {
    name: 'minimal',
    description: 'Compact output, less decoration',
    colors: false,
    tables: false,
    verbosity: 'quiet',
    format: 'text',
  },
  verbose: {
    name: 'verbose',
    description: 'Detailed output with extra info',
    colors: true,
    tables: true,
    verbosity: 'verbose',
    format: 'text',
  },
  json: {
    name: 'json',
    description: 'JSON output for all commands',
    colors: false,
    tables: false,
    verbosity: 'normal',
    format: 'json',
  },
};

const DEFAULT_THEME_NAME = 'default';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the theme directory path.
 * @param {string} [baseDir]
 * @returns {string}
 */
function getThemeDir(baseDir) {
  return path.join(baseDir || process.cwd(), '.aiox');
}

/**
 * Get the theme file path.
 * @param {string} [baseDir]
 * @returns {string}
 */
function getThemeFile(baseDir) {
  return path.join(getThemeDir(baseDir), 'theme.json');
}

/**
 * Load theme config from disk.
 * @param {string} [baseDir]
 * @returns {{ active: string }}
 */
function loadThemeConfig(baseDir) {
  const filePath = getThemeFile(baseDir);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(raw);
      if (config && config.active && AVAILABLE_THEMES[config.active]) {
        return config;
      }
    }
  } catch (_e) {
    // Corrupt file, fall through
  }
  return { active: DEFAULT_THEME_NAME };
}

/**
 * Save theme config to disk.
 * @param {{ active: string }} config
 * @param {string} [baseDir]
 * @returns {boolean}
 */
function saveThemeConfig(config, baseDir) {
  const dir = getThemeDir(baseDir);
  const filePath = getThemeFile(baseDir);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Get the current active theme object.
 * Utility function other commands can import.
 * @param {string} [baseDir]
 * @returns {object}
 */
function getTheme(baseDir) {
  const config = loadThemeConfig(baseDir);
  return AVAILABLE_THEMES[config.active] || AVAILABLE_THEMES[DEFAULT_THEME_NAME];
}

/**
 * List all available themes.
 * @returns {Array<{ name: string, description: string }>}
 */
function listThemes() {
  return Object.values(AVAILABLE_THEMES).map(t => ({ name: t.name, description: t.description }));
}

/**
 * Set the active theme.
 * @param {string} themeName
 * @param {string} [baseDir]
 * @returns {{ success: boolean, error?: string }}
 */
function setTheme(themeName, baseDir) {
  if (!themeName || typeof themeName !== 'string') {
    return { success: false, error: 'Theme name is required' };
  }
  if (!AVAILABLE_THEMES[themeName]) {
    const available = Object.keys(AVAILABLE_THEMES).join(', ');
    return { success: false, error: `Unknown theme: "${themeName}". Available: ${available}` };
  }
  const saved = saveThemeConfig({ active: themeName }, baseDir);
  if (!saved) {
    return { success: false, error: 'Failed to save theme configuration' };
  }
  return { success: true };
}

/**
 * Format theme display for current theme.
 * @param {object} theme
 * @returns {string}
 */
function formatThemeDisplay(theme) {
  const lines = [];
  lines.push('');
  lines.push('CURRENT THEME');
  lines.push('─'.repeat(40));
  lines.push(`  Name:        ${theme.name}`);
  lines.push(`  Description: ${theme.description}`);
  lines.push(`  Colors:      ${theme.colors}`);
  lines.push(`  Tables:      ${theme.tables}`);
  lines.push(`  Verbosity:   ${theme.verbosity}`);
  lines.push(`  Format:      ${theme.format}`);
  lines.push('─'.repeat(40));
  lines.push('');
  return lines.join('\n');
}

// ── CLI Entry ────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * @param {string[]} args
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @returns {object|null}
 */
function runTheme(args, options = {}) {
  const baseDir = options.baseDir;

  if (args && args.includes('--help')) {
    console.log(HELP_TEXT);
    return null;
  }

  if (!args || args.length === 0) {
    // Show current theme
    const theme = getTheme(baseDir);
    console.log(formatThemeDisplay(theme));
    return { action: 'show', theme };
  }

  const subcommand = args[0];

  if (subcommand === 'list') {
    const themes = listThemes();
    const config = loadThemeConfig(baseDir);
    console.log('\nAvailable Themes:\n');
    for (const t of themes) {
      const marker = t.name === config.active ? ' (active)' : '';
      console.log(`  ${t.name.padEnd(12)} ${t.description}${marker}`);
    }
    console.log('');
    return { action: 'list', themes, active: config.active };
  }

  if (subcommand === 'set') {
    const themeName = args[1];
    if (!themeName) {
      console.error('Error: Theme name is required.');
      console.log('Usage: aiox theme set <name>');
      console.log(`Available: ${Object.keys(AVAILABLE_THEMES).join(', ')}`);
      return null;
    }

    const result = setTheme(themeName, baseDir);
    if (result.success) {
      const theme = getTheme(baseDir);
      console.log(`\n✓ Theme set to "${themeName}"`);
      console.log(formatThemeDisplay(theme));
    } else {
      console.error(`\n✗ ${result.error}`);
      process.exitCode = 1;
    }
    return { action: 'set', ...result };
  }

  console.error(`Unknown theme subcommand: ${subcommand}`);
  console.log('Run "aiox theme --help" for usage.');
  return null;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return HELP_TEXT;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  loadThemeConfig,
  saveThemeConfig,
  getTheme,
  listThemes,
  setTheme,
  formatThemeDisplay,
  runTheme,
  getHelpText,
  getThemeFile,
  getThemeDir,
  AVAILABLE_THEMES,
  DEFAULT_THEME_NAME,
};
