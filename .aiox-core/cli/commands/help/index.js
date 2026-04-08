/**
 * Context-Aware Help System
 *
 * Story 3.4: Adapts `aiox help` output based on current session state.
 *
 * Detection flow:
 *   1. If --raw flag present -> show static help, return
 *   2. Try readSessionState()
 *      - On exception or null -> show onboarding help
 *   3. If session.activeAgent is set -> show agent-specific commands
 *   4. Else if session.activeStoryId is set -> show story-phase help
 *   5. Else -> show onboarding help (no active story)
 *
 * All output branches include the footer line pointing to `aiox help --raw`.
 *
 * @module cli/commands/help
 * @version 1.0.0
 */

'use strict';

const path = require('path');

// ─── Dependencies from sibling modules ─────────────────────────────────────

/**
 * Lazy-load session module to avoid circular dependencies
 * and keep the module testable with mocked cwd.
 */
function loadSessionModule() {
  return require(path.resolve(__dirname, '..', 'session', 'index.js'));
}

/**
 * Lazy-load agents module for agent-specific commands.
 */
function loadAgentsModule() {
  return require(path.resolve(__dirname, '..', 'agents', 'index.js'));
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENTS_DIR_RELATIVE = path.join('.aiox-core', 'development', 'agents');

const FOOTER = '\n  Run `aiox help --raw` for full command reference.\n';

// ─── Output Branches ───────────────────────────────────────────────────────

/**
 * Branch 1: No session state, no story, or session state unreadable.
 * Shows onboarding guidance.
 */
function renderOnboardingHelp() {
  const lines = [
    '',
    '  AIOX Help -- Getting Started',
    '  ' + '-'.repeat(40),
    '',
    '  You don\'t have an active story or session.',
    '',
    '  Next steps:',
    '    aiox agents          Discover available AI agents',
    '    aiox status          Check project status',
    '',
    '  Create your first story:',
    '    1. Activate Scrum Master: @sm',
    '    2. Run: *create-story',
    '    3. Start development: @dev',
    FOOTER,
  ];
  return lines.join('\n');
}

/**
 * Branch 2: Story active — show story-phase-aware help.
 *
 * @param {object} state - Session state with activeStoryId, workflowPosition, etc.
 * @param {string} suggestion - Next action suggestion from suggestNextAction()
 */
function renderStoryHelp(state, suggestion) {
  const storyId = state.activeStoryId || 'unknown';
  const position = state.workflowPosition || 'unknown';
  const agent = state.activeAgent ? `@${state.activeAgent}` : 'none';
  const branch = state.gitBranch || 'unknown';

  const lines = [
    '',
    `  AIOX Help -- Story ${storyId} (${position})`,
    '  ' + '-'.repeat(40),
    '',
    `    Story:    ${storyId} (${position})`,
    `    Agent:    ${agent}`,
    `    Branch:   ${branch}`,
    '',
    '  Suggested next action:',
    `    ${suggestion}`,
    '',
    '  Story commands:',
    '    aiox status          Check current status',
    '    aiox resume          Resume last session',
    '',
    '  Quality gates:',
    '    npm run lint         ESLint check',
    '    npm test             Run tests',
    '    npm run typecheck    Type checking',
    FOOTER,
  ];
  return lines.join('\n');
}

/**
 * Branch 3: Agent active (with or without story).
 * Shows agent-specific commands and common actions.
 *
 * @param {object} state - Session state with activeAgent
 * @param {object|null} agentDef - Parsed agent definition (from discoverAgents)
 */
function renderAgentHelp(state, agentDef) {
  const agentId = state.activeAgent;
  const agentName = agentDef ? agentDef.name : agentId;
  const agentIcon = agentDef ? agentDef.icon : '';

  const headerLabel = agentIcon
    ? `${agentIcon} @${agentId} (${agentName})`
    : `@${agentId} (${agentName})`;

  const lines = [
    '',
    `  AIOX Help -- ${headerLabel}`,
    '  ' + '-'.repeat(40),
    '',
  ];

  // Show commands if we have agent definition
  if (agentDef && agentDef.commands && agentDef.commands.length > 0) {
    lines.push('  Available commands:');
    for (const cmd of agentDef.commands) {
      const prefix = `    *${cmd.name}`;
      const padded = prefix.length < 24 ? prefix + ' '.repeat(24 - prefix.length) : prefix + '  ';
      lines.push(`${padded}${cmd.description}`);
    }
    lines.push('');
  }

  lines.push('  Common actions:');
  lines.push('    aiox agents          Switch agent');
  lines.push('    aiox status          Check status');
  lines.push(FOOTER);

  return lines.join('\n');
}

// ─── Context Detection ─────────────────────────────────────────────────────

/**
 * Detect context from session state and build help output.
 * Completes in < 200ms (synchronous file I/O only).
 *
 * @param {Function} showStaticHelp - Callback to render static help (from aiox.js showHelp)
 * @returns {string} Help output text
 */
function detectContextAndBuildHelp(showStaticHelp) {
  let state;
  try {
    const sessionModule = loadSessionModule();
    state = sessionModule.readSessionState();
  } catch (error) {
    // Session module unavailable or error — fall back to onboarding
    if (process.env.AIOX_DEBUG === 'true') {
      console.error(`[help] Context detection error: ${error.message}`);
    }
    return renderOnboardingHelp();
  }

  // No state at all — onboarding
  if (!state) {
    return renderOnboardingHelp();
  }

  // Agent active — agent-specific help (highest priority)
  if (state.activeAgent) {
    let agentDef = null;
    try {
      const agentsModule = loadAgentsModule();
      const agentsDir = path.join(process.cwd(), AGENTS_DIR_RELATIVE);
      const agents = agentsModule.discoverAgents(agentsDir);
      agentDef = agents.find(
        (a) => a.id.toLowerCase() === state.activeAgent.toLowerCase()
      ) || null;
    } catch (_) {
      // Agent discovery failed — show agent help without commands
    }
    return renderAgentHelp(state, agentDef);
  }

  // Story active — story-phase help
  if (state.activeStoryId) {
    let suggestion = '';
    try {
      const sessionModule = loadSessionModule();
      suggestion = sessionModule.suggestNextAction(state);
    } catch (_) {
      suggestion = 'Continue working on your story.';
    }
    return renderStoryHelp(state, suggestion);
  }

  // No agent, no story — onboarding
  return renderOnboardingHelp();
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Run the context-aware help command.
 *
 * @param {string[]} argv - Arguments after "help" (e.g. ['--raw'])
 * @param {object} options - Options
 * @param {Function} options.showStaticHelp - Callback to render static help
 */
function runHelp(argv, options = {}) {
  const helpArgs = argv || [];
  const showStaticHelp = options.showStaticHelp;

  // --raw flag: bypass context detection entirely
  if (helpArgs.includes('--raw')) {
    if (typeof showStaticHelp === 'function') {
      showStaticHelp();
    } else {
      console.log('Static help unavailable. Run `aiox --help` instead.');
    }
    return;
  }

  // Context-aware help
  const output = detectContextAndBuildHelp(showStaticHelp);
  console.log(output);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  runHelp,
  detectContextAndBuildHelp,
  // Exported for testing
  renderOnboardingHelp,
  renderStoryHelp,
  renderAgentHelp,
  loadSessionModule,
  loadAgentsModule,
};
