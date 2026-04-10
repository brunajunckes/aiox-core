/**
 * Marketplace Command Module
 *
 * Local squads marketplace for browsing, searching, and installing squads.
 *
 * Subcommands:
 *   aiox marketplace                  — Browse available squads (catalog)
 *   aiox marketplace search <term>    — Search catalog
 *   aiox marketplace install <name>   — Install squad from catalog to project
 *   aiox marketplace publish <path>   — Package local squad for sharing
 *   aiox marketplace --featured       — Show featured/recommended squads
 *
 * @module cli/commands/marketplace
 * @version 1.0.0
 * @story 34.3 - Squads Marketplace MVP (Local)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getCatalogFile() {
  return path.join(process.cwd(), '.aiox-core', 'data', 'marketplace-catalog.json');
}

function getSquadsDir() {
  return path.join(process.cwd(), 'squads');
}

function getPublishDir() {
  return path.join(process.cwd(), '.aiox', 'marketplace', 'published');
}

// ── Catalog Operations ────────────────────────────────────────────────────────

/**
 * Read the marketplace catalog from disk.
 * @returns {{ squads: Array<object>, version: string }}
 */
function readCatalog() {
  const filePath = getCatalogFile();

  try {
    if (!fs.existsSync(filePath)) {
      return { squads: [], version: '0.0.0' };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.squads)) {
      return { squads: [], version: parsed.version || '0.0.0' };
    }
    return parsed;
  } catch {
    return { squads: [], version: '0.0.0' };
  }
}

/**
 * Search catalog by name, description, or tags.
 * @param {string} term
 * @returns {Array<object>}
 */
function searchCatalog(term) {
  if (!term || typeof term !== 'string') return [];

  const catalog = readCatalog();
  const lower = term.toLowerCase();

  return catalog.squads.filter(squad => {
    if (squad.name && squad.name.toLowerCase().includes(lower)) return true;
    if (squad.description && squad.description.toLowerCase().includes(lower)) return true;
    if (Array.isArray(squad.tags)) {
      return squad.tags.some(tag => tag.toLowerCase().includes(lower));
    }
    return false;
  });
}

/**
 * Get featured squads from catalog.
 * @returns {Array<object>}
 */
function getFeatured() {
  const catalog = readCatalog();
  return catalog.squads.filter(s => s.featured === true);
}

/**
 * Get a specific squad from catalog by name.
 * @param {string} name
 * @returns {object|null}
 */
function getCatalogSquad(name) {
  if (!name || typeof name !== 'string') return null;
  const catalog = readCatalog();
  return catalog.squads.find(s => s.name === name) || null;
}

/**
 * Install a squad from catalog to project's squads/ directory.
 * Creates a squad config and directory structure.
 * @param {string} name - Squad name from catalog
 * @returns {{ success: boolean, error?: string, path?: string }}
 */
function installSquad(name) {
  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Squad name is required' };
  }

  const squad = getCatalogSquad(name);
  if (!squad) {
    return { success: false, error: `Squad "${name}" not found in catalog` };
  }

  const squadsDir = getSquadsDir();
  const squadDir = path.join(squadsDir, name);

  if (fs.existsSync(squadDir)) {
    return { success: false, error: `Squad "${name}" is already installed at ${squadDir}` };
  }

  try {
    fs.mkdirSync(squadDir, { recursive: true });

    // Write squad.json
    const meta = {
      name: squad.name,
      version: squad.version,
      description: squad.description,
      author: squad.author || 'AIOX Marketplace',
      tags: squad.tags || [],
      agents: squad.agents || [],
      installedAt: new Date().toISOString(),
      source: 'marketplace',
    };

    fs.writeFileSync(
      path.join(squadDir, 'squad.json'),
      JSON.stringify(meta, null, 2),
      'utf8'
    );

    // Create agents directory if squad has agents
    if (Array.isArray(squad.agents) && squad.agents.length > 0) {
      fs.mkdirSync(path.join(squadDir, 'agents'), { recursive: true });
    }

    return { success: true, path: squadDir };
  } catch (error) {
    return {
      success: false,
      error: `Failed to install: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Package a local squad directory for sharing.
 * Creates a JSON package file in .aiox/marketplace/published/.
 * @param {string} squadPath - Path to local squad directory
 * @returns {{ success: boolean, error?: string, outputPath?: string }}
 */
function publishSquad(squadPath) {
  if (!squadPath || typeof squadPath !== 'string') {
    return { success: false, error: 'Squad path is required' };
  }

  const resolvedPath = path.resolve(squadPath);

  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `Path does not exist: ${resolvedPath}` };
  }

  // Read squad metadata
  let meta = null;
  const jsonPath = path.join(resolvedPath, 'squad.json');
  const yamlPath = path.join(resolvedPath, 'config.yaml');

  try {
    if (fs.existsSync(jsonPath)) {
      meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else if (fs.existsSync(yamlPath)) {
      // Simple yaml parse
      const raw = fs.readFileSync(yamlPath, 'utf8');
      meta = {};
      for (const line of raw.split('\n')) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          meta[match[1].trim()] = value;
        }
      }
    }
  } catch {
    return { success: false, error: 'Failed to read squad metadata' };
  }

  if (!meta || !meta.name) {
    return { success: false, error: 'No valid squad.json or config.yaml found' };
  }

  const publishDir = getPublishDir();
  if (!fs.existsSync(publishDir)) {
    fs.mkdirSync(publishDir, { recursive: true });
  }

  const packageData = {
    ...meta,
    sourcePath: resolvedPath,
    publishedAt: new Date().toISOString(),
    files: [],
  };

  // List files in squad directory
  try {
    const entries = fs.readdirSync(resolvedPath);
    packageData.files = entries;
  } catch {
    // ignore file listing errors
  }

  const outputPath = path.join(publishDir, `${meta.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(packageData, null, 2), 'utf8');

  return { success: true, outputPath };
}

// ── Display ───────────────────────────────────────────────────────────────────

/**
 * Format catalog for CLI output.
 * @param {Array<object>} squads
 * @param {string} [title]
 * @returns {string}
 */
function formatCatalog(squads, title) {
  const heading = title || 'AIOX Squads Marketplace';

  if (squads.length === 0) {
    return `\n  ${heading}\n  ${'='.repeat(heading.length)}\n\n  No squads available.\n`;
  }

  const lines = [
    '',
    `  ${heading}`,
    `  ${'='.repeat(heading.length)}`,
    '',
  ];

  for (const squad of squads) {
    const tags = Array.isArray(squad.tags) ? ` [${squad.tags.join(', ')}]` : '';
    const featured = squad.featured ? ' *' : '';
    lines.push(`  ${squad.name} v${squad.version || '?'}${tags}${featured}`);
    if (squad.description) {
      lines.push(`    ${squad.description}`);
    }
    lines.push('');
  }

  lines.push(`  Total: ${squads.length} squad(s)`);
  lines.push('');

  return lines.join('\n');
}

// ── CLI Runner ────────────────────────────────────────────────────────────────

function showHelp() {
  console.log(`
  Usage: aiox marketplace [command] [args]

  Commands:
    (none)            Browse all available squads
    search <term>     Search squads by name/tag
    install <name>    Install a squad from catalog
    publish <path>    Package a local squad for sharing
    --featured        Show featured/recommended squads
    help              Show this help message

  Catalog: .aiox-core/data/marketplace-catalog.json
`);
}

/**
 * Main CLI entry point.
 * @param {string[]} args
 */
function runMarketplace(args) {
  const subcommand = args[0] || '';

  switch (subcommand) {
    case '': {
      const catalog = readCatalog();
      console.log(formatCatalog(catalog.squads));
      break;
    }

    case '--featured': {
      const featured = getFeatured();
      console.log(formatCatalog(featured, 'Featured Squads'));
      break;
    }

    case 'search': {
      const term = args[1];
      if (!term) {
        console.error('Usage: aiox marketplace search <term>');
        return;
      }
      const results = searchCatalog(term);
      if (results.length === 0) {
        console.log(`No squads matching "${term}".`);
      } else {
        console.log(formatCatalog(results, `Search: "${term}"`));
      }
      break;
    }

    case 'install': {
      const name = args[1];
      if (!name) {
        console.error('Usage: aiox marketplace install <name>');
        return;
      }
      const result = installSquad(name);
      if (result.success) {
        console.log(`Squad "${name}" installed to ${result.path}`);
      } else {
        console.error(`Install failed: ${result.error}`);
      }
      break;
    }

    case 'publish': {
      const pubPath = args[1];
      if (!pubPath) {
        console.error('Usage: aiox marketplace publish <path>');
        return;
      }
      const result = publishSquad(pubPath);
      if (result.success) {
        console.log(`Squad packaged to ${result.outputPath}`);
      } else {
        console.error(`Publish failed: ${result.error}`);
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
  getCatalogFile,
  getSquadsDir,
  getPublishDir,
  readCatalog,
  searchCatalog,
  getFeatured,
  getCatalogSquad,
  installSquad,
  publishSquad,
  formatCatalog,
  runMarketplace,
};
