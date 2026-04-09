/**
 * Tests for Local REST API Server Command Module
 *
 * @module tests/cli/serve
 * @story 16.1 — Local REST API Server
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-serve-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/serve/index.js');

// ── parsePort ────────────────────────────────────────────────────────────────

describe('parsePort', () => {
  test('returns default port when no args', () => {
    expect(mod.parsePort([])).toBe(3456);
  });

  test('returns custom port from --port flag', () => {
    expect(mod.parsePort(['--port', '8080'])).toBe(8080);
  });

  test('throws on invalid port', () => {
    expect(() => mod.parsePort(['--port', 'abc'])).toThrow('Invalid port');
  });

  test('throws on port 0', () => {
    expect(() => mod.parsePort(['--port', '0'])).toThrow('Invalid port');
  });

  test('throws on port above 65535', () => {
    expect(() => mod.parsePort(['--port', '70000'])).toThrow('Invalid port');
  });

  test('returns default when --port has no value', () => {
    expect(mod.parsePort(['--port'])).toBe(3456);
  });
});

// ── getStatus ────────────────────────────────────────────────────────────────

describe('getStatus', () => {
  test('returns basic status without package.json', () => {
    const status = mod.getStatus();
    expect(status.project).toBe(path.basename(tmpDir));
    expect(status.version).toBe('unknown');
    expect(status.aioxCore).toBe(false);
    expect(status.storiesDirectory).toBe(false);
    expect(status.nodeVersion).toBe(process.version);
    expect(status.timestamp).toBeDefined();
  });

  test('reads project name from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.2.3' }),
    );
    const status = mod.getStatus();
    expect(status.project).toBe('test-project');
    expect(status.version).toBe('1.2.3');
  });

  test('detects .aiox-core directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.aiox-core'));
    const status = mod.getStatus();
    expect(status.aioxCore).toBe(true);
  });

  test('detects docs/stories directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'stories'), { recursive: true });
    const status = mod.getStatus();
    expect(status.storiesDirectory).toBe(true);
  });
});

// ── getStories ───────────────────────────────────────────────────────────────

describe('getStories', () => {
  test('returns empty array when no stories dir', () => {
    expect(mod.getStories()).toEqual([]);
  });

  test('lists story files with title and status', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(
      path.join(storiesDir, '1.1.story.md'),
      '# Story 1.1: Test Story\n\n## Status\n\nInReview\n',
    );
    const stories = mod.getStories();
    expect(stories).toHaveLength(1);
    expect(stories[0].file).toBe('1.1.story.md');
    expect(stories[0].title).toBe('Story 1.1: Test Story');
    expect(stories[0].status).toBe('InReview');
  });

  test('ignores non-story files', () => {
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(path.join(storiesDir, 'readme.md'), '# Readme');
    expect(mod.getStories()).toEqual([]);
  });
});

// ── getCommands ──────────────────────────────────────────────────────────────

describe('getCommands', () => {
  test('returns empty array when no bin/aiox.js', () => {
    expect(mod.getCommands()).toEqual([]);
  });

  test('extracts commands from bin/aiox.js', () => {
    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir);
    fs.writeFileSync(
      path.join(binDir, 'aiox.js'),
      `    case 'serve': {\n      // Local REST API Server — Story 16.1\n      break;\n    }\n`,
    );
    const commands = mod.getCommands();
    expect(commands.length).toBeGreaterThanOrEqual(1);
    expect(commands[0].name).toBe('serve');
  });
});

// ── getHealth ────────────────────────────────────────────────────────────────

describe('getHealth', () => {
  test('returns health object with status ok', () => {
    const health = mod.getHealth();
    expect(health.status).toBe('ok');
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.timestamp).toBeDefined();
    expect(health.memory).toBeDefined();
  });
});

// ── routeRequest ─────────────────────────────────────────────────────────────

describe('routeRequest', () => {
  test('returns 405 for non-GET methods', () => {
    const result = mod.routeRequest('POST', '/api/status');
    expect(result.status).toBe(405);
    expect(result.body.error).toBe('Method not allowed');
  });

  test('routes /api/status', () => {
    const result = mod.routeRequest('GET', '/api/status');
    expect(result.status).toBe(200);
    expect(result.body.nodeVersion).toBeDefined();
  });

  test('routes /api/stories', () => {
    const result = mod.routeRequest('GET', '/api/stories');
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
  });

  test('routes /api/commands', () => {
    const result = mod.routeRequest('GET', '/api/commands');
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body)).toBe(true);
  });

  test('routes /api/health', () => {
    const result = mod.routeRequest('GET', '/api/health');
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('ok');
  });

  test('returns 404 for unknown path', () => {
    const result = mod.routeRequest('GET', '/api/unknown');
    expect(result.status).toBe(404);
    expect(result.body.error).toBe('Not found');
    expect(result.body.availableEndpoints).toBeDefined();
  });

  test('strips query string from URL', () => {
    const result = mod.routeRequest('GET', '/api/health?foo=bar');
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('ok');
  });
});

// ── createHandler ────────────────────────────────────────────────────────────

describe('createHandler', () => {
  test('returns a function', () => {
    const handler = mod.createHandler();
    expect(typeof handler).toBe('function');
  });
});

// ── HELP_TEXT & DEFAULT_PORT ─────────────────────────────────────────────────

describe('exports', () => {
  test('DEFAULT_PORT is 3456', () => {
    expect(mod.DEFAULT_PORT).toBe(3456);
  });

  test('HELP_TEXT is defined', () => {
    expect(mod.HELP_TEXT).toBeDefined();
    expect(mod.HELP_TEXT).toContain('LOCAL REST API SERVER');
  });
});
