'use strict';

/**
 * AIOX Enhanced Quickstart Command — Story 32.1
 * Interactive guided CLI flow for new users.
 * Zero external deps — Node.js stdlib only.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const VERSION = '5.0.3';

const STEPS = [
  'Welcome',
  'Environment Detection',
  'Prerequisites Check',
  'Project Type Selection',
  'Initialization',
  'Verification',
  'Next Steps',
];

/**
 * Detect current environment information.
 * @returns {{ nodeVersion: string, os: string, arch: string, ide: string, cwd: string }}
 */
function detectEnvironment() {
  const nodeVersion = process.version;
  const platform = os.platform();
  const arch = os.arch();
  const cwd = process.cwd();

  let ide = 'unknown';
  if (process.env.CURSOR_SESSION_ID || process.env.CURSOR_TRACE_ID) {
    ide = 'Cursor';
  } else if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode') {
    ide = 'VS Code';
  } else if (process.env.JETBRAINS_IDE || process.env.IDEA_INITIAL_DIRECTORY) {
    ide = 'JetBrains';
  } else if (process.env.WINDSURF_SESSION) {
    ide = 'Windsurf';
  } else if (process.env.CLAUDE_CODE || process.env.CLAUDE_AGENT) {
    ide = 'Claude Code';
  } else if (process.env.TERM_PROGRAM) {
    ide = process.env.TERM_PROGRAM;
  }

  const osName = platform === 'darwin' ? 'macOS'
    : platform === 'win32' ? 'Windows'
      : platform === 'linux' ? 'Linux'
        : platform;

  return { nodeVersion, os: osName, arch, ide, cwd };
}

/**
 * Check prerequisites and return status for each.
 * @returns {Array<{ name: string, required: boolean, found: boolean, version: string|null, message: string }>}
 */
function checkPrerequisites() {
  const results = [];

  // Node.js >= 18
  const nodeMajor = parseInt(process.version.slice(1), 10);
  results.push({
    name: 'Node.js >= 18',
    required: true,
    found: nodeMajor >= 18,
    version: process.version,
    message: nodeMajor >= 18 ? `${process.version} detected` : `${process.version} detected — upgrade to >= 18 required`,
  });

  // npm
  let npmVersion = null;
  try {
    npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
  } catch { /* ignore */ }
  results.push({
    name: 'npm',
    required: true,
    found: !!npmVersion,
    version: npmVersion,
    message: npmVersion ? `v${npmVersion} detected` : 'Not found — install Node.js which includes npm',
  });

  // git
  let gitVersion = null;
  try {
    gitVersion = execSync('git --version', { encoding: 'utf8', timeout: 5000 }).trim().replace('git version ', '');
  } catch { /* ignore */ }
  results.push({
    name: 'git',
    required: true,
    found: !!gitVersion,
    version: gitVersion,
    message: gitVersion ? `v${gitVersion} detected` : 'Not found — install git',
  });

  // GitHub CLI (optional)
  let ghVersion = null;
  try {
    ghVersion = execSync('gh --version', { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
  } catch { /* ignore */ }
  results.push({
    name: 'GitHub CLI (gh)',
    required: false,
    found: !!ghVersion,
    version: ghVersion,
    message: ghVersion ? `${ghVersion}` : 'Not found (optional — needed for PR operations)',
  });

  return results;
}

/**
 * Detect whether current directory is a new or existing project.
 * @param {string} cwd
 * @returns {{ isExisting: boolean, hasPackageJson: boolean, hasGit: boolean, hasAiox: boolean }}
 */
function detectProjectType(cwd) {
  const hasPackageJson = fs.existsSync(path.join(cwd, 'package.json'));
  const hasGit = fs.existsSync(path.join(cwd, '.git'));
  const hasAiox = fs.existsSync(path.join(cwd, '.aiox-core'));

  return {
    isExisting: hasPackageJson || hasGit || hasAiox,
    hasPackageJson,
    hasGit,
    hasAiox,
  };
}

/**
 * Generate verification results for current project state.
 * @param {string} cwd
 * @returns {Array<{ check: string, passed: boolean, detail: string }>}
 */
function runVerification(cwd) {
  const checks = [];

  // package.json exists
  const pkgExists = fs.existsSync(path.join(cwd, 'package.json'));
  checks.push({
    check: 'package.json exists',
    passed: pkgExists,
    detail: pkgExists ? 'Found' : 'Missing — run npm init',
  });

  // .aiox-core exists
  const aioxExists = fs.existsSync(path.join(cwd, '.aiox-core'));
  checks.push({
    check: 'AIOX framework installed',
    passed: aioxExists,
    detail: aioxExists ? '.aiox-core/ detected' : 'Missing — run npx aiox-core install',
  });

  // git initialized
  const gitExists = fs.existsSync(path.join(cwd, '.git'));
  checks.push({
    check: 'Git initialized',
    passed: gitExists,
    detail: gitExists ? '.git/ detected' : 'Missing — run git init',
  });

  // docs/stories directory
  const storiesExists = fs.existsSync(path.join(cwd, 'docs', 'stories'));
  checks.push({
    check: 'Stories directory',
    passed: storiesExists,
    detail: storiesExists ? 'docs/stories/ ready' : 'Missing — will be created on first story',
  });

  // Node modules
  const nmExists = fs.existsSync(path.join(cwd, 'node_modules'));
  checks.push({
    check: 'Dependencies installed',
    passed: nmExists,
    detail: nmExists ? 'node_modules/ found' : 'Missing — run npm install',
  });

  return checks;
}

/**
 * Get next steps recommendations.
 * @param {{ hasAiox: boolean }} projectInfo
 * @returns {Array<{ step: number, command: string, description: string }>}
 */
function getNextSteps(projectInfo) {
  const steps = [];

  if (!projectInfo.hasAiox) {
    steps.push({
      step: steps.length + 1,
      command: 'npx aiox-core install',
      description: 'Install AIOX framework into your project',
    });
  }

  steps.push({
    step: steps.length + 1,
    command: 'aiox doctor',
    description: 'Run diagnostics to verify everything works',
  });

  steps.push({
    step: steps.length + 1,
    command: 'aiox ide-matrix',
    description: 'Check IDE compatibility with AIOX features',
  });

  steps.push({
    step: steps.length + 1,
    command: 'aiox getting-started',
    description: 'Follow the 5-step getting started guide',
  });

  steps.push({
    step: steps.length + 1,
    command: '@dev *help',
    description: 'Activate the developer agent and see commands',
  });

  return steps;
}

/**
 * Format the welcome banner.
 * @returns {string}
 */
function formatWelcome() {
  const lines = [];
  const sep = '='.repeat(56);
  lines.push(sep);
  lines.push(`  AIOX Quickstart v${VERSION}`);
  lines.push('  AI-Orchestrated System for Full Stack Development');
  lines.push(sep);
  lines.push('');
  lines.push('This wizard will guide you through setting up AIOX.');
  lines.push(`Steps: ${STEPS.length} | Estimated time: ~5 minutes`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Format environment detection results.
 * @param {object} env
 * @returns {string}
 */
function formatEnvironment(env) {
  const lines = [];
  lines.push('Step 2: Environment Detection');
  lines.push('-'.repeat(40));
  lines.push(`  Node.js:    ${env.nodeVersion}`);
  lines.push(`  OS:         ${env.os} (${env.arch})`);
  lines.push(`  IDE:        ${env.ide}`);
  lines.push(`  Directory:  ${env.cwd}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Format prerequisites check results.
 * @param {Array} prereqs
 * @returns {string}
 */
function formatPrerequisites(prereqs) {
  const lines = [];
  lines.push('Step 3: Prerequisites Check');
  lines.push('-'.repeat(40));
  for (const p of prereqs) {
    const icon = p.found ? '[OK]' : (p.required ? '[FAIL]' : '[SKIP]');
    lines.push(`  ${icon} ${p.name}: ${p.message}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format project type detection.
 * @param {object} project
 * @returns {string}
 */
function formatProjectType(project) {
  const lines = [];
  lines.push('Step 4: Project Type');
  lines.push('-'.repeat(40));
  if (project.isExisting) {
    lines.push('  Detected: EXISTING project');
    lines.push(`  package.json: ${project.hasPackageJson ? 'Yes' : 'No'}`);
    lines.push(`  Git: ${project.hasGit ? 'Yes' : 'No'}`);
    lines.push(`  AIOX: ${project.hasAiox ? 'Yes' : 'No'}`);
  } else {
    lines.push('  Detected: NEW project (empty directory)');
    lines.push('  Will initialize fresh AIOX project.');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format verification results.
 * @param {Array} checks
 * @returns {string}
 */
function formatVerification(checks) {
  const lines = [];
  lines.push('Step 6: Verification');
  lines.push('-'.repeat(40));
  for (const c of checks) {
    const icon = c.passed ? '[OK]' : '[--]';
    lines.push(`  ${icon} ${c.check}: ${c.detail}`);
  }
  const passCount = checks.filter((c) => c.passed).length;
  lines.push(`\n  Result: ${passCount}/${checks.length} checks passed`);
  lines.push('');
  return lines.join('\n');
}

/**
 * Format next steps.
 * @param {Array} steps
 * @returns {string}
 */
function formatNextSteps(steps) {
  const lines = [];
  lines.push('Step 7: Next Steps');
  lines.push('-'.repeat(40));
  for (const s of steps) {
    lines.push(`  ${s.step}. ${s.command}`);
    lines.push(`     ${s.description}`);
  }
  lines.push('');
  lines.push('='.repeat(56));
  lines.push('  Ready! Happy coding with AIOX!');
  lines.push('='.repeat(56));
  return lines.join('\n');
}

/**
 * Run the full quickstart flow (non-interactive / --yes mode).
 * @param {string[]} argv
 * @param {{ silent?: boolean, cwd?: string }} options
 * @returns {{ env: object, prereqs: Array, project: object, verification: Array, nextSteps: Array, allPrereqsMet: boolean }}
 */
function runQuickstart(argv = [], options = {}) {
  const silent = options.silent || false;
  const cwd = options.cwd || process.cwd();

  const env = detectEnvironment();
  const prereqs = checkPrerequisites();
  const project = detectProjectType(cwd);
  const verification = runVerification(cwd);
  const nextSteps = getNextSteps(project);
  const allPrereqsMet = prereqs.filter((p) => p.required).every((p) => p.found);

  if (!silent) {
    console.log(formatWelcome());
    console.log(formatEnvironment(env));
    console.log(formatPrerequisites(prereqs));
    console.log(formatProjectType(project));

    // Step 5: Init guidance
    console.log('Step 5: Initialization');
    console.log('-'.repeat(40));
    if (project.hasAiox) {
      console.log('  AIOX is already installed. Skipping initialization.');
    } else {
      console.log('  Run: npx aiox-core install');
      console.log('  This will set up the AIOX framework in your project.');
    }
    console.log('');

    console.log(formatVerification(verification));
    console.log(formatNextSteps(nextSteps));
  }

  return { env, prereqs, project, verification, nextSteps, allPrereqsMet };
}

module.exports = {
  runQuickstart,
  detectEnvironment,
  checkPrerequisites,
  detectProjectType,
  runVerification,
  getNextSteps,
  formatWelcome,
  formatEnvironment,
  formatPrerequisites,
  formatProjectType,
  formatVerification,
  formatNextSteps,
  STEPS,
  VERSION,
};

if (require.main === module) {
  runQuickstart(process.argv.slice(2));
}
