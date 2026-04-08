'use strict';

/**
 * Template Scaffold Generator — Story 8.2
 * Generates project files from scaffold templates.
 * Zero external dependencies. ES2022 CommonJS.
 */

const fs = require('fs');
const path = require('path');

/** Supported scaffold types */
const SCAFFOLD_TYPES = ['component', 'module', 'test', 'story', 'workflow', 'squad'];

/**
 * Returns the absolute path to the scaffolds directory.
 * @returns {string}
 */
function getScaffoldsDir() {
  return path.resolve(__dirname, '..', '..', '..', 'data', 'scaffolds');
}

/**
 * Lists available scaffold types by scanning the scaffolds directory.
 * @returns {string[]} Array of scaffold type names (without extensions).
 */
function listScaffolds() {
  const dir = getScaffoldsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.includes('.tmpl.'))
    .map((f) => f.replace(/\.tmpl\.\w+$/, ''))
    .sort();
}

/**
 * Loads a scaffold template by type.
 * @param {string} type - The scaffold type (e.g., 'component', 'module').
 * @returns {string} The template content.
 * @throws {Error} If the template does not exist.
 */
function loadTemplate(type) {
  if (!type || typeof type !== 'string') {
    throw new Error('Scaffold type is required');
  }

  const dir = getScaffoldsDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`Scaffolds directory not found: ${dir}`);
  }

  // Find the template file matching the type
  const files = fs.readdirSync(dir);
  const match = files.find((f) => f.startsWith(`${type}.tmpl.`));

  if (!match) {
    throw new Error(
      `Unknown scaffold type: "${type}". Available: ${listScaffolds().join(', ') || 'none'}`
    );
  }

  return fs.readFileSync(path.join(dir, match), 'utf8');
}

/**
 * Interpolates {{placeholder}} variables in template content.
 * @param {string} content - Template content with {{placeholders}}.
 * @param {Record<string, string>} vars - Variable map.
 * @returns {string} Interpolated content.
 */
function interpolate(content, vars) {
  if (!content || typeof content !== 'string') {
    return '';
  }
  if (!vars || typeof vars !== 'object') {
    return content;
  }

  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
  });
}

/**
 * Generates a scaffold file from a template.
 * @param {string} type - Scaffold type.
 * @param {string} name - Name for the generated artifact.
 * @param {object} [options] - Additional options.
 * @param {string} [options.author] - Author name.
 * @param {string} [options.output] - Output directory (defaults to cwd).
 * @param {boolean} [options.force] - Overwrite existing files.
 * @param {boolean} [options.dryRun] - Print content instead of writing.
 * @param {Record<string, string>} [options.extraVars] - Additional template variables.
 * @returns {{ filePath: string, content: string }} Generated file info.
 */
function generateScaffold(type, name, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Scaffold name is required');
  }

  const template = loadTemplate(type);

  // Build variable map
  const vars = {
    name,
    Name: name.charAt(0).toUpperCase() + name.slice(1),
    NAME: name.toUpperCase(),
    date: new Date().toISOString().slice(0, 10),
    author: options.author || 'AIOX',
    description: options.description || `${name} scaffold`,
    ...options.extraVars,
  };

  const content = interpolate(template, vars);

  // Determine output file extension from template file name
  const dir = getScaffoldsDir();
  const files = fs.readdirSync(dir);
  const tmplFile = files.find((f) => f.startsWith(`${type}.tmpl.`));
  const ext = tmplFile ? tmplFile.replace(/^.*\.tmpl\./, '') : 'js';

  const outputDir = options.output || process.cwd();
  const fileName = `${name}.${ext}`;
  const filePath = path.join(outputDir, fileName);

  if (options.dryRun) {
    return { filePath, content };
  }

  // Check for existing file
  if (fs.existsSync(filePath) && !options.force) {
    throw new Error(`File already exists: ${filePath}. Use --force to overwrite.`);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf8');

  return { filePath, content };
}

/**
 * CLI handler for the scaffold command.
 * @param {string[]} argv - Command arguments (after 'scaffold').
 */
function runScaffold(argv = []) {
  const subcommand = argv[0];

  // --help
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printHelp();
    return;
  }

  // list
  if (subcommand === 'list') {
    const scaffolds = listScaffolds();
    if (scaffolds.length === 0) {
      console.log('No scaffold templates found.');
      return;
    }
    console.log('Available scaffold types:');
    scaffolds.forEach((s) => console.log(`  - ${s}`));
    return;
  }

  // <type> [name] [options]
  const type = subcommand;
  const name = argv[1];

  if (!name || name.startsWith('-')) {
    console.error(`Error: Name is required. Usage: aiox scaffold ${type} <name>`);
    process.exit(1);
  }

  // Parse flags
  const flags = argv.slice(2);
  const options = {
    force: flags.includes('--force'),
    dryRun: flags.includes('--dry-run'),
  };

  // Parse --author=value
  const authorFlag = flags.find((f) => f.startsWith('--author='));
  if (authorFlag) {
    options.author = authorFlag.split('=').slice(1).join('=');
  }

  // Parse --output=value
  const outputFlag = flags.find((f) => f.startsWith('--output='));
  if (outputFlag) {
    options.output = outputFlag.split('=').slice(1).join('=');
  }

  // Parse --description=value
  const descFlag = flags.find((f) => f.startsWith('--description='));
  if (descFlag) {
    options.description = descFlag.split('=').slice(1).join('=');
  }

  try {
    const result = generateScaffold(type, name, options);
    if (options.dryRun) {
      console.log(`[dry-run] Would create: ${result.filePath}`);
      console.log('---');
      console.log(result.content);
    } else {
      console.log(`Created: ${result.filePath}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Prints help text for the scaffold command.
 */
function printHelp() {
  console.log(`
AIOX Scaffold Generator

USAGE:
  aiox scaffold <type> <name> [options]
  aiox scaffold list
  aiox scaffold --help

TYPES:
  component   — UI component scaffold
  module      — JS module scaffold
  test        — Test file scaffold
  story       — Development story scaffold
  workflow    — Workflow definition scaffold
  squad       — Squad expansion scaffold

OPTIONS:
  --author=<name>        Author name (default: AIOX)
  --output=<dir>         Output directory (default: cwd)
  --description=<text>   Description for the scaffold
  --force                Overwrite existing files
  --dry-run              Preview without writing

EXAMPLES:
  aiox scaffold component user-profile
  aiox scaffold module auth-service --author=Dex
  aiox scaffold test auth-service --output=tests/
  aiox scaffold story feature-login
  aiox scaffold list
`.trim());
}

module.exports = {
  getScaffoldsDir,
  listScaffolds,
  loadTemplate,
  interpolate,
  generateScaffold,
  runScaffold,
  SCAFFOLD_TYPES,
};
