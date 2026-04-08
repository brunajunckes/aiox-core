/**
 * Hooks Command Module
 *
 * Plugin hook system for AIOX CLI lifecycle events.
 * Register custom commands to run on pre-command, post-command,
 * pre-commit, post-test, pre-push, and post-install events.
 *
 * @module cli/commands/hooks
 * @version 1.0.0
 * @story 6.3 - Plugin Hook System
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENTS = [
  'pre-command',
  'post-command',
  'pre-commit',
  'post-test',
  'pre-push',
  'post-install',
];

// ── Path Helpers ─────────────────────────────────────────────────────────────

/**
 * Get path to hooks configuration file.
 * @returns {string}
 */
function getHooksFile() {
  return path.join(process.cwd(), '.aiox', 'hooks.json');
}

// ── Data Helpers ─────────────────────────────────────────────────────────────

/**
 * Read hooks configuration from disk.
 * Returns default structure if file does not exist or is invalid.
 * @returns {{ hooks: Array<Object> }}
 */
function readHooks() {
  const filePath = getHooksFile();
  try {
    if (!fs.existsSync(filePath)) {
      return { hooks: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.hooks)) {
      return { hooks: [] };
    }
    return data;
  } catch {
    return { hooks: [] };
  }
}

/**
 * Atomic write of hooks configuration.
 * @param {{ hooks: Array<Object> }} data
 */
function writeHooks(data) {
  const filePath = getHooksFile();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Fallback: direct write (Windows rename can fail if target exists)
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

/**
 * Generate a unique hook ID.
 * @returns {string}
 */
function generateId() {
  return `hook-${Date.now()}`;
}

// ── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Add a new hook.
 * @param {string} event - Hook event name
 * @param {string} command - Shell command to execute
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.enabled=true] - Whether hook starts enabled
 * @returns {{ ok: boolean, hook?: Object, error?: string }}
 */
function addHook(event, command, options = {}) {
  if (!event || typeof event !== 'string') {
    return { ok: false, error: 'Event is required.' };
  }
  if (!EVENTS.includes(event)) {
    return { ok: false, error: `Invalid event "${event}". Valid events: ${EVENTS.join(', ')}` };
  }
  if (!command || typeof command !== 'string' || command.trim() === '') {
    return { ok: false, error: 'Command is required.' };
  }

  const data = readHooks();
  const hook = {
    id: generateId(),
    event,
    command: command.trim(),
    enabled: options.enabled !== undefined ? Boolean(options.enabled) : true,
    createdAt: new Date().toISOString(),
  };
  data.hooks.push(hook);
  writeHooks(data);
  return { ok: true, hook };
}

/**
 * Remove a hook by ID.
 * @param {string} id
 * @returns {{ ok: boolean, error?: string }}
 */
function removeHook(id) {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Hook ID is required.' };
  }
  const data = readHooks();
  const idx = data.hooks.findIndex((h) => h.id === id);
  if (idx === -1) {
    return { ok: false, error: `Hook "${id}" not found.` };
  }
  data.hooks.splice(idx, 1);
  writeHooks(data);
  return { ok: true };
}

/**
 * Enable a hook by ID.
 * @param {string} id
 * @returns {{ ok: boolean, error?: string }}
 */
function enableHook(id) {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Hook ID is required.' };
  }
  const data = readHooks();
  const hook = data.hooks.find((h) => h.id === id);
  if (!hook) {
    return { ok: false, error: `Hook "${id}" not found.` };
  }
  hook.enabled = true;
  writeHooks(data);
  return { ok: true };
}

/**
 * Disable a hook by ID.
 * @param {string} id
 * @returns {{ ok: boolean, error?: string }}
 */
function disableHook(id) {
  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Hook ID is required.' };
  }
  const data = readHooks();
  const hook = data.hooks.find((h) => h.id === id);
  if (!hook) {
    return { ok: false, error: `Hook "${id}" not found.` };
  }
  hook.enabled = false;
  writeHooks(data);
  return { ok: true };
}

/**
 * List all hooks, optionally filtered by event.
 * @param {Object} [options]
 * @param {string} [options.event] - Filter by event name
 * @returns {Array<Object>}
 */
function listHooks(options = {}) {
  const data = readHooks();
  let hooks = data.hooks;
  if (options.event) {
    hooks = hooks.filter((h) => h.event === options.event);
  }
  return hooks;
}

// ── Display Helpers ──────────────────────────────────────────────────────────

/**
 * Format hooks list for CLI display.
 * @param {Array<Object>} hooks
 * @returns {string}
 */
function formatHooksList(hooks) {
  if (hooks.length === 0) {
    return 'No hooks registered.';
  }

  const lines = ['', 'Registered Hooks:', ''];
  for (const hook of hooks) {
    const status = hook.enabled ? '[enabled]' : '[disabled]';
    lines.push(`  ${hook.id}  ${status}`);
    lines.push(`    Event:   ${hook.event}`);
    lines.push(`    Command: ${hook.command}`);
    lines.push(`    Created: ${hook.createdAt}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Format events list for CLI display.
 * @returns {string}
 */
function formatEventsList() {
  const lines = ['', 'Available Hook Events:', ''];
  for (const event of EVENTS) {
    lines.push(`  - ${event}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Show help text.
 * @returns {string}
 */
function showHelp() {
  return `
AIOX Hooks - Plugin Hook System

USAGE:
  aiox hooks list                    List all registered hooks
  aiox hooks add <event> <command>   Add a new hook
  aiox hooks remove <id>             Remove a hook by ID
  aiox hooks enable <id>             Enable a hook
  aiox hooks disable <id>            Disable a hook
  aiox hooks events                  List available hook events
  aiox hooks --help                  Show this help

EVENTS:
  ${EVENTS.join(', ')}

EXAMPLES:
  aiox hooks add post-test "echo 'Tests complete!'"
  aiox hooks add pre-push "npm run lint"
  aiox hooks disable hook-1712345678
  aiox hooks list
`.trim();
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Main CLI handler for hooks command.
 * @param {string[]} argv - Arguments after 'hooks'
 */
function runHooks(argv) {
  const sub = argv[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(showHelp());
    return;
  }

  switch (sub) {
    case 'list': {
      const eventFilter = argv[1] === '--event' ? argv[2] : undefined;
      const hooks = listHooks({ event: eventFilter });
      console.log(formatHooksList(hooks));
      break;
    }

    case 'add': {
      const event = argv[1];
      const command = argv.slice(2).join(' ');
      if (!event || !command) {
        console.error('Usage: aiox hooks add <event> <command>');
        process.exitCode = 1;
        return;
      }
      const result = addHook(event, command);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`Hook added: ${result.hook.id} (${result.hook.event})`);
      break;
    }

    case 'remove': {
      const id = argv[1];
      if (!id) {
        console.error('Usage: aiox hooks remove <id>');
        process.exitCode = 1;
        return;
      }
      const result = removeHook(id);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`Hook removed: ${id}`);
      break;
    }

    case 'enable': {
      const id = argv[1];
      if (!id) {
        console.error('Usage: aiox hooks enable <id>');
        process.exitCode = 1;
        return;
      }
      const result = enableHook(id);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`Hook enabled: ${id}`);
      break;
    }

    case 'disable': {
      const id = argv[1];
      if (!id) {
        console.error('Usage: aiox hooks disable <id>');
        process.exitCode = 1;
        return;
      }
      const result = disableHook(id);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(`Hook disabled: ${id}`);
      break;
    }

    case 'events': {
      console.log(formatEventsList());
      break;
    }

    default:
      console.error(`Unknown hooks subcommand: ${sub}`);
      console.log(showHelp());
      process.exitCode = 1;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  EVENTS,
  getHooksFile,
  readHooks,
  writeHooks,
  generateId,
  addHook,
  removeHook,
  enableHook,
  disableHook,
  listHooks,
  formatHooksList,
  formatEventsList,
  showHelp,
  runHooks,
};
