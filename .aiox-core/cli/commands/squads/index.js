/**
 * Squads Marketplace Command Module
 *
 * CLI commands for discovering, installing, and managing squads.
 *
 * Subcommands:
 *   aiox squads list              — Show installed squads
 *   aiox squads search <query>    — Search available squads
 *   aiox squads install <name>    — Install squad from registry
 *   aiox squads publish           — Show publishing instructions
 *
 * @module cli/commands/squads
 * @version 1.0.0
 * @story 4.4 — Squads Marketplace MVP
 */

'use strict';

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// ── Constants ─────────────────────────────────────────────────────────────────

const REQUIRED_MANIFEST_FIELDS = ['name', 'version', 'description'];
const REGISTRY_FILENAME = 'squads-registry.json';

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getSquadsDir() {
  return path.join(process.cwd(), 'squads');
}

function getRegistryPath() {
  return path.join(process.cwd(), '.aiox-core', 'data', REGISTRY_FILENAME);
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Validate a squad manifest (config.yaml parsed object) has required fields.
 *
 * @param {object} manifest - Parsed squad manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'] };
  }

  const squad = manifest.squad || manifest;

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!squad[field] || (typeof squad[field] === 'string' && squad[field].trim() === '')) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (squad.name && typeof squad.name === 'string' && !/^[a-z0-9][a-z0-9-]*$/.test(squad.name)) {
    errors.push('Name must be lowercase alphanumeric with hyphens, starting with alphanumeric');
  }

  if (squad.version && typeof squad.version === 'string' && !/^\d+\.\d+\.\d+/.test(squad.version)) {
    errors.push('Version must follow semver format (e.g. 1.0.0)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * List installed squads by reading squads/ directory.
 * Reads each squad's config.yaml for metadata.
 *
 * @returns {Array<{ name: string, version: string, description: string, path: string, agentCount: number }>}
 */
function listInstalled() {
  const squadsDir = getSquadsDir();

  if (!fs.existsSync(squadsDir)) {
    return [];
  }

  const entries = fs.readdirSync(squadsDir, { withFileTypes: true });
  const squads = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue; // skip _example etc.

    const squadDir = path.join(squadsDir, entry.name);
    const configPath = path.join(squadDir, 'config.yaml');

    const squad = {
      name: entry.name,
      version: 'unknown',
      description: '',
      path: squadDir,
      agentCount: 0,
    };

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const parsed = parseYamlLite(content);

        if (parsed.squad) {
          squad.version = parsed.squad.version || 'unknown';
          squad.description = parsed.squad.description || parsed.squad.display_name || '';
        }

        if (parsed.agents) {
          squad.agentCount = Object.keys(parsed.agents).length;
        }
      } catch (_e) {
        // Keep defaults if config can't be read
      }
    }

    // Count agent files as fallback
    if (squad.agentCount === 0) {
      const agentsDir = path.join(squadDir, 'agents');
      if (fs.existsSync(agentsDir)) {
        try {
          squad.agentCount = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length;
        } catch (_e) {
          // ignore
        }
      }
    }

    squads.push(squad);
  }

  return squads;
}

/**
 * Search the local registry file for squads matching a query.
 *
 * @param {string} query - Search term (matched against name, description, keywords)
 * @returns {Array<object>} Matching registry entries
 */
function searchSquads(query) {
  const registryPath = getRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return [];
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (_e) {
    return [];
  }

  if (!Array.isArray(registry)) {
    return [];
  }

  if (!query || query.trim() === '') {
    return registry;
  }

  const q = query.toLowerCase().trim();

  return registry.filter(entry => {
    const name = (entry.name || '').toLowerCase();
    const desc = (entry.description || '').toLowerCase();
    const keywords = Array.isArray(entry.keywords)
      ? entry.keywords.join(' ').toLowerCase()
      : '';

    return name.includes(q) || desc.includes(q) || keywords.includes(q);
  });
}

/**
 * Install a squad by name from the registry.
 * MVP: for "local" source, copies from squads/ template if exists.
 *
 * @param {string} name - Squad name
 * @param {string} [source] - Source override (default: from registry)
 * @returns {{ success: boolean, message: string }}
 */
function installSquad(name, source) {
  const squadsDir = getSquadsDir();
  const targetDir = path.join(squadsDir, name);

  // Check if already installed
  if (fs.existsSync(targetDir)) {
    return { success: false, message: `Squad '${name}' is already installed at ${targetDir}` };
  }

  // Look up in registry if no source given
  let resolvedSource = source;
  if (!resolvedSource) {
    const registryPath = getRegistryPath();
    if (fs.existsSync(registryPath)) {
      try {
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const entry = Array.isArray(registry)
          ? registry.find(e => e.name === name)
          : null;

        if (entry) {
          resolvedSource = entry.source || 'local';
        }
      } catch (_e) {
        // continue without registry
      }
    }
  }

  if (!resolvedSource) {
    return { success: false, message: `Squad '${name}' not found in registry` };
  }

  // MVP: local source copies from _example or shows not-found
  if (resolvedSource === 'local') {
    // Check if a template/source exists in squads/_example or squads/{name}
    const templateDir = path.join(squadsDir, '_example');
    if (!fs.existsSync(templateDir)) {
      return {
        success: false,
        message: `Local source for '${name}' not available. Use 'aiox squads publish' for distribution info.`,
      };
    }

    // Create target directory and copy template
    try {
      copyDirSync(templateDir, targetDir);
      return {
        success: true,
        message: `Squad '${name}' installed from template at ${targetDir}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to install '${name}': ${error.message}`,
      };
    }
  }

  // Future: handle 'github', 'tarball', etc.
  return {
    success: false,
    message: `Source type '${resolvedSource}' is not yet supported. GitHub Releases integration coming soon.`,
  };
}

/**
 * Package a squad directory as a gzipped tarball (stdlib only).
 *
 * @param {string} squadDir - Absolute path to squad directory
 * @returns {{ success: boolean, outputPath?: string, message: string }}
 */
function packSquad(squadDir) {
  if (!fs.existsSync(squadDir)) {
    return { success: false, message: `Directory not found: ${squadDir}` };
  }

  const configPath = path.join(squadDir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    return { success: false, message: `No config.yaml found in ${squadDir}` };
  }

  const squadName = path.basename(squadDir);
  const outputPath = path.join(path.dirname(squadDir), `${squadName}.tar.gz`);

  try {
    // Build tar archive in memory (simplified POSIX tar format)
    const files = collectFiles(squadDir, '');
    const tarBuffer = createTarBuffer(files, squadName);

    // Gzip compress
    const gzipped = zlib.gzipSync(tarBuffer);
    fs.writeFileSync(outputPath, gzipped);

    return {
      success: true,
      outputPath,
      message: `Packed ${files.length} files into ${outputPath}`,
    };
  } catch (error) {
    return { success: false, message: `Pack failed: ${error.message}` };
  }
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * Main CLI handler for `aiox squads` command.
 *
 * @param {string[]} argv - Arguments after 'squads' (e.g. ['list'], ['search', 'claude'])
 */
function runSquads(argv) {
  const subcommand = argv[0];

  switch (subcommand) {
    case 'list':
      handleList();
      break;

    case 'search': {
      const query = argv.slice(1).join(' ');
      handleSearch(query);
      break;
    }

    case 'install': {
      const name = argv[1];
      if (!name) {
        console.error('Usage: aiox squads install <name>');
        process.exitCode = 1;
        return;
      }
      handleInstall(name);
      break;
    }

    case 'pack': {
      const dir = argv[1];
      if (!dir) {
        console.error('Usage: aiox squads pack <squad-directory>');
        process.exitCode = 1;
        return;
      }
      handlePack(dir);
      break;
    }

    case 'publish':
      handlePublish();
      break;

    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      showHelp();
      process.exitCode = 1;
  }
}

// ── Subcommand Handlers ───────────────────────────────────────────────────────

function handleList() {
  const squads = listInstalled();

  if (squads.length === 0) {
    console.log('No squads installed.');
    console.log('\nRun \'aiox squads search\' to discover available squads.');
    return;
  }

  console.log(`Installed Squads (${squads.length}):\n`);

  for (const squad of squads) {
    const desc = typeof squad.description === 'string'
      ? squad.description.split('\n')[0].trim()
      : '';
    console.log(`  ${squad.name} v${squad.version}`);
    if (desc) console.log(`    ${desc}`);
    console.log(`    Agents: ${squad.agentCount} | Path: ${squad.path}`);
    console.log('');
  }
}

function handleSearch(query) {
  const results = searchSquads(query);

  if (results.length === 0) {
    const msg = query
      ? `No squads found matching '${query}'.`
      : 'Registry is empty or not found.';
    console.log(msg);
    return;
  }

  const label = query ? `Search results for '${query}'` : 'Available squads';
  console.log(`${label} (${results.length}):\n`);

  for (const entry of results) {
    console.log(`  ${entry.name} v${entry.version || '0.0.0'}`);
    if (entry.description) console.log(`    ${entry.description}`);
    if (entry.author) console.log(`    Author: ${entry.author}`);
    console.log('');
  }
}

function handleInstall(name) {
  const result = installSquad(name);

  if (result.success) {
    console.log(`Installed: ${result.message}`);
  } else {
    console.error(`Error: ${result.message}`);
    process.exitCode = 1;
  }
}

function handlePack(dir) {
  const resolved = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const result = packSquad(resolved);

  if (result.success) {
    console.log(`Packed: ${result.message}`);
  } else {
    console.error(`Error: ${result.message}`);
    process.exitCode = 1;
  }
}

function handlePublish() {
  console.log(`Squads Marketplace — Publishing Guide

To publish a squad for others to use:

1. Ensure your squad has a valid config.yaml with required fields:
   - squad.name (lowercase, alphanumeric, hyphens)
   - squad.version (semver format)
   - squad.description

2. Pack your squad:
   aiox squads pack squads/your-squad-name

3. Publish options (coming soon):
   - GitHub Releases: Attach the .tar.gz to a release
   - Local registry: Add entry to .aiox-core/data/squads-registry.json

4. For now, share the .tar.gz file directly or add to the local registry.

Registry entry format:
  {
    "name": "your-squad-name",
    "version": "1.0.0",
    "description": "What your squad does",
    "author": "YourName",
    "source": "local"
  }
`);
}

function showHelp() {
  console.log(`Squads Marketplace — Discover, install, and manage squads

USAGE:
  aiox squads list              Show installed squads
  aiox squads search [query]    Search available squads in registry
  aiox squads install <name>    Install a squad from registry
  aiox squads pack <dir>        Package a squad as .tar.gz
  aiox squads publish           Show publishing instructions
  aiox squads --help            Show this help
`);
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Lightweight YAML parser for squad config files.
 * Handles the subset used in squad configs (key: value, nested objects).
 * Falls back gracefully — no external deps.
 */
function parseYamlLite(content) {
  const result = {};
  let currentSection = null;
  let currentSubSection = null;

  const lines = content.split('\n');

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    // Top-level key (no indent)
    const topMatch = line.match(/^([a-z0-9_-]+):\s*$/);
    if (topMatch) {
      currentSection = topMatch[1];
      result[currentSection] = {};
      currentSubSection = null;
      continue;
    }

    // Second-level key (2-space indent)
    const secondMatch = line.match(/^  ([a-z0-9_-]+):\s*(.*)$/);
    if (secondMatch && currentSection) {
      const key = secondMatch[1];
      const value = secondMatch[2].trim();

      if (value === '' || value === '|') {
        // Sub-object or multi-line
        currentSubSection = key;
        if (typeof result[currentSection] !== 'object') {
          result[currentSection] = {};
        }
        result[currentSection][key] = result[currentSection][key] || {};
        continue;
      }

      // Clean quoted values
      const cleaned = value.replace(/^["']|["']$/g, '');
      if (typeof result[currentSection] !== 'object') {
        result[currentSection] = {};
      }
      result[currentSection][key] = cleaned;
      currentSubSection = null;
      continue;
    }

    // Third-level key (4-space indent)
    const thirdMatch = line.match(/^    ([a-z0-9_-]+):\s*(.*)$/);
    if (thirdMatch && currentSection && currentSubSection) {
      const key = thirdMatch[1];
      const value = thirdMatch[2].trim().replace(/^["']|["']$/g, '');
      if (typeof result[currentSection][currentSubSection] !== 'object') {
        result[currentSection][currentSubSection] = {};
      }
      result[currentSection][currentSubSection][key] = value;
    }
  }

  return result;
}

/**
 * Recursively collect all files in a directory.
 * @returns {Array<{ relativePath: string, content: Buffer }>}
 */
function collectFiles(baseDir, prefix) {
  const results = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, relPath));
    } else {
      results.push({
        relativePath: relPath,
        content: fs.readFileSync(fullPath),
      });
    }
  }

  return results;
}

/**
 * Create a POSIX tar buffer from file entries.
 * Simplified — supports files up to 8GB, paths up to 100 chars.
 */
function createTarBuffer(files, rootName) {
  const blocks = [];

  for (const file of files) {
    const filePath = `${rootName}/${file.relativePath}`;
    const content = file.content;
    const size = content.length;

    // Create 512-byte header
    const header = Buffer.alloc(512, 0);
    header.write(filePath.substring(0, 100), 0, 100, 'utf8');         // name
    header.write('0000644\0', 100, 8, 'utf8');                         // mode
    header.write('0001000\0', 108, 8, 'utf8');                         // uid
    header.write('0001000\0', 116, 8, 'utf8');                         // gid
    header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8'); // size
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12, 'utf8'); // mtime
    header.write('        ', 148, 8, 'utf8');                          // checksum placeholder
    header[156] = 0x30;                                                // type: regular file

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');

    blocks.push(header);
    blocks.push(content);

    // Pad to 512-byte boundary
    const padding = 512 - (size % 512);
    if (padding < 512) {
      blocks.push(Buffer.alloc(padding, 0));
    }
  }

  // Two empty 512-byte blocks as end-of-archive marker
  blocks.push(Buffer.alloc(1024, 0));

  return Buffer.concat(blocks);
}

/**
 * Recursively copy a directory.
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runSquads,
  validateManifest,
  listInstalled,
  searchSquads,
  installSquad,
  packSquad,
  parseYamlLite,
  copyDirSync,
  REQUIRED_MANIFEST_FIELDS,
  getSquadsDir,
  getRegistryPath,
};
