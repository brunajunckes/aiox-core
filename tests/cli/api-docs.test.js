/**
 * Tests for API Documentation Generator Command Module
 *
 * @module tests/cli/api-docs
 * @story 16.3 — API Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-api-docs-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/api-docs/index.js');

// ── Sample aiox.js content for testing ───────────────────────────────────────

const SAMPLE_AIOX = `
    case 'serve': {
      // Local REST API Server — Story 16.1
      const { runServe } = require('../.aiox-core/cli/commands/serve/index.js');
      runServe(args.slice(1));
      break;
    }

    case 'webhooks': {
      // Webhook Handler — Story 16.2
      const { runWebhooks } = require('../.aiox-core/cli/commands/webhooks/index.js');
      runWebhooks(args.slice(1));
      break;
    }

    case 'healthcheck': {
      // Health Check Endpoint — Story 16.4
      const { runHealthcheck } = require('../.aiox-core/cli/commands/healthcheck/index.js');
      runHealthcheck(args.slice(1));
      break;
    }
`;

// ── extractCommands ──────────────────────────────────────────────────────────

describe('extractCommands', () => {
  test('extracts commands from content', () => {
    const commands = mod.extractCommands(SAMPLE_AIOX);
    expect(commands.length).toBe(3);
    expect(commands[0].name).toBe('serve');
    expect(commands[0].description).toBe('Local REST API Server');
    expect(commands[0].story).toBe('16.1');
  });

  test('handles command without story reference', () => {
    const content = `    case 'mycommand': {\n      // Some description\n      break;\n    }\n`;
    const commands = mod.extractCommands(content);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('mycommand');
    expect(commands[0].story).toBeNull();
  });

  test('returns empty for empty content', () => {
    expect(mod.extractCommands('')).toEqual([]);
  });

  test('handles case without comment', () => {
    const content = `    case 'bare': {\n      break;\n    }\n`;
    const commands = mod.extractCommands(content);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('bare');
    expect(commands[0].description).toBe('');
  });

  test('extracts multiple commands', () => {
    const commands = mod.extractCommands(SAMPLE_AIOX);
    const names = commands.map(c => c.name);
    expect(names).toContain('serve');
    expect(names).toContain('webhooks');
    expect(names).toContain('healthcheck');
  });
});

// ── extractCommandsFromFile ──────────────────────────────────────────────────

describe('extractCommandsFromFile', () => {
  test('returns empty when no bin/aiox.js', () => {
    expect(mod.extractCommandsFromFile()).toEqual([]);
  });

  test('reads from bin/aiox.js in cwd', () => {
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'aiox.js'), SAMPLE_AIOX);
    const commands = mod.extractCommandsFromFile();
    expect(commands.length).toBe(3);
  });
});

// ── formatMarkdown ───────────────────────────────────────────────────────────

describe('formatMarkdown', () => {
  test('generates markdown with header and table', () => {
    const commands = [
      { name: 'serve', description: 'REST API', story: '16.1' },
      { name: 'test', description: 'Tests', story: null },
    ];
    const md = mod.formatMarkdown(commands);
    expect(md).toContain('# AIOX CLI API Documentation');
    expect(md).toContain('| `serve` | REST API | 16.1 |');
    expect(md).toContain('| `test` | Tests | - |');
    expect(md).toContain('Total commands: 2');
  });

  test('includes generated timestamp', () => {
    const md = mod.formatMarkdown([]);
    expect(md).toContain('Generated:');
  });
});

// ── formatJson ───────────────────────────────────────────────────────────────

describe('formatJson', () => {
  test('generates valid JSON', () => {
    const commands = [{ name: 'a', description: 'b', story: '1.0' }];
    const json = mod.formatJson(commands);
    const parsed = JSON.parse(json);
    expect(parsed.totalCommands).toBe(1);
    expect(parsed.commands).toHaveLength(1);
    expect(parsed.generated).toBeDefined();
  });
});

// ── formatOutput ─────────────────────────────────────────────────────────────

describe('formatOutput', () => {
  test('returns markdown by default', () => {
    const output = mod.formatOutput([{ name: 'x', description: 'y', story: null }], 'markdown');
    expect(output).toContain('# AIOX CLI API Documentation');
  });

  test('returns JSON when format is json', () => {
    const output = mod.formatOutput([{ name: 'x', description: 'y', story: null }], 'json');
    const parsed = JSON.parse(output);
    expect(parsed.commands).toBeDefined();
  });
});

// ── parseFormat ──────────────────────────────────────────────────────────────

describe('parseFormat', () => {
  test('defaults to markdown', () => {
    expect(mod.parseFormat([])).toBe('markdown');
  });

  test('parses --format markdown', () => {
    expect(mod.parseFormat(['--format', 'markdown'])).toBe('markdown');
  });

  test('parses --format json', () => {
    expect(mod.parseFormat(['--format', 'json'])).toBe('json');
  });

  test('throws on invalid format', () => {
    expect(() => mod.parseFormat(['--format', 'xml'])).toThrow('Invalid format');
  });
});

// ── parseOutput ──────────────────────────────────────────────────────────────

describe('parseOutput', () => {
  test('returns null when no --output', () => {
    expect(mod.parseOutput([])).toBeNull();
  });

  test('returns path from --output', () => {
    expect(mod.parseOutput(['--output', 'docs/api.md'])).toBe('docs/api.md');
  });
});

// ── runApiDocs (integration) ─────────────────────────────────────────────────

describe('runApiDocs', () => {
  test('writes to file with --output', () => {
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'aiox.js'), SAMPLE_AIOX);
    const outputFile = path.join(tmpDir, 'out', 'api.md');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runApiDocs(['--output', outputFile]);
    spy.mockRestore();
    expect(fs.existsSync(outputFile)).toBe(true);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('serve');
  });

  test('writes JSON format to file', () => {
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, 'aiox.js'), SAMPLE_AIOX);
    const outputFile = path.join(tmpDir, 'api.json');
    const spy = jest.spyOn(console, 'log').mockImplementation();
    mod.runApiDocs(['--format', 'json', '--output', outputFile]);
    spy.mockRestore();
    const parsed = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(parsed.commands.length).toBe(3);
  });
});

// ── HELP_TEXT ─────────────────────────────────────────────────────────────────

describe('HELP_TEXT', () => {
  test('is defined and contains usage', () => {
    expect(mod.HELP_TEXT).toContain('API DOCUMENTATION GENERATOR');
    expect(mod.HELP_TEXT).toContain('--format');
    expect(mod.HELP_TEXT).toContain('--output');
  });
});
