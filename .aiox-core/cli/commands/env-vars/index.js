/**
 * Environment Variable Manager Command Module
 *
 * Manages .env files: list, check, diff, generate.
 *
 * Subcommands:
 *   aiox env-vars list          — list all env vars from .env files
 *   aiox env-vars check         — validate .env against .env.example
 *   aiox env-vars diff          — diff .env vs .env.example
 *   aiox env-vars generate      — generate .env from .env.example
 *   aiox env-vars --format json — output as JSON
 *
 * @module cli/commands/env-vars
 * @version 1.0.0
 * @story 23.3 — Environment Variable Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Parse a .env file into key-value pairs.
 * Supports comments (#), empty lines, KEY=VALUE, KEY="VALUE", KEY='VALUE'.
 * @param {string} content
 * @returns {Array<{key: string, value: string, line: number}>}
 */
function parseEnvContent(content) {
  if (!content) return [];

  const entries = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      entries.push({ key, value, line: i + 1 });
    }
  }

  return entries;
}

/**
 * Read and parse a .env file.
 * @param {string} filePath
 * @returns {Array<{key: string, value: string, line: number}>}
 */
function readEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseEnvContent(content);
  } catch {
    return [];
  }
}

/**
 * Find all .env files in the project root.
 * @param {string} cwd
 * @returns {string[]}
 */
function findEnvFiles(cwd) {
  try {
    return fs.readdirSync(cwd)
      .filter(name => name === '.env' || name.startsWith('.env.'))
      .map(name => path.join(cwd, name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * List all env vars from all .env files.
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {object}
 */
function listEnvVars(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = findEnvFiles(cwd);
  const result = { files: {} };

  for (const file of files) {
    const name = path.basename(file);
    const entries = readEnvFile(file);
    result.files[name] = entries.map(e => ({ key: e.key, value: e.value, line: e.line }));
  }

  return result;
}

/**
 * Check .env against .env.example — find missing vars.
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ missing: string[], extra: string[], valid: boolean }}
 */
function checkEnvVars(options = {}) {
  const cwd = options.cwd || process.cwd();

  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  const envEntries = readEnvFile(envPath);
  const exampleEntries = readEnvFile(examplePath);

  const envKeys = new Set(envEntries.map(e => e.key));
  const exampleKeys = new Set(exampleEntries.map(e => e.key));

  const missing = [...exampleKeys].filter(k => !envKeys.has(k));
  const extra = [...envKeys].filter(k => !exampleKeys.has(k));

  return {
    missing,
    extra,
    valid: missing.length === 0,
    envExists: fs.existsSync(envPath),
    exampleExists: fs.existsSync(examplePath),
  };
}

/**
 * Diff .env vs .env.example.
 * @param {object} options
 * @param {string} [options.cwd]
 * @returns {{ onlyInEnv: string[], onlyInExample: string[], common: string[], changed: Array<{key: string, envValue: string, exampleValue: string}> }}
 */
function diffEnvVars(options = {}) {
  const cwd = options.cwd || process.cwd();

  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  const envEntries = readEnvFile(envPath);
  const exampleEntries = readEnvFile(examplePath);

  const envMap = {};
  for (const e of envEntries) envMap[e.key] = e.value;
  const exampleMap = {};
  for (const e of exampleEntries) exampleMap[e.key] = e.value;

  const envKeys = new Set(Object.keys(envMap));
  const exampleKeys = new Set(Object.keys(exampleMap));

  const onlyInEnv = [...envKeys].filter(k => !exampleKeys.has(k));
  const onlyInExample = [...exampleKeys].filter(k => !envKeys.has(k));
  const common = [...envKeys].filter(k => exampleKeys.has(k));
  const changed = common
    .filter(k => envMap[k] !== exampleMap[k])
    .map(k => ({ key: k, envValue: envMap[k], exampleValue: exampleMap[k] }));

  return { onlyInEnv, onlyInExample, common, changed };
}

/**
 * Generate .env from .env.example with defaults.
 * @param {object} options
 * @param {string} [options.cwd]
 * @param {boolean} [options.overwrite]
 * @returns {{ generated: boolean, path: string, vars: number, message: string }}
 */
function generateEnv(options = {}) {
  const cwd = options.cwd || process.cwd();

  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  if (!fs.existsSync(examplePath)) {
    return { generated: false, path: envPath, vars: 0, message: '.env.example not found' };
  }

  if (fs.existsSync(envPath) && !options.overwrite) {
    return { generated: false, path: envPath, vars: 0, message: '.env already exists (use --overwrite to replace)' };
  }

  const content = fs.readFileSync(examplePath, 'utf8');
  fs.writeFileSync(envPath, content, 'utf8');

  const entries = parseEnvContent(content);
  return { generated: true, path: envPath, vars: entries.length, message: `.env generated with ${entries.length} variables` };
}

/**
 * Format list results as text.
 * @param {object} result
 * @returns {string}
 */
function formatListText(result) {
  const lines = [];
  lines.push('Environment Variables');
  lines.push('='.repeat(50));

  const fileNames = Object.keys(result.files);
  if (fileNames.length === 0) {
    lines.push('\nNo .env files found.');
    return lines.join('\n');
  }

  for (const name of fileNames) {
    const entries = result.files[name];
    lines.push(`\n${name} (${entries.length} vars):`);
    lines.push('-'.repeat(40));
    for (const e of entries) {
      const maskedValue = e.value.length > 4 ? e.value.slice(0, 2) + '***' : '***';
      lines.push(`  ${e.key}=${maskedValue}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format check results as text.
 * @param {object} result
 * @returns {string}
 */
function formatCheckText(result) {
  const lines = [];
  lines.push('Environment Check');
  lines.push('='.repeat(50));

  if (!result.exampleExists) {
    lines.push('\n.env.example not found. Cannot validate.');
    return lines.join('\n');
  }

  if (!result.envExists) {
    lines.push('\n.env not found. Run `aiox env-vars generate` to create it.');
    return lines.join('\n');
  }

  if (result.valid) {
    lines.push('\nAll required variables are present.');
  } else {
    lines.push(`\nMissing variables (${result.missing.length}):`);
    for (const k of result.missing) {
      lines.push(`  - ${k}`);
    }
  }

  if (result.extra.length > 0) {
    lines.push(`\nExtra variables not in .env.example (${result.extra.length}):`);
    for (const k of result.extra) {
      lines.push(`  + ${k}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format diff results as text.
 * @param {object} result
 * @returns {string}
 */
function formatDiffText(result) {
  const lines = [];
  lines.push('Environment Diff (.env vs .env.example)');
  lines.push('='.repeat(50));

  if (result.onlyInEnv.length > 0) {
    lines.push(`\nOnly in .env (${result.onlyInEnv.length}):`);
    for (const k of result.onlyInEnv) lines.push(`  + ${k}`);
  }

  if (result.onlyInExample.length > 0) {
    lines.push(`\nOnly in .env.example (${result.onlyInExample.length}):`);
    for (const k of result.onlyInExample) lines.push(`  - ${k}`);
  }

  if (result.changed.length > 0) {
    lines.push(`\nChanged values (${result.changed.length}):`);
    for (const c of result.changed) {
      lines.push(`  ~ ${c.key}`);
    }
  }

  if (result.onlyInEnv.length === 0 && result.onlyInExample.length === 0 && result.changed.length === 0) {
    lines.push('\nFiles are identical.');
  }

  return lines.join('\n');
}

/**
 * Parse CLI args and run env-vars subcommand.
 * @param {string[]} argv
 */
function runEnvVars(argv = []) {
  const subcommand = argv[0] || 'list';
  const format = argv.includes('--format') ? argv[argv.indexOf('--format') + 1] : 'text';
  const overwrite = argv.includes('--overwrite');

  if (subcommand === '--help' || subcommand === '-h') {
    console.log('Usage: aiox env-vars <list|check|diff|generate> [--format json] [--overwrite]');
    return;
  }

  const cwd = process.cwd();

  switch (subcommand) {
    case 'list': {
      const result = listEnvVars({ cwd });
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatListText(result));
      }
      break;
    }
    case 'check': {
      const result = checkEnvVars({ cwd });
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCheckText(result));
      }
      break;
    }
    case 'diff': {
      const result = diffEnvVars({ cwd });
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatDiffText(result));
      }
      break;
    }
    case 'generate': {
      const result = generateEnv({ cwd, overwrite });
      if (format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.message);
      }
      break;
    }
    default: {
      console.error(`Unknown subcommand: ${subcommand}`);
      console.log('Usage: aiox env-vars <list|check|diff|generate>');
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runEnvVars,
  parseEnvContent,
  readEnvFile,
  findEnvFiles,
  listEnvVars,
  checkEnvVars,
  diffEnvVars,
  generateEnv,
  formatListText,
  formatCheckText,
  formatDiffText,
};
