/**
 * Task Runner with Dependencies
 *
 * Subcommands:
 *   aiox tasks list                          — list all defined tasks
 *   aiox tasks run <name>                    — run a task with dependency resolution
 *   aiox tasks add <name> "<command>"        — add a task
 *   aiox tasks add <name> "<cmd>" --deps "a,b" — add with dependencies
 *   aiox tasks remove <name>                 — remove a task
 *   aiox tasks --help                        — show help
 *
 * @module cli/commands/tasks
 * @version 1.0.0
 * @story 15.1 — Task Runner with Dependencies
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
TASK RUNNER WITH DEPENDENCIES

USAGE:
  aiox tasks list                              List all defined tasks
  aiox tasks run <name>                        Run a task (resolves dependencies first)
  aiox tasks add <name> "<command>"            Add a new task
  aiox tasks add <name> "<cmd>" --deps "a,b"   Add task with dependencies
  aiox tasks remove <name>                     Remove a task
  aiox tasks --help                            Show this help

TASK FILE:
  .aiox/tasks.yaml (YAML-like format in project root)

EXAMPLES:
  aiox tasks add lint "npm run lint"
  aiox tasks add test "npm test" --deps "lint"
  aiox tasks add build "npm run build" --deps "lint,test"
  aiox tasks run build
  aiox tasks list
  aiox tasks remove build
`.trim();

// ── YAML-like Parser/Serializer ─────────────────────────────────────────────

/**
 * Parse a simple YAML-like tasks file into an array of task objects.
 * Format:
 *   - name: taskname
 *     command: "shell command"
 *     deps: [dep1, dep2]
 *     description: "optional desc"
 *
 * @param {string} content - File content
 * @returns {Array<{name: string, command: string, deps: string[], description: string}>}
 */
function parseTasks(content) {
  if (!content || typeof content !== 'string') return [];
  const tasks = [];
  const lines = content.split('\n');
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const nameMatch = trimmed.match(/^- name:\s*(.+)$/);
    if (nameMatch) {
      if (current) tasks.push(current);
      current = { name: nameMatch[1].trim(), command: '', deps: [], description: '' };
      continue;
    }

    if (!current) continue;

    const cmdMatch = trimmed.match(/^command:\s*"(.+)"$/);
    if (cmdMatch) {
      current.command = cmdMatch[1];
      continue;
    }

    const depsMatch = trimmed.match(/^deps:\s*\[([^\]]*)\]$/);
    if (depsMatch) {
      current.deps = depsMatch[1]
        .split(',')
        .map(d => d.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }

    const descMatch = trimmed.match(/^description:\s*"(.+)"$/);
    if (descMatch) {
      current.description = descMatch[1];
      continue;
    }
  }

  if (current) tasks.push(current);
  return tasks;
}

/**
 * Serialize tasks array back to YAML-like format.
 * @param {Array<{name: string, command: string, deps: string[], description: string}>} tasks
 * @returns {string}
 */
function serializeTasks(tasks) {
  if (!tasks || !tasks.length) return '# AIOX Tasks\n# No tasks defined\n';
  const lines = ['# AIOX Tasks'];
  for (const t of tasks) {
    lines.push(`- name: ${t.name}`);
    lines.push(`  command: "${t.command}"`);
    lines.push(`  deps: [${t.deps.map(d => `"${d}"`).join(', ')}]`);
    if (t.description) lines.push(`  description: "${t.description}"`);
  }
  return lines.join('\n') + '\n';
}

// ── Task File I/O ───────────────────────────────────────────────────────────

/**
 * Get the tasks file path.
 * @param {string} [cwd]
 * @returns {string}
 */
function getTasksFilePath(cwd) {
  return path.join(cwd || process.cwd(), '.aiox', 'tasks.yaml');
}

/**
 * Load tasks from file.
 * @param {string} [cwd]
 * @returns {Array<{name: string, command: string, deps: string[], description: string}>}
 */
function loadTasks(cwd) {
  const filePath = getTasksFilePath(cwd);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return parseTasks(content);
}

/**
 * Save tasks to file.
 * @param {Array} tasks
 * @param {string} [cwd]
 */
function saveTasks(tasks, cwd) {
  const filePath = getTasksFilePath(cwd);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, serializeTasks(tasks), 'utf8');
}

// ── DAG / Dependency Resolution ─────────────────────────────────────────────

/**
 * Detect circular dependencies in the task graph.
 * @param {Array} tasks
 * @returns {{ hasCycle: boolean, cycle: string[] }}
 */
function detectCycles(tasks) {
  const taskMap = new Map(tasks.map(t => [t.name, t]));
  const visited = new Set();
  const inStack = new Set();
  const cyclePath = [];

  function dfs(name) {
    if (inStack.has(name)) {
      cyclePath.push(name);
      return true;
    }
    if (visited.has(name)) return false;

    visited.add(name);
    inStack.add(name);
    cyclePath.push(name);

    const task = taskMap.get(name);
    if (task) {
      for (const dep of task.deps) {
        if (dfs(dep)) return true;
      }
    }

    cyclePath.pop();
    inStack.delete(name);
    return false;
  }

  for (const task of tasks) {
    visited.clear();
    inStack.clear();
    cyclePath.length = 0;
    if (dfs(task.name)) {
      // Extract cycle from path
      const cycleStart = cyclePath[cyclePath.length - 1];
      const startIdx = cyclePath.indexOf(cycleStart);
      return { hasCycle: true, cycle: cyclePath.slice(startIdx) };
    }
  }

  return { hasCycle: false, cycle: [] };
}

/**
 * Topological sort — returns execution order respecting dependencies.
 * @param {string} taskName - Starting task
 * @param {Array} tasks - All tasks
 * @returns {string[]} - Execution order (dependencies first)
 */
function resolveOrder(taskName, tasks) {
  const taskMap = new Map(tasks.map(t => [t.name, t]));
  const visited = new Set();
  const order = [];

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const task = taskMap.get(name);
    if (task) {
      for (const dep of task.deps) {
        visit(dep);
      }
    }
    order.push(name);
  }

  visit(taskName);
  return order;
}

// ── Task Execution ──────────────────────────────────────────────────────────

/**
 * Execute a single task command.
 * @param {object} task
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {{ name: string, success: boolean, output: string, error: string }}
 */
function executeTask(task, options = {}) {
  const exec = options.execFn || execSync;
  const cwd = options.cwd || process.cwd();

  try {
    const output = exec(task.command, { encoding: 'utf8', cwd, stdio: 'pipe' });
    return { name: task.name, success: true, output: output || '', error: '' };
  } catch (err) {
    return {
      name: task.name,
      success: false,
      output: err.stdout || '',
      error: err.stderr || err.message || 'Unknown error',
    };
  }
}

/**
 * Run a task and all its dependencies in order.
 * @param {string} taskName
 * @param {Array} tasks
 * @param {object} [options]
 * @returns {{ results: Array, success: boolean }}
 */
function runTask(taskName, tasks, options = {}) {
  const taskMap = new Map(tasks.map(t => [t.name, t]));

  if (!taskMap.has(taskName)) {
    return { results: [], success: false, error: `Task "${taskName}" not found` };
  }

  const cycleCheck = detectCycles(tasks);
  if (cycleCheck.hasCycle) {
    return {
      results: [],
      success: false,
      error: `Circular dependency detected: ${cycleCheck.cycle.join(' -> ')}`,
    };
  }

  const order = resolveOrder(taskName, tasks);
  const results = [];

  for (const name of order) {
    const task = taskMap.get(name);
    if (!task) {
      results.push({ name, success: false, output: '', error: `Task "${name}" not found` });
      return { results, success: false, error: `Dependency "${name}" not found` };
    }
    const result = executeTask(task, options);
    results.push(result);
    if (!result.success) {
      return { results, success: false, error: `Task "${name}" failed` };
    }
  }

  return { results, success: true };
}

// ── Subcommand Handlers ─────────────────────────────────────────────────────

/**
 * List all tasks.
 * @param {string} [cwd]
 * @returns {string}
 */
function listTasks(cwd) {
  const tasks = loadTasks(cwd);
  if (!tasks.length) return 'No tasks defined. Add tasks with: aiox tasks add <name> "<command>"';

  const lines = ['TASKS:', ''];
  for (const t of tasks) {
    const deps = t.deps.length ? ` (deps: ${t.deps.join(', ')})` : '';
    const desc = t.description ? ` — ${t.description}` : '';
    lines.push(`  ${t.name}: ${t.command}${deps}${desc}`);
  }
  return lines.join('\n');
}

/**
 * Add a task.
 * @param {string} name
 * @param {string} command
 * @param {string[]} deps
 * @param {string} [cwd]
 * @returns {string}
 */
function addTask(name, command, deps = [], cwd) {
  if (!name || typeof name !== 'string') return 'Error: Task name is required';
  if (!command || typeof command !== 'string') return 'Error: Task command is required';

  const tasks = loadTasks(cwd);
  if (tasks.find(t => t.name === name)) {
    return `Error: Task "${name}" already exists`;
  }

  // Check deps reference existing tasks (or will be added)
  // We allow forward references but warn about missing deps
  tasks.push({ name, command, deps, description: '' });

  // Validate no cycles with the new task
  const cycleCheck = detectCycles(tasks);
  if (cycleCheck.hasCycle) {
    return `Error: Adding this task would create a circular dependency: ${cycleCheck.cycle.join(' -> ')}`;
  }

  saveTasks(tasks, cwd);
  const depStr = deps.length ? ` with deps: ${deps.join(', ')}` : '';
  return `Task "${name}" added${depStr}`;
}

/**
 * Remove a task.
 * @param {string} name
 * @param {string} [cwd]
 * @returns {string}
 */
function removeTask(name, cwd) {
  if (!name) return 'Error: Task name is required';
  const tasks = loadTasks(cwd);
  const idx = tasks.findIndex(t => t.name === name);
  if (idx === -1) return `Error: Task "${name}" not found`;

  tasks.splice(idx, 1);
  saveTasks(tasks, cwd);
  return `Task "${name}" removed`;
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Main entry point for the tasks command.
 * @param {string[]} argv
 */
function runTasks(argv) {
  const subArgs = argv || [];

  if (subArgs.includes('--help') || subArgs.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sub = subArgs[0];

  switch (sub) {
    case 'list': {
      console.log(listTasks());
      break;
    }

    case 'run': {
      const taskName = subArgs[1];
      if (!taskName) {
        console.error('Error: Task name required. Usage: aiox tasks run <name>');
        process.exitCode = 1;
        return;
      }
      const tasks = loadTasks();
      const result = runTask(taskName, tasks);
      if (result.success) {
        for (const r of result.results) {
          console.log(`[${r.name}] OK`);
          if (r.output) console.log(r.output.trimEnd());
        }
      } else {
        console.error(result.error);
        for (const r of result.results) {
          const status = r.success ? 'OK' : 'FAIL';
          console.log(`[${r.name}] ${status}`);
        }
        process.exitCode = 1;
      }
      break;
    }

    case 'add': {
      const name = subArgs[1];
      const command = subArgs[2];
      const depsIdx = subArgs.indexOf('--deps');
      const deps = depsIdx !== -1 && subArgs[depsIdx + 1]
        ? subArgs[depsIdx + 1].split(',').map(d => d.trim()).filter(Boolean)
        : [];
      const msg = addTask(name, command, deps);
      if (msg.startsWith('Error')) {
        console.error(msg);
        process.exitCode = 1;
      } else {
        console.log(msg);
      }
      break;
    }

    case 'remove': {
      const name = subArgs[1];
      const msg = removeTask(name);
      if (msg.startsWith('Error')) {
        console.error(msg);
        process.exitCode = 1;
      } else {
        console.log(msg);
      }
      break;
    }

    default: {
      if (!sub) {
        console.log(HELP_TEXT);
      } else {
        console.error(`Unknown subcommand: ${sub}`);
        console.log('Run "aiox tasks --help" for usage');
        process.exitCode = 1;
      }
      break;
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parseTasks,
  serializeTasks,
  loadTasks,
  saveTasks,
  getTasksFilePath,
  detectCycles,
  resolveOrder,
  executeTask,
  runTask,
  listTasks,
  addTask,
  removeTask,
  runTasks,
  getHelpText: () => HELP_TEXT,
};
