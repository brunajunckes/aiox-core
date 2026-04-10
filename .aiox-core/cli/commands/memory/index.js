/**
 * Memory Layer for Agent Context Persistence
 *
 * Key-value memory store for agents with namespace support.
 *
 * Subcommands:
 *   aiox memory                    - show all memory entries
 *   aiox memory set <key> <value>  - store a key-value memory entry
 *   aiox memory get <key>          - retrieve a memory entry
 *   aiox memory delete <key>       - delete a memory entry
 *   aiox memory search <term>      - search across all memory entries
 *   aiox memory export             - export all memory as JSON
 *   aiox memory import <file>      - import memory from JSON file
 *   aiox memory agent <agent-name> - show memories for specific agent
 *
 * @module cli/commands/memory
 * @version 1.0.0
 * @story 35.1 - Memory Layer for Agent Context Persistence
 */

'use strict';

const fs = require('fs');
const path = require('path');

// -- Constants ----------------------------------------------------------------

const MEMORY_DIR_NAME = '.aiox/memory';

// -- Helpers ------------------------------------------------------------------

/**
 * Resolve memory directory from cwd.
 * @returns {string}
 */
function getMemoryDir() {
  return path.join(process.cwd(), MEMORY_DIR_NAME);
}

/**
 * Ensure memory directory exists.
 */
function ensureMemoryDir() {
  const dir = getMemoryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Sanitize a key for use as a filename.
 * Replaces colons and slashes with double-underscores.
 * @param {string} key
 * @returns {string}
 */
function keyToFilename(key) {
  return key.replace(/[:/\\]/g, '__') + '.json';
}

/**
 * Recover the original key from a filename.
 * @param {string} filename
 * @returns {string}
 */
function filenameToKey(filename) {
  return filename.replace(/\.json$/, '').replace(/__/g, ':');
}

/**
 * List all memory entry files.
 * @returns {string[]} filenames
 */
function listEntryFiles() {
  const dir = getMemoryDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
}

/**
 * Read a single memory entry by key.
 * @param {string} key
 * @returns {object|null}
 */
function readEntry(key) {
  const filePath = path.join(getMemoryDir(), keyToFilename(key));
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Write a memory entry.
 * @param {string} key
 * @param {*} value
 * @returns {object} the stored entry
 */
function writeEntry(key, value) {
  const dir = ensureMemoryDir();
  const entry = {
    key,
    value,
    namespace: extractNamespace(key),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Check if exists to preserve createdAt
  const existing = readEntry(key);
  if (existing && existing.createdAt) {
    entry.createdAt = existing.createdAt;
  }
  const filePath = path.join(dir, keyToFilename(key));
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  return entry;
}

/**
 * Delete a memory entry.
 * @param {string} key
 * @returns {boolean} true if deleted
 */
function deleteEntry(key) {
  const filePath = path.join(getMemoryDir(), keyToFilename(key));
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Read all memory entries.
 * @returns {object[]}
 */
function readAllEntries() {
  const files = listEntryFiles();
  const entries = [];
  const dir = getMemoryDir();
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      entries.push(data);
    } catch {
      // skip corrupt entries
    }
  }
  return entries;
}

/**
 * Extract namespace from a namespaced key.
 * e.g. 'agent:dev:lastStory' -> 'agent'
 * @param {string} key
 * @returns {string|null}
 */
function extractNamespace(key) {
  if (!key.includes(':')) return null;
  return key.split(':')[0];
}

/**
 * Search across all memory entries.
 * @param {string} term
 * @returns {object[]}
 */
function searchEntries(term) {
  const all = readAllEntries();
  const lower = term.toLowerCase();
  return all.filter(entry => {
    const keyMatch = entry.key && entry.key.toLowerCase().includes(lower);
    const valMatch = JSON.stringify(entry.value).toLowerCase().includes(lower);
    return keyMatch || valMatch;
  });
}

/**
 * Get all entries for a specific agent namespace.
 * @param {string} agentName
 * @returns {object[]}
 */
function getAgentEntries(agentName) {
  const all = readAllEntries();
  return all.filter(entry => entry.namespace === 'agent' && entry.key.startsWith(`agent:${agentName}:`));
}

/**
 * Export all entries as a single JSON object.
 * @returns {object}
 */
function exportAll() {
  const entries = readAllEntries();
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}

/**
 * Import entries from a JSON export object.
 * @param {object} data - export format with .entries array
 * @returns {{ imported: number, skipped: number }}
 */
function importEntries(data) {
  if (!data || !Array.isArray(data.entries)) {
    throw new Error('Invalid import format: expected { entries: [...] }');
  }
  let imported = 0;
  let skipped = 0;
  for (const entry of data.entries) {
    if (!entry.key) {
      skipped++;
      continue;
    }
    writeEntry(entry.key, entry.value);
    imported++;
  }
  return { imported, skipped };
}

// -- CLI Runner ---------------------------------------------------------------

/**
 * Run the memory command.
 * @param {string[]} argv - arguments after 'memory'
 */
function runMemory(argv) {
  const sub = argv[0];

  if (!sub) {
    // Show all entries
    const entries = readAllEntries();
    if (entries.length === 0) {
      console.log('No memory entries found.');
      console.log(`Store: ${getMemoryDir()}`);
      return;
    }
    console.log(`Memory Entries (${entries.length}):\n`);
    for (const e of entries) {
      const val = typeof e.value === 'string' ? e.value : JSON.stringify(e.value);
      const display = val.length > 60 ? val.slice(0, 57) + '...' : val;
      console.log(`  ${e.key} = ${display}`);
    }
    return;
  }

  switch (sub) {
    case 'set': {
      const key = argv[1];
      const value = argv.slice(2).join(' ');
      if (!key || !value) {
        console.error('Usage: aiox memory set <key> <value>');
        process.exit(1);
      }
      const entry = writeEntry(key, value);
      console.log(`Set: ${entry.key} = ${entry.value}`);
      break;
    }

    case 'get': {
      const key = argv[1];
      if (!key) {
        console.error('Usage: aiox memory get <key>');
        process.exit(1);
      }
      const entry = readEntry(key);
      if (!entry) {
        console.error(`Key not found: ${key}`);
        process.exit(1);
      }
      console.log(typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2));
      break;
    }

    case 'delete': {
      const key = argv[1];
      if (!key) {
        console.error('Usage: aiox memory delete <key>');
        process.exit(1);
      }
      const deleted = deleteEntry(key);
      if (!deleted) {
        console.error(`Key not found: ${key}`);
        process.exit(1);
      }
      console.log(`Deleted: ${key}`);
      break;
    }

    case 'search': {
      const term = argv.slice(1).join(' ');
      if (!term) {
        console.error('Usage: aiox memory search <term>');
        process.exit(1);
      }
      const results = searchEntries(term);
      if (results.length === 0) {
        console.log(`No results for: ${term}`);
        return;
      }
      console.log(`Search Results (${results.length}):\n`);
      for (const e of results) {
        const val = typeof e.value === 'string' ? e.value : JSON.stringify(e.value);
        const display = val.length > 60 ? val.slice(0, 57) + '...' : val;
        console.log(`  ${e.key} = ${display}`);
      }
      break;
    }

    case 'export': {
      const data = exportAll();
      console.log(JSON.stringify(data, null, 2));
      break;
    }

    case 'import': {
      const file = argv[1];
      if (!file) {
        console.error('Usage: aiox memory import <file>');
        process.exit(1);
      }
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const result = importEntries(data);
        console.log(`Imported ${result.imported} entries, skipped ${result.skipped}`);
      } catch (err) {
        console.error(`Import failed: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'agent': {
      const agentName = argv[1];
      if (!agentName) {
        console.error('Usage: aiox memory agent <agent-name>');
        process.exit(1);
      }
      const entries = getAgentEntries(agentName);
      if (entries.length === 0) {
        console.log(`No memory entries for agent: ${agentName}`);
        return;
      }
      console.log(`Agent ${agentName} Memories (${entries.length}):\n`);
      for (const e of entries) {
        const val = typeof e.value === 'string' ? e.value : JSON.stringify(e.value);
        const display = val.length > 60 ? val.slice(0, 57) + '...' : val;
        console.log(`  ${e.key} = ${display}`);
      }
      break;
    }

    default:
      console.error(`Unknown memory subcommand: ${sub}`);
      console.log('Available: set, get, delete, search, export, import, agent');
      process.exit(1);
  }
}

module.exports = {
  runMemory,
  getMemoryDir,
  ensureMemoryDir,
  keyToFilename,
  filenameToKey,
  readEntry,
  writeEntry,
  deleteEntry,
  readAllEntries,
  extractNamespace,
  searchEntries,
  getAgentEntries,
  exportAll,
  importEntries,
};
