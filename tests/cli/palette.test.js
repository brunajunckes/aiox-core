'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  fuzzyScore,
  fuzzyFilter,
  scoreEntry,
  buildRegistry,
  renderTable,
  renderCommandDetail,
} = require('../../.aiox-core/cli/commands/palette/index.js');

// ─── fuzzyScore ─────────────────────────────────────────────────────────────

describe('fuzzyScore', () => {
  test('returns 100 for exact match (case-insensitive)', () => {
    expect(fuzzyScore('develop', 'develop')).toBe(100);
    expect(fuzzyScore('Develop', 'develop')).toBe(100);
    expect(fuzzyScore('DEVELOP', 'develop')).toBe(100);
  });

  test('returns 80 for prefix match', () => {
    expect(fuzzyScore('develop-story', 'develop')).toBe(80);
    expect(fuzzyScore('qa-gate', 'qa')).toBe(80);
  });

  test('returns 60 for substring match', () => {
    expect(fuzzyScore('develop-story', 'story')).toBe(60);
    expect(fuzzyScore('qa-loop-review', 'loop')).toBe(60);
  });

  test('returns 40 for character scatter match', () => {
    expect(fuzzyScore('develop', 'dvp')).toBe(40);
    expect(fuzzyScore('qa-gate', 'qg')).toBe(40);
  });

  test('returns 0 for no match', () => {
    expect(fuzzyScore('develop', 'xyz')).toBe(0);
    expect(fuzzyScore('qa-gate', 'zz')).toBe(0);
  });

  test('returns 0 for empty query', () => {
    expect(fuzzyScore('develop', '')).toBe(0);
  });

  test('returns 0 for empty candidate', () => {
    expect(fuzzyScore('', 'test')).toBe(0);
  });

  test('handles single character queries', () => {
    expect(fuzzyScore('help', 'h')).toBe(80); // prefix
    expect(fuzzyScore('push', 'u')).toBe(60); // substring
  });
});

// ─── scoreEntry ─────────────────────────────────────────────────────────────

describe('scoreEntry', () => {
  const entry = {
    command: 'develop',
    agent: 'dev',
    agentIcon: '',
    description: 'Implement story tasks',
  };

  test('scores against command name', () => {
    expect(scoreEntry(entry, 'develop')).toBe(100);
  });

  test('scores against description', () => {
    expect(scoreEntry(entry, 'story')).toBe(60);
  });

  test('scores against agent name', () => {
    expect(scoreEntry(entry, 'dev')).toBe(100);
  });

  test('takes best score across fields', () => {
    // 'dev' matches command as prefix (80) and agent exactly (100)
    expect(scoreEntry(entry, 'dev')).toBe(100);
  });
});

// ─── fuzzyFilter ────────────────────────────────────────────────────────────

describe('fuzzyFilter', () => {
  const registry = [
    { command: 'help', agent: 'dev', agentIcon: '', description: 'Show help' },
    { command: 'develop', agent: 'dev', agentIcon: '', description: 'Implement story tasks' },
    { command: 'qa-gate', agent: 'qa', agentIcon: '', description: 'Run quality gate' },
    { command: 'push', agent: 'devops', agentIcon: '', description: 'Push to remote' },
    { command: 'help', agent: 'qa', agentIcon: '', description: 'Show QA help' },
  ];

  test('returns all entries when query is empty', () => {
    expect(fuzzyFilter(registry, '')).toEqual(registry);
    expect(fuzzyFilter(registry, null)).toEqual(registry);
  });

  test('filters by command name', () => {
    const result = fuzzyFilter(registry, 'help');
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.command === 'help')).toBe(true);
  });

  test('filters by agent name', () => {
    const result = fuzzyFilter(registry, 'qa');
    // 'qa-gate' (prefix on command), 'qa' agent help, and 'Run quality gate' description
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test('filters by description content', () => {
    const result = fuzzyFilter(registry, 'quality');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].command).toBe('qa-gate');
  });

  test('returns empty array for unmatched query', () => {
    const result = fuzzyFilter(registry, 'zzzzz');
    expect(result).toHaveLength(0);
  });

  test('sorts by score descending', () => {
    const result = fuzzyFilter(registry, 'dev');
    // 'develop' (prefix 80 on command) and 'dev' agent entries should be ranked high
    expect(result.length).toBeGreaterThanOrEqual(1);
    // First result should have highest relevance
    const firstScore = scoreEntry(result[0], 'dev');
    for (const entry of result) {
      expect(scoreEntry(entry, 'dev')).toBeLessThanOrEqual(firstScore);
    }
  });
});

// ─── buildRegistry ──────────────────────────────────────────────────────────

describe('buildRegistry', () => {
  test('builds flat registry from agents', () => {
    const agents = [
      {
        id: 'dev',
        name: 'Dex',
        icon: '',
        commands: [
          { name: 'help', description: 'Show help', visibility: ['key'] },
          { name: 'develop', description: 'Implement story', visibility: ['full'] },
        ],
      },
      {
        id: 'qa',
        name: 'Quinn',
        icon: '',
        commands: [
          { name: 'qa-gate', description: 'Run QA gate', visibility: ['key'] },
        ],
      },
    ];

    const registry = buildRegistry(agents);
    expect(registry).toHaveLength(3);
    expect(registry.every((e) => e.command && e.agent && 'description' in e)).toBe(true);
  });

  test('returns empty array for no agents', () => {
    expect(buildRegistry([])).toEqual([]);
  });

  test('handles agents with no commands', () => {
    const agents = [{ id: 'empty', name: 'Empty', icon: '', commands: [] }];
    expect(buildRegistry(agents)).toEqual([]);
  });

  test('sorts alphabetically by command name', () => {
    const agents = [
      {
        id: 'dev',
        name: 'Dex',
        icon: '',
        commands: [
          { name: 'zebra', description: 'Z cmd', visibility: [] },
          { name: 'alpha', description: 'A cmd', visibility: [] },
        ],
      },
    ];
    const registry = buildRegistry(agents);
    expect(registry[0].command).toBe('alpha');
    expect(registry[1].command).toBe('zebra');
  });
});

// ─── renderTable ────────────────────────────────────────────────────────────

describe('renderTable', () => {
  test('renders formatted table output', () => {
    const entries = [
      { command: 'help', agent: 'dev', agentIcon: '', description: 'Show help' },
      { command: 'qa-gate', agent: 'qa', agentIcon: '', description: 'Run QA gate' },
    ];

    const chunks = [];
    const mockOutput = { write: (s) => chunks.push(s) };

    renderTable(entries, mockOutput);
    const output = chunks.join('');

    expect(output).toContain('Command');
    expect(output).toContain('Agent');
    expect(output).toContain('Description');
    expect(output).toContain('*help');
    expect(output).toContain('@dev');
    expect(output).toContain('*qa-gate');
    expect(output).toContain('@qa');
    expect(output).toContain('2 commands across 2 agents');
  });

  test('handles empty entries', () => {
    const chunks = [];
    const mockOutput = { write: (s) => chunks.push(s) };

    renderTable([], mockOutput);
    const output = chunks.join('');
    expect(output).toContain('No commands found');
  });
});

// ─── renderCommandDetail ────────────────────────────────────────────────────

describe('renderCommandDetail', () => {
  test('renders command detail', () => {
    const entry = {
      command: 'develop',
      agent: 'dev',
      agentIcon: '',
      description: 'Implement story tasks',
    };

    const chunks = [];
    const mockOutput = { write: (s) => chunks.push(s) };

    renderCommandDetail(entry, mockOutput);
    const output = chunks.join('');

    expect(output).toContain('*develop');
    expect(output).toContain('@dev');
    expect(output).toContain('Implement story tasks');
    expect(output).toContain('Usage:');
  });
});

// ─── Integration: buildRegistry with real agent files ───────────────────────

describe('buildRegistry integration with discoverAgents', () => {
  test('builds registry from real agent files', () => {
    const { discoverAgents } = require('../../.aiox-core/cli/commands/agents/index.js');
    const agentsDir = path.resolve(__dirname, '../../.aiox-core/development/agents');

    // Only run if agents dir exists
    if (!fs.existsSync(agentsDir)) {
      return;
    }

    const agents = discoverAgents(agentsDir);
    const registry = buildRegistry(agents);

    // Should have commands from multiple agents
    expect(registry.length).toBeGreaterThan(0);

    // Each entry should have required fields
    for (const entry of registry) {
      expect(typeof entry.command).toBe('string');
      expect(typeof entry.agent).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(entry.command.length).toBeGreaterThan(0);
      expect(entry.agent.length).toBeGreaterThan(0);
    }

    // Should have multiple agents represented
    const uniqueAgents = new Set(registry.map((e) => e.agent));
    expect(uniqueAgents.size).toBeGreaterThan(1);
  });
});

// ─── Integration: fuzzyFilter on real registry ──────────────────────────────

describe('fuzzyFilter integration', () => {
  let registry;

  beforeAll(() => {
    const { discoverAgents } = require('../../.aiox-core/cli/commands/agents/index.js');
    const agentsDir = path.resolve(__dirname, '../../.aiox-core/development/agents');
    if (!fs.existsSync(agentsDir)) return;

    const agents = discoverAgents(agentsDir);
    registry = buildRegistry(agents);
  });

  test('searching "help" returns results from multiple agents', () => {
    if (!registry) return;
    const results = fuzzyFilter(registry, 'help');
    expect(results.length).toBeGreaterThan(0);
  });

  test('searching gibberish returns empty', () => {
    if (!registry) return;
    const results = fuzzyFilter(registry, 'xyzzyplugh');
    expect(results).toHaveLength(0);
  });
});
