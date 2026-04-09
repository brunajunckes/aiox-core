/**
 * Plugin Loader & Registry Command Module
 *
 * Manages plugins in .aiox/plugins/.
 *
 * Subcommands:
 *   aiox plugins list          — List installed plugins
 *   aiox plugins info <name>   — Show plugin manifest details
 *   aiox plugins enable <name> — Enable a plugin
 *   aiox plugins disable <name>— Disable a plugin
 *   aiox plugins init <name>   — Scaffold a new plugin directory
 *
 * @module cli/commands/plugins
 * @version 1.0.0
 * @story 11.2 — Plugin Loader & Registry
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getPluginsDir() {
  return path.join(getAioxDir(), 'plugins');
}

function getPluginDir(name) {
  return path.join(getPluginsDir(), name);
}

function getManifestPath(name) {
  return path.join(getPluginDir(name), 'plugin.json');
}

// ── Plugin Operations ─────────────────────────────────────────────────────────

/**
 * Read a plugin manifest.
 * @param {string} name
 * @returns {object|null}
 */
function readManifest(name) {
  const manifestPath = getManifestPath(name);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Write a plugin manifest.
 * @param {string} name
 * @param {object} manifest
 */
function writeManifest(name, manifest) {
  const dir = getPluginDir(name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getManifestPath(name), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * List all installed plugins (directories with plugin.json).
 * @returns {Array<object>} Array of manifests
 */
function listPlugins() {
  const dir = getPluginsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const plugins = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifest = readManifest(entry.name);
      if (manifest) {
        plugins.push(manifest);
      }
    }
  }
  return plugins;
}

/**
 * Enable a plugin by setting enabled=true in its manifest.
 * @param {string} name
 * @returns {{ success: boolean, message: string }}
 */
function enablePlugin(name) {
  const manifest = readManifest(name);
  if (!manifest) {
    return { success: false, message: `Plugin "${name}" not found.` };
  }
  if (manifest.enabled === true) {
    return { success: true, message: `Plugin "${name}" is already enabled.` };
  }
  manifest.enabled = true;
  writeManifest(name, manifest);
  return { success: true, message: `Plugin "${name}" enabled.` };
}

/**
 * Disable a plugin by setting enabled=false in its manifest.
 * @param {string} name
 * @returns {{ success: boolean, message: string }}
 */
function disablePlugin(name) {
  const manifest = readManifest(name);
  if (!manifest) {
    return { success: false, message: `Plugin "${name}" not found.` };
  }
  if (manifest.enabled === false) {
    return { success: true, message: `Plugin "${name}" is already disabled.` };
  }
  manifest.enabled = false;
  writeManifest(name, manifest);
  return { success: true, message: `Plugin "${name}" disabled.` };
}

/**
 * Scaffold a new plugin directory with default plugin.json.
 * @param {string} name
 * @returns {{ success: boolean, message: string }}
 */
function initPlugin(name) {
  if (!name || typeof name !== 'string') {
    return { success: false, message: 'Plugin name is required.' };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return { success: false, message: `Invalid plugin name "${name}". Use lowercase alphanumeric with hyphens.` };
  }
  const dir = getPluginDir(name);
  if (fs.existsSync(dir)) {
    return { success: false, message: `Plugin directory "${name}" already exists.` };
  }

  const manifest = {
    name,
    version: '0.1.0',
    description: '',
    commands: [],
    hooks: [],
    enabled: true,
  };

  fs.mkdirSync(dir, { recursive: true });
  writeManifest(name, manifest);
  fs.writeFileSync(path.join(dir, 'index.js'), `'use strict';\n\n// Plugin: ${name}\n// Add your plugin logic here.\n\nmodule.exports = {};\n`, 'utf8');

  return { success: true, message: `Plugin "${name}" initialized at ${dir}` };
}

/**
 * Load all enabled plugins. Returns array of loaded manifests.
 * @returns {Array<object>}
 */
function loadPlugins() {
  const plugins = listPlugins();
  return plugins.filter(p => p.enabled === true);
}

// ── Display Helpers ───────────────────────────────────────────────────────────

function formatPluginRow(manifest) {
  const status = manifest.enabled ? 'enabled' : 'disabled';
  const ver = manifest.version || '0.0.0';
  const desc = manifest.description || '(no description)';
  return `  ${manifest.name} v${ver} [${status}] - ${desc}`;
}

function formatPluginInfo(manifest) {
  const lines = [
    `Name:        ${manifest.name}`,
    `Version:     ${manifest.version || '0.0.0'}`,
    `Description: ${manifest.description || '(none)'}`,
    `Status:      ${manifest.enabled ? 'enabled' : 'disabled'}`,
    `Commands:    ${(manifest.commands || []).length > 0 ? manifest.commands.join(', ') : '(none)'}`,
    `Hooks:       ${(manifest.hooks || []).length > 0 ? manifest.hooks.join(', ') : '(none)'}`,
  ];
  return lines.join('\n');
}

// ── Main Runner ──────────────────────────────────────────────────────────────

/**
 * Run the plugins command.
 * @param {string[]} argv
 */
function runPlugins(argv = []) {
  const subcommand = argv[0];
  const name = argv[1];

  switch (subcommand) {
    case 'list':
    case undefined: {
      const plugins = listPlugins();
      if (plugins.length === 0) {
        console.log('No plugins installed.');
        return;
      }
      console.log(`Installed plugins (${plugins.length}):\n`);
      for (const p of plugins) {
        console.log(formatPluginRow(p));
      }
      break;
    }

    case 'info': {
      if (!name) {
        console.error('Usage: aiox plugins info <name>');
        process.exitCode = 1;
        return;
      }
      const manifest = readManifest(name);
      if (!manifest) {
        console.error(`Plugin "${name}" not found.`);
        process.exitCode = 1;
        return;
      }
      console.log(formatPluginInfo(manifest));
      break;
    }

    case 'enable': {
      if (!name) {
        console.error('Usage: aiox plugins enable <name>');
        process.exitCode = 1;
        return;
      }
      const result = enablePlugin(name);
      console.log(result.message);
      if (!result.success) process.exitCode = 1;
      break;
    }

    case 'disable': {
      if (!name) {
        console.error('Usage: aiox plugins disable <name>');
        process.exitCode = 1;
        return;
      }
      const result = disablePlugin(name);
      console.log(result.message);
      if (!result.success) process.exitCode = 1;
      break;
    }

    case 'init': {
      if (!name) {
        console.error('Usage: aiox plugins init <name>');
        process.exitCode = 1;
        return;
      }
      const result = initPlugin(name);
      console.log(result.message);
      if (!result.success) process.exitCode = 1;
      break;
    }

    default:
      console.error(`Unknown plugins subcommand: ${subcommand}`);
      console.log('Available: list, info, enable, disable, init');
      process.exitCode = 1;
  }
}

module.exports = {
  getAioxDir,
  getPluginsDir,
  getPluginDir,
  getManifestPath,
  readManifest,
  writeManifest,
  listPlugins,
  enablePlugin,
  disablePlugin,
  initPlugin,
  loadPlugins,
  formatPluginRow,
  formatPluginInfo,
  runPlugins,
};
