'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENTS_DIR = path.resolve(__dirname, '../../../development/agents');

// ─── YAML Extraction Helpers ────────────────────────────────────────────────

/**
 * Extract the YAML code block from an agent markdown file.
 * Returns the raw YAML string between ```yaml and ```.
 */
function extractYamlBlock(content) {
  const match = content.match(/```yaml\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

/**
 * Parse a simple YAML value from a line like "  key: value" or "  key: 'value'"
 * This is intentionally minimal — handles the flat fields we need without a full YAML parser.
 */
function parseSimpleValue(yamlBlock, key) {
  const regex = new RegExp(`^\\s*${key}:\\s*['"]?(.+?)['"]?\\s*$`, 'm');
  const match = yamlBlock.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract the commands array from the YAML block.
 * Each command has name, description, and optionally visibility.
 */
function parseCommands(yamlBlock) {
  const commands = [];
  const lines = yamlBlock.split('\n');
  let inCommands = false;
  let current = null;

  for (const line of lines) {
    // Detect start of commands section
    if (/^commands:\s*$/.test(line)) {
      inCommands = true;
      continue;
    }

    if (!inCommands) continue;

    // A top-level key at same indent as "commands:" ends the section
    if (/^[a-zA-Z_]/.test(line) && !line.startsWith(' ') && !line.startsWith('#')) {
      break;
    }

    // New command entry (list item with "- name:")
    const nameMatch = line.match(/^\s+-\s+name:\s*['"]?(.+?)['"]?\s*$/);
    if (nameMatch) {
      if (current) commands.push(current);
      current = { name: nameMatch[1], description: '', visibility: [] };
      continue;
    }

    if (!current) continue;

    // Description line
    const descMatch = line.match(/^\s+description:\s*['"](.+?)['"]?\s*$/);
    if (descMatch) {
      current.description = descMatch[1];
      continue;
    }

    // Visibility line (array format: [full, quick, key])
    const visMatch = line.match(/^\s+visibility:\s*\[([^\]]*)\]/);
    if (visMatch) {
      current.visibility = visMatch[1].split(',').map((v) => v.trim());
      continue;
    }
  }

  if (current) commands.push(current);
  return commands;
}

/**
 * Parse a single agent file and return structured metadata.
 */
function parseAgentFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const yamlBlock = extractYamlBlock(content);
  if (!yamlBlock) return null;

  const name = parseSimpleValue(yamlBlock, 'name');
  const id = parseSimpleValue(yamlBlock, 'id');
  const title = parseSimpleValue(yamlBlock, 'title');
  const icon = parseSimpleValue(yamlBlock, 'icon');
  const role = parseSimpleValue(yamlBlock, 'role');
  const commands = parseCommands(yamlBlock);

  if (!name || !id) return null;

  return { name, id, title: title || '', icon: icon || '', role: role || '', commands };
}

// ─── Discovery ──────────────────────────────────────────────────────────────

/**
 * Discover all agent files in the agents directory.
 * Only reads top-level .md files (not subdirectory files like MEMORY.md).
 */
function discoverAgents(agentsDir) {
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  const files = fs.readdirSync(agentsDir).filter((f) => {
    if (!f.endsWith('.md')) return false;
    const fullPath = path.join(agentsDir, f);
    return fs.statSync(fullPath).isFile();
  });

  const agents = [];
  for (const file of files) {
    try {
      const agent = parseAgentFile(path.join(agentsDir, file));
      if (agent) agents.push(agent);
    } catch (err) {
      // Skip files that fail to parse
    }
  }

  // Sort alphabetically by id
  agents.sort((a, b) => a.id.localeCompare(b.id));
  return agents;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Pad a string to a given width (right-pad with spaces).
 */
function pad(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Render the agent list as a formatted table.
 */
function renderTable(agents) {
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  // Compute dynamic column widths from actual data
  const nameValues = agents.map((a) => `${a.icon} ${a.id}`);
  const COL_NAME = Math.max('Name'.length, ...nameValues.map((v) => v.length)) + 3;
  const COL_PERSONA = Math.max('Persona'.length, ...agents.map((a) => a.name.length)) + 3;
  const COL_ROLE = Math.max('Role'.length, ...agents.map((a) => a.title.length)) + 3;

  const header =
    pad('Name', COL_NAME) +
    pad('Persona', COL_PERSONA) +
    pad('Role', COL_ROLE) +
    'Activate';

  const totalWidth = header.length;

  console.log('');
  console.log(header);
  console.log('\u2500'.repeat(totalWidth));

  for (const agent of agents) {
    const nameCol = `${agent.icon} ${agent.id}`;
    const line =
      pad(nameCol, COL_NAME) +
      pad(agent.name, COL_PERSONA) +
      pad(agent.title, COL_ROLE) +
      `@${agent.id}`;
    console.log(line);
  }

  console.log('');
  console.log(`${agents.length} agents available. Use --detail <name> for details.`);
  console.log('');
}

/**
 * Render detail view for a single agent.
 */
function renderDetail(agent) {
  console.log('');
  console.log(`${agent.icon} ${agent.name} (${agent.id}) — ${agent.title}`);
  console.log(`Role: ${agent.role}`);
  console.log('');

  if (agent.commands.length > 0) {
    console.log('Commands:');
    for (const cmd of agent.commands) {
      const prefix = `  *${cmd.name}`;
      const padded = pad(prefix, 28);
      console.log(`${padded}${cmd.description}`);
    }
    console.log('');
  }

  console.log(`Activate: @${agent.id}`);
  console.log('');
}

// ─── Interactive Picker ─────────────────────────────────────────────────────

/**
 * Show numbered list and let user pick an agent.
 * Uses readline for simple TTY input (no external deps).
 */
async function interactivePicker(agents) {
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  console.log('');
  console.log('Available AIOX Agents:');
  console.log('');

  for (let i = 0; i < agents.length; i++) {
    console.log(`  ${i + 1}. ${agents[i].icon} ${agents[i].name} (${agents[i].id}) — ${agents[i].title}`);
  }

  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Select agent (number) or press Enter to cancel: ', (answer) => {
      rl.close();
      const num = parseInt(answer, 10);
      if (isNaN(num) || num < 1 || num > agents.length) {
        if (answer.trim() !== '') {
          console.log(`Invalid selection: ${answer}`);
        }
        resolve(null);
        return;
      }
      resolve(agents[num - 1]);
    });
  });
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run the agents CLI command.
 * @param {string[]} argv - Arguments after "agents" (e.g. ['--detail', 'dev'])
 * @param {object} [options] - Override options for testing
 * @param {string} [options.agentsDir] - Custom agents directory
 * @param {boolean} [options.nonInteractive] - Force non-interactive mode
 */
async function runAgents(argv, options = {}) {
  const agentsDir = options.agentsDir || AGENTS_DIR;
  const args = argv || [];

  // Parse --detail flag
  const detailIndex = args.indexOf('--detail');
  if (detailIndex !== -1) {
    const agentName = args[detailIndex + 1];
    if (!agentName) {
      console.error('Error: --detail requires an agent name. Example: aiox agents --detail dev');
      process.exitCode = 1;
      return;
    }

    const agents = discoverAgents(agentsDir);
    const match = agents.find(
      (a) => a.id.toLowerCase() === agentName.toLowerCase() || a.name.toLowerCase() === agentName.toLowerCase()
    );

    if (!match) {
      console.log('');
      console.log(`Agent "${agentName}" not found.`);
      console.log('');
      console.log('Available agents:');
      for (const a of agents) {
        console.log(`  ${a.icon} ${a.id} (${a.name})`);
      }
      console.log('');
      console.log('Use: aiox agents --detail <name>');
      console.log('');
      return;
    }

    renderDetail(match);
    return;
  }

  // Parse --json flag
  if (args.includes('--json')) {
    const agents = discoverAgents(agentsDir);
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  // Parse --help flag
  if (args.includes('--help') || args.includes('-h')) {
    showAgentsHelp();
    return;
  }

  const agents = discoverAgents(agentsDir);

  // Interactive mode if stdin is TTY and no flags
  const isTTY = process.stdin.isTTY && !options.nonInteractive;
  if (isTTY && args.length === 0) {
    const selected = await interactivePicker(agents);
    if (selected) {
      renderDetail(selected);
    }
    return;
  }

  // Default: render table
  renderTable(agents);
}

function showAgentsHelp() {
  console.log(`
AIOX Agents — Discover available AI agents

USAGE:
  aiox agents                    # List all agents (interactive if TTY)
  aiox agents --detail <name>    # Show detail for a specific agent
  aiox agents --json             # Output agent list as JSON
  aiox agents --help             # Show this help

EXAMPLES:
  aiox agents --detail dev       # Show Dex's commands and role
  aiox agents --detail architect # Show Aria's capabilities
`);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  runAgents,
  discoverAgents,
  parseAgentFile,
  extractYamlBlock,
  parseCommands,
  renderTable,
  renderDetail,
};
