/**
 * Man Page Generator
 *
 * Generates formatted man-page-style help for all AIOX CLI commands.
 * Reads command metadata from bin/aiox.js switch cases.
 *
 * @module cli/commands/man
 * @version 1.0.0
 * @story 19.1 - Man Page Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const MAN_DIR_NAME = '.aiox/man';

/**
 * Command registry with metadata for man pages.
 * Each entry: { name, synopsis, description, options?, examples?, category }
 */
const COMMAND_REGISTRY = [
  { name: 'install', synopsis: 'aiox install [options]', description: 'Install AIOX in the current project.', options: ['--force  Force reinstall', '--quiet  Minimal output', '--dry-run  Preview changes'], category: 'core', examples: ['aiox install', 'aiox install --force'] },
  { name: 'uninstall', synopsis: 'aiox uninstall [options]', description: 'Remove AIOX from the current project.', options: ['--force  Skip confirmation', '--keep-data  Keep .aiox/ directory', '--dry-run  Preview removal'], category: 'core', examples: ['aiox uninstall', 'aiox uninstall --force'] },
  { name: 'init', synopsis: 'aiox init <name>', description: 'Create a new project with AIOX scaffolding.', category: 'core', examples: ['aiox init my-app'] },
  { name: 'info', synopsis: 'aiox info', description: 'Show system and project information.', category: 'core', examples: ['aiox info'] },
  { name: 'doctor', synopsis: 'aiox doctor [options]', description: 'Run health checks on your AIOX installation.', options: ['--fix  Auto-fix issues', '--json  JSON output', '--quiet  Minimal output'], category: 'core', examples: ['aiox doctor', 'aiox doctor --fix'] },
  { name: 'status', synopsis: 'aiox status', description: 'Show project and session status.', category: 'core', examples: ['aiox status'] },
  { name: 'resume', synopsis: 'aiox resume', description: 'Resume last session.', category: 'core', examples: ['aiox resume'] },
  { name: 'help', synopsis: 'aiox help [--raw]', description: 'Context-aware help that adapts to session.', options: ['--raw  Full static help'], category: 'core', examples: ['aiox help', 'aiox help --raw'] },
  { name: 'update', synopsis: 'aiox update [options]', description: 'Update AIOX to the latest version.', options: ['--check  Check only', '--dry-run  Preview updates'], category: 'core', examples: ['aiox update', 'aiox update --check'] },
  { name: 'validate', synopsis: 'aiox validate', description: 'Validate installation integrity.', category: 'core', examples: ['aiox validate'] },
  { name: 'config', synopsis: 'aiox config <key> [value]', description: 'Get or set configuration values.', category: 'config', examples: ['aiox config model', 'aiox config model opus'] },
  { name: 'config-diff', synopsis: 'aiox config-diff [options]', description: 'Show configuration differences.', category: 'config', examples: ['aiox config-diff'] },
  { name: 'theme', synopsis: 'aiox theme [name]', description: 'Manage CLI themes.', category: 'config', examples: ['aiox theme', 'aiox theme dark'] },
  { name: 'env', synopsis: 'aiox env', description: 'Manage environment variables.', category: 'config', examples: ['aiox env'] },
  { name: 'secrets', synopsis: 'aiox secrets', description: 'Manage project secrets.', category: 'config', examples: ['aiox secrets'] },
  { name: 'alias', synopsis: 'aiox alias <name> <command>', description: 'Create command aliases.', category: 'config', examples: ['aiox alias t test'] },
  { name: 'agents', synopsis: 'aiox agents [options]', description: 'List and manage AI agents.', category: 'dev', examples: ['aiox agents', 'aiox agents --list'] },
  { name: 'workers', synopsis: 'aiox workers [options]', description: 'Manage background workers.', category: 'dev', examples: ['aiox workers'] },
  { name: 'chain', synopsis: 'aiox chain <commands...>', description: 'Chain multiple commands together.', category: 'dev', examples: ['aiox chain lint test build'] },
  { name: 'batch', synopsis: 'aiox batch <file>', description: 'Run batch command files.', category: 'dev', examples: ['aiox batch commands.txt'] },
  { name: 'cron', synopsis: 'aiox cron [options]', description: 'Schedule recurring tasks.', category: 'dev', examples: ['aiox cron --list'] },
  { name: 'tasks', synopsis: 'aiox tasks [options]', description: 'Manage development tasks.', category: 'dev', examples: ['aiox tasks', 'aiox tasks --list'] },
  { name: 'watch', synopsis: 'aiox watch [pattern]', description: 'Watch files for changes and run commands.', category: 'dev', examples: ['aiox watch "src/**/*.js"'] },
  { name: 'setup', synopsis: 'aiox setup', description: 'Run project setup wizard.', category: 'dev', examples: ['aiox setup'] },
  { name: 'test', synopsis: 'aiox test [options]', description: 'Run project tests.', category: 'test', examples: ['aiox test', 'aiox test --coverage'] },
  { name: 'coverage', synopsis: 'aiox coverage', description: 'Generate test coverage reports.', category: 'test', examples: ['aiox coverage'] },
  { name: 'test-gen', synopsis: 'aiox test-gen <file>', description: 'Auto-generate test skeletons from module exports.', category: 'test', examples: ['aiox test-gen src/utils.js'] },
  { name: 'flaky', synopsis: 'aiox flaky [options]', description: 'Detect flaky tests from run history.', category: 'test', examples: ['aiox flaky', 'aiox flaky --threshold 0.3'] },
  { name: 'test-impact', synopsis: 'aiox test-impact [options]', description: 'Analyze test impact from code changes.', category: 'test', examples: ['aiox test-impact'] },
  { name: 'test-report', synopsis: 'aiox test-report [options]', description: 'Generate test report dashboards.', category: 'test', examples: ['aiox test-report'] },
  { name: 'lint', synopsis: 'aiox lint [options]', description: 'Run linter on the project.', category: 'quality', examples: ['aiox lint', 'aiox lint --fix'] },
  { name: 'audit', synopsis: 'aiox audit [options]', description: 'Run security audit.', category: 'quality', examples: ['aiox audit'] },
  { name: 'benchmark', synopsis: 'aiox benchmark [options]', description: 'Run performance benchmarks.', category: 'quality', examples: ['aiox benchmark'] },
  { name: 'governance', synopsis: 'aiox governance', description: 'Check project governance compliance.', category: 'quality', examples: ['aiox governance'] },
  { name: 'licenses', synopsis: 'aiox licenses', description: 'Check dependency licenses.', category: 'quality', examples: ['aiox licenses'] },
  { name: 'changelog', synopsis: 'aiox changelog [options]', description: 'Generate changelog from git history.', category: 'docs', examples: ['aiox changelog', 'aiox changelog --format json'] },
  { name: 'auto-changelog', synopsis: 'aiox auto-changelog', description: 'Auto-generate changelog on commit.', category: 'docs', examples: ['aiox auto-changelog'] },
  { name: 'docs-gen', synopsis: 'aiox docs-gen [options]', description: 'Generate documentation.', category: 'docs', examples: ['aiox docs-gen'] },
  { name: 'api-docs', synopsis: 'aiox api-docs', description: 'Generate API documentation.', category: 'docs', examples: ['aiox api-docs'] },
  { name: 'contributors', synopsis: 'aiox contributors', description: 'List project contributors.', category: 'docs', examples: ['aiox contributors'] },
  { name: 'sprint-report', synopsis: 'aiox sprint-report [options]', description: 'Generate sprint reports.', category: 'docs', examples: ['aiox sprint-report'] },
  { name: 'analytics', synopsis: 'aiox analytics [options]', description: 'View project analytics.', category: 'analytics', examples: ['aiox analytics'] },
  { name: 'dashboard', synopsis: 'aiox dashboard', description: 'Open analytics dashboard.', category: 'analytics', examples: ['aiox dashboard'] },
  { name: 'data', synopsis: 'aiox data [options]', description: 'Manage project data.', category: 'data', examples: ['aiox data'] },
  { name: 'kv', synopsis: 'aiox kv <get|set|del> <key> [value]', description: 'Key-value store operations.', category: 'data', examples: ['aiox kv get mykey', 'aiox kv set mykey val'] },
  { name: 'cache', synopsis: 'aiox cache [options]', description: 'Manage CLI cache.', category: 'data', examples: ['aiox cache', 'aiox cache --clear'] },
  { name: 'backup', synopsis: 'aiox backup [options]', description: 'Backup project data.', category: 'data', examples: ['aiox backup', 'aiox backup --restore'] },
  { name: 'notify', synopsis: 'aiox notify <message>', description: 'Send notifications.', category: 'infra', examples: ['aiox notify "Build done"'] },
  { name: 'githooks', synopsis: 'aiox githooks [options]', description: 'Manage git hooks.', category: 'infra', examples: ['aiox githooks', 'aiox githooks --install'] },
  { name: 'completion', synopsis: 'aiox completion [shell]', description: 'Generate shell completion scripts.', category: 'infra', examples: ['aiox completion bash'] },
  { name: 'webhooks', synopsis: 'aiox webhooks [options]', description: 'Manage webhooks.', category: 'infra', examples: ['aiox webhooks'] },
  { name: 'serve', synopsis: 'aiox serve [options]', description: 'Start a dev server.', category: 'infra', examples: ['aiox serve'] },
  { name: 'healthcheck', synopsis: 'aiox healthcheck', description: 'Run infrastructure health checks.', category: 'infra', examples: ['aiox healthcheck'] },
  { name: 'init-project', synopsis: 'aiox init-project <name>', description: 'Initialize a new project scaffold.', category: 'core', examples: ['aiox init-project my-app'] },
  { name: 'pro', synopsis: 'aiox pro [options]', description: 'Access Pro features.', category: 'core', examples: ['aiox pro'] },
  { name: 'man', synopsis: 'aiox man [command] [options]', description: 'Show formatted man pages for AIOX commands.', options: ['--generate  Generate man page files', '--list  List all available man pages'], category: 'docs', examples: ['aiox man', 'aiox man config', 'aiox man --generate'] },
  { name: 'tutorial', synopsis: 'aiox tutorial [options]', description: 'Interactive step-by-step tutorial for AIOX.', options: ['--step N  Show specific step', '--list  List all steps', '--reset  Reset progress'], category: 'docs', examples: ['aiox tutorial', 'aiox tutorial --step 3'] },
  { name: 'ref', synopsis: 'aiox ref [options]', description: 'Generate complete command reference.', options: ['--format <fmt>  Output format (markdown|json)', '--output <file>  Write to file', '--category <cat>  Filter by category'], category: 'docs', examples: ['aiox ref', 'aiox ref --format json'] },
  { name: 'changes', synopsis: 'aiox changes [options]', description: 'View recent changes from changelog or git log.', options: ['--since <tag>  Changes since tag', '--count N  Last N entries', '--format json  JSON output', '--breaking  Breaking changes only'], category: 'docs', examples: ['aiox changes', 'aiox changes --since v5.0.0'] },
];

const CATEGORIES = {
  core: 'Core',
  config: 'Configuration',
  dev: 'Development',
  test: 'Testing',
  quality: 'Quality',
  docs: 'Documentation',
  analytics: 'Analytics',
  data: 'Data',
  infra: 'Infrastructure',
};

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Get the full command registry.
 * @returns {Array}
 */
function getRegistry() {
  return COMMAND_REGISTRY;
}

/**
 * Get all category names.
 * @returns {object}
 */
function getCategories() {
  return CATEGORIES;
}

/**
 * Find a command by name.
 * @param {string} name
 * @returns {object|null}
 */
function findCommand(name) {
  if (!name || typeof name !== 'string') return null;
  return COMMAND_REGISTRY.find(c => c.name === name) || null;
}

/**
 * Format a single man page for a command.
 * @param {object} cmd - Command metadata object
 * @returns {string}
 */
function formatManPage(cmd) {
  if (!cmd || !cmd.name) return '';
  const lines = [];
  lines.push(`AIOX-${cmd.name.toUpperCase()}(1)`);
  lines.push('');
  lines.push('NAME');
  lines.push(`    ${cmd.name} - ${cmd.description}`);
  lines.push('');
  lines.push('SYNOPSIS');
  lines.push(`    ${cmd.synopsis}`);
  lines.push('');
  lines.push('DESCRIPTION');
  lines.push(`    ${cmd.description}`);
  if (cmd.options && cmd.options.length > 0) {
    lines.push('');
    lines.push('OPTIONS');
    for (const opt of cmd.options) {
      lines.push(`    ${opt}`);
    }
  }
  if (cmd.examples && cmd.examples.length > 0) {
    lines.push('');
    lines.push('EXAMPLES');
    for (const ex of cmd.examples) {
      lines.push(`    $ ${ex}`);
    }
  }
  lines.push('');
  lines.push('CATEGORY');
  lines.push(`    ${CATEGORIES[cmd.category] || cmd.category}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Format overview man page for all commands.
 * @returns {string}
 */
function formatOverview() {
  const lines = [];
  lines.push('AIOX(1) — AIOX CLI Manual');
  lines.push('');
  lines.push('DESCRIPTION');
  lines.push('    AIOX-FullStack CLI — AI-Orchestrated System for Full Stack Development');
  lines.push('');

  const grouped = {};
  for (const cmd of COMMAND_REGISTRY) {
    const cat = cmd.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(cmd);
  }

  for (const [cat, cmds] of Object.entries(grouped)) {
    const label = CATEGORIES[cat] || cat;
    lines.push(`${label.toUpperCase()} COMMANDS`);
    for (const c of cmds) {
      lines.push(`    ${c.name.padEnd(20)} ${c.description}`);
    }
    lines.push('');
  }

  lines.push('SEE ALSO');
  lines.push('    aiox man <command>     Show help for specific command');
  lines.push('    aiox man --generate    Generate man page files');
  lines.push('    aiox man --list        List all man pages');
  lines.push('');
  return lines.join('\n');
}

/**
 * List all available man pages.
 * @returns {string}
 */
function listManPages() {
  const lines = ['Available man pages:', ''];
  for (const cmd of COMMAND_REGISTRY) {
    lines.push(`  ${cmd.name}`);
  }
  lines.push('');
  lines.push(`Total: ${COMMAND_REGISTRY.length} commands`);
  return lines.join('\n');
}

/**
 * Generate man page files to .aiox/man/.
 * @param {object} [options]
 * @param {string} [options.baseDir] - Base directory (default: process.cwd())
 * @returns {{ dir: string, count: number, files: string[] }}
 */
function generateManPages(options = {}) {
  const baseDir = options.baseDir || process.cwd();
  const manDir = path.join(baseDir, MAN_DIR_NAME);
  if (!fs.existsSync(manDir)) {
    fs.mkdirSync(manDir, { recursive: true });
  }

  const files = [];
  // Write overview
  const overviewPath = path.join(manDir, 'aiox.1');
  fs.writeFileSync(overviewPath, formatOverview(), 'utf8');
  files.push('aiox.1');

  for (const cmd of COMMAND_REGISTRY) {
    const filename = `aiox-${cmd.name}.1`;
    const filePath = path.join(manDir, filename);
    fs.writeFileSync(filePath, formatManPage(cmd), 'utf8');
    files.push(filename);
  }

  return { dir: manDir, count: files.length, files };
}

/**
 * Get help text for the man command.
 * @returns {string}
 */
function getHelpText() {
  return `Usage: aiox man [command] [options]

Show formatted man pages for AIOX commands.

Options:
  --generate    Generate man page files at .aiox/man/
  --list        List all available man pages
  -h, --help    Show this help message

Examples:
  aiox man                Show overview of all commands
  aiox man config         Show man page for config command
  aiox man --generate     Generate man page files
  aiox man --list         List all man pages`;
}

/**
 * Main runner.
 * @param {string[]} argv
 */
function runMan(argv = []) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(getHelpText());
    return;
  }

  if (argv.includes('--list')) {
    console.log(listManPages());
    return;
  }

  if (argv.includes('--generate')) {
    const result = generateManPages();
    console.log(`Generated ${result.count} man pages at ${result.dir}`);
    return;
  }

  // Specific command
  const cmdName = argv.find(a => !a.startsWith('-'));
  if (cmdName) {
    const cmd = findCommand(cmdName);
    if (!cmd) {
      console.error(`No man page found for: ${cmdName}`);
      process.exitCode = 1;
      return;
    }
    console.log(formatManPage(cmd));
    return;
  }

  // Default: overview
  console.log(formatOverview());
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runMan,
  getHelpText,
  getRegistry,
  getCategories,
  findCommand,
  formatManPage,
  formatOverview,
  listManPages,
  generateManPages,
  COMMAND_REGISTRY,
  CATEGORIES,
  MAN_DIR_NAME,
};
