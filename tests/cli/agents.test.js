'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  runAgents,
  discoverAgents,
  parseAgentFile,
  extractYamlBlock,
  parseCommands,
  renderTable,
  renderDetail,
} = require('../../.aiox-core/cli/commands/agents/index.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTempAgentsDir() {
  const dir = path.join(os.tmpdir(), `aiox-agents-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeAgentFile(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
}

const SAMPLE_AGENT_MD = `# test-agent

Some description text.

\`\`\`yaml
agent:
  name: TestBot
  id: test-agent
  title: Test Agent
  icon: T

persona:
  role: Testing Specialist

commands:
  - name: help
    visibility: [full, quick, key]
    description: 'Show help'
  - name: run-tests
    visibility: [full, quick]
    description: 'Run all tests'
\`\`\`
`;

const SAMPLE_AGENT_MINIMAL = `# minimal

\`\`\`yaml
agent:
  name: Mini
  id: minimal
  title: Minimal Agent
  icon: M

persona:
  role: Minimal Role
\`\`\`
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Agent CLI — YAML Extraction', () => {
  test('extractYamlBlock extracts content between yaml fences', () => {
    const content = '# Title\n\n```yaml\nfoo: bar\nbaz: qux\n```\n\nMore text.';
    const result = extractYamlBlock(content);
    expect(result).toBe('foo: bar\nbaz: qux\n');
  });

  test('extractYamlBlock returns null when no yaml block', () => {
    const result = extractYamlBlock('# No yaml here\nJust text.');
    expect(result).toBeNull();
  });
});

describe('Agent CLI — parseCommands', () => {
  test('parses commands with name, description, visibility', () => {
    const yaml = `
commands:
  - name: help
    visibility: [full, quick, key]
    description: 'Show help'
  - name: build
    visibility: [full]
    description: 'Build project'
`;
    const cmds = parseCommands(yaml);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toEqual({
      name: 'help',
      description: 'Show help',
      visibility: ['full', 'quick', 'key'],
    });
    expect(cmds[1]).toEqual({
      name: 'build',
      description: 'Build project',
      visibility: ['full'],
    });
  });

  test('returns empty array when no commands section', () => {
    const yaml = 'agent:\n  name: Foo\n  id: foo\n';
    const cmds = parseCommands(yaml);
    expect(cmds).toEqual([]);
  });

  test('handles commands without visibility', () => {
    const yaml = `
commands:
  - name: solo
    description: 'Solo command'
`;
    const cmds = parseCommands(yaml);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].name).toBe('solo');
    expect(cmds[0].visibility).toEqual([]);
  });
});

describe('Agent CLI — parseAgentFile', () => {
  let dir;

  beforeEach(() => {
    dir = createTempAgentsDir();
  });

  afterEach(() => {
    cleanupDir(dir);
  });

  test('parses a well-formed agent file', () => {
    const filePath = path.join(dir, 'test-agent.md');
    fs.writeFileSync(filePath, SAMPLE_AGENT_MD, 'utf8');

    const agent = parseAgentFile(filePath);
    expect(agent).not.toBeNull();
    expect(agent.name).toBe('TestBot');
    expect(agent.id).toBe('test-agent');
    expect(agent.title).toBe('Test Agent');
    expect(agent.icon).toBe('T');
    expect(agent.role).toBe('Testing Specialist');
    expect(agent.commands).toHaveLength(2);
    expect(agent.commands[0].name).toBe('help');
  });

  test('returns null for file without yaml block', () => {
    const filePath = path.join(dir, 'no-yaml.md');
    fs.writeFileSync(filePath, '# No YAML\nJust markdown.', 'utf8');

    const result = parseAgentFile(filePath);
    expect(result).toBeNull();
  });

  test('returns null for yaml block without name/id', () => {
    const filePath = path.join(dir, 'bad.md');
    fs.writeFileSync(filePath, '```yaml\nfoo: bar\n```', 'utf8');

    const result = parseAgentFile(filePath);
    expect(result).toBeNull();
  });

  test('parses agent with no commands', () => {
    const filePath = path.join(dir, 'minimal.md');
    fs.writeFileSync(filePath, SAMPLE_AGENT_MINIMAL, 'utf8');

    const agent = parseAgentFile(filePath);
    expect(agent).not.toBeNull();
    expect(agent.name).toBe('Mini');
    expect(agent.commands).toEqual([]);
  });
});

describe('Agent CLI — discoverAgents', () => {
  let dir;

  beforeEach(() => {
    dir = createTempAgentsDir();
  });

  afterEach(() => {
    cleanupDir(dir);
  });

  test('discovers agent files in directory', () => {
    writeAgentFile(dir, 'test-agent.md', SAMPLE_AGENT_MD);
    writeAgentFile(dir, 'minimal.md', SAMPLE_AGENT_MINIMAL);

    const agents = discoverAgents(dir);
    expect(agents).toHaveLength(2);
    // Sorted alphabetically by id
    expect(agents[0].id).toBe('minimal');
    expect(agents[1].id).toBe('test-agent');
  });

  test('returns empty array for non-existent directory', () => {
    const agents = discoverAgents('/tmp/nonexistent-aiox-agents-dir');
    expect(agents).toEqual([]);
  });

  test('skips non-md files', () => {
    writeAgentFile(dir, 'test-agent.md', SAMPLE_AGENT_MD);
    writeAgentFile(dir, 'readme.txt', 'Not an agent file');

    const agents = discoverAgents(dir);
    expect(agents).toHaveLength(1);
  });

  test('skips subdirectories', () => {
    writeAgentFile(dir, 'test-agent.md', SAMPLE_AGENT_MD);
    const subdir = path.join(dir, 'subdirectory');
    fs.mkdirSync(subdir);
    writeAgentFile(subdir, 'MEMORY.md', '# Memory');

    const agents = discoverAgents(dir);
    expect(agents).toHaveLength(1);
  });

  test('skips files that fail to parse', () => {
    writeAgentFile(dir, 'good.md', SAMPLE_AGENT_MD);
    writeAgentFile(dir, 'bad.md', '# No yaml block at all');

    const agents = discoverAgents(dir);
    expect(agents).toHaveLength(1);
  });
});

describe('Agent CLI — renderTable', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('renders table with agent data', () => {
    const agents = [
      { id: 'dev', name: 'Dex', title: 'Full Stack Developer', icon: 'D', role: 'Engineer', commands: [] },
    ];
    renderTable(agents);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Name');
    expect(output).toContain('Persona');
    expect(output).toContain('Role');
    expect(output).toContain('Activate');
    expect(output).toContain('D dev');
    expect(output).toContain('Dex');
    expect(output).toContain('@dev');
  });

  test('shows message for empty agents list', () => {
    renderTable([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No agents found');
  });
});

describe('Agent CLI — renderDetail', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('renders agent detail with commands', () => {
    const agent = {
      id: 'dev',
      name: 'Dex',
      title: 'Full Stack Developer',
      icon: 'D',
      role: 'Expert Senior Engineer',
      commands: [
        { name: 'help', description: 'Show help', visibility: ['full', 'key'] },
        { name: 'develop', description: 'Implement story', visibility: ['full'] },
      ],
    };
    renderDetail(agent);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('D Dex (dev)');
    expect(output).toContain('Full Stack Developer');
    expect(output).toContain('Expert Senior Engineer');
    expect(output).toContain('*help');
    expect(output).toContain('*develop');
    expect(output).toContain('Activate: @dev');
  });

  test('renders agent without commands', () => {
    const agent = {
      id: 'mini',
      name: 'Mini',
      title: 'Minimal',
      icon: 'M',
      role: 'Minimal Role',
      commands: [],
    };
    renderDetail(agent);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('M Mini (mini)');
    expect(output).not.toContain('Commands:');
  });
});

describe('Agent CLI — runAgents', () => {
  let dir;
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    dir = createTempAgentsDir();
    writeAgentFile(dir, 'test-agent.md', SAMPLE_AGENT_MD);
    writeAgentFile(dir, 'minimal.md', SAMPLE_AGENT_MINIMAL);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupDir(dir);
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
  });

  test('lists agents in table mode (non-interactive)', async () => {
    await runAgents([], { agentsDir: dir, nonInteractive: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('minimal');
    expect(output).toContain('test-agent');
    expect(output).toContain('2 agents available');
  });

  test('--detail shows agent detail', async () => {
    await runAgents(['--detail', 'test-agent'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('T TestBot (test-agent)');
    expect(output).toContain('Testing Specialist');
    expect(output).toContain('*help');
    expect(output).toContain('*run-tests');
  });

  test('--detail with case-insensitive match', async () => {
    await runAgents(['--detail', 'Test-Agent'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('TestBot');
  });

  test('--detail with persona name match', async () => {
    await runAgents(['--detail', 'TestBot'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('TestBot');
  });

  test('--detail with unknown agent shows available list', async () => {
    await runAgents(['--detail', 'unknown-agent'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('not found');
    expect(output).toContain('Available agents');
    expect(output).toContain('test-agent');
    expect(output).toContain('minimal');
  });

  test('--detail without name shows error', async () => {
    await runAgents(['--detail'], { agentsDir: dir });

    const output = consoleErrorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('--detail requires an agent name');
    expect(process.exitCode).toBe(1);
  });

  test('--json outputs JSON', async () => {
    await runAgents(['--json'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('minimal');
    expect(parsed[1].id).toBe('test-agent');
  });

  test('--help shows help text', async () => {
    await runAgents(['--help'], { agentsDir: dir });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('AIOX Agents');
    expect(output).toContain('--detail');
  });

  test('handles empty agents directory gracefully', async () => {
    const emptyDir = createTempAgentsDir();
    await runAgents([], { agentsDir: emptyDir, nonInteractive: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No agents found');
    cleanupDir(emptyDir);
  });
});

describe('Agent CLI — discoverAgents on real agents directory', () => {
  const realAgentsDir = path.resolve(__dirname, '../../.aiox-core/development/agents');

  test('discovers agents from the actual project directory', () => {
    if (!fs.existsSync(realAgentsDir)) {
      // Skip if running outside the project
      return;
    }

    const agents = discoverAgents(realAgentsDir);
    expect(agents.length).toBeGreaterThan(0);

    // All should have required fields
    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.id).toBeTruthy();
      expect(typeof agent.title).toBe('string');
      expect(typeof agent.icon).toBe('string');
      expect(Array.isArray(agent.commands)).toBe(true);
    }

    // Known agents should be present
    const ids = agents.map((a) => a.id);
    expect(ids).toContain('dev');
    expect(ids).toContain('qa');
    expect(ids).toContain('architect');
  });
});
