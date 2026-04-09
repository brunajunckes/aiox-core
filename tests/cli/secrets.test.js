/**
 * Tests for Secret Scanner Command Module
 *
 * @module tests/cli/secrets
 * @story 12.1 — Secret Scanner
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-secrets-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/secrets/index.js');

// ── shouldIgnoreFile ───────────────────────────────────────────────────────

describe('shouldIgnoreFile', () => {
  test('ignores .env.example', () => {
    expect(mod.shouldIgnoreFile('.env.example')).toBe(true);
  });

  test('ignores .env.sample', () => {
    expect(mod.shouldIgnoreFile('.env.sample')).toBe(true);
  });

  test('ignores .test.js files', () => {
    expect(mod.shouldIgnoreFile('foo.test.js')).toBe(true);
  });

  test('ignores .spec.ts files', () => {
    expect(mod.shouldIgnoreFile('bar.spec.ts')).toBe(true);
  });

  test('ignores binary files (.png)', () => {
    expect(mod.shouldIgnoreFile('image.png')).toBe(true);
  });

  test('allows regular .js files', () => {
    expect(mod.shouldIgnoreFile('config.js')).toBe(false);
  });

  test('allows .env files', () => {
    expect(mod.shouldIgnoreFile('.env')).toBe(false);
  });
});

// ── collectFiles ───────────────────────────────────────────────────────────

describe('collectFiles', () => {
  test('collects files recursively', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'config.js'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.js'), 'y');
    const files = mod.collectFiles(tmpDir);
    expect(files).toHaveLength(2);
  });

  test('ignores node_modules', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'app.js'), 'y');
    const files = mod.collectFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('app.js');
  });

  test('ignores .git directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.git', 'objects'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.git', 'config'), 'x');
    fs.writeFileSync(path.join(tmpDir, 'app.js'), 'y');
    const files = mod.collectFiles(tmpDir);
    expect(files).toHaveLength(1);
  });

  test('returns empty for nonexistent dir', () => {
    const files = mod.collectFiles(path.join(tmpDir, 'nonexistent'));
    expect(files).toEqual([]);
  });
});

// ── scanFile ───────────────────────────────────────────────────────────────

describe('scanFile', () => {
  test('detects API_KEY assignment', () => {
    const filePath = path.join(tmpDir, 'config.js');
    fs.writeFileSync(filePath, 'const API_KEY = "sk_live_abcdef12345678";\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].pattern).toContain('API_KEY');
  });

  test('detects SECRET assignment', () => {
    const filePath = path.join(tmpDir, 'env.js');
    fs.writeFileSync(filePath, 'SECRET = "my_super_secret_value"\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('SECRET'))).toBe(true);
  });

  test('detects PASSWORD assignment', () => {
    const filePath = path.join(tmpDir, 'db.js');
    fs.writeFileSync(filePath, 'PASSWORD = "hunter2"\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('PASSWORD'))).toBe(true);
  });

  test('detects TOKEN assignment', () => {
    const filePath = path.join(tmpDir, 'auth.js');
    fs.writeFileSync(filePath, 'TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz1234"\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('TOKEN'))).toBe(true);
  });

  test('detects private key block', () => {
    const filePath = path.join(tmpDir, 'key.pem');
    fs.writeFileSync(filePath, '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('Private Key'))).toBe(true);
  });

  test('detects Bearer token', () => {
    const filePath = path.join(tmpDir, 'api.js');
    fs.writeFileSync(filePath, 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('Bearer'))).toBe(true);
  });

  test('detects AWS access key', () => {
    const filePath = path.join(tmpDir, 'aws.js');
    fs.writeFileSync(filePath, 'aws_key = "AKIAIOSFODNN7EXAMPLE"\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings.some(f => f.pattern.includes('AWS'))).toBe(true);
  });

  test('returns empty for clean file', () => {
    const filePath = path.join(tmpDir, 'clean.js');
    fs.writeFileSync(filePath, 'const x = 42;\nmodule.exports = x;\n');
    const findings = mod.scanFile(filePath, tmpDir);
    expect(findings).toHaveLength(0);
  });

  test('includes correct line numbers', () => {
    const filePath = path.join(tmpDir, 'multi.js');
    fs.writeFileSync(filePath, 'line1\nline2\nAPI_KEY = "abcdefghijklmnop"\nline4\n');
    const findings = mod.scanFile(filePath, tmpDir);
    const apiKeyFinding = findings.find(f => f.pattern.includes('API_KEY'));
    expect(apiKeyFinding).toBeDefined();
    expect(apiKeyFinding.line).toBe(3);
  });
});

// ── scanProject ────────────────────────────────────────────────────────────

describe('scanProject', () => {
  test('scans multiple files', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.js'), 'API_KEY = "test12345678"\n');
    fs.writeFileSync(path.join(tmpDir, 'b.js'), 'PASSWORD = "hunter2"\n');
    const findings = mod.scanProject(tmpDir);
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  test('returns empty for clean project', () => {
    fs.writeFileSync(path.join(tmpDir, 'app.js'), 'const x = 1;\n');
    const findings = mod.scanProject(tmpDir);
    expect(findings).toHaveLength(0);
  });
});

// ── fixSecrets ─────────────────────────────────────────────────────────────

describe('fixSecrets', () => {
  test('replaces secrets with REDACTED', () => {
    const filePath = path.join(tmpDir, 'config.js');
    fs.writeFileSync(filePath, 'API_KEY = "sk_live_abcdef12345678"\n');
    const findings = mod.scanFile(filePath, tmpDir);
    const modified = mod.fixSecrets(findings, tmpDir);
    expect(modified).toBe(1);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('<REDACTED>');
  });

  test('returns 0 for no findings', () => {
    const modified = mod.fixSecrets([], tmpDir);
    expect(modified).toBe(0);
  });
});

// ── formatConsole ──────────────────────────────────────────────────────────

describe('formatConsole', () => {
  test('shows clean message for no findings', () => {
    expect(mod.formatConsole([])).toContain('No secrets found');
  });

  test('shows count for findings', () => {
    const findings = [{ file: 'a.js', line: 1, pattern: 'API_KEY', match: 'API_KEY = "x"' }];
    const output = mod.formatConsole(findings);
    expect(output).toContain('1 potential secret');
    expect(output).toContain('a.js:1');
  });
});

// ── formatJSON ─────────────────────────────────────────────────────────────

describe('formatJSON', () => {
  test('returns valid JSON', () => {
    const result = JSON.parse(mod.formatJSON([]));
    expect(result.totalFindings).toBe(0);
    expect(result).toHaveProperty('scannedAt');
  });

  test('includes findings in output', () => {
    const findings = [{ file: 'a.js', line: 1, pattern: 'TOKEN', match: 'TOKEN = "abc"' }];
    const result = JSON.parse(mod.formatJSON(findings));
    expect(result.totalFindings).toBe(1);
    expect(result.findings).toHaveLength(1);
  });
});

// ── runSecrets ─────────────────────────────────────────────────────────────

describe('runSecrets', () => {
  test('shows help with --help', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runSecrets(['--help']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Secret Scanner'));
    spy.mockRestore();
  });

  test('handles scan subcommand', () => {
    fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const x = 1;\n');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runSecrets(['scan']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('handles unknown subcommand', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mod.runSecrets(['unknown']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
    spy.mockRestore();
  });

  test('handles json format', () => {
    fs.writeFileSync(path.join(tmpDir, 'clean.js'), 'const x = 1;\n');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mod.runSecrets(['scan', '--format', 'json']);
    const output = spy.mock.calls[0][0];
    expect(() => JSON.parse(output)).not.toThrow();
    spy.mockRestore();
  });
});

// ── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  test('SECRET_PATTERNS is an array', () => {
    expect(Array.isArray(mod.SECRET_PATTERNS)).toBe(true);
    expect(mod.SECRET_PATTERNS.length).toBeGreaterThan(0);
  });

  test('IGNORE_DIRS includes node_modules', () => {
    expect(mod.IGNORE_DIRS).toContain('node_modules');
  });

  test('IGNORE_DIRS includes .git', () => {
    expect(mod.IGNORE_DIRS).toContain('.git');
  });
});
