/**
 * Project Init Templates
 *
 * Scaffold new projects with AIOX boilerplate using configurable templates.
 *
 * Usage:
 *   aiox init-project <name>                    — create with default template
 *   aiox init-project <name> --template api     — API template
 *   aiox init-project <name> --template cli     — CLI template
 *   aiox init-project <name> --template fullstack — Fullstack template
 *   aiox init-project --list-templates          — show available templates
 *   aiox init-project --help                    — show help
 *
 * @module cli/commands/init-project
 * @version 1.0.0
 * @story 13.2 — Project Init Templates
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
PROJECT INIT TEMPLATES

USAGE:
  aiox init-project <name>                     Create project with default template
  aiox init-project <name> --template <tpl>    Use a specific template
  aiox init-project --list-templates           List available templates
  aiox init-project --help                     Show this help

TEMPLATES:
  default    — Basic AIOX project structure
  api        — API project (Express-like structure)
  cli        — CLI tool project
  fullstack  — Full-stack project (API + frontend)

EXAMPLES:
  aiox init-project my-app
  aiox init-project my-api --template api
  aiox init-project my-tool --template cli
`.trim();

const TEMPLATES = {
  default: {
    name: 'default',
    description: 'Basic AIOX project structure',
    dirs: ['src', 'tests', '.aiox'],
    files: {
      'src/index.js': '\'use strict\';\n\n// Entry point\nconsole.log(\'Hello from AIOX!\');\n',
      'tests/.gitkeep': '',
    },
  },
  api: {
    name: 'api',
    description: 'API project (Express-like structure)',
    dirs: ['src', 'src/routes', 'src/middleware', 'src/models', 'tests', '.aiox'],
    files: {
      'src/index.js': '\'use strict\';\n\nconst http = require(\'http\');\n\nconst PORT = process.env.PORT || 3000;\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { \'Content-Type\': \'application/json\' });\n  res.end(JSON.stringify({ status: \'ok\' }));\n});\n\nserver.listen(PORT, () => {\n  console.log(`API running on port ${PORT}`);\n});\n',
      'src/routes/.gitkeep': '',
      'src/middleware/.gitkeep': '',
      'src/models/.gitkeep': '',
      'tests/.gitkeep': '',
    },
  },
  cli: {
    name: 'cli',
    description: 'CLI tool project',
    dirs: ['src', 'src/commands', 'bin', 'tests', '.aiox'],
    files: {
      'bin/cli.js': '#!/usr/bin/env node\n\'use strict\';\n\nconst args = process.argv.slice(2);\nconsole.log(\'CLI started with args:\', args);\n',
      'src/index.js': '\'use strict\';\n\n// CLI entry\nmodule.exports = { run() { console.log(\'Running CLI\'); } };\n',
      'src/commands/.gitkeep': '',
      'tests/.gitkeep': '',
    },
  },
  fullstack: {
    name: 'fullstack',
    description: 'Full-stack project (API + frontend)',
    dirs: [
      'src', 'src/api', 'src/api/routes', 'src/api/middleware',
      'src/client', 'src/client/components', 'src/client/pages',
      'src/shared', 'tests', 'tests/api', 'tests/client', '.aiox',
    ],
    files: {
      'src/api/index.js': '\'use strict\';\n\n// API entry point\nmodule.exports = {};\n',
      'src/api/routes/.gitkeep': '',
      'src/api/middleware/.gitkeep': '',
      'src/client/index.js': '\'use strict\';\n\n// Client entry point\nmodule.exports = {};\n',
      'src/client/components/.gitkeep': '',
      'src/client/pages/.gitkeep': '',
      'src/shared/index.js': '\'use strict\';\n\n// Shared utilities\nmodule.exports = {};\n',
      'tests/api/.gitkeep': '',
      'tests/client/.gitkeep': '',
    },
  },
};

// ── Template Logic ───────────────────────────────────────────────────────────

/**
 * List available templates.
 * @returns {Array<{ name: string, description: string }>}
 */
function listTemplates() {
  return Object.values(TEMPLATES).map(t => ({ name: t.name, description: t.description }));
}

/**
 * Get a template by name.
 * @param {string} name
 * @returns {object|null}
 */
function getTemplate(name) {
  return TEMPLATES[name] || null;
}

/**
 * Generate package.json content.
 * @param {string} projectName
 * @param {string} templateName
 * @returns {string}
 */
function generatePackageJson(projectName, templateName) {
  const pkg = {
    name: projectName,
    version: '0.1.0',
    description: `${projectName} — created with AIOX (${templateName} template)`,
    main: templateName === 'cli' ? 'bin/cli.js' : 'src/index.js',
    scripts: {
      start: templateName === 'cli' ? 'node bin/cli.js' : 'node src/index.js',
      test: 'jest',
      lint: 'eslint src/',
    },
    keywords: ['aiox'],
    license: 'MIT',
  };
  if (templateName === 'cli') {
    pkg.bin = { [projectName]: './bin/cli.js' };
  }
  return JSON.stringify(pkg, null, 2) + '\n';
}

/**
 * Generate .gitignore content.
 * @returns {string}
 */
function generateGitignore() {
  return [
    'node_modules/',
    'coverage/',
    'dist/',
    '.env',
    '.env.local',
    '*.log',
    '.DS_Store',
    '',
  ].join('\n');
}

/**
 * Generate README content.
 * @param {string} projectName
 * @param {string} templateName
 * @returns {string}
 */
function generateReadme(projectName, templateName) {
  return [
    `# ${projectName}`,
    '',
    `Created with AIOX using the **${templateName}** template.`,
    '',
    '## Getting Started',
    '',
    '```bash',
    'npm install',
    'npm start',
    '```',
    '',
    '## Testing',
    '',
    '```bash',
    'npm test',
    '```',
    '',
  ].join('\n');
}

/**
 * Generate AIOX config content.
 * @param {string} projectName
 * @returns {string}
 */
function generateAioxConfig(projectName) {
  return JSON.stringify({ project: projectName, version: '1.0.0' }, null, 2) + '\n';
}

/**
 * Create a project from a template.
 * @param {string} projectName
 * @param {string} templateName
 * @param {object} [options]
 * @param {string} [options.baseDir] - Base directory to create project in
 * @returns {{ success: boolean, projectPath: string, filesCreated: string[], error?: string }}
 */
function createProject(projectName, templateName, options = {}) {
  const template = getTemplate(templateName);
  if (!template) {
    return { success: false, projectPath: '', filesCreated: [], error: `Unknown template: ${templateName}` };
  }

  if (!projectName || typeof projectName !== 'string') {
    return { success: false, projectPath: '', filesCreated: [], error: 'Project name is required' };
  }

  // Validate project name (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(projectName)) {
    return { success: false, projectPath: '', filesCreated: [], error: 'Invalid project name. Use letters, numbers, hyphens, underscores. Must start with a letter.' };
  }

  const baseDir = options.baseDir || process.cwd();
  const projectPath = path.join(baseDir, projectName);

  if (fs.existsSync(projectPath)) {
    return { success: false, projectPath, filesCreated: [], error: `Directory already exists: ${projectPath}` };
  }

  const filesCreated = [];

  try {
    // Create project root
    fs.mkdirSync(projectPath, { recursive: true });

    // Create directories
    for (const dir of template.dirs) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    }

    // Create template files
    for (const [filePath, content] of Object.entries(template.files)) {
      const fullPath = path.join(projectPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      filesCreated.push(filePath);
    }

    // Create standard files
    const standardFiles = {
      'package.json': generatePackageJson(projectName, templateName),
      '.gitignore': generateGitignore(),
      'README.md': generateReadme(projectName, templateName),
      '.aiox/config.json': generateAioxConfig(projectName),
    };

    for (const [filePath, content] of Object.entries(standardFiles)) {
      const fullPath = path.join(projectPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      filesCreated.push(filePath);
    }

    return { success: true, projectPath, filesCreated };
  } catch (err) {
    return { success: false, projectPath, filesCreated, error: err.message };
  }
}

// ── CLI Entry ────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * @param {string[]} args
 * @returns {object|null}
 */
function runInitProject(args) {
  if (!args || args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return null;
  }

  if (args.includes('--list-templates')) {
    const templates = listTemplates();
    console.log('\nAvailable Templates:\n');
    for (const t of templates) {
      console.log(`  ${t.name.padEnd(12)} ${t.description}`);
    }
    console.log('');
    return { action: 'list', templates };
  }

  // Find project name (first non-flag arg)
  const projectName = args.find(a => !a.startsWith('--'));
  if (!projectName) {
    console.error('Error: Project name is required.');
    console.log('Usage: aiox init-project <name>');
    return null;
  }

  // Find template
  let templateName = 'default';
  const tplIdx = args.indexOf('--template');
  if (tplIdx !== -1 && args[tplIdx + 1]) {
    templateName = args[tplIdx + 1];
  }

  const result = createProject(projectName, templateName);

  if (result.success) {
    console.log(`\n✓ Project "${projectName}" created with "${templateName}" template`);
    console.log(`  Path: ${result.projectPath}`);
    console.log(`  Files: ${result.filesCreated.length} created`);
    console.log('\n  Next steps:');
    console.log(`    cd ${projectName}`);
    console.log('    npm install');
    console.log('    npm start\n');
  } else {
    console.error(`\n✗ Failed to create project: ${result.error}\n`);
    process.exitCode = 1;
  }

  return result;
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return HELP_TEXT;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  listTemplates,
  getTemplate,
  generatePackageJson,
  generateGitignore,
  generateReadme,
  generateAioxConfig,
  createProject,
  runInitProject,
  getHelpText,
  TEMPLATES,
};
