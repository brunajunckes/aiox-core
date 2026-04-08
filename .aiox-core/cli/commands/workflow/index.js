/**
 * Workflow Automation Engine
 *
 * Load, list, create, and execute YAML-based workflow definitions.
 * Zero external dependencies — uses a minimal YAML parser for the
 * simple key/list format that workflow files use.
 *
 * @module cli/commands/workflow
 * @version 1.0.0
 * @story 7.1 - Workflow Automation Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_WORKFLOWS_DIR = path.join(process.cwd(), '.aiox', 'workflows');
const DEFAULT_BUILTIN_DIR = path.join(__dirname, '..', '..', '..', 'data', 'workflows');

/** @returns {string} */
function getWorkflowsDir() {
  return module.exports.WORKFLOWS_DIR || DEFAULT_WORKFLOWS_DIR;
}

/** @returns {string} */
function getBuiltinDir() {
  return module.exports.BUILTIN_DIR || DEFAULT_BUILTIN_DIR;
}

const WORKFLOW_TEMPLATE = `name: {{name}}
description: Describe what this workflow does
steps:
  - name: step-1
    command: echo "Replace with real command"
`;

// ── Minimal YAML Parser ───────────────────────────────────────────────────────

/**
 * Parse a simple YAML workflow file into a JS object.
 *
 * Supports:
 *   - Top-level scalar keys  (name: value)
 *   - A "steps" list where each item has name + command
 *
 * Does NOT support nested objects, multi-line strings, anchors, etc.
 *
 * @param {string} text - Raw YAML content
 * @returns {{ name: string, description: string, steps: Array<{ name: string, command: string }> }}
 */
function parseWorkflowYaml(text) {
  const lines = text.split('\n');
  const result = { name: '', description: '', steps: [] };
  let inSteps = false;
  let currentStep = null;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');

    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Detect steps: block
    if (/^steps:\s*$/.test(line)) {
      inSteps = true;
      continue;
    }

    if (inSteps) {
      // New list item: "  - name: value"
      const listItemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
      if (listItemMatch) {
        const [, key, val] = listItemMatch;
        if (key === 'name') {
          if (currentStep) result.steps.push(currentStep);
          currentStep = { name: val.trim(), command: '' };
        } else if (key === 'command' && currentStep) {
          currentStep.command = val.trim();
        }
        continue;
      }

      // Continuation key inside same item: "    command: value"
      const contMatch = line.match(/^\s+(\w+):\s*(.*)$/);
      if (contMatch && currentStep) {
        const [, key, val] = contMatch;
        if (key === 'command') {
          currentStep.command = val.trim();
        } else if (key === 'name') {
          // Flush previous step
          if (currentStep.name || currentStep.command) {
            result.steps.push(currentStep);
          }
          currentStep = { name: val.trim(), command: '' };
        }
        continue;
      }

      // If we hit a non-indented line, steps block ended
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        if (currentStep) {
          result.steps.push(currentStep);
          currentStep = null;
        }
        inSteps = false;
        // Fall through to top-level key parsing below
      } else {
        continue;
      }
    }

    // Top-level key: value
    const topMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (topMatch) {
      const [, key, val] = topMatch;
      if (key === 'name') result.name = val.trim();
      else if (key === 'description') result.description = val.trim();
    }
  }

  // Flush last step
  if (currentStep) result.steps.push(currentStep);

  return result;
}

// ── Core Functions ────────────────────────────────────────────────────────────

/**
 * Ensure the user workflows directory exists.
 */
function ensureWorkflowsDir() {
  if (!fs.existsSync(getWorkflowsDir())) {
    fs.mkdirSync(getWorkflowsDir(), { recursive: true });
  }
}

/**
 * Load a workflow by name.
 *
 * Search order:
 *   1. .aiox/workflows/{name}.yaml
 *   2. .aiox-core/data/workflows/{name}.yaml  (built-in)
 *
 * @param {string} name - Workflow name (without extension)
 * @returns {{ name: string, description: string, steps: Array<{ name: string, command: string }>, source: string }}
 */
function loadWorkflow(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Workflow name is required');
  }

  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) {
    throw new Error(`Invalid workflow name: ${name}`);
  }

  const userPath = path.join(getWorkflowsDir(), `${sanitized}.yaml`);
  if (fs.existsSync(userPath)) {
    const content = fs.readFileSync(userPath, 'utf8');
    const workflow = parseWorkflowYaml(content);
    workflow.source = userPath;
    return workflow;
  }

  const builtinPath = path.join(getBuiltinDir(), `${sanitized}.yaml`);
  if (fs.existsSync(builtinPath)) {
    const content = fs.readFileSync(builtinPath, 'utf8');
    const workflow = parseWorkflowYaml(content);
    workflow.source = builtinPath;
    return workflow;
  }

  throw new Error(`Workflow not found: ${sanitized}`);
}

/**
 * List all available workflows (user + built-in, deduplicated).
 *
 * @returns {Array<{ name: string, description: string, source: string }>}
 */
function listWorkflows() {
  const seen = new Set();
  const workflows = [];

  const scanDir = (dir, sourceLabel) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'));
    for (const file of files) {
      const name = file.replace(/\.yaml$/, '');
      if (seen.has(name)) continue;
      seen.add(name);
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const wf = parseWorkflowYaml(content);
        workflows.push({
          name: wf.name || name,
          description: wf.description || '',
          source: sourceLabel,
        });
      } catch {
        workflows.push({ name, description: '(parse error)', source: sourceLabel });
      }
    }
  };

  scanDir(getWorkflowsDir(), 'user');
  scanDir(getBuiltinDir(), 'builtin');

  return workflows;
}

/**
 * Create a new workflow from the default template.
 *
 * @param {string} name - Workflow name
 * @returns {string} Path to the created file
 */
function createWorkflow(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Workflow name is required');
  }

  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) {
    throw new Error(`Invalid workflow name: ${name}`);
  }

  ensureWorkflowsDir();

  const filePath = path.join(getWorkflowsDir(), `${sanitized}.yaml`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Workflow already exists: ${filePath}`);
  }

  const content = WORKFLOW_TEMPLATE.replace('{{name}}', sanitized);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Execute a parsed workflow's steps sequentially.
 *
 * @param {{ name: string, steps: Array<{ name: string, command: string }> }} workflow
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false] - Print commands without running
 * @param {function} [options.execFn] - Custom exec function (for testing)
 * @param {function} [options.log] - Custom logger
 * @returns {{ success: boolean, results: Array<{ step: string, status: string, output?: string, error?: string }> }}
 */
function executeWorkflow(workflow, options = {}) {
  const {
    dryRun = false,
    execFn = execSync,
    log = console.log,
  } = options;

  if (!workflow || !Array.isArray(workflow.steps)) {
    throw new Error('Invalid workflow: missing steps array');
  }

  if (workflow.steps.length === 0) {
    throw new Error('Workflow has no steps to execute');
  }

  const results = [];
  let allPassed = true;

  log(`\nWorkflow: ${workflow.name || 'unnamed'}`);
  log(`Steps: ${workflow.steps.length}\n`);

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const label = `[${i + 1}/${workflow.steps.length}] ${step.name}`;

    if (!step.command) {
      log(`${label} -- SKIP (no command)`);
      results.push({ step: step.name, status: 'skipped' });
      continue;
    }

    if (dryRun) {
      log(`${label} -- DRY RUN: ${step.command}`);
      results.push({ step: step.name, status: 'dry-run', output: step.command });
      continue;
    }

    log(`${label} -- running: ${step.command}`);

    try {
      const output = execFn(step.command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });
      log(`${label} -- PASS`);
      results.push({ step: step.name, status: 'pass', output: output.trim() });
    } catch (err) {
      allPassed = false;
      const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
      log(`${label} -- FAIL: ${errMsg}`);
      results.push({ step: step.name, status: 'fail', error: errMsg });
      // Stop on first failure
      break;
    }
  }

  return { success: allPassed, results };
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

function showWorkflowHelp() {
  console.log(`
AIOX Workflow Automation Engine

USAGE:
  aiox workflow run <name>           Run a workflow by name
  aiox workflow run <name> --dry-run Preview commands without executing
  aiox workflow list                 List available workflows
  aiox workflow create <name>        Create a new workflow from template
  aiox workflow --help               Show this help

EXAMPLES:
  aiox workflow run full-cycle       Run the full quality cycle
  aiox workflow run quick-check      Run lint + test
  aiox workflow create my-deploy     Create a custom workflow
  aiox workflow list                 See all workflows

WORKFLOW LOCATION:
  User:     .aiox/workflows/
  Built-in: .aiox-core/data/workflows/
`);
}

/**
 * Main CLI entry point.
 *
 * @param {string[]} argv - Arguments after "workflow" (e.g., ["run", "full-cycle"])
 */
function runWorkflow(argv) {
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    showWorkflowHelp();
    return;
  }

  switch (subcommand) {
    case 'run': {
      const name = argv[1];
      if (!name) {
        console.error('Error: workflow name required. Usage: aiox workflow run <name>');
        process.exit(1);
      }
      const dryRun = argv.includes('--dry-run');
      try {
        const workflow = loadWorkflow(name);
        const result = executeWorkflow(workflow, { dryRun });
        if (!result.success) {
          process.exit(1);
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'list': {
      const workflows = listWorkflows();
      if (workflows.length === 0) {
        console.log('No workflows found.');
        console.log('Create one with: aiox workflow create <name>');
        return;
      }
      console.log('\nAvailable Workflows:\n');
      for (const wf of workflows) {
        const tag = wf.source === 'builtin' ? ' (built-in)' : '';
        console.log(`  ${wf.name}${tag}`);
        if (wf.description) {
          console.log(`    ${wf.description}`);
        }
      }
      console.log('');
      break;
    }

    case 'create': {
      const name = argv[1];
      if (!name) {
        console.error('Error: workflow name required. Usage: aiox workflow create <name>');
        process.exit(1);
      }
      try {
        const filePath = createWorkflow(name);
        console.log(`Workflow created: ${filePath}`);
        console.log(`Edit the file and run with: aiox workflow run ${name}`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown workflow subcommand: ${subcommand}`);
      showWorkflowHelp();
      process.exit(1);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  parseWorkflowYaml,
  loadWorkflow,
  listWorkflows,
  createWorkflow,
  executeWorkflow,
  runWorkflow,
  WORKFLOWS_DIR: DEFAULT_WORKFLOWS_DIR,
  BUILTIN_DIR: DEFAULT_BUILTIN_DIR,
};
