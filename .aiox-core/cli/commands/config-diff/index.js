/**
 * Config Diff & Migration Tool Command Module
 *
 * Shows differences between current config and defaults,
 * and migrates old config formats to current schema.
 *
 * Subcommands:
 *   aiox config-diff                    — Show diff between current and defaults
 *   aiox config-diff --format json      — Output diff as JSON
 *   aiox config-diff migrate            — Migrate old config to current schema
 *   aiox config-diff migrate --dry-run  — Preview migration without writing
 *   aiox config-diff --help             — Show help
 *
 * @module cli/commands/config-diff
 * @version 1.0.0
 * @story 10.3 — Config Diff & Migration Tool
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const CONFIG_FILE = 'core-config.yaml';
const DEFAULT_CONFIG_FILE = 'core-config.defaults.yaml';

/**
 * Default configuration values used when no defaults file exists.
 */
const BUILTIN_DEFAULTS = {
  project: { name: '', version: '1.0.0' },
  boundary: { frameworkProtection: true },
  agents: { enabled: true, defaultMode: 'interactive' },
  coderabbit_integration: { enabled: false },
  telemetry: { enabled: false },
  debug: false,
};

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Simple YAML-like key-value parser for flat/shallow configs.
 * Handles: key: value lines, ignoring comments and blank lines.
 * Returns a flat object of key -> value.
 * @param {string} content - YAML-like content
 * @returns {Object}
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  const stack = [{ obj: result, indent: -1 }];

  for (const line of lines) {
    // Skip empty/comment lines
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const match = line.match(/^(\s*)([^:\s]+)\s*:\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    let value = match[3].trim();

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (value === '' || value === undefined) {
      // Nested object
      parent[key] = {};
      stack.push({ obj: parent[key], indent });
    } else {
      // Parse value
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
      else if ((value.startsWith("'") && value.endsWith("'")) ||
               (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      parent[key] = value;
    }
  }

  return result;
}

/**
 * Flatten a nested object into dot-notation keys.
 * @param {Object} obj
 * @param {string} [prefix='']
 * @returns {Object} - Flat map of dotted-key -> value
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], fullKey));
    } else {
      result[fullKey] = obj[key];
    }
  }
  return result;
}

/**
 * Load config file, trying js-yaml first, fallback to simple parser.
 * @param {string} filePath
 * @returns {Object|null}
 */
function loadConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const yaml = require('js-yaml');
      return yaml.load(content) || {};
    } catch {
      return parseSimpleYaml(content);
    }
  } catch {
    return null;
  }
}

/**
 * Compute diff between current config and defaults.
 * @param {Object} current - Current config (flat)
 * @param {Object} defaults - Default config (flat)
 * @returns {Array<{key: string, status: string, current: *, default: *}>}
 */
function computeDiff(current, defaults) {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(defaults)]);
  const diffs = [];

  for (const key of [...allKeys].sort()) {
    const inCurrent = key in current;
    const inDefaults = key in defaults;

    if (inCurrent && inDefaults) {
      if (current[key] !== defaults[key]) {
        diffs.push({ key, status: 'modified', current: current[key], default: defaults[key] });
      }
    } else if (inCurrent && !inDefaults) {
      diffs.push({ key, status: 'added', current: current[key], default: undefined });
    } else {
      diffs.push({ key, status: 'removed', current: undefined, default: defaults[key] });
    }
  }

  return diffs;
}

/**
 * Format diff as text.
 * @param {Array} diffs
 * @returns {string}
 */
function formatDiffText(diffs) {
  if (diffs.length === 0) return 'No differences found. Config matches defaults.';

  const lines = [];
  lines.push('Config Differences:');
  lines.push('');

  for (const d of diffs) {
    const symbol = d.status === 'added' ? '+' : d.status === 'removed' ? '-' : '~';
    if (d.status === 'modified') {
      lines.push(`  ${symbol} ${d.key}: ${JSON.stringify(d.current)} (default: ${JSON.stringify(d.default)})`);
    } else if (d.status === 'added') {
      lines.push(`  ${symbol} ${d.key}: ${JSON.stringify(d.current)} (not in defaults)`);
    } else {
      lines.push(`  ${symbol} ${d.key}: missing (default: ${JSON.stringify(d.default)})`);
    }
  }

  const added = diffs.filter(d => d.status === 'added').length;
  const removed = diffs.filter(d => d.status === 'removed').length;
  const modified = diffs.filter(d => d.status === 'modified').length;
  lines.push('');
  lines.push(`Summary: ${modified} modified, ${added} added, ${removed} removed`);

  return lines.join('\n');
}

/**
 * Format diff as JSON.
 * @param {Array} diffs
 * @returns {string}
 */
function formatDiffJSON(diffs) {
  return JSON.stringify({ diffs, total: diffs.length }, null, 2);
}

// ── Migration ──────────────────────────────────────────────────────────────────

/**
 * Known migration rules from old config keys to new ones.
 */
const MIGRATION_RULES = [
  { old: 'frameworkProtection', new: 'boundary.frameworkProtection' },
  { old: 'enableAgents', new: 'agents.enabled' },
  { old: 'defaultAgentMode', new: 'agents.defaultMode' },
  { old: 'coderabbit', new: 'coderabbit_integration.enabled' },
  { old: 'enableTelemetry', new: 'telemetry.enabled' },
  { old: 'debugMode', new: 'debug' },
];

/**
 * Apply migration rules to a config object.
 * @param {Object} config - Flat config object
 * @returns {{migrated: Object, changes: Array<{from: string, to: string, value: *}>}}
 */
function migrateConfig(config) {
  const migrated = { ...config };
  const changes = [];

  for (const rule of MIGRATION_RULES) {
    if (rule.old in migrated) {
      const value = migrated[rule.old];
      migrated[rule.new] = value;
      delete migrated[rule.old];
      changes.push({ from: rule.old, to: rule.new, value });
    }
  }

  return { migrated, changes };
}

/**
 * Unflatten a dot-notation object back to nested.
 * @param {Object} flat
 * @returns {Object}
 */
function unflattenObject(flat) {
  const result = {};
  for (const key of Object.keys(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = flat[key];
  }
  return result;
}

/**
 * Serialize object as simple YAML.
 * @param {Object} obj
 * @param {number} [indent=0]
 * @returns {string}
 */
function serializeYaml(obj, indent = 0) {
  const lines = [];
  const prefix = ' '.repeat(indent);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${prefix}${key}:`);
      lines.push(serializeYaml(val, indent + 2));
    } else {
      lines.push(`${prefix}${key}: ${JSON.stringify(val)}`);
    }
  }
  return lines.join('\n');
}

// ── CLI Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the config-diff command.
 * @param {string[]} argv - CLI arguments (after command name)
 * @param {object} [options]
 * @param {string} [options.configFile] - Custom config file path
 * @param {string} [options.defaultsFile] - Custom defaults file path
 */
function runConfigDiff(argv = [], options = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Usage: aiox config-diff [subcommand] [options]

Show config differences or migrate old formats.

Subcommands:
  (none)              Show diff between current config and defaults
  migrate             Migrate old config keys to current schema

Options:
  --format json       Output diff as JSON
  --dry-run           Preview migration without writing
  --help, -h          Show this help message
`);
    return;
  }

  const cwd = process.cwd();
  const configPath = options.configFile || path.join(cwd, CONFIG_FILE);
  const defaultsPath = options.defaultsFile || path.join(cwd, DEFAULT_CONFIG_FILE);

  // Subcommand: migrate
  if (argv[0] === 'migrate') {
    const isDryRun = argv.includes('--dry-run');

    const currentConfig = loadConfig(configPath);
    if (!currentConfig) {
      console.log(`No config file found at ${configPath}`);
      return;
    }

    const flat = flattenObject(currentConfig);
    const { migrated, changes } = migrateConfig(flat);

    if (changes.length === 0) {
      console.log('No migrations needed. Config is up to date.');
      return;
    }

    console.log('Migration changes:');
    for (const c of changes) {
      console.log(`  ${c.from} -> ${c.to} (value: ${JSON.stringify(c.value)})`);
    }

    if (isDryRun) {
      console.log('\n(dry-run) No files were modified.');
      return;
    }

    // Write migrated config
    const nested = unflattenObject(migrated);
    try {
      const yaml = require('js-yaml');
      fs.writeFileSync(configPath, yaml.dump(nested, { lineWidth: 120, noRefs: true }), 'utf8');
    } catch {
      fs.writeFileSync(configPath, serializeYaml(nested) + '\n', 'utf8');
    }
    console.log(`\nConfig migrated and saved to ${configPath}`);
    return;
  }

  // Default: show diff
  const currentConfig = loadConfig(configPath);
  if (!currentConfig) {
    console.log(`No config file found at ${configPath}`);
    return;
  }

  let defaultConfig = loadConfig(defaultsPath);
  if (!defaultConfig) {
    defaultConfig = BUILTIN_DEFAULTS;
  }

  const currentFlat = flattenObject(currentConfig);
  const defaultFlat = flattenObject(defaultConfig);
  const diffs = computeDiff(currentFlat, defaultFlat);

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 && argv[formatIdx + 1] ? argv[formatIdx + 1] : 'text';

  if (format === 'json') {
    console.log(formatDiffJSON(diffs));
  } else {
    console.log(formatDiffText(diffs));
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runConfigDiff,
  parseSimpleYaml,
  flattenObject,
  unflattenObject,
  loadConfig,
  computeDiff,
  formatDiffText,
  formatDiffJSON,
  migrateConfig,
  serializeYaml,
  BUILTIN_DEFAULTS,
  MIGRATION_RULES,
  CONFIG_FILE,
  DEFAULT_CONFIG_FILE,
};
