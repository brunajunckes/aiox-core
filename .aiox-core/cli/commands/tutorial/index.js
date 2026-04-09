/**
 * Interactive Tutorial
 *
 * Step-by-step tutorial for AIOX CLI usage.
 * Tracks progress in .aiox/tutorial-progress.json.
 *
 * @module cli/commands/tutorial
 * @version 1.0.0
 * @story 19.2 - Interactive Tutorial
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const PROGRESS_FILE = '.aiox/tutorial-progress.json';

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: 'Welcome to AIOX',
    content: [
      'AIOX (AI-Orchestrated System) is a meta-framework for full stack development.',
      'It orchestrates AI agents to handle complex development workflows.',
      '',
      'Key concepts:',
      '  - CLI First: Everything works from the command line',
      '  - Agents: Specialized AI personas (@dev, @qa, @architect, etc.)',
      '  - Stories: All development is driven by story files',
      '  - Quality Gates: Automated checks ensure code quality',
    ],
  },
  {
    id: 2,
    title: 'Installation & Setup',
    content: [
      'Install AIOX in your project:',
      '',
      '  $ npx aiox-core install',
      '',
      'This will:',
      '  1. Create .aiox-core/ directory with framework files',
      '  2. Set up docs/stories/ for story-driven development',
      '  3. Configure agents and workflows',
      '',
      'Verify your installation:',
      '  $ aiox doctor',
    ],
  },
  {
    id: 3,
    title: 'Your First Story',
    content: [
      'Stories drive all development in AIOX.',
      '',
      'Create a story:',
      '  $ aiox agents    # See available agents',
      '  @sm *draft       # Ask Scrum Master to draft a story',
      '',
      'Story lifecycle:',
      '  Draft → Ready → InProgress → InReview → Done',
      '',
      'Stories live in docs/stories/ as markdown files.',
    ],
  },
  {
    id: 4,
    title: 'Working with Agents',
    content: [
      'AIOX has specialized agents for different tasks:',
      '',
      '  @dev       Dex     — Code implementation',
      '  @qa        Quinn   — Testing and quality',
      '  @architect Aria    — System design',
      '  @pm        Morgan  — Product management',
      '  @po        Pax     — Story validation',
      '  @sm        River   — Story creation',
      '  @devops    Gage    — CI/CD and git push',
      '',
      'Activate an agent with @agent-name.',
      'Use * prefix for commands: *help, *create-story, *task',
    ],
  },
  {
    id: 5,
    title: 'Testing & Quality',
    content: [
      'AIOX enforces quality through automated gates.',
      '',
      'Run tests:',
      '  $ aiox test               # or npm test',
      '  $ aiox coverage           # with coverage report',
      '  $ aiox lint               # code style check',
      '',
      'Quality gates check:',
      '  1. Code review patterns',
      '  2. Unit test coverage',
      '  3. Acceptance criteria',
      '  4. No regressions',
      '  5. Performance',
      '  6. Security basics',
      '  7. Documentation',
    ],
  },
  {
    id: 6,
    title: 'Deployment & CI/CD',
    content: [
      'Deployment is managed exclusively by @devops (Gage).',
      '',
      'Push workflow:',
      '  1. @dev completes implementation',
      '  2. @qa runs quality gate',
      '  3. @devops handles git push and PR',
      '',
      'Commands:',
      '  $ aiox githooks           # Manage git hooks',
      '  $ aiox healthcheck        # Infrastructure checks',
      '',
      'Convention: Only @devops can push to remote.',
    ],
  },
  {
    id: 7,
    title: 'Advanced Features',
    content: [
      'Explore more AIOX capabilities:',
      '',
      '  $ aiox man                # Man pages for all commands',
      '  $ aiox ref                # Full command reference',
      '  $ aiox config             # Configuration management',
      '  $ aiox analytics          # Project analytics',
      '  $ aiox changelog          # Generate changelogs',
      '',
      'Chain commands:',
      '  $ aiox chain lint test build',
      '',
      'Congratulations! You\'ve completed the AIOX tutorial.',
    ],
  },
];

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Get all tutorial steps.
 * @returns {Array}
 */
function getSteps() {
  return TUTORIAL_STEPS;
}

/**
 * Get progress file path.
 * @param {string} [baseDir]
 * @returns {string}
 */
function getProgressPath(baseDir) {
  return path.join(baseDir || process.cwd(), PROGRESS_FILE);
}

/**
 * Read tutorial progress.
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @returns {{ completedSteps: number[], lastStep: number }}
 */
function readProgress(options = {}) {
  const filePath = getProgressPath(options.baseDir);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      completedSteps: Array.isArray(data.completedSteps) ? data.completedSteps : [],
      lastStep: typeof data.lastStep === 'number' ? data.lastStep : 0,
    };
  } catch {
    return { completedSteps: [], lastStep: 0 };
  }
}

/**
 * Write tutorial progress.
 * @param {object} progress
 * @param {object} [options]
 * @param {string} [options.baseDir]
 */
function writeProgress(progress, options = {}) {
  const filePath = getProgressPath(options.baseDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2) + '\n', 'utf8');
}

/**
 * Reset tutorial progress.
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @returns {boolean}
 */
function resetProgress(options = {}) {
  const filePath = getProgressPath(options.baseDir);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Format a single step for display.
 * @param {object} step
 * @param {boolean} [completed]
 * @returns {string}
 */
function formatStep(step, completed = false) {
  const marker = completed ? '[x]' : '[ ]';
  const lines = [];
  lines.push(`${marker} Step ${step.id}: ${step.title}`);
  lines.push('─'.repeat(50));
  for (const line of step.content) {
    lines.push(`  ${line}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Format the list of steps.
 * @param {number[]} completedSteps
 * @returns {string}
 */
function formatStepList(completedSteps = []) {
  const lines = ['AIOX Tutorial Steps:', ''];
  for (const step of TUTORIAL_STEPS) {
    const marker = completedSteps.includes(step.id) ? '[x]' : '[ ]';
    lines.push(`  ${marker} Step ${step.id}: ${step.title}`);
  }
  const done = completedSteps.length;
  const total = TUTORIAL_STEPS.length;
  lines.push('');
  lines.push(`Progress: ${done}/${total} steps completed`);
  return lines.join('\n');
}

/**
 * Run the full tutorial (all steps).
 * @param {object} [options]
 * @param {string} [options.baseDir]
 * @returns {string}
 */
function runFullTutorial(options = {}) {
  const progress = readProgress(options);
  const lines = [];
  lines.push('AIOX Tutorial');
  lines.push('='.repeat(50));
  lines.push('');

  for (const step of TUTORIAL_STEPS) {
    const completed = progress.completedSteps.includes(step.id);
    lines.push(formatStep(step, completed));
  }

  // Mark all steps as completed
  const allIds = TUTORIAL_STEPS.map(s => s.id);
  writeProgress({ completedSteps: allIds, lastStep: TUTORIAL_STEPS.length }, options);

  lines.push(`All ${TUTORIAL_STEPS.length} steps displayed. Progress saved.`);
  return lines.join('\n');
}

/**
 * Get help text.
 * @returns {string}
 */
function getHelpText() {
  return `Usage: aiox tutorial [options]

Step-by-step tutorial for AIOX CLI.

Options:
  --step N     Show specific step (1-${TUTORIAL_STEPS.length})
  --list       List all tutorial steps
  --reset      Reset tutorial progress
  -h, --help   Show this help message

Examples:
  aiox tutorial            Run full tutorial
  aiox tutorial --step 3   Show step 3
  aiox tutorial --list     List all steps
  aiox tutorial --reset    Reset progress`;
}

/**
 * Main runner.
 * @param {string[]} argv
 */
function runTutorial(argv = []) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(getHelpText());
    return;
  }

  if (argv.includes('--reset')) {
    const removed = resetProgress();
    console.log(removed ? 'Tutorial progress reset.' : 'No progress to reset.');
    return;
  }

  if (argv.includes('--list')) {
    const progress = readProgress();
    console.log(formatStepList(progress.completedSteps));
    return;
  }

  const stepIdx = argv.indexOf('--step');
  if (stepIdx !== -1) {
    const num = parseInt(argv[stepIdx + 1], 10);
    if (isNaN(num) || num < 1 || num > TUTORIAL_STEPS.length) {
      console.error(`Invalid step number. Use 1-${TUTORIAL_STEPS.length}.`);
      process.exitCode = 1;
      return;
    }
    const step = TUTORIAL_STEPS.find(s => s.id === num);
    const progress = readProgress();
    console.log(formatStep(step, progress.completedSteps.includes(num)));

    // Mark step completed and update progress
    if (!progress.completedSteps.includes(num)) {
      progress.completedSteps.push(num);
    }
    progress.lastStep = num;
    writeProgress(progress);
    return;
  }

  // Default: full tutorial
  console.log(runFullTutorial());
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runTutorial,
  getHelpText,
  getSteps,
  readProgress,
  writeProgress,
  resetProgress,
  formatStep,
  formatStepList,
  runFullTutorial,
  getProgressPath,
  TUTORIAL_STEPS,
  PROGRESS_FILE,
};
