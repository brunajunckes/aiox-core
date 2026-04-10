/**
 * i18n Command Module
 *
 * Internationalization support for AIOX CLI.
 *
 * Subcommands:
 *   aiox i18n             — Show current language configuration
 *   aiox i18n set <lang>  — Set language (en, pt-br, es)
 *   aiox i18n list        — List available languages
 *   aiox i18n export      — Export current translations as JSON
 *
 * @module cli/commands/i18n
 * @version 1.0.0
 * @story 34.4 - i18n Support (PT-BR Priority)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en', 'pt-br', 'es'];

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getI18nDir() {
  return path.join(process.cwd(), '.aiox-core', 'data', 'i18n');
}

function getConfigFile() {
  return path.join(getAioxDir(), 'config.json');
}

function getTranslationFile(lang) {
  return path.join(getI18nDir(), `${lang}.json`);
}

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Read current language from config.
 * @returns {string}
 */
function getCurrentLang() {
  try {
    const configPath = getConfigFile();
    if (!fs.existsSync(configPath)) return DEFAULT_LANG;
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (config.language && typeof config.language === 'string') {
      return config.language;
    }
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * Set language in config file.
 * @param {string} lang
 * @returns {{ success: boolean, error?: string }}
 */
function setLang(lang) {
  if (!lang || typeof lang !== 'string') {
    return { success: false, error: 'Language code is required' };
  }

  const normalized = lang.toLowerCase();
  if (!SUPPORTED_LANGS.includes(normalized)) {
    return {
      success: false,
      error: `Unsupported language: ${lang}. Available: ${SUPPORTED_LANGS.join(', ')}`,
    };
  }

  try {
    const dir = getAioxDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const configPath = getConfigFile();
    let config = {};

    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch {
      config = {};
    }

    config.language = normalized;
    config.languageSetAt = new Date().toISOString();

    const tmpPath = `${configPath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpPath, configPath);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to set language: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

// ── Translation Loading ───────────────────────────────────────────────────────

/**
 * Load translations for a given language.
 * Falls back to English if the language file is missing.
 * @param {string} lang
 * @returns {object}
 */
function loadTranslations(lang) {
  const filePath = getTranslationFile(lang);

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // fall through to fallback
  }

  // Fallback to English
  if (lang !== DEFAULT_LANG) {
    const fallbackPath = getTranslationFile(DEFAULT_LANG);
    try {
      if (fs.existsSync(fallbackPath)) {
        return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      }
    } catch {
      // no fallback available
    }
  }

  return {};
}

/**
 * Get a translated string by key.
 * Supports dot notation (e.g. 'commands.help.title').
 * @param {string} key
 * @param {string} [lang]
 * @returns {string}
 */
function t(key, lang) {
  const currentLang = lang || getCurrentLang();
  const translations = loadTranslations(currentLang);

  const parts = key.split('.');
  let value = translations;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return key; // Return key itself as fallback
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * List available languages with their translation file stats.
 * @returns {Array<{ code: string, name: string, keys: number, available: boolean }>}
 */
function listLanguages() {
  const langNames = {
    'en': 'English',
    'pt-br': 'Portuguese (Brazil)',
    'es': 'Spanish',
  };

  return SUPPORTED_LANGS.map(code => {
    const filePath = getTranslationFile(code);
    let keys = 0;
    let available = false;

    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        keys = countKeys(data);
        available = true;
      }
    } catch {
      // not available
    }

    return {
      code,
      name: langNames[code] || code,
      keys,
      available,
    };
  });
}

/**
 * Count total keys in a nested object (leaf keys only).
 * @param {object} obj
 * @returns {number}
 */
function countKeys(obj) {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Export current translations as a flat object.
 * @param {string} [lang]
 * @returns {object}
 */
function exportTranslations(lang) {
  const currentLang = lang || getCurrentLang();
  const translations = loadTranslations(currentLang);

  return {
    language: currentLang,
    translations,
    exportedAt: new Date().toISOString(),
    keyCount: countKeys(translations),
  };
}

// ── CLI Runner ────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
  Usage: aiox i18n [command] [args]

  Commands:
    (none)          Show current language configuration
    set <lang>      Set language (en, pt-br, es)
    list            List available languages
    export          Export current translations as JSON
    help            Show this help message

  Translation files: .aiox-core/data/i18n/{lang}.json
`);
}

/**
 * Main CLI entry point.
 * @param {string[]} args
 */
function runI18n(args) {
  const subcommand = args[0] || '';

  switch (subcommand) {
    case '': {
      const currentLang = getCurrentLang();
      const langs = listLanguages();
      const current = langs.find(l => l.code === currentLang);

      console.log('');
      console.log('  i18n Configuration');
      console.log('  ==================');
      console.log('');
      console.log(`  Current Language: ${currentLang} (${current ? current.name : 'unknown'})`);
      console.log(`  Translation Keys: ${current ? current.keys : 0}`);
      console.log(`  Default Language: ${DEFAULT_LANG}`);
      console.log('');
      break;
    }

    case 'set': {
      const lang = args[1];
      if (!lang) {
        console.error('Usage: aiox i18n set <lang>');
        console.log(`Available: ${SUPPORTED_LANGS.join(', ')}`);
        return;
      }
      const result = setLang(lang);
      if (result.success) {
        console.log(`Language set to: ${lang.toLowerCase()}`);
      } else {
        console.error(result.error);
      }
      break;
    }

    case 'list': {
      const langs = listLanguages();
      const currentLang = getCurrentLang();

      console.log('');
      console.log('  Available Languages');
      console.log('  ===================');
      console.log('');

      for (const lang of langs) {
        const marker = lang.code === currentLang ? ' (active)' : '';
        const status = lang.available ? `${lang.keys} keys` : 'not available';
        console.log(`  ${lang.code.padEnd(8)} ${lang.name.padEnd(25)} ${status}${marker}`);
      }

      console.log('');
      break;
    }

    case 'export': {
      const data = exportTranslations();
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'help':
    case '--help':
      showHelp();
      break;

    default:
      showHelp();
      break;
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  getAioxDir,
  getI18nDir,
  getConfigFile,
  getTranslationFile,
  getCurrentLang,
  setLang,
  loadTranslations,
  t,
  listLanguages,
  countKeys,
  exportTranslations,
  runI18n,
};
