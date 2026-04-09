/**
 * Key-Value Store
 *
 * Subcommands:
 *   aiox kv get <key>          — get value
 *   aiox kv set <key> <value>  — set value
 *   aiox kv delete <key>       — delete key
 *   aiox kv list               — list all keys
 *   aiox kv clear              — clear all
 *   aiox kv export             — export as JSON
 *   aiox kv import <file>      — import from JSON file
 *
 * @module cli/commands/kv
 * @version 1.0.0
 * @story 17.1 — Key-Value Store
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const KV_FILE = () => path.join(process.cwd(), '.aiox', 'kv-store.json');

const HELP_TEXT = `
KEY-VALUE STORE

USAGE:
  aiox kv get <key>          Get value by key
  aiox kv set <key> <value>  Set key-value pair
  aiox kv delete <key>       Delete a key
  aiox kv list               List all key-value pairs
  aiox kv clear              Clear all stored data
  aiox kv export             Export store as JSON to stdout
  aiox kv import <file>      Import key-value pairs from JSON file
  aiox kv --help             Show this help

EXAMPLES:
  aiox kv set name "AIOX"
  aiox kv get name
  aiox kv list
  aiox kv export > backup.json
  aiox kv import backup.json
`.trim();

// ── Store Operations ─────────────────────────────────────────────────────────

/**
 * Load the KV store from disk.
 * @returns {Object} key-value pairs
 */
function loadStore() {
  const filePath = KV_FILE();
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save the KV store to disk.
 * @param {Object} store
 */
function saveStore(store) {
  const filePath = KV_FILE();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Get a value by key.
 * @param {string} key
 * @returns {*} value or undefined
 */
function kvGet(key) {
  const store = loadStore();
  return store[key];
}

/**
 * Set a key-value pair.
 * @param {string} key
 * @param {*} value
 */
function kvSet(key, value) {
  const store = loadStore();
  store[key] = value;
  saveStore(store);
}

/**
 * Delete a key.
 * @param {string} key
 * @returns {boolean} true if key existed
 */
function kvDelete(key) {
  const store = loadStore();
  if (!(key in store)) return false;
  delete store[key];
  saveStore(store);
  return true;
}

/**
 * List all key-value pairs.
 * @returns {Object}
 */
function kvList() {
  return loadStore();
}

/**
 * Clear all data.
 */
function kvClear() {
  saveStore({});
}

/**
 * Export store as JSON string.
 * @returns {string}
 */
function kvExport() {
  return JSON.stringify(loadStore(), null, 2);
}

/**
 * Import key-value pairs from a JSON file.
 * @param {string} filePath - path to JSON file
 * @returns {{imported: number, errors: string[]}}
 */
function kvImport(filePath) {
  const errors = [];
  let imported = 0;

  if (!fs.existsSync(filePath)) {
    return { imported: 0, errors: [`File not found: ${filePath}`] };
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (err) {
    return { imported: 0, errors: [`Invalid JSON: ${err.message}`] };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { imported: 0, errors: ['JSON must be a plain object with key-value pairs'] };
  }

  const store = loadStore();
  for (const [key, value] of Object.entries(data)) {
    store[key] = value;
    imported++;
  }
  saveStore(store);

  return { imported, errors };
}

// ── CLI Runner ───────────────────────────────────────────────────────────────

/**
 * Run the kv command.
 * @param {string[]} argv - arguments after "aiox kv"
 */
function runKv(argv) {
  const sub = argv[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (sub) {
    case 'get': {
      const key = argv[1];
      if (!key) {
        console.error('Usage: aiox kv get <key>');
        process.exitCode = 1;
        return;
      }
      const value = kvGet(key);
      if (value === undefined) {
        console.log(`Key "${key}" not found`);
      } else {
        console.log(typeof value === 'string' ? value : JSON.stringify(value));
      }
      break;
    }

    case 'set': {
      const key = argv[1];
      const value = argv.slice(2).join(' ');
      if (!key || value === '') {
        console.error('Usage: aiox kv set <key> <value>');
        process.exitCode = 1;
        return;
      }
      kvSet(key, value);
      console.log(`Set "${key}" = "${value}"`);
      break;
    }

    case 'delete': {
      const key = argv[1];
      if (!key) {
        console.error('Usage: aiox kv delete <key>');
        process.exitCode = 1;
        return;
      }
      const deleted = kvDelete(key);
      if (deleted) {
        console.log(`Deleted "${key}"`);
      } else {
        console.log(`Key "${key}" not found`);
      }
      break;
    }

    case 'list': {
      const store = kvList();
      const keys = Object.keys(store);
      if (keys.length === 0) {
        console.log('(empty store)');
        return;
      }
      console.log('KEY-VALUE STORE:');
      for (const key of keys) {
        const val = typeof store[key] === 'string' ? store[key] : JSON.stringify(store[key]);
        console.log(`  ${key} = ${val}`);
      }
      console.log(`\nTotal: ${keys.length} entries`);
      break;
    }

    case 'clear': {
      kvClear();
      console.log('Store cleared');
      break;
    }

    case 'export': {
      console.log(kvExport());
      break;
    }

    case 'import': {
      const file = argv[1];
      if (!file) {
        console.error('Usage: aiox kv import <file>');
        process.exitCode = 1;
        return;
      }
      const absPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const result = kvImport(absPath);
      if (result.errors.length > 0) {
        console.error(`Errors: ${result.errors.join(', ')}`);
        process.exitCode = 1;
      }
      if (result.imported > 0) {
        console.log(`Imported ${result.imported} entries`);
      }
      break;
    }

    default:
      console.error(`Unknown kv subcommand: ${sub}`);
      console.log(HELP_TEXT);
      process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runKv,
  loadStore,
  saveStore,
  kvGet,
  kvSet,
  kvDelete,
  kvList,
  kvClear,
  kvExport,
  kvImport,
  KV_FILE,
};
