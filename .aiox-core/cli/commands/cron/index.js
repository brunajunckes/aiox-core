/**
 * Cron-like Scheduled Tasks
 *
 * Subcommands:
 *   aiox cron list                          — list scheduled tasks
 *   aiox cron add "<cron-expr>" "<command>" — add scheduled task
 *   aiox cron remove <id>                   — remove by ID
 *   aiox cron run                           — start scheduler
 *   aiox cron next                          — show next run times
 *   aiox cron --help                        — show help
 *
 * @module cli/commands/cron
 * @version 1.0.0
 * @story 15.3 — Cron-like Scheduled Tasks
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
CRON-LIKE SCHEDULED TASKS

USAGE:
  aiox cron list                              List all scheduled tasks
  aiox cron add "<cron-expr>" "<command>"     Add a scheduled task
  aiox cron remove <id>                       Remove a task by ID
  aiox cron run                               Start the scheduler (checks every minute)
  aiox cron next                              Show next run times for all tasks
  aiox cron --help                            Show this help

CRON EXPRESSION FORMAT:
  * * * * *
  | | | | |
  | | | | +-- day of week (0-6, Sun=0)
  | | | +---- month (1-12)
  | | +------ day of month (1-31)
  | +-------- hour (0-23)
  +---------- minute (0-59)

  Supported: *, specific numbers, */N (every N)

EXAMPLES:
  aiox cron add "*/5 * * * *" "echo heartbeat"        Every 5 minutes
  aiox cron add "0 * * * *" "npm run health-check"     Every hour
  aiox cron add "0 9 * * 1" "npm run weekly-report"    Monday 9am
  aiox cron list
  aiox cron next
  aiox cron remove 1
`.trim();

// ── Cron Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a single cron field.
 * @param {string} field - e.g. "*", "5", "* /5" (without space)
 * @param {number} min
 * @param {number} max
 * @returns {number[]} - Array of matching values
 */
function parseCronField(field, min, max) {
  if (field === '*') {
    const result = [];
    for (let i = min; i <= max; i++) result.push(i);
    return result;
  }

  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    if (step <= 0) return [];
    const result = [];
    for (let i = min; i <= max; i += step) result.push(i);
    return result;
  }

  const num = parseInt(field, 10);
  if (!isNaN(num) && num >= min && num <= max) return [num];

  return [];
}

/**
 * Parse a full cron expression into fields.
 * @param {string} expr - "* /5 * * * *" format
 * @returns {{ minute: number[], hour: number[], dayOfMonth: number[], month: number[], dayOfWeek: number[] } | null}
 */
function parseCronExpression(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const minute = parseCronField(parts[0], 0, 59);
  const hour = parseCronField(parts[1], 0, 23);
  const dayOfMonth = parseCronField(parts[2], 1, 31);
  const month = parseCronField(parts[3], 1, 12);
  const dayOfWeek = parseCronField(parts[4], 0, 6);

  if (!minute.length || !hour.length || !dayOfMonth.length || !month.length || !dayOfWeek.length) {
    return null;
  }

  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

/**
 * Check if a cron expression matches a given date.
 * @param {string} expr
 * @param {Date} date
 * @returns {boolean}
 */
function cronMatches(expr, date) {
  const parsed = parseCronExpression(expr);
  if (!parsed) return false;

  return (
    parsed.minute.includes(date.getMinutes()) &&
    parsed.hour.includes(date.getHours()) &&
    parsed.dayOfMonth.includes(date.getDate()) &&
    parsed.month.includes(date.getMonth() + 1) &&
    parsed.dayOfWeek.includes(date.getDay())
  );
}

/**
 * Get the next matching time for a cron expression after a given date.
 * @param {string} expr
 * @param {Date} [after]
 * @returns {Date|null}
 */
function getNextRun(expr, after) {
  const parsed = parseCronExpression(expr);
  if (!parsed) return null;

  const start = after ? new Date(after) : new Date();
  // Move to next minute
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  // Search up to 366 days
  const maxIterations = 366 * 24 * 60;
  const candidate = new Date(start);

  for (let i = 0; i < maxIterations; i++) {
    if (
      parsed.minute.includes(candidate.getMinutes()) &&
      parsed.hour.includes(candidate.getHours()) &&
      parsed.dayOfMonth.includes(candidate.getDate()) &&
      parsed.month.includes(candidate.getMonth() + 1) &&
      parsed.dayOfWeek.includes(candidate.getDay())
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
}

// ── Cron File I/O ───────────────────────────────────────────────────────────

/**
 * Get the cron file path.
 * @param {string} [cwd]
 * @returns {string}
 */
function getCronFilePath(cwd) {
  return path.join(cwd || process.cwd(), '.aiox', 'cron.yaml');
}

/**
 * Parse cron YAML-like file.
 * Format:
 *   - id: 1
 *     expression: "* /5 * * * *"
 *     command: "echo hello"
 *
 * @param {string} content
 * @returns {Array<{id: number, expression: string, command: string}>}
 */
function parseCronFile(content) {
  if (!content || typeof content !== 'string') return [];
  const entries = [];
  const lines = content.split('\n');
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idMatch = trimmed.match(/^- id:\s*(\d+)$/);
    if (idMatch) {
      if (current) entries.push(current);
      current = { id: parseInt(idMatch[1], 10), expression: '', command: '' };
      continue;
    }

    if (!current) continue;

    const exprMatch = trimmed.match(/^expression:\s*"(.+)"$/);
    if (exprMatch) {
      current.expression = exprMatch[1];
      continue;
    }

    const cmdMatch = trimmed.match(/^command:\s*"(.+)"$/);
    if (cmdMatch) {
      current.command = cmdMatch[1];
      continue;
    }
  }

  if (current) entries.push(current);
  return entries;
}

/**
 * Serialize cron entries to YAML-like format.
 * @param {Array} entries
 * @returns {string}
 */
function serializeCronFile(entries) {
  if (!entries || !entries.length) return '# AIOX Cron Tasks\n# No tasks scheduled\n';
  const lines = ['# AIOX Cron Tasks'];
  for (const e of entries) {
    lines.push(`- id: ${e.id}`);
    lines.push(`  expression: "${e.expression}"`);
    lines.push(`  command: "${e.command}"`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Load cron entries from file.
 * @param {string} [cwd]
 * @returns {Array}
 */
function loadCronEntries(cwd) {
  const filePath = getCronFilePath(cwd);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return parseCronFile(content);
}

/**
 * Save cron entries to file.
 * @param {Array} entries
 * @param {string} [cwd]
 */
function saveCronEntries(entries, cwd) {
  const filePath = getCronFilePath(cwd);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, serializeCronFile(entries), 'utf8');
}

// ── Subcommand Handlers ─────────────────────────────────────────────────────

/**
 * List all cron tasks.
 * @param {string} [cwd]
 * @returns {string}
 */
function listCronTasks(cwd) {
  const entries = loadCronEntries(cwd);
  if (!entries.length) return 'No scheduled tasks. Add with: aiox cron add "<expr>" "<command>"';

  const lines = ['SCHEDULED TASKS:', ''];
  for (const e of entries) {
    lines.push(`  [${e.id}] ${e.expression} — ${e.command}`);
  }
  return lines.join('\n');
}

/**
 * Add a cron task.
 * @param {string} expression
 * @param {string} command
 * @param {string} [cwd]
 * @returns {string}
 */
function addCronTask(expression, command, cwd) {
  if (!expression || typeof expression !== 'string') return 'Error: Cron expression is required';
  if (!command || typeof command !== 'string') return 'Error: Command is required';

  const parsed = parseCronExpression(expression);
  if (!parsed) return `Error: Invalid cron expression "${expression}"`;

  const entries = loadCronEntries(cwd);
  const maxId = entries.reduce((max, e) => Math.max(max, e.id), 0);
  const newId = maxId + 1;

  entries.push({ id: newId, expression, command });
  saveCronEntries(entries, cwd);

  return `Cron task added (id: ${newId}): ${expression} — ${command}`;
}

/**
 * Remove a cron task by ID.
 * @param {number|string} id
 * @param {string} [cwd]
 * @returns {string}
 */
function removeCronTask(id, cwd) {
  if (id === undefined || id === null) return 'Error: Task ID is required';
  const numId = parseInt(String(id), 10);
  if (isNaN(numId)) return 'Error: Invalid task ID';

  const entries = loadCronEntries(cwd);
  const idx = entries.findIndex(e => e.id === numId);
  if (idx === -1) return `Error: Cron task with id ${numId} not found`;

  entries.splice(idx, 1);
  saveCronEntries(entries, cwd);
  return `Cron task ${numId} removed`;
}

/**
 * Show next run times for all cron tasks.
 * @param {string} [cwd]
 * @param {Date} [now]
 * @returns {string}
 */
function showNextRuns(cwd, now) {
  const entries = loadCronEntries(cwd);
  if (!entries.length) return 'No scheduled tasks.';

  const lines = ['NEXT RUN TIMES:', ''];
  for (const e of entries) {
    const next = getNextRun(e.expression, now);
    const nextStr = next ? next.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '') : 'unknown';
    lines.push(`  [${e.id}] ${nextStr} — ${e.command}`);
  }
  return lines.join('\n');
}

/**
 * Execute matching cron tasks for a given time.
 * @param {Date} date
 * @param {Array} entries
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @returns {Array<{id: number, command: string, success: boolean, output: string, error: string}>}
 */
function executeCronTasks(date, entries, options = {}) {
  const exec = options.execFn || execSync;
  const cwd = options.cwd || process.cwd();
  const results = [];

  for (const entry of entries) {
    if (cronMatches(entry.expression, date)) {
      try {
        const output = exec(entry.command, { encoding: 'utf8', cwd, stdio: 'pipe' });
        results.push({ id: entry.id, command: entry.command, success: true, output: output || '', error: '' });
      } catch (err) {
        results.push({
          id: entry.id,
          command: entry.command,
          success: false,
          output: err.stdout || '',
          error: err.stderr || err.message || 'Unknown error',
        });
      }
    }
  }

  return results;
}

/**
 * Start the cron scheduler (runs indefinitely, checking every minute).
 * @param {object} [options]
 * @param {function} [options.execFn]
 * @param {string} [options.cwd]
 * @param {function} [options.onTick] - callback per tick (for testing)
 * @returns {{ interval: *, stop: function }}
 */
function startScheduler(options = {}) {
  const cwd = options.cwd || process.cwd();

  const tick = () => {
    const now = new Date();
    const entries = loadCronEntries(cwd);
    const results = executeCronTasks(now, entries, options);
    if (options.onTick) options.onTick(now, results);
    return results;
  };

  const interval = setInterval(tick, 60000);

  return {
    interval,
    stop: () => clearInterval(interval),
    tick, // expose for testing
  };
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Main entry point for the cron command.
 * @param {string[]} argv
 */
function runCron(argv) {
  const subArgs = argv || [];

  if (subArgs.includes('--help') || subArgs.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sub = subArgs[0];

  switch (sub) {
    case 'list': {
      console.log(listCronTasks());
      break;
    }

    case 'add': {
      const expression = subArgs[1];
      const command = subArgs[2];
      const msg = addCronTask(expression, command);
      if (msg.startsWith('Error')) {
        console.error(msg);
        process.exitCode = 1;
      } else {
        console.log(msg);
      }
      break;
    }

    case 'remove': {
      const id = subArgs[1];
      const msg = removeCronTask(id);
      if (msg.startsWith('Error')) {
        console.error(msg);
        process.exitCode = 1;
      } else {
        console.log(msg);
      }
      break;
    }

    case 'next': {
      console.log(showNextRuns());
      break;
    }

    case 'run': {
      console.log('Starting cron scheduler (checking every minute)...');
      console.log('Press Ctrl+C to stop\n');
      const scheduler = startScheduler({
        onTick: (date, results) => {
          if (results.length) {
            for (const r of results) {
              const status = r.success ? 'OK' : 'FAIL';
              console.log(`[${date.toISOString()}] [${r.id}] ${status}: ${r.command}`);
            }
          }
        },
      });
      process.on('SIGINT', () => {
        console.log('\nStopping scheduler...');
        scheduler.stop();
        process.exit(0);
      });
      break;
    }

    default: {
      if (!sub) {
        console.log(HELP_TEXT);
      } else {
        console.error(`Unknown subcommand: ${sub}`);
        console.log('Run "aiox cron --help" for usage');
        process.exitCode = 1;
      }
      break;
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parseCronField,
  parseCronExpression,
  cronMatches,
  getNextRun,
  getCronFilePath,
  parseCronFile,
  serializeCronFile,
  loadCronEntries,
  saveCronEntries,
  listCronTasks,
  addCronTask,
  removeCronTask,
  showNextRuns,
  executeCronTasks,
  startScheduler,
  runCron,
  getHelpText: () => HELP_TEXT,
};
