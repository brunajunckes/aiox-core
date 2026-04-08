'use strict';

const path = require('path');
const readline = require('readline');

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENTS_DIR = path.resolve(__dirname, '../../../development/agents');

// ─── Fuzzy Search ───────────────────────────────────────────────────────────

/**
 * Score a candidate string against a query using fuzzy matching.
 * Returns a numeric score (higher = better match). 0 means no match.
 *
 * Scoring tiers:
 *   100 — exact match (case-insensitive)
 *    80 — prefix match
 *    60 — substring match
 *    40 — character scatter (all query chars appear in order)
 *     0 — no match
 */
function fuzzyScore(candidate, query) {
  if (!query || !candidate) return 0;

  const lower = candidate.toLowerCase();
  const q = query.toLowerCase();

  // Exact match
  if (lower === q) return 100;

  // Prefix match
  if (lower.startsWith(q)) return 80;

  // Substring match
  if (lower.includes(q)) return 60;

  // Character scatter — all chars of query appear in candidate in order
  let ci = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = lower.indexOf(q[qi], ci);
    if (found === -1) return 0;
    ci = found + 1;
  }
  return 40;
}

/**
 * Score a registry entry against a query.
 * Matches against both command name and description, taking the best score.
 */
function scoreEntry(entry, query) {
  const nameScore = fuzzyScore(entry.command, query);
  const descScore = fuzzyScore(entry.description, query);
  const agentScore = fuzzyScore(entry.agent, query);
  return Math.max(nameScore, descScore, agentScore);
}

/**
 * Filter and sort registry entries by fuzzy match score.
 * Returns entries with score > 0, sorted descending by score.
 */
function fuzzyFilter(registry, query) {
  if (!query) return registry;

  const scored = registry
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score || a.entry.command.localeCompare(b.entry.command));
  return scored.map((s) => s.entry);
}

// ─── Command Registry ───────────────────────────────────────────────────────

/**
 * Build a flat command registry from all discovered agents.
 * Each entry: { command, agent, agentIcon, description }
 */
function buildRegistry(agents) {
  const registry = [];

  for (const agent of agents) {
    for (const cmd of agent.commands) {
      registry.push({
        command: cmd.name,
        agent: agent.id,
        agentIcon: agent.icon || '',
        description: cmd.description || '',
      });
    }
  }

  // Sort alphabetically by command name, then by agent
  registry.sort((a, b) => a.command.localeCompare(b.command) || a.agent.localeCompare(b.agent));
  return registry;
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
 * Render the registry as a formatted table to stdout.
 */
function renderTable(entries, output) {
  const out = output || process.stdout;

  if (entries.length === 0) {
    out.write('No commands found.\n');
    return;
  }

  // Compute column widths
  const cmdValues = entries.map((e) => `*${e.command}`);
  const agentValues = entries.map((e) => `@${e.agent}`);

  const COL_CMD = Math.max('Command'.length, ...cmdValues.map((v) => v.length)) + 3;
  const COL_AGENT = Math.max('Agent'.length, ...agentValues.map((v) => v.length)) + 3;

  const header = pad('Command', COL_CMD) + pad('Agent', COL_AGENT) + 'Description';
  const separator = '\u2500'.repeat(Math.max(header.length, 68));

  out.write('\n');
  out.write(header + '\n');
  out.write(separator + '\n');

  for (const entry of entries) {
    const line =
      pad(`*${entry.command}`, COL_CMD) +
      pad(`@${entry.agent}`, COL_AGENT) +
      entry.description;
    out.write(line + '\n');
  }

  out.write('\n');
  out.write(`${entries.length} commands across ${new Set(entries.map((e) => e.agent)).size} agents.\n`);
  out.write('\n');
}

/**
 * Render detail for a single command entry.
 */
function renderCommandDetail(entry, output) {
  const out = output || process.stdout;
  out.write('\n');
  out.write(`  ${entry.agentIcon} *${entry.command}  (@${entry.agent})\n`);
  out.write(`  ${entry.description}\n`);
  out.write('\n');
  out.write(`  Usage: Activate @${entry.agent} then run *${entry.command}\n`);
  out.write('\n');
}

// ─── Interactive Mode ───────────────────────────────────────────────────────

/**
 * Run the interactive palette with fuzzy search.
 * Users type to filter, use numbers to select, press Enter with no input to exit.
 */
async function interactivePalette(registry) {
  if (registry.length === 0) {
    console.log('No commands found.');
    return;
  }

  const PAGE_SIZE = 15;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const showFiltered = (query) => {
    const filtered = fuzzyFilter(registry, query);
    const display = filtered.slice(0, PAGE_SIZE);

    console.log('');
    if (query) {
      console.log(`  Search: "${query}" (${filtered.length} results)`);
    } else {
      console.log(`  AIOX Command Palette (${registry.length} commands)`);
    }
    console.log('');

    if (display.length === 0) {
      console.log('  No matching commands.');
    } else {
      for (let i = 0; i < display.length; i++) {
        const e = display[i];
        console.log(`  ${pad(String(i + 1) + '.', 5)}${e.agentIcon} ${pad(`*${e.command}`, 24)}@${pad(e.agent, 14)}${e.description}`);
      }
      if (filtered.length > PAGE_SIZE) {
        console.log(`  ... and ${filtered.length - PAGE_SIZE} more. Refine your search.`);
      }
    }
    console.log('');

    return filtered;
  };

  let currentFiltered = showFiltered('');

  return new Promise((resolve) => {
    const prompt = () => {
      rl.question('  Search or select (#): ', (answer) => {
        const trimmed = answer.trim();

        // Empty input exits
        if (trimmed === '') {
          rl.close();
          resolve(null);
          return;
        }

        // If it is a number, select that entry
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= currentFiltered.length && String(num) === trimmed) {
          const selected = currentFiltered[num - 1];
          renderCommandDetail(selected);
          rl.close();
          resolve(selected);
          return;
        }

        // Otherwise treat as search query
        currentFiltered = showFiltered(trimmed);
        prompt();
      });
    };

    prompt();
  });
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Run the palette CLI command.
 * @param {string[]} argv - Arguments after "palette" (e.g. ['--search', 'develop'])
 * @param {object} [options] - Override options for testing
 * @param {string} [options.agentsDir] - Custom agents directory
 * @param {function} [options.discoverAgents] - Custom agent discovery function
 */
async function runPalette(argv, options = {}) {
  const { discoverAgents } = options.discoverAgents
    ? { discoverAgents: options.discoverAgents }
    : require('../agents/index.js');

  const agentsDir = options.agentsDir || AGENTS_DIR;
  const args = argv || [];

  // Parse flags
  const searchIndex = args.indexOf('--search');
  const hasSearch = searchIndex !== -1;
  const searchQuery = hasSearch ? args[searchIndex + 1] || '' : '';
  const hasJson = args.includes('--json');
  const hasList = args.includes('--list');
  const hasHelp = args.includes('--help') || args.includes('-h');

  if (hasHelp) {
    showPaletteHelp();
    return;
  }

  // Discover agents and build registry
  const agents = discoverAgents(agentsDir);
  const registry = buildRegistry(agents);

  // --json: output full registry as JSON
  if (hasJson) {
    console.log(JSON.stringify(registry, null, 2));
    return;
  }

  // --search: filter and display results
  if (hasSearch) {
    const filtered = fuzzyFilter(registry, searchQuery);
    renderTable(filtered);
    return;
  }

  // --list or piped (non-TTY): render table
  if (hasList || !process.stdin.isTTY) {
    renderTable(registry);
    return;
  }

  // Interactive mode (TTY, no flags)
  await interactivePalette(registry);
}

function showPaletteHelp() {
  console.log(`
AIOX Command Palette — Discover commands across all agents

USAGE:
  aiox palette                     # Interactive fuzzy search (TTY)
  aiox palette --list              # List all commands (non-interactive)
  aiox palette --search <query>    # Filter commands by query
  aiox palette --json              # Output command registry as JSON
  aiox palette --help              # Show this help

ALIASES:
  aiox commands                    # Same as aiox palette

EXAMPLES:
  aiox palette --search develop    # Find commands matching "develop"
  aiox palette --search qa         # Find QA-related commands
  aiox commands --list             # List all commands
  aiox commands --json             # JSON output for scripting
`);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  runPalette,
  buildRegistry,
  fuzzyScore,
  fuzzyFilter,
  scoreEntry,
  renderTable,
  renderCommandDetail,
  showPaletteHelp,
};
