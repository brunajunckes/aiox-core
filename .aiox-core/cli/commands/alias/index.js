/**
 * CLI Alias & Shortcuts Command Module
 *
 * Manage command aliases for the AIOX CLI.
 *
 * Subcommands:
 *   aiox alias list              — Show all aliases
 *   aiox alias set <name> <cmd>  — Create or update alias
 *   aiox alias remove <name>     — Delete alias
 *   aiox alias reset             — Restore default aliases
 *   aiox alias --help            — Show help
 *
 * @module cli/commands/alias
 * @version 1.0.0
 * @story 9.4 — CLI Command Aliases & Shortcuts
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

function getAliasDir() { return path.join(process.cwd(), '.aiox'); }
function getAliasFile() { return path.join(getAliasDir(), 'aliases.yaml'); }

const DEFAULT_ALIASES = {
  s: 'status',
  d: 'doctor',
  h: 'help',
  a: 'agents',
  i: 'info',
  p: 'palette',
};

const EXISTING_COMMANDS = [
  'help', 'agents', 'status', 'doctor', 'info', 'config', 'scaffold',
  'profile', 'dashboard', 'flow', 'coverage', 'explain', 'alias',
  'feedback', 'telemetry', 'experiment', 'health', 'hooks', 'palette',
  'commands', 'docs', 'squads', 'completion', 'progress', 'release',
  'changelog', 'smoke-test', 'benchmark', 'audit', 'stats', 'workflow',
  'validate', 'update', 'install', 'init', 'resume', 'workers',
  'quickstart', 'graph',
];

// ── Simple YAML helpers (no external deps) ───────────────────────────────────

/**
 * Parse simple key: value YAML under an `aliases:` block.
 * @param {string} content - Raw YAML string
 * @returns {Object<string,string>}
 */
function parseAliasYaml(content) {
  const aliases = {};
  const lines = content.split('\n');
  let inBlock = false;

  for (const line of lines) {
    if (/^aliases:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      const match = line.match(/^  (\S+):\s+(.+)$/);
      if (match) {
        aliases[match[1]] = match[2].trim();
      } else if (line.trim() !== '' && !line.startsWith('#') && !line.startsWith('  #')) {
        // Left the aliases block
        break;
      }
    }
  }
  return aliases;
}

/**
 * Serialize aliases to simple YAML.
 * @param {Object<string,string>} aliases
 * @returns {string}
 */
function serializeAliasYaml(aliases) {
  const lines = ['# AIOX CLI Aliases', 'aliases:'];
  const keys = Object.keys(aliases).sort();
  for (const key of keys) {
    lines.push(`  ${key}: ${aliases[key]}`);
  }
  return lines.join('\n') + '\n';
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Load aliases from disk, returning defaults if file is absent.
 * @returns {Object<string,string>}
 */
function loadAliases() {
  if (!fs.existsSync(getAliasFile())) {
    return { ...DEFAULT_ALIASES };
  }
  try {
    const content = fs.readFileSync(getAliasFile(), 'utf8');
    const aliases = parseAliasYaml(content);
    return Object.keys(aliases).length > 0 ? aliases : { ...DEFAULT_ALIASES };
  } catch {
    return { ...DEFAULT_ALIASES };
  }
}

/**
 * Save aliases to disk, creating the directory if needed.
 * @param {Object<string,string>} aliases
 */
function saveAliases(aliases) {
  if (!fs.existsSync(getAliasDir())) {
    fs.mkdirSync(getAliasDir(), { recursive: true });
  }
  fs.writeFileSync(getAliasFile(), serializeAliasYaml(aliases), 'utf8');
}

/**
 * Set (create or update) an alias.
 * @param {string} name - Alias name
 * @param {string} command - Target command
 * @returns {{ success: boolean, message: string }}
 */
function setAlias(name, command) {
  if (!name || !command) {
    return { success: false, message: 'Usage: aiox alias set <name> <command>' };
  }

  // Conflict check: alias name cannot be an existing command
  if (EXISTING_COMMANDS.includes(name)) {
    return {
      success: false,
      message: `Cannot create alias "${name}": conflicts with existing command`,
    };
  }

  // Validate name (alphanumeric + hyphens)
  if (!/^[\w-]+$/.test(name)) {
    return {
      success: false,
      message: `Invalid alias name "${name}": use only letters, numbers, hyphens, and underscores`,
    };
  }

  const aliases = loadAliases();
  const isUpdate = aliases[name] !== undefined;
  aliases[name] = command;
  saveAliases(aliases);

  const action = isUpdate ? 'Updated' : 'Created';
  return { success: true, message: `${action} alias: ${name} -> ${command}` };
}

/**
 * Remove an alias.
 * @param {string} name - Alias name to remove
 * @returns {{ success: boolean, message: string }}
 */
function removeAlias(name) {
  if (!name) {
    return { success: false, message: 'Usage: aiox alias remove <name>' };
  }

  const aliases = loadAliases();
  if (!aliases[name]) {
    return { success: false, message: `Alias "${name}" not found` };
  }

  delete aliases[name];
  saveAliases(aliases);
  return { success: true, message: `Removed alias: ${name}` };
}

/**
 * Reset aliases to defaults.
 * @returns {{ success: boolean, message: string }}
 */
function resetAliases() {
  saveAliases({ ...DEFAULT_ALIASES });
  return { success: true, message: 'Aliases reset to defaults' };
}

/**
 * Resolve a command string through the alias map.
 * @param {string} command - Input command
 * @returns {string|null} Resolved command or null if not an alias
 */
function resolveAlias(command) {
  if (!command) return null;
  const aliases = loadAliases();
  return aliases[command] || null;
}

// ── Display Helpers ──────────────────────────────────────────────────────────

function showAliasList() {
  const aliases = loadAliases();
  const keys = Object.keys(aliases).sort();

  if (keys.length === 0) {
    console.log('No aliases configured.');
    console.log('Run "aiox alias set <name> <command>" to create one.');
    return;
  }

  console.log('\n  AIOX CLI Aliases\n');

  // Table header
  const nameWidth = Math.max(6, ...keys.map(k => k.length)) + 2;
  const header = `  ${'Alias'.padEnd(nameWidth)}Command`;
  const separator = `  ${'─'.repeat(nameWidth)}${'─'.repeat(20)}`;

  console.log(header);
  console.log(separator);

  for (const key of keys) {
    const isDefault = DEFAULT_ALIASES[key] === aliases[key];
    const marker = isDefault ? '' : ' *';
    console.log(`  ${key.padEnd(nameWidth)}${aliases[key]}${marker}`);
  }

  console.log('');
  console.log(`  ${keys.length} alias(es) configured`);
  console.log('  (* = custom)\n');
}

function showHelp() {
  console.log(`
  Usage: aiox alias <subcommand> [options]

  Manage CLI command aliases and shortcuts.

  Subcommands:
    list                Show all configured aliases
    set <name> <cmd>    Create or update an alias
    remove <name>       Delete an alias
    reset               Restore default aliases

  Default Aliases:
    s -> status     d -> doctor     h -> help
    a -> agents     i -> info       p -> palette

  Examples:
    aiox alias list
    aiox alias set t test
    aiox alias set wf workflow
    aiox alias remove t
    aiox alias reset
`);
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run the alias command.
 * @param {string[]} args - Arguments after "alias"
 */
function runAlias(args) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
    case 'ls':
      showAliasList();
      break;

    case 'set':
    case 'add': {
      const result = setAlias(args[1], args.slice(2).join(' '));
      console.log(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
      if (!result.success) process.exitCode = 1;
      break;
    }

    case 'remove':
    case 'rm':
    case 'delete': {
      const result = removeAlias(args[1]);
      console.log(result.success ? `✓ ${result.message}` : `✗ ${result.message}`);
      if (!result.success) process.exitCode = 1;
      break;
    }

    case 'reset': {
      const result = resetAliases();
      console.log(`✓ ${result.message}`);
      break;
    }

    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;

    default:
      console.error(`Unknown alias subcommand: ${subcommand}`);
      showHelp();
      process.exitCode = 1;
      break;
  }
}

module.exports = { runAlias, resolveAlias, loadAliases, setAlias, removeAlias, resetAliases, DEFAULT_ALIASES, EXISTING_COMMANDS };
