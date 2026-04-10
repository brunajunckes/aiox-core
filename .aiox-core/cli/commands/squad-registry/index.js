/**
 * Squad Registry Command Module
 *
 * Local squad registry for discovering and managing squads.
 *
 * Subcommands:
 *   aiox squad-registry list           — List available squads from registry
 *   aiox squad-registry search <term>  — Search squads by name/tag
 *   aiox squad-registry info <name>    — Detailed info about a squad
 *   aiox squad-registry add <path>     — Register a local squad
 *   aiox squad-registry remove <name>  — Unregister a squad
 *
 * @module cli/commands/squad-registry
 * @version 1.0.0
 * @story 34.2 - Squad Registry
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getRegistryDir() {
  return path.join(getAioxDir(), 'registry');
}

function getRegistryFile() {
  return path.join(getRegistryDir(), 'squads.json');
}

// ── Registry Operations ───────────────────────────────────────────────────────

/**
 * Read the squad registry from disk.
 * @returns {{ squads: Array<object>, updatedAt: string }}
 */
function readRegistry() {
  const filePath = getRegistryFile();

  try {
    if (!fs.existsSync(filePath)) {
      return { squads: [], updatedAt: null };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.squads)) {
      return { squads: [], updatedAt: null };
    }
    return parsed;
  } catch {
    return { squads: [], updatedAt: null };
  }
}

/**
 * Write the squad registry to disk atomically.
 * @param {object} registry
 */
function writeRegistry(registry) {
  const dir = getRegistryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  registry.updatedAt = new Date().toISOString();
  const filePath = getRegistryFile();
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Validate squad metadata object.
 * @param {object} meta
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSquadMeta(meta) {
  const errors = [];

  if (!meta || typeof meta !== 'object') {
    return { valid: false, errors: ['Metadata must be a non-null object'] };
  }

  if (!meta.name || typeof meta.name !== 'string' || !meta.name.trim()) {
    errors.push('Missing required field: name');
  }
  if (!meta.description || typeof meta.description !== 'string' || !meta.description.trim()) {
    errors.push('Missing required field: description');
  }
  if (!meta.version || typeof meta.version !== 'string') {
    errors.push('Missing required field: version');
  }

  if (meta.name && typeof meta.name === 'string' && !/^[a-z0-9][a-z0-9-]*$/.test(meta.name)) {
    errors.push('Name must be lowercase alphanumeric with hyphens');
  }

  if (meta.version && typeof meta.version === 'string' && !/^\d+\.\d+\.\d+/.test(meta.version)) {
    errors.push('Version must follow semver format (e.g. 1.0.0)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Read squad metadata from a squad directory.
 * Looks for config.yaml or squad.json.
 * @param {string} squadPath - Absolute path to squad directory
 * @returns {object|null}
 */
function readSquadMeta(squadPath) {
  // Try squad.json first
  const jsonPath = path.join(squadPath, 'squad.json');
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    // fall through
  }

  // Try config.yaml (simple key: value parsing)
  const yamlPath = path.join(squadPath, 'config.yaml');
  try {
    if (fs.existsSync(yamlPath)) {
      const raw = fs.readFileSync(yamlPath, 'utf8');
      const meta = {};
      const lines = raw.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove quotes
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          meta[key] = value;
        }
      }
      return Object.keys(meta).length > 0 ? meta : null;
    }
  } catch {
    // fall through
  }

  return null;
}

/**
 * List all squads in the registry.
 * @returns {Array<object>}
 */
function listSquads() {
  const registry = readRegistry();
  return registry.squads;
}

/**
 * Search squads by name or tag.
 * @param {string} term - Search term
 * @returns {Array<object>}
 */
function searchSquads(term) {
  if (!term || typeof term !== 'string') return [];

  const registry = readRegistry();
  const lower = term.toLowerCase();

  return registry.squads.filter(squad => {
    if (squad.name && squad.name.toLowerCase().includes(lower)) return true;
    if (squad.description && squad.description.toLowerCase().includes(lower)) return true;
    if (Array.isArray(squad.tags)) {
      return squad.tags.some(tag => tag.toLowerCase().includes(lower));
    }
    return false;
  });
}

/**
 * Get detailed info about a specific squad.
 * @param {string} name - Squad name
 * @returns {object|null}
 */
function getSquadInfo(name) {
  if (!name || typeof name !== 'string') return null;

  const registry = readRegistry();
  return registry.squads.find(s => s.name === name) || null;
}

/**
 * Add a squad to the registry from a local path.
 * @param {string} squadPath - Path to squad directory
 * @returns {{ success: boolean, error?: string, squad?: object }}
 */
function addSquad(squadPath) {
  if (!squadPath || typeof squadPath !== 'string') {
    return { success: false, error: 'Path is required' };
  }

  const resolvedPath = path.resolve(squadPath);

  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `Path does not exist: ${resolvedPath}` };
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    return { success: false, error: 'Path must be a directory' };
  }

  const meta = readSquadMeta(resolvedPath);
  if (!meta) {
    return { success: false, error: 'No squad.json or config.yaml found in directory' };
  }

  const validation = validateSquadMeta(meta);
  if (!validation.valid) {
    return { success: false, error: `Invalid metadata: ${validation.errors.join(', ')}` };
  }

  const registry = readRegistry();

  // Check for duplicates
  const existing = registry.squads.findIndex(s => s.name === meta.name);
  if (existing >= 0) {
    registry.squads[existing] = {
      ...meta,
      path: resolvedPath,
      registeredAt: registry.squads[existing].registeredAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    registry.squads.push({
      ...meta,
      path: resolvedPath,
      registeredAt: new Date().toISOString(),
    });
  }

  writeRegistry(registry);
  return { success: true, squad: meta };
}

/**
 * Remove a squad from the registry.
 * @param {string} name - Squad name to remove
 * @returns {{ success: boolean, error?: string }}
 */
function removeSquad(name) {
  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Name is required' };
  }

  const registry = readRegistry();
  const idx = registry.squads.findIndex(s => s.name === name);

  if (idx < 0) {
    return { success: false, error: `Squad not found: ${name}` };
  }

  registry.squads.splice(idx, 1);
  writeRegistry(registry);
  return { success: true };
}

// ── Display ───────────────────────────────────────────────────────────────────

/**
 * Format squad list for CLI output.
 * @param {Array<object>} squads
 * @returns {string}
 */
function formatSquadList(squads) {
  if (squads.length === 0) {
    return 'No squads registered. Use `aiox squad-registry add <path>` to register one.';
  }

  const lines = [
    '',
    '  Registered Squads',
    '  =================',
    '',
  ];

  for (const squad of squads) {
    const tags = Array.isArray(squad.tags) ? ` [${squad.tags.join(', ')}]` : '';
    lines.push(`  ${squad.name} v${squad.version || '?'}${tags}`);
    if (squad.description) {
      lines.push(`    ${squad.description}`);
    }
    lines.push('');
  }

  lines.push(`  Total: ${squads.length} squad(s)`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format detailed squad info for CLI.
 * @param {object} squad
 * @returns {string}
 */
function formatSquadInfo(squad) {
  const lines = [
    '',
    `  Squad: ${squad.name}`,
    '  ' + '='.repeat(squad.name.length + 7),
    '',
    `  Version:     ${squad.version || 'unknown'}`,
    `  Description: ${squad.description || 'none'}`,
  ];

  if (squad.author) lines.push(`  Author:      ${squad.author}`);
  if (squad.path) lines.push(`  Path:        ${squad.path}`);
  if (Array.isArray(squad.tags) && squad.tags.length) {
    lines.push(`  Tags:        ${squad.tags.join(', ')}`);
  }
  if (Array.isArray(squad.agents) && squad.agents.length) {
    lines.push(`  Agents:      ${squad.agents.join(', ')}`);
  }
  if (squad.registeredAt) lines.push(`  Registered:  ${squad.registeredAt}`);

  lines.push('');
  return lines.join('\n');
}

// ── CLI Runner ────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
  Usage: aiox squad-registry <command> [args]

  Commands:
    list              List all registered squads
    search <term>     Search squads by name or tag
    info <name>       Show detailed info about a squad
    add <path>        Register a local squad directory
    remove <name>     Unregister a squad
    help              Show this help message

  Registry stored in .aiox/registry/squads.json
`);
}

/**
 * Main CLI entry point.
 * @param {string[]} args
 */
function runSquadRegistry(args) {
  const subcommand = args[0] || 'list';

  switch (subcommand) {
    case 'list': {
      const squads = listSquads();
      console.log(formatSquadList(squads));
      break;
    }

    case 'search': {
      const term = args[1];
      if (!term) {
        console.error('Usage: aiox squad-registry search <term>');
        return;
      }
      const results = searchSquads(term);
      if (results.length === 0) {
        console.log(`No squads matching "${term}".`);
      } else {
        console.log(formatSquadList(results));
      }
      break;
    }

    case 'info': {
      const name = args[1];
      if (!name) {
        console.error('Usage: aiox squad-registry info <name>');
        return;
      }
      const squad = getSquadInfo(name);
      if (!squad) {
        console.log(`Squad not found: ${name}`);
      } else {
        console.log(formatSquadInfo(squad));
      }
      break;
    }

    case 'add': {
      const addPath = args[1];
      if (!addPath) {
        console.error('Usage: aiox squad-registry add <path>');
        return;
      }
      const result = addSquad(addPath);
      if (result.success) {
        console.log(`Squad "${result.squad.name}" registered successfully.`);
      } else {
        console.error(`Failed to register squad: ${result.error}`);
      }
      break;
    }

    case 'remove': {
      const removeName = args[1];
      if (!removeName) {
        console.error('Usage: aiox squad-registry remove <name>');
        return;
      }
      const result = removeSquad(removeName);
      if (result.success) {
        console.log(`Squad "${removeName}" removed from registry.`);
      } else {
        console.error(`Failed to remove squad: ${result.error}`);
      }
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
  getAioxDir,
  getRegistryDir,
  getRegistryFile,
  readRegistry,
  writeRegistry,
  validateSquadMeta,
  readSquadMeta,
  listSquads,
  searchSquads,
  getSquadInfo,
  addSquad,
  removeSquad,
  formatSquadList,
  formatSquadInfo,
  runSquadRegistry,
};
