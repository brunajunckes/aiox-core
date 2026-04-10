'use strict';

/**
 * AIOX Getting Started Guide Generator — Story 32.3
 * Interactive 5-step journey displayed in terminal.
 * Zero external deps — Node.js stdlib only.
 */

const GUIDE_STEPS = [
  {
    number: 1,
    title: 'Install AIOX',
    description: 'Set up the AIOX framework in your project.',
    instructions: [
      'Initialize your project if not done:',
      '  mkdir my-project && cd my-project',
      '  npm init -y',
      '  git init',
      '',
      'Install AIOX framework:',
      '  npx aiox-core install',
      '',
      'Verify installation:',
      '  aiox doctor',
    ],
    commands: ['npx aiox-core install', 'aiox doctor'],
    tip: 'The installer auto-detects your IDE and configures agent files accordingly.',
  },
  {
    number: 2,
    title: 'Your First Agent (@dev)',
    description: 'Activate the developer agent and explore its capabilities.',
    instructions: [
      'Activate the developer agent:',
      '  @dev',
      '',
      'The agent will greet you and show available commands.',
      'Key commands to try:',
      '  *help          — See all developer commands',
      '  *guide         — Comprehensive usage guide',
      '  *session-info  — Current session details',
    ],
    commands: ['@dev', '*help', '*guide'],
    tip: 'AIOX has 10 specialized agents: @dev, @qa, @architect, @pm, @po, @sm, @analyst, @data-engineer, @ux-design-expert, @devops',
  },
  {
    number: 3,
    title: 'Your First Story',
    description: 'Create a development story to drive your implementation.',
    instructions: [
      'Switch to the Scrum Master agent:',
      '  @sm',
      '',
      'Create your first story:',
      '  *create-story',
      '',
      'The SM agent will guide you through:',
      '  - Story title and description',
      '  - Acceptance criteria',
      '  - Task breakdown',
      '  - Effort estimation',
      '',
      'Stories are saved in docs/stories/{sprint}.{number}.story.md',
    ],
    commands: ['@sm', '*create-story'],
    tip: 'Stories follow a strict lifecycle: Draft -> Validated -> InProgress -> InReview -> Done',
  },
  {
    number: 4,
    title: 'Your First Implementation',
    description: 'Implement the story using the developer agent.',
    instructions: [
      'Switch to the developer agent:',
      '  @dev',
      '',
      'Start implementing your story:',
      '  *develop {story-id}',
      '',
      'Development modes:',
      '  *develop-yolo         — Autonomous (recommended for experienced users)',
      '  *develop-interactive  — Step-by-step with confirmations',
      '  *develop-preflight    — Planning mode before coding',
      '',
      'The agent reads story tasks and implements them sequentially.',
    ],
    commands: ['@dev', '*develop {story-id}', '*develop-yolo'],
    tip: 'The dev agent auto-updates story checkboxes and file lists as it works.',
  },
  {
    number: 5,
    title: 'Quality Gates',
    description: 'Validate your code meets AIOX quality standards.',
    instructions: [
      'Run quality checks:',
      '  npm run lint       — ESLint code style',
      '  npm run typecheck  — TypeScript validation',
      '  npm test           — Jest test suite',
      '',
      'Request QA review:',
      '  @qa',
      '  *qa-gate {story-id}',
      '',
      'QA verdicts: PASS | CONCERNS | FAIL | WAIVED',
      '',
      'When everything passes, ship it:',
      '  @devops',
      '  *push',
    ],
    commands: ['npm run lint', 'npm test', '@qa', '*qa-gate', '@devops *push'],
    tip: 'Only @devops can push to remote — this is an AIOX constitutional rule.',
  },
];

/**
 * Get all guide steps.
 * @returns {Array}
 */
function getSteps() {
  return GUIDE_STEPS;
}

/**
 * Get a specific step by number.
 * @param {number} stepNum
 * @returns {object|null}
 */
function getStep(stepNum) {
  return GUIDE_STEPS.find((s) => s.number === stepNum) || null;
}

/**
 * Format a single step for display.
 * @param {object} step
 * @returns {string}
 */
function formatStep(step) {
  const lines = [];
  const sep = '='.repeat(56);
  const dash = '-'.repeat(40);

  lines.push(sep);
  lines.push(`  Step ${step.number} of ${GUIDE_STEPS.length}: ${step.title}`);
  lines.push(sep);
  lines.push('');
  lines.push(step.description);
  lines.push('');
  lines.push('Instructions:');
  lines.push(dash);
  for (const line of step.instructions) {
    lines.push(line);
  }
  lines.push('');
  lines.push(`Tip: ${step.tip}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format all steps as a full guide.
 * @returns {string}
 */
function formatFullGuide() {
  const lines = [];
  const sep = '='.repeat(56);

  lines.push(sep);
  lines.push('  AIOX Getting Started Guide');
  lines.push('  5-Step Journey to Productive Development');
  lines.push(sep);
  lines.push('');

  for (const step of GUIDE_STEPS) {
    lines.push(formatStep(step));
  }

  lines.push(sep);
  lines.push('  You\'re ready! Start building with AIOX.');
  lines.push(sep);

  return lines.join('\n');
}

/**
 * Export guide as markdown.
 * @returns {string}
 */
function exportMarkdown() {
  const lines = [];

  lines.push('# AIOX Getting Started Guide');
  lines.push('');
  lines.push('A 5-step journey to productive development with AIOX.');
  lines.push('');

  for (const step of GUIDE_STEPS) {
    lines.push(`## Step ${step.number}: ${step.title}`);
    lines.push('');
    lines.push(step.description);
    lines.push('');
    lines.push('### Instructions');
    lines.push('');
    for (const line of step.instructions) {
      if (line.startsWith('  ')) {
        lines.push('```bash');
        lines.push(line.trim());
        lines.push('```');
      } else if (line === '') {
        lines.push('');
      } else {
        lines.push(line);
      }
    }
    lines.push('');
    lines.push(`> **Tip:** ${step.tip}`);
    lines.push('');
    lines.push('### Key Commands');
    lines.push('');
    for (const cmd of step.commands) {
      lines.push(`- \`${cmd}\``);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('*Generated by AIOX Getting Started Guide Generator*');

  return lines.join('\n');
}

/**
 * Run the getting-started command.
 * @param {string[]} argv
 * @param {{ silent?: boolean }} options
 * @returns {{ output: string, markdown?: string, step?: object }}
 */
function runGettingStarted(argv = [], options = {}) {
  const silent = options.silent || false;
  const isExport = argv.includes('--export');
  const stepIdx = argv.indexOf('--step');
  const stepNum = stepIdx !== -1 && argv[stepIdx + 1] ? parseInt(argv[stepIdx + 1], 10) : null;

  if (isExport) {
    const md = exportMarkdown();
    if (!silent) console.log(md);
    return { output: md, markdown: md };
  }

  if (stepNum !== null) {
    const step = getStep(stepNum);
    if (!step) {
      const msg = `Step ${stepNum} not found. Available steps: 1-${GUIDE_STEPS.length}`;
      if (!silent) console.error(msg);
      return { output: msg, error: true };
    }
    const output = formatStep(step);
    if (!silent) console.log(output);
    return { output, step };
  }

  const output = formatFullGuide();
  if (!silent) console.log(output);
  return { output };
}

module.exports = {
  runGettingStarted,
  getSteps,
  getStep,
  formatStep,
  formatFullGuide,
  exportMarkdown,
  GUIDE_STEPS,
};

if (require.main === module) {
  runGettingStarted(process.argv.slice(2));
}
