/**
 * Tests for Project Init Templates
 *
 * @module tests/cli/init-project
 * @story 13.2 — Project Init Templates
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  listTemplates,
  getTemplate,
  generatePackageJson,
  generateGitignore,
  generateReadme,
  generateAioxConfig,
  createProject,
  runInitProject,
  getHelpText,
  TEMPLATES,
} = require('../../.aiox-core/cli/commands/init-project/index.js');

let tmpDir;
const originalCwd = process.cwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-init-project-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

// ── listTemplates ────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  test('returns all templates', () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(4);
    const names = templates.map(t => t.name);
    expect(names).toContain('default');
    expect(names).toContain('api');
    expect(names).toContain('cli');
    expect(names).toContain('fullstack');
  });

  test('each template has name and description', () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });
});

// ── getTemplate ──────────────────────────────────────────────────────────────

describe('getTemplate', () => {
  test('returns template by name', () => {
    const tpl = getTemplate('api');
    expect(tpl).not.toBeNull();
    expect(tpl.name).toBe('api');
  });

  test('returns null for unknown template', () => {
    expect(getTemplate('nonexistent')).toBeNull();
  });
});

// ── generatePackageJson ──────────────────────────────────────────────────────

describe('generatePackageJson', () => {
  test('generates valid JSON', () => {
    const raw = generatePackageJson('my-app', 'default');
    const pkg = JSON.parse(raw);
    expect(pkg.name).toBe('my-app');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.scripts).toBeDefined();
  });

  test('cli template includes bin field', () => {
    const raw = generatePackageJson('my-cli', 'cli');
    const pkg = JSON.parse(raw);
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin['my-cli']).toBe('./bin/cli.js');
  });

  test('non-cli template has no bin field', () => {
    const raw = generatePackageJson('my-app', 'api');
    const pkg = JSON.parse(raw);
    expect(pkg.bin).toBeUndefined();
  });
});

// ── generateGitignore ────────────────────────────────────────────────────────

describe('generateGitignore', () => {
  test('includes common patterns', () => {
    const content = generateGitignore();
    expect(content).toContain('node_modules/');
    expect(content).toContain('.env');
    expect(content).toContain('coverage/');
  });
});

// ── generateReadme ───────────────────────────────────────────────────────────

describe('generateReadme', () => {
  test('includes project name', () => {
    const content = generateReadme('my-app', 'default');
    expect(content).toContain('# my-app');
    expect(content).toContain('default');
  });
});

// ── generateAioxConfig ───────────────────────────────────────────────────────

describe('generateAioxConfig', () => {
  test('generates valid JSON with project name', () => {
    const raw = generateAioxConfig('my-app');
    const config = JSON.parse(raw);
    expect(config.project).toBe('my-app');
  });
});

// ── createProject ────────────────────────────────────────────────────────────

describe('createProject', () => {
  test('creates project with default template', () => {
    const result = createProject('test-app', 'default', { baseDir: tmpDir });
    expect(result.success).toBe(true);
    expect(result.filesCreated.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tmpDir, 'test-app', 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'test-app', 'src'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'test-app', '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'test-app', 'README.md'))).toBe(true);
  });

  test('creates project with api template', () => {
    const result = createProject('api-app', 'api', { baseDir: tmpDir });
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'api-app', 'src', 'routes'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'api-app', 'src', 'middleware'))).toBe(true);
  });

  test('creates project with cli template', () => {
    const result = createProject('cli-app', 'cli', { baseDir: tmpDir });
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'cli-app', 'bin', 'cli.js'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'cli-app', 'src', 'commands'))).toBe(true);
  });

  test('creates project with fullstack template', () => {
    const result = createProject('fs-app', 'fullstack', { baseDir: tmpDir });
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'fs-app', 'src', 'api'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'fs-app', 'src', 'client'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'fs-app', 'src', 'shared'))).toBe(true);
  });

  test('fails for unknown template', () => {
    const result = createProject('app', 'unknown', { baseDir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown template');
  });

  test('fails for empty project name', () => {
    const result = createProject('', 'default', { baseDir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  test('fails for invalid project name', () => {
    const result = createProject('123-bad', 'default', { baseDir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid project name');
  });

  test('fails if directory already exists', () => {
    fs.mkdirSync(path.join(tmpDir, 'existing'));
    const result = createProject('existing', 'default', { baseDir: tmpDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  test('creates .aiox config directory', () => {
    createProject('cfg-app', 'default', { baseDir: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, 'cfg-app', '.aiox', 'config.json'))).toBe(true);
  });
});

// ── runInitProject ───────────────────────────────────────────────────────────

describe('runInitProject', () => {
  test('shows help with no args', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runInitProject([]);
    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runInitProject(['--help']);
    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('lists templates with --list-templates', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runInitProject(['--list-templates']);
    expect(result).not.toBeNull();
    expect(result.action).toBe('list');
    expect(result.templates.length).toBeGreaterThanOrEqual(4);
    spy.mockRestore();
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const text = getHelpText();
    expect(text).toContain('PROJECT INIT');
    expect(text).toContain('--template');
    expect(text).toContain('--list-templates');
  });
});
