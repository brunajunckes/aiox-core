/**
 * Tests for Interactive Config Wizard
 *
 * @module tests/cli/setup
 * @story 13.3 — Interactive Config Wizard
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig,
  saveConfig,
  validateConfig,
  detectProjectName,
  getDefaults,
  formatConfig,
  applyDefaults,
  resetConfig,
  runSetup,
  getHelpText,
  getSetupFile,
  DEFAULT_CONFIG,
  VALID_AGENTS,
} = require('../../.aiox-core/cli/commands/setup/index.js');

let tmpDir;
const originalCwd = process.cwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-setup-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

// ── loadConfig ───────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  test('returns null when no config exists', () => {
    expect(loadConfig(tmpDir)).toBeNull();
  });

  test('loads existing config', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'setup.json'), JSON.stringify({ projectName: 'test' }));
    const config = loadConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config.projectName).toBe('test');
  });

  test('returns null for corrupt file', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'setup.json'), 'not json{{{');
    expect(loadConfig(tmpDir)).toBeNull();
  });
});

// ── saveConfig ───────────────────────────────────────────────────────────────

describe('saveConfig', () => {
  test('saves config to disk', () => {
    const result = saveConfig({ projectName: 'test' }, tmpDir);
    expect(result).toBe(true);
    const filePath = getSetupFile(tmpDir);
    expect(fs.existsSync(filePath)).toBe(true);
    const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(loaded.projectName).toBe('test');
  });

  test('creates .aiox directory if needed', () => {
    saveConfig({ projectName: 'test' }, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.aiox'))).toBe(true);
  });
});

// ── validateConfig ───────────────────────────────────────────────────────────

describe('validateConfig', () => {
  test('validates correct config', () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects null config', () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
  });

  test('rejects empty projectName', () => {
    const result = validateConfig({ projectName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects invalid agent', () => {
    const result = validateConfig({ projectName: 'test', defaultAgent: '@invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('defaultAgent');
  });

  test('rejects non-boolean gitIntegration', () => {
    const result = validateConfig({ projectName: 'test', gitIntegration: 'yes' });
    expect(result.valid).toBe(false);
  });

  test('accepts all valid agents', () => {
    for (const agent of VALID_AGENTS) {
      const result = validateConfig({ projectName: 'test', defaultAgent: agent });
      expect(result.valid).toBe(true);
    }
  });
});

// ── detectProjectName ────────────────────────────────────────────────────────

describe('detectProjectName', () => {
  test('reads from package.json if available', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'from-pkg' }));
    expect(detectProjectName(tmpDir)).toBe('from-pkg');
  });

  test('falls back to directory name', () => {
    const name = detectProjectName(tmpDir);
    expect(name).toBe(path.basename(tmpDir));
  });
});

// ── getDefaults ──────────────────────────────────────────────────────────────

describe('getDefaults', () => {
  test('returns default config with detected name', () => {
    const defaults = getDefaults(tmpDir);
    expect(defaults.defaultAgent).toBe('@dev');
    expect(defaults.gitIntegration).toBe(true);
    expect(defaults.testCommand).toBe('npm test');
    expect(defaults.lintCommand).toBe('npm run lint');
  });
});

// ── formatConfig ─────────────────────────────────────────────────────────────

describe('formatConfig', () => {
  test('formats config as readable string', () => {
    const output = formatConfig(DEFAULT_CONFIG);
    expect(output).toContain('AIOX SETUP CONFIGURATION');
    expect(output).toContain('my-project');
    expect(output).toContain('@dev');
    expect(output).toContain('npm test');
  });
});

// ── applyDefaults ────────────────────────────────────────────────────────────

describe('applyDefaults', () => {
  test('saves defaults to disk', () => {
    const result = applyDefaults(tmpDir);
    expect(result.success).toBe(true);
    expect(result.config.defaultAgent).toBe('@dev');
    expect(fs.existsSync(getSetupFile(tmpDir))).toBe(true);
  });
});

// ── resetConfig ──────────────────────────────────────────────────────────────

describe('resetConfig', () => {
  test('resets to defaults', () => {
    saveConfig({ projectName: 'custom', defaultAgent: '@qa' }, tmpDir);
    const result = resetConfig(tmpDir);
    expect(result.success).toBe(true);
    expect(result.config.defaultAgent).toBe('@dev');
  });
});

// ── runSetup ─────────────────────────────────────────────────────────────────

describe('runSetup', () => {
  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--help'], { baseDir: tmpDir });
    expect(result).toBeNull();
    spy.mockRestore();
  });

  test('shows config with --show', () => {
    saveConfig({ projectName: 'test', defaultAgent: '@dev' }, tmpDir);
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--show'], { baseDir: tmpDir });
    expect(result.action).toBe('show');
    expect(result.config).not.toBeNull();
    spy.mockRestore();
  });

  test('shows message when no config with --show', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--show'], { baseDir: tmpDir });
    expect(result.action).toBe('show');
    expect(result.config).toBeNull();
    spy.mockRestore();
  });

  test('applies defaults with --defaults', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--defaults'], { baseDir: tmpDir });
    expect(result.action).toBe('defaults');
    expect(result.success).toBe(true);
    spy.mockRestore();
  });

  test('resets with --reset', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--reset'], { baseDir: tmpDir });
    expect(result.action).toBe('reset');
    expect(result.success).toBe(true);
    spy.mockRestore();
  });

  test('errors on unknown option', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const result = runSetup(['--bogus'], { baseDir: tmpDir });
    expect(result).toBeNull();
    spy.mockRestore();
    logSpy.mockRestore();
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const text = getHelpText();
    expect(text).toContain('INTERACTIVE CONFIG WIZARD');
    expect(text).toContain('--defaults');
    expect(text).toContain('--show');
    expect(text).toContain('--reset');
  });
});
