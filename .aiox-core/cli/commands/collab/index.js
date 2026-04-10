/**
 * Enhanced Agent Collaboration Protocol
 *
 * Manage agent handoffs, collaboration chains, and capability matrix.
 *
 * Subcommands:
 *   aiox collab                          - show active collaboration state
 *   aiox collab handoff <from> <to> --context <json> - create handoff artifact
 *   aiox collab history                  - show handoff history
 *   aiox collab chain <workflow>         - show agent chain for a workflow
 *   aiox collab matrix                   - show agent capability matrix
 *
 * @module cli/commands/collab
 * @version 1.0.0
 * @story 35.2 - Enhanced Agent Collaboration Protocol
 */

'use strict';

const fs = require('fs');
const path = require('path');

// -- Constants ----------------------------------------------------------------

const HANDOFF_DIR_NAME = '.aiox/handoffs';
const CHAINS_FILE_NAME = '.aiox-core/data/workflow-chains.yaml';

const AGENT_CAPABILITIES = {
  dev: {
    name: 'Dex',
    role: 'Implementation',
    capabilities: ['code', 'tests', 'git-local', 'refactor', 'debug'],
    blocked: ['git-push', 'pr-create', 'mcp-manage'],
  },
  qa: {
    name: 'Quinn',
    role: 'Quality Assurance',
    capabilities: ['test-review', 'qa-gate', 'code-review', 'regression'],
    blocked: ['git-push', 'implementation'],
  },
  architect: {
    name: 'Aria',
    role: 'Architecture',
    capabilities: ['system-design', 'tech-selection', 'complexity-assessment', 'patterns'],
    blocked: ['git-push', 'implementation'],
  },
  pm: {
    name: 'Morgan',
    role: 'Product Management',
    capabilities: ['epic-create', 'epic-execute', 'requirements', 'spec-pipeline'],
    blocked: ['git-push', 'implementation'],
  },
  po: {
    name: 'Pax',
    role: 'Product Owner',
    capabilities: ['story-validate', 'backlog-prioritize', 'context-track'],
    blocked: ['git-push', 'implementation'],
  },
  sm: {
    name: 'River',
    role: 'Scrum Master',
    capabilities: ['story-create', 'story-draft', 'template-select'],
    blocked: ['git-push', 'implementation'],
  },
  analyst: {
    name: 'Alex',
    role: 'Research & Analysis',
    capabilities: ['research', 'analysis', 'data-gather', 'report'],
    blocked: ['git-push', 'implementation'],
  },
  'data-engineer': {
    name: 'Dara',
    role: 'Database',
    capabilities: ['schema-design', 'query-optimize', 'migration', 'rls-policy'],
    blocked: ['git-push', 'frontend'],
  },
  'ux-design-expert': {
    name: 'Uma',
    role: 'UX/UI Design',
    capabilities: ['ux-review', 'frontend-spec', 'accessibility', 'design-system'],
    blocked: ['git-push', 'backend'],
  },
  devops: {
    name: 'Gage',
    role: 'DevOps',
    capabilities: ['git-push', 'pr-create', 'ci-cd', 'release', 'mcp-manage'],
    blocked: [],
  },
};

const DEFAULT_CHAINS = {
  'story-development': {
    name: 'Story Development Cycle',
    chain: ['sm', 'po', 'dev', 'qa', 'devops'],
    description: 'Full story lifecycle from draft to push',
  },
  'qa-loop': {
    name: 'QA Review Loop',
    chain: ['qa', 'dev', 'qa'],
    description: 'Iterative review-fix cycle',
  },
  'spec-pipeline': {
    name: 'Spec Pipeline',
    chain: ['pm', 'architect', 'analyst', 'pm', 'qa', 'architect'],
    description: 'Requirements to implementation plan',
  },
  'brownfield': {
    name: 'Brownfield Discovery',
    chain: ['architect', 'data-engineer', 'ux-design-expert', 'architect', 'qa', 'analyst', 'pm'],
    description: 'Legacy assessment workflow',
  },
};

// -- Helpers ------------------------------------------------------------------

function getHandoffDir() {
  return path.join(process.cwd(), HANDOFF_DIR_NAME);
}

function ensureHandoffDir() {
  const dir = getHandoffDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * List all handoff artifacts sorted by timestamp (newest first).
 * @returns {object[]}
 */
function listHandoffs() {
  const dir = getHandoffDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('handoff-') && (f.endsWith('.yaml') || f.endsWith('.json')))
    .sort()
    .reverse();
  const results = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      // Simple YAML/JSON parse — prefer JSON
      let data;
      if (f.endsWith('.json')) {
        data = JSON.parse(content);
      } else {
        data = parseSimpleYaml(content);
      }
      data._file = f;
      results.push(data);
    } catch {
      // skip corrupt files
    }
  }
  return results;
}

/**
 * Simple YAML-like parser for handoff artifacts (flat key-value).
 * @param {string} content
 * @returns {object}
 */
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let currentKey = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      result[currentKey] = match[2] || '';
    } else if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(result[currentKey])) {
        result[currentKey] = result[currentKey] ? [result[currentKey]] : [];
      }
      result[currentKey].push(trimmed.slice(2));
    }
  }
  return result;
}

/**
 * Create a handoff artifact.
 * @param {string} from - source agent
 * @param {string} to - target agent
 * @param {object} context - handoff context
 * @returns {string} filename
 */
function createHandoff(from, to, context) {
  const dir = ensureHandoffDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `handoff-${from}-to-${to}-${timestamp}.json`;
  const artifact = {
    from_agent: from,
    to_agent: to,
    timestamp: new Date().toISOString(),
    consumed: false,
    context: context || {},
  };
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(artifact, null, 2), 'utf8');
  return filename;
}

/**
 * Get the most recent unconsumed handoff.
 * @returns {object|null}
 */
function getActiveHandoff() {
  const handoffs = listHandoffs();
  return handoffs.find(h => h.consumed === false) || null;
}

/**
 * Get workflow chain definitions.
 * @returns {object}
 */
function getChains() {
  const chainsFile = path.join(process.cwd(), CHAINS_FILE_NAME);
  if (fs.existsSync(chainsFile)) {
    try {
      const content = fs.readFileSync(chainsFile, 'utf8');
      const parsed = parseSimpleYaml(content);
      if (Object.keys(parsed).length > 0) return parsed;
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_CHAINS;
}

// -- CLI Runner ---------------------------------------------------------------

/**
 * Run the collab command.
 * @param {string[]} argv
 */
function runCollab(argv) {
  const sub = argv[0];

  if (!sub) {
    // Show active collaboration state
    const active = getActiveHandoff();
    if (!active) {
      console.log('No active agent collaboration.');
      console.log('Use: aiox collab handoff <from> <to> --context <json>');
      return;
    }
    console.log('Active Handoff:');
    console.log(`  From: ${active.from_agent}`);
    console.log(`  To: ${active.to_agent}`);
    console.log(`  Time: ${active.timestamp}`);
    if (active.context && Object.keys(active.context).length > 0) {
      console.log(`  Context: ${JSON.stringify(active.context)}`);
    }
    return;
  }

  switch (sub) {
    case 'handoff': {
      const from = argv[1];
      const to = argv[2];
      if (!from || !to) {
        console.error('Usage: aiox collab handoff <from> <to> [--context <json>]');
        process.exit(1);
      }
      // Parse --context flag
      let context = {};
      const ctxIdx = argv.indexOf('--context');
      if (ctxIdx !== -1 && argv[ctxIdx + 1]) {
        try {
          context = JSON.parse(argv[ctxIdx + 1]);
        } catch {
          console.error('Invalid JSON for --context');
          process.exit(1);
        }
      }
      const filename = createHandoff(from, to, context);
      console.log(`Handoff created: ${from} -> ${to}`);
      console.log(`Artifact: ${filename}`);
      break;
    }

    case 'history': {
      const handoffs = listHandoffs();
      if (handoffs.length === 0) {
        console.log('No handoff history.');
        return;
      }
      console.log(`Handoff History (${handoffs.length}):\n`);
      for (const h of handoffs) {
        const status = h.consumed ? 'consumed' : 'active';
        console.log(`  ${h.from_agent || '?'} -> ${h.to_agent || '?'}  [${status}]  ${h.timestamp || ''}`);
      }
      break;
    }

    case 'chain': {
      const workflow = argv[1];
      const chains = getChains();
      if (!workflow) {
        // List all chains
        console.log('Available Workflow Chains:\n');
        for (const [key, chain] of Object.entries(chains)) {
          const agents = chain.chain ? chain.chain.join(' -> ') : 'unknown';
          console.log(`  ${key}: ${agents}`);
          if (chain.description) console.log(`    ${chain.description}`);
        }
        return;
      }
      const chain = chains[workflow];
      if (!chain) {
        console.error(`Unknown workflow: ${workflow}`);
        console.log('Available:', Object.keys(chains).join(', '));
        process.exit(1);
      }
      console.log(`Workflow: ${chain.name || workflow}`);
      if (chain.description) console.log(`Description: ${chain.description}`);
      console.log(`Chain: ${chain.chain.join(' -> ')}`);
      break;
    }

    case 'matrix': {
      console.log('Agent Capability Matrix:\n');
      const header = '  Agent              Role                    Capabilities';
      console.log(header);
      console.log('  ' + '-'.repeat(header.length - 2));
      for (const [id, agent] of Object.entries(AGENT_CAPABILITIES)) {
        const padId = id.padEnd(18);
        const padRole = agent.role.padEnd(23);
        const caps = agent.capabilities.join(', ');
        console.log(`  ${padId} ${padRole} ${caps}`);
      }
      break;
    }

    default:
      console.error(`Unknown collab subcommand: ${sub}`);
      console.log('Available: handoff, history, chain, matrix');
      process.exit(1);
  }
}

module.exports = {
  runCollab,
  getHandoffDir,
  ensureHandoffDir,
  listHandoffs,
  createHandoff,
  getActiveHandoff,
  getChains,
  parseSimpleYaml,
  AGENT_CAPABILITIES,
  DEFAULT_CHAINS,
};
