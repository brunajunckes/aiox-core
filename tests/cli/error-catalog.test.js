'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const {
  loadErrorCatalog,
  getErrorInfo,
  listAllErrors,
  throwAioxError,
  formatError,
  _resetCache,
  CATALOG_PATH,
} = require('../../.aiox-core/cli/utils/error.js');

// Reset cache between tests to ensure isolation
beforeEach(() => {
  _resetCache();
});

// ─── loadErrorCatalog ─────────────────────────────────────────────────────────

describe('loadErrorCatalog', () => {
  it('returns an array', () => {
    const catalog = loadErrorCatalog();
    expect(Array.isArray(catalog)).toBe(true);
  });

  it('loads at least 20 error entries', () => {
    const catalog = loadErrorCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(20);
  });

  it('each entry has required fields', () => {
    const catalog = loadErrorCatalog();
    for (const entry of catalog) {
      expect(entry).toHaveProperty('code');
      expect(entry).toHaveProperty('message');
      expect(entry).toHaveProperty('suggestion');
      expect(entry).toHaveProperty('severity');
      expect(entry).toHaveProperty('category');
    }
  });

  it('all codes follow AIOX-E### format', () => {
    const catalog = loadErrorCatalog();
    for (const entry of catalog) {
      expect(entry.code).toMatch(/^AIOX-E\d{3}$/);
    }
  });

  it('caches results on subsequent calls', () => {
    const first = loadErrorCatalog();
    const second = loadErrorCatalog();
    expect(first).toBe(second); // Same reference
  });

  it('catalog YAML file exists on disk', () => {
    expect(fs.existsSync(CATALOG_PATH)).toBe(true);
  });
});

// ─── getErrorInfo ─────────────────────────────────────────────────────────────

describe('getErrorInfo', () => {
  it('returns correct entry for AIOX-E001', () => {
    const entry = getErrorInfo('AIOX-E001');
    expect(entry).not.toBeNull();
    expect(entry.code).toBe('AIOX-E001');
    expect(entry.message).toBe('Configuration file not found');
    expect(entry.category).toBe('config');
  });

  it('returns correct entry for AIOX-E030', () => {
    const entry = getErrorInfo('AIOX-E030');
    expect(entry).not.toBeNull();
    expect(entry.code).toBe('AIOX-E030');
    expect(entry.category).toBe('git');
  });

  it('returns null for unknown code', () => {
    const entry = getErrorInfo('AIOX-E999');
    expect(entry).toBeNull();
  });

  it('returns null for empty string', () => {
    const entry = getErrorInfo('');
    expect(entry).toBeNull();
  });
});

// ─── listAllErrors ────────────────────────────────────────────────────────────

describe('listAllErrors', () => {
  it('returns same data as loadErrorCatalog', () => {
    const catalog = loadErrorCatalog();
    _resetCache();
    const all = listAllErrors();
    expect(all).toEqual(catalog);
  });

  it('contains 20+ entries', () => {
    const all = listAllErrors();
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it('covers multiple categories', () => {
    const all = listAllErrors();
    const categories = new Set(all.map((e) => e.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
    expect(categories.has('config')).toBe(true);
    expect(categories.has('install')).toBe(true);
    expect(categories.has('git')).toBe(true);
    expect(categories.has('agent')).toBe(true);
    expect(categories.has('test')).toBe(true);
  });
});

// ─── throwAioxError ───────────────────────────────────────────────────────────

describe('throwAioxError', () => {
  it('throws an Error', () => {
    expect(() => throwAioxError('AIOX-E001')).toThrow(Error);
  });

  it('includes error code in message', () => {
    expect(() => throwAioxError('AIOX-E001')).toThrow(/\[AIOX-E001\]/);
  });

  it('includes description in message', () => {
    expect(() => throwAioxError('AIOX-E001')).toThrow(/Configuration file not found/);
  });

  it('includes suggestion in message', () => {
    expect(() => throwAioxError('AIOX-E001')).toThrow(/aiox doctor/);
  });

  it('includes explain hint in message', () => {
    expect(() => throwAioxError('AIOX-E001')).toThrow(/aiox explain AIOX-E001/);
  });

  it('includes context when provided', () => {
    expect(() => throwAioxError('AIOX-E001', { path: '/tmp/missing' })).toThrow(
      /\/tmp\/missing/,
    );
  });

  it('throws for unknown code with descriptive message', () => {
    expect(() => throwAioxError('AIOX-E999')).toThrow(/Unknown error code/);
  });
});

// ─── formatError ──────────────────────────────────────────────────────────────

describe('formatError', () => {
  it('formats entry without throwing', () => {
    const entry = getErrorInfo('AIOX-E001');
    const output = formatError(entry);
    expect(output).toContain('[AIOX-E001]');
    expect(output).toContain('Configuration file not found');
    expect(output).toContain('→');
  });
});

// ─── explain command ──────────────────────────────────────────────────────────

describe('explain command', () => {
  const bin = path.resolve(__dirname, '..', '..', 'bin', 'aiox.js');

  it('shows usage when no code provided', () => {
    const output = execSync(`node "${bin}" explain`, { encoding: 'utf8' });
    expect(output).toContain('USAGE');
    expect(output).toContain('aiox explain');
  });

  it('shows error details for a valid code', () => {
    const output = execSync(`node "${bin}" explain AIOX-E001`, { encoding: 'utf8' });
    expect(output).toContain('AIOX-E001');
    expect(output).toContain('Configuration file not found');
    expect(output).toContain('config');
  });

  it('handles lowercase code input', () => {
    const output = execSync(`node "${bin}" explain aiox-e001`, { encoding: 'utf8' });
    expect(output).toContain('AIOX-E001');
  });

  it('lists all errors with --list flag', () => {
    const output = execSync(`node "${bin}" explain --list`, { encoding: 'utf8' });
    expect(output).toContain('Error Catalog');
    expect(output).toContain('AIOX-E001');
    expect(output).toContain('Total:');
  });

  it('shows error for unknown code', () => {
    try {
      execSync(`node "${bin}" explain AIOX-E999`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      expect(e.stderr || e.stdout).toContain('Unknown error code');
    }
  });
});

// ─── doctor --errors ──────────────────────────────────────────────────────────

describe('doctor --errors', () => {
  const bin = path.resolve(__dirname, '..', '..', 'bin', 'aiox.js');

  it('lists all error codes', () => {
    const output = execSync(`node "${bin}" doctor --errors`, { encoding: 'utf8' });
    expect(output).toContain('AIOX-E001');
    expect(output).toContain('Total:');
    expect(output).toContain('aiox explain');
  });
});
