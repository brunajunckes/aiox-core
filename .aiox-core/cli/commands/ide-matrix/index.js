'use strict';

/**
 * AIOX IDE Compatibility Matrix — Story 32.2
 * Shows which IDE features work with AIOX.
 * Zero external deps — Node.js stdlib only.
 */

const IDE_LIST = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    tier: 'Tier 1 (Full Support)',
    features: {
      agentActivation: { supported: true, notes: 'Native @agent commands via slash commands' },
      storyWorkflow: { supported: true, notes: 'Full SDC lifecycle with agent handoffs' },
      qualityGates: { supported: true, notes: 'Integrated lint, typecheck, test, CodeRabbit' },
      squads: { supported: true, notes: 'Parallel squad execution via Task tool' },
      mcp: { supported: true, notes: 'Native MCP support with Docker gateway' },
    },
    setup: [
      'AIOX installs automatically via npx aiox-core install',
      'Agent commands available as /AIOX:agents:{name}',
      'MCP servers configured in .claude/mcp.json',
      'Rules loaded from .claude/rules/',
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    tier: 'Tier 2 (Good Support)',
    features: {
      agentActivation: { supported: true, notes: 'Via .cursor/rules/agents/ condensed rules' },
      storyWorkflow: { supported: true, notes: 'Story-driven dev with agent rules' },
      qualityGates: { supported: true, notes: 'CLI commands: npm run lint, npm test' },
      squads: { supported: false, notes: 'No parallel agent execution' },
      mcp: { supported: true, notes: 'MCP support via Cursor settings' },
    },
    setup: [
      'Run npx aiox-core install (auto-syncs agent rules)',
      'Agent personas in .cursor/rules/agents/',
      'Use @agent-name in Cursor chat for context',
      'Configure MCP in Cursor settings',
    ],
  },
  {
    id: 'vscode-copilot',
    name: 'VS Code + Copilot',
    tier: 'Tier 2 (Good Support)',
    features: {
      agentActivation: { supported: true, notes: 'Via .github/agents/ copilot format' },
      storyWorkflow: { supported: true, notes: 'Story files as context in chat' },
      qualityGates: { supported: true, notes: 'CLI commands via integrated terminal' },
      squads: { supported: false, notes: 'No parallel agent execution' },
      mcp: { supported: false, notes: 'Copilot does not support MCP yet' },
    },
    setup: [
      'Run npx aiox-core install (auto-syncs agent configs)',
      'Agent configs in .github/agents/',
      'Reference agent in Copilot Chat with @workspace',
      'Quality gates via VS Code tasks or terminal',
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini Code Assist',
    tier: 'Tier 2 (Good Support)',
    features: {
      agentActivation: { supported: true, notes: 'Via .gemini/rules/AIOX/agents/' },
      storyWorkflow: { supported: true, notes: 'Story-driven with rule files' },
      qualityGates: { supported: true, notes: 'CLI commands via terminal' },
      squads: { supported: false, notes: 'No parallel agent execution' },
      mcp: { supported: false, notes: 'No MCP support' },
    },
    setup: [
      'Run npx aiox-core install (auto-syncs rules)',
      'Agent rules in .gemini/rules/AIOX/agents/',
      'Reference rules in Gemini chat',
      'Quality gates via integrated terminal',
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    tier: 'Tier 3 (Basic Support)',
    features: {
      agentActivation: { supported: false, notes: 'Manual context loading required' },
      storyWorkflow: { supported: true, notes: 'Story files as manual context' },
      qualityGates: { supported: true, notes: 'CLI commands via terminal' },
      squads: { supported: false, notes: 'No parallel execution' },
      mcp: { supported: true, notes: 'MCP support available' },
    },
    setup: [
      'Run npx aiox-core install',
      'Manually load agent persona files as context',
      'Use story files as context references',
      'Quality gates via terminal: npm run lint && npm test',
    ],
  },
  {
    id: 'jetbrains',
    name: 'JetBrains AI',
    tier: 'Tier 3 (Basic Support)',
    features: {
      agentActivation: { supported: false, notes: 'No agent command system' },
      storyWorkflow: { supported: true, notes: 'Story files as context' },
      qualityGates: { supported: true, notes: 'IDE-integrated lint + terminal commands' },
      squads: { supported: false, notes: 'No parallel execution' },
      mcp: { supported: false, notes: 'No MCP support' },
    },
    setup: [
      'Run npx aiox-core install',
      'Load agent persona files manually in AI chat',
      'Use JetBrains run configs for quality gates',
      'Reference story files when asking AI for implementation',
    ],
  },
];

const FEATURE_LABELS = {
  agentActivation: 'Agent Activation',
  storyWorkflow: 'Story Workflow',
  qualityGates: 'Quality Gates',
  squads: 'Squads',
  mcp: 'MCP Integration',
};

/**
 * Get all IDE data.
 * @returns {Array}
 */
function getIDEList() {
  return IDE_LIST;
}

/**
 * Get a specific IDE by id.
 * @param {string} ideId
 * @returns {object|null}
 */
function getIDE(ideId) {
  const normalized = ideId.toLowerCase().replace(/\s+/g, '-');
  return IDE_LIST.find((ide) =>
    ide.id === normalized ||
    ide.name.toLowerCase().replace(/\s+/g, '-') === normalized
  ) || null;
}

/**
 * Format the full compatibility matrix as a table.
 * @returns {string}
 */
function formatMatrix() {
  const lines = [];
  const sep = '='.repeat(72);
  lines.push(sep);
  lines.push('  AIOX IDE Compatibility Matrix');
  lines.push(sep);
  lines.push('');

  // Header
  const featureKeys = Object.keys(FEATURE_LABELS);
  const colWidth = 10;
  let header = 'IDE'.padEnd(22);
  for (const key of featureKeys) {
    header += FEATURE_LABELS[key].padEnd(colWidth + 8);
  }
  lines.push(header);
  lines.push('-'.repeat(72));

  // Rows
  for (const ide of IDE_LIST) {
    let row = ide.name.padEnd(22);
    for (const key of featureKeys) {
      const f = ide.features[key];
      const icon = f.supported ? 'Yes' : 'No';
      row += icon.padEnd(colWidth + 8);
    }
    lines.push(row);
  }

  lines.push('');
  lines.push('Legend: Yes = Supported, No = Not supported');
  lines.push('');
  lines.push('Use --ide <name> for detailed IDE instructions.');
  lines.push('Use --json for machine-readable output.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format detailed info for a specific IDE.
 * @param {object} ide
 * @returns {string}
 */
function formatIDEDetail(ide) {
  const lines = [];
  const sep = '='.repeat(56);
  lines.push(sep);
  lines.push(`  ${ide.name} — ${ide.tier}`);
  lines.push(sep);
  lines.push('');

  lines.push('Features:');
  lines.push('-'.repeat(40));
  const featureKeys = Object.keys(FEATURE_LABELS);
  for (const key of featureKeys) {
    const f = ide.features[key];
    const icon = f.supported ? '[OK]' : '[--]';
    lines.push(`  ${icon} ${FEATURE_LABELS[key]}: ${f.notes}`);
  }
  lines.push('');

  lines.push('Setup Instructions:');
  lines.push('-'.repeat(40));
  for (let i = 0; i < ide.setup.length; i++) {
    lines.push(`  ${i + 1}. ${ide.setup[i]}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Build JSON output.
 * @param {string|null} ideFilter
 * @returns {object}
 */
function buildJSON(ideFilter) {
  if (ideFilter) {
    const ide = getIDE(ideFilter);
    if (!ide) {
      return { error: `IDE not found: ${ideFilter}`, available: IDE_LIST.map((i) => i.id) };
    }
    return ide;
  }
  return { ides: IDE_LIST, features: FEATURE_LABELS };
}

/**
 * Run the ide-matrix command.
 * @param {string[]} argv
 * @param {{ silent?: boolean }} options
 * @returns {{ output: string, json?: object }}
 */
function runIDEMatrix(argv = [], options = {}) {
  const silent = options.silent || false;
  const isJSON = argv.includes('--json');
  const ideIdx = argv.indexOf('--ide');
  const ideFilter = ideIdx !== -1 && argv[ideIdx + 1] ? argv[ideIdx + 1] : null;

  if (isJSON) {
    const json = buildJSON(ideFilter);
    if (!silent) {
      console.log(JSON.stringify(json, null, 2));
    }
    return { output: JSON.stringify(json, null, 2), json };
  }

  if (ideFilter) {
    const ide = getIDE(ideFilter);
    if (!ide) {
      const msg = `IDE not found: ${ideFilter}\nAvailable: ${IDE_LIST.map((i) => i.id).join(', ')}`;
      if (!silent) console.error(msg);
      return { output: msg, error: true };
    }
    const output = formatIDEDetail(ide);
    if (!silent) console.log(output);
    return { output };
  }

  const output = formatMatrix();
  if (!silent) console.log(output);
  return { output };
}

module.exports = {
  runIDEMatrix,
  getIDEList,
  getIDE,
  formatMatrix,
  formatIDEDetail,
  buildJSON,
  IDE_LIST,
  FEATURE_LABELS,
};

if (require.main === module) {
  runIDEMatrix(process.argv.slice(2));
}
