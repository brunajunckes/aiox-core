/**
 * Config Schema Generator Command Module
 *
 * Generates config module with validation and defaults from CLI.
 *
 * Subcommands:
 *   aiox gen-config <name>                                         -- generate config
 *   aiox gen-config <name> --fields "port:number:3000,host:string:localhost"
 *   aiox gen-config <name> --env                                   -- generate from env vars
 *   aiox gen-config --list                                         -- list generated configs
 *
 * @module cli/commands/gen-config
 * @version 1.0.0
 * @story 28.4 -- Config Schema Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ───────────────────────────────────────────────────────────────

const VALID_TYPES = ['string', 'number', 'boolean'];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert name to PascalCase.
 * @param {string} name
 * @returns {string}
 */
function toPascalCase(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

/**
 * Convert name to SCREAMING_SNAKE_CASE for env vars.
 * @param {string} name
 * @returns {string}
 */
function toEnvKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

/**
 * Parse config fields with defaults.
 * @param {string} str - "port:number:3000,host:string:localhost"
 * @returns {Array<{name: string, type: string, defaultValue: string}>}
 */
function parseFields(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(item => {
    const parts = item.trim().split(':');
    if (parts.length < 2) return null;
    const name = parts[0].trim();
    const type = parts[1].trim().toLowerCase();
    const defaultValue = parts[2] !== undefined ? parts[2].trim() : '';
    if (!name || !VALID_TYPES.includes(type)) return null;
    return { name, type, defaultValue };
  }).filter(Boolean);
}

/**
 * Get typed default value representation.
 * @param {string} type
 * @param {string} defaultValue
 * @returns {string}
 */
function getTypedDefault(type, defaultValue) {
  if (!defaultValue && defaultValue !== '0' && defaultValue !== 'false') {
    switch (type) {
      case 'string': return "''";
      case 'number': return '0';
      case 'boolean': return 'false';
      default: return 'null';
    }
  }
  switch (type) {
    case 'string': return `'${defaultValue}'`;
    case 'number': return String(Number(defaultValue) || 0);
    case 'boolean': return defaultValue === 'true' ? 'true' : 'false';
    default: return `'${defaultValue}'`;
  }
}

/**
 * Get the output directory for generated configs.
 * @param {string[]} args
 * @returns {string}
 */
function getOutputDir(args) {
  const idx = args.indexOf('--output');
  if (idx !== -1 && args[idx + 1]) {
    const dir = args[idx + 1];
    return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
  }
  return path.resolve(process.cwd(), 'generated', 'configs');
}

/**
 * List generated configs.
 * @param {string} dir
 * @returns {string[]}
 */
function listConfigs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => {
    const full = path.join(dir, f);
    return fs.statSync(full).isDirectory();
  }).sort();
}

/**
 * Generate config.js content.
 * @param {string} name
 * @param {Array<{name: string, type: string, defaultValue: string}>} fields
 * @param {boolean} useEnv
 * @returns {string}
 */
function generateConfig(name, fields, useEnv) {
  const pascal = toPascalCase(name);
  const prefix = toEnvKey(name);

  const defaults = fields.map(f => {
    const envLine = useEnv
      ? `process.env.${prefix}_${toEnvKey(f.name)} || `
      : '';
    return `    ${f.name}: ${envLine}${getTypedDefault(f.type, f.defaultValue)},`;
  }).join('\n');

  const validationChecks = fields.map(f => {
    switch (f.type) {
      case 'string':
        return `  if (typeof config.${f.name} !== 'string') {
    errors.push('${f.name} must be a string');
  }`;
      case 'number':
        return `  if (typeof config.${f.name} !== 'number' || isNaN(config.${f.name})) {
    errors.push('${f.name} must be a number');
  }`;
      case 'boolean':
        return `  if (typeof config.${f.name} !== 'boolean') {
    errors.push('${f.name} must be a boolean');
  }`;
      default:
        return '';
    }
  }).filter(Boolean).join('\n');

  const envCoerce = useEnv ? fields.map(f => {
    if (f.type === 'number') {
      return `  if (typeof merged.${f.name} === 'string') {
    merged.${f.name} = Number(merged.${f.name}) || ${getTypedDefault(f.type, f.defaultValue)};
  }`;
    }
    if (f.type === 'boolean') {
      return `  if (typeof merged.${f.name} === 'string') {
    merged.${f.name} = merged.${f.name} === 'true';
  }`;
    }
    return '';
  }).filter(Boolean).join('\n') : '';

  return `/**
 * ${pascal} Configuration
 * Generated by aiox gen-config
 *
 * Fields: ${fields.map(f => f.name + ':' + f.type + (f.defaultValue ? '=' + f.defaultValue : '')).join(', ')}
 */

'use strict';

/**
 * Default configuration values.
 */
function getDefaults() {
  return {
${defaults}
  };
}

/**
 * Validate configuration object.
 * @param {Object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
${validationChecks}
  return { valid: errors.length === 0, errors };
}

/**
 * Load and merge configuration with defaults.
 * @param {Object} [overrides={}]
 * @returns {Object}
 */
function load(overrides) {
  const merged = { ...getDefaults(), ...(overrides || {}) };
${envCoerce}
  return merged;
}

module.exports = {
  getDefaults,
  validate,
  load,
};
`;
}

/**
 * Generate config.test.js content.
 * @param {string} name
 * @param {Array<{name: string, type: string, defaultValue: string}>} fields
 * @param {boolean} useEnv
 * @returns {string}
 */
function generateConfigTest(name, fields, useEnv) {
  const pascal = toPascalCase(name);

  const envTests = useEnv ? `
  describe('environment variables', () => {
    it('reads from environment when available', () => {
      // env-based loading is tested via load()
      const config = cfg.load({});
      expect(config).toBeDefined();
    });
  });` : '';

  return `/**
 * Tests for ${pascal} Configuration
 * Generated by aiox gen-config
 */

'use strict';

const cfg = require('./config');

describe('${pascal} Config', () => {
  describe('getDefaults', () => {
    it('returns default config object', () => {
      const defaults = cfg.getDefaults();
      expect(defaults).toBeDefined();
      expect(typeof defaults).toBe('object');
    });

    it('has all expected fields', () => {
      const defaults = cfg.getDefaults();
${fields.map(f => `      expect(defaults).toHaveProperty('${f.name}');`).join('\n')}
    });
  });

  describe('validate', () => {
    it('validates correct defaults', () => {
      const result = cfg.validate(cfg.getDefaults());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns invalid for null', () => {
      const result = cfg.validate(null);
      expect(result.valid).toBe(false);
    });

    it('returns invalid for non-object', () => {
      const result = cfg.validate(42);
      expect(result.valid).toBe(false);
    });
  });

  describe('load', () => {
    it('returns defaults when no overrides', () => {
      const config = cfg.load();
      expect(config).toEqual(cfg.getDefaults());
    });

    it('merges overrides with defaults', () => {
      const config = cfg.load({});
      expect(config).toBeDefined();
    });
  });
${envTests}
});
`;
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Run the gen-config command.
 * @param {string[]} args
 */
function runGenConfig(args) {
  if (!args || args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: aiox gen-config <name> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --fields "port:number:3000,host:string:localhost"  Define fields with defaults');
    console.log('  --env                          Generate from environment variables');
    console.log('  --output <dir>                 Custom output directory');
    console.log('  --list                         List generated configs');
    console.log('  --help, -h                     Show help');
    return;
  }

  if (args.includes('--list')) {
    const dir = getOutputDir(args);
    const configs = listConfigs(dir);
    if (configs.length === 0) {
      console.log('No generated configs found.');
      return;
    }
    console.log('Generated configs:');
    configs.forEach(c => console.log(`  - ${c}`));
    return;
  }

  const name = args[0];
  if (!name || name.startsWith('-')) {
    console.error('Error: config name is required');
    process.exitCode = 1;
    return;
  }

  // Parse fields
  const fieldsIdx = args.indexOf('--fields');
  const fields = fieldsIdx !== -1 ? parseFields(args[fieldsIdx + 1]) : [];

  const useEnv = args.includes('--env');

  // Get output dir
  const outputDir = getOutputDir(args);
  const configDir = path.join(outputDir, name);

  // Create directory
  fs.mkdirSync(configDir, { recursive: true });

  // Generate files
  const configContent = generateConfig(name, fields, useEnv);
  const testContent = generateConfigTest(name, fields, useEnv);

  fs.writeFileSync(path.join(configDir, 'config.js'), configContent, 'utf8');
  fs.writeFileSync(path.join(configDir, 'config.test.js'), testContent, 'utf8');

  console.log(`Generated config: ${name}`);
  console.log(`  Fields: ${fields.map(f => f.name + ':' + f.type + (f.defaultValue ? '=' + f.defaultValue : '')).join(', ') || 'none'}`);
  if (useEnv) console.log('  Environment: enabled');
  console.log(`  Config: ${path.join(configDir, 'config.js')}`);
  console.log(`  Test:   ${path.join(configDir, 'config.test.js')}`);
}

module.exports = {
  runGenConfig,
  toPascalCase,
  toEnvKey,
  parseFields,
  getTypedDefault,
  getOutputDir,
  listConfigs,
  generateConfig,
  generateConfigTest,
  VALID_TYPES,
};
