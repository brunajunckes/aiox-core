/**
 * Command Reference Generator
 *
 * Generates a complete command reference for all AIOX CLI commands.
 * Supports markdown, JSON, and text output formats.
 *
 * @module cli/commands/ref
 * @version 1.0.0
 * @story 19.3 - Command Reference Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Dependencies ───────────────────────────────────────────────────────────────

// Reuse registry from man command
let _manModule;
function getManModule() {
  if (!_manModule) {
    _manModule = require('../man/index.js');
  }
  return _manModule;
}

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Get all commands, optionally filtered by category.
 * @param {string} [category]
 * @returns {Array}
 */
function getCommands(category) {
  const { COMMAND_REGISTRY } = getManModule();
  if (!category) return [...COMMAND_REGISTRY];
  return COMMAND_REGISTRY.filter(c => c.category === category);
}

/**
 * Get all available categories.
 * @returns {string[]}
 */
function getAvailableCategories() {
  const { COMMAND_REGISTRY } = getManModule();
  const cats = new Set();
  for (const cmd of COMMAND_REGISTRY) {
    cats.add(cmd.category);
  }
  return [...cats].sort();
}

/**
 * Group commands by category.
 * @param {Array} commands
 * @returns {object}
 */
function groupByCategory(commands) {
  const groups = {};
  for (const cmd of commands) {
    const cat = cmd.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(cmd);
  }
  return groups;
}

/**
 * Format reference as plain text.
 * @param {Array} commands
 * @returns {string}
 */
function formatText(commands) {
  const { CATEGORIES } = getManModule();
  const grouped = groupByCategory(commands);
  const lines = [];
  lines.push('AIOX CLI Command Reference');
  lines.push('='.repeat(60));
  lines.push('');

  for (const [cat, cmds] of Object.entries(grouped)) {
    const label = CATEGORIES[cat] || cat;
    lines.push(`${label.toUpperCase()}`);
    lines.push('-'.repeat(40));
    for (const cmd of cmds) {
      lines.push(`  ${cmd.name.padEnd(20)} ${cmd.description}`);
    }
    lines.push('');
  }

  lines.push(`Total: ${commands.length} commands`);
  return lines.join('\n');
}

/**
 * Format reference as markdown.
 * @param {Array} commands
 * @returns {string}
 */
function formatMarkdown(commands) {
  const { CATEGORIES } = getManModule();
  const grouped = groupByCategory(commands);
  const lines = [];
  lines.push('# AIOX CLI Command Reference');
  lines.push('');

  for (const [cat, cmds] of Object.entries(grouped)) {
    const label = CATEGORIES[cat] || cat;
    lines.push(`## ${label}`);
    lines.push('');
    lines.push('| Command | Description |');
    lines.push('|---------|-------------|');
    for (const cmd of cmds) {
      lines.push(`| \`${cmd.name}\` | ${cmd.description} |`);
    }
    lines.push('');
  }

  lines.push(`> Total: ${commands.length} commands`);
  return lines.join('\n');
}

/**
 * Format reference as JSON.
 * @param {Array} commands
 * @returns {string}
 */
function formatJSON(commands) {
  const grouped = groupByCategory(commands);
  const result = {
    title: 'AIOX CLI Command Reference',
    total: commands.length,
    categories: {},
  };
  for (const [cat, cmds] of Object.entries(grouped)) {
    result.categories[cat] = cmds.map(c => ({
      name: c.name,
      synopsis: c.synopsis,
      description: c.description,
      options: c.options || [],
      examples: c.examples || [],
    }));
  }
  return JSON.stringify(result, null, 2);
}

/**
 * Write output to a file.
 * @param {string} filePath
 * @param {string} content
 * @returns {{ path: string, bytes: number }}
 */
function writeOutput(filePath, content) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absPath, content + '\n', 'utf8');
  return { path: absPath, bytes: Buffer.byteLength(content + '\n') };
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `Usage: aiox ref [options]

Generate complete command reference.

Options:
  --format <fmt>      Output format: text (default), markdown, json
  --output <file>     Write output to file
  --category <cat>    Filter by category
  -h, --help          Show this help message

Categories:
  core, config, dev, test, quality, docs, analytics, data, infra

Examples:
  aiox ref                          Show all commands
  aiox ref --format markdown        As markdown
  aiox ref --format json            As JSON
  aiox ref --output docs/ref.md     Write to file
  aiox ref --category test          Filter by testing`;
}

/**
 * Parse a flag value from argv.
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string|null}
 */
function parseFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

/**
 * Main runner.
 * @param {string[]} argv
 */
function runRef(argv = []) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(getHelpText());
    return;
  }

  const format = parseFlag(argv, '--format') || 'text';
  const output = parseFlag(argv, '--output');
  const category = parseFlag(argv, '--category');

  // Validate format
  if (!['text', 'markdown', 'json'].includes(format)) {
    console.error(`Invalid format: ${format}. Use text, markdown, or json.`);
    process.exitCode = 1;
    return;
  }

  // Validate category
  if (category) {
    const available = getAvailableCategories();
    if (!available.includes(category)) {
      console.error(`Unknown category: ${category}. Available: ${available.join(', ')}`);
      process.exitCode = 1;
      return;
    }
  }

  const commands = getCommands(category);

  let content;
  if (format === 'markdown') {
    content = formatMarkdown(commands);
  } else if (format === 'json') {
    content = formatJSON(commands);
  } else {
    content = formatText(commands);
  }

  if (output) {
    const result = writeOutput(output, content);
    console.log(`Reference written to ${result.path} (${result.bytes} bytes)`);
  } else {
    console.log(content);
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runRef,
  getHelpText,
  getCommands,
  getAvailableCategories,
  groupByCategory,
  formatText,
  formatMarkdown,
  formatJSON,
  writeOutput,
  parseFlag,
};
