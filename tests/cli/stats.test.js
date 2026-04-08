/**
 * Tests for Code Stats & Complexity Dashboard Command Module
 *
 * @module tests/cli/stats
 * @story 7.3 — Code Stats & Complexity Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-stats-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/stats/index.js');

// ── Helper ──────────────────────────────────────────────────────────────────

function writeFile(relPath, content) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ── countLines ──────────────────────────────────────────────────────────────

describe('countLines', () => {
  test('counts lines in a simple file', () => {
    const f = writeFile('test.js', 'line1\nline2\nline3');
    expect(mod.countLines(f)).toBe(3);
  });

  test('returns 0 for empty file', () => {
    const f = writeFile('empty.js', '');
    expect(mod.countLines(f)).toBe(0);
  });

  test('returns 1 for single line without newline', () => {
    const f = writeFile('one.js', 'single line');
    expect(mod.countLines(f)).toBe(1);
  });

  test('returns 0 for non-existent file', () => {
    expect(mod.countLines('/nonexistent/path/file.js')).toBe(0);
  });

  test('counts file with trailing newline correctly', () => {
    const f = writeFile('trailing.js', 'a\nb\n');
    expect(mod.countLines(f)).toBe(3);
  });
});

// ── scanDirectory ───────────────────────────────────────────────────────────

describe('scanDirectory', () => {
  test('finds files with matching extensions', () => {
    writeFile('src/a.js', 'line1\nline2');
    writeFile('src/b.ts', 'line1');
    writeFile('src/c.txt', 'ignored');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js', '.ts']);
    expect(results).toHaveLength(2);
    expect(results.every((r) => ['.js', '.ts'].includes(r.extension))).toBe(true);
  });

  test('returns empty array for non-existent directory', () => {
    expect(mod.scanDirectory('/nonexistent/dir')).toEqual([]);
  });

  test('skips node_modules directory', () => {
    writeFile('src/node_modules/dep/index.js', 'code');
    writeFile('src/main.js', 'code');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js']);
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toContain('main.js');
  });

  test('skips .git directory', () => {
    writeFile('src/.git/config', 'gitdata');
    writeFile('src/app.js', 'code');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js']);
    expect(results).toHaveLength(1);
  });

  test('skips dist directory', () => {
    writeFile('src/dist/bundle.js', 'bundled');
    writeFile('src/index.js', 'source');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js']);
    expect(results).toHaveLength(1);
  });

  test('scans nested directories', () => {
    writeFile('src/deep/nested/file.js', 'code');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js']);
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toContain('nested');
  });

  test('uses default extensions when none specified', () => {
    writeFile('src/a.js', 'js');
    writeFile('src/b.md', 'md');
    writeFile('src/c.yaml', 'yaml');
    writeFile('src/d.bin', 'binary');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'));
    expect(results).toHaveLength(3);
  });

  test('returns correct line counts per file', () => {
    writeFile('src/small.js', 'a');
    writeFile('src/big.js', 'a\nb\nc\nd\ne');

    const results = mod.scanDirectory(path.join(tmpDir, 'src'), ['.js']);
    const sorted = results.sort((a, b) => a.lines - b.lines);
    expect(sorted[0].lines).toBe(1);
    expect(sorted[1].lines).toBe(5);
  });
});

// ── getLanguageBreakdown ────────────────────────────────────────────────────

describe('getLanguageBreakdown', () => {
  test('groups files by extension and sums LOC', () => {
    const files = [
      { filePath: 'a.js', lines: 100, extension: '.js' },
      { filePath: 'b.js', lines: 200, extension: '.js' },
      { filePath: 'c.md', lines: 50, extension: '.md' },
    ];

    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].extension).toBe('.js');
    expect(breakdown[0].lines).toBe(300);
    expect(breakdown[0].files).toBe(2);
    expect(breakdown[1].extension).toBe('.md');
    expect(breakdown[1].lines).toBe(50);
  });

  test('calculates percentages correctly', () => {
    const files = [
      { filePath: 'a.js', lines: 75, extension: '.js' },
      { filePath: 'b.md', lines: 25, extension: '.md' },
    ];

    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown[0].percentage).toBe(75.0);
    expect(breakdown[1].percentage).toBe(25.0);
  });

  test('returns empty array for empty input', () => {
    expect(mod.getLanguageBreakdown([])).toEqual([]);
  });

  test('sorts by lines descending', () => {
    const files = [
      { filePath: 'a.md', lines: 10, extension: '.md' },
      { filePath: 'b.js', lines: 100, extension: '.js' },
      { filePath: 'c.yaml', lines: 50, extension: '.yaml' },
    ];

    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown[0].extension).toBe('.js');
    expect(breakdown[1].extension).toBe('.yaml');
    expect(breakdown[2].extension).toBe('.md');
  });

  test('uses LANGUAGE_NAMES for known extensions', () => {
    const files = [{ filePath: 'a.js', lines: 10, extension: '.js' }];
    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown[0].language).toBe('JavaScript');
  });

  test('uses extension as language name for unknown extensions', () => {
    const files = [{ filePath: 'a.xyz', lines: 10, extension: '.xyz' }];
    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown[0].language).toBe('.xyz');
  });

  test('handles all zero-line files', () => {
    const files = [
      { filePath: 'a.js', lines: 0, extension: '.js' },
      { filePath: 'b.js', lines: 0, extension: '.js' },
    ];
    const breakdown = mod.getLanguageBreakdown(files);
    expect(breakdown[0].percentage).toBe(0);
  });
});

// ── calculateComplexity ─────────────────────────────────────────────────────

describe('calculateComplexity', () => {
  test('counts if statements', () => {
    const f = writeFile('complex.js', 'if (a) {}\nif (b) {}');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(2);
  });

  test('counts for and while loops', () => {
    const f = writeFile('loops.js', 'for (;;) {}\nwhile (true) {}');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(2);
  });

  test('counts switch and catch', () => {
    const f = writeFile('switch.js', 'switch (x) { case 1: break; }\ntry {} catch (e) {}');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(2);
  });

  test('counts logical operators', () => {
    const f = writeFile('logical.js', 'if (a && b || c) {}');
    const result = mod.calculateComplexity(f);
    // if + && + ||
    expect(result.complexity).toBe(3);
  });

  test('counts ternary operator', () => {
    const f = writeFile('ternary.js', 'const x = a ? b : c;');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(1);
  });

  test('returns 0 for simple file', () => {
    const f = writeFile('simple.js', 'const x = 1;\nconst y = 2;');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(0);
  });

  test('returns 0 for non-existent file', () => {
    const result = mod.calculateComplexity('/nonexistent/file.js');
    expect(result.complexity).toBe(0);
    expect(result.lines).toBe(0);
  });

  test('returns correct line count alongside complexity', () => {
    const f = writeFile('counted.js', 'if (a) {}\nfor (;;) {}\nconst x = 1;');
    const result = mod.calculateComplexity(f);
    expect(result.lines).toBe(3);
    expect(result.complexity).toBe(2);
  });

  test('ignores keywords in comments', () => {
    const f = writeFile('commented.js', '// if (a) {}\nconst x = 1;');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(0);
  });

  test('ignores keywords in strings', () => {
    const f = writeFile('stringed.js', 'const s = "if while for";\nconst y = 1;');
    const result = mod.calculateComplexity(f);
    expect(result.complexity).toBe(0);
  });
});

// ── formatStats ─────────────────────────────────────────────────────────────

describe('formatStats', () => {
  test('includes header and totals', () => {
    const output = mod.formatStats({
      totalFiles: 245,
      totalLines: 12450,
      breakdown: [],
    });

    expect(output).toContain('AIOX Codebase Statistics');
    expect(output).toContain('245');
    expect(output).toContain('12,450');
  });

  test('includes language breakdown entries', () => {
    const output = mod.formatStats({
      totalFiles: 10,
      totalLines: 100,
      breakdown: [
        { extension: '.js', language: 'JavaScript', files: 8, lines: 80, percentage: 80.0 },
        { extension: '.md', language: 'Markdown', files: 2, lines: 20, percentage: 20.0 },
      ],
    });

    expect(output).toContain('JavaScript (.js)');
    expect(output).toContain('Markdown (.md)');
    expect(output).toContain('80.0%');
  });

  test('includes complexity section when data provided', () => {
    const output = mod.formatStats({
      totalFiles: 1,
      totalLines: 100,
      breakdown: [],
      complexity: [
        { filePath: '/root/src/complex.js', complexity: 35, lines: 100 },
      ],
      projectRoot: '/root',
    });

    expect(output).toContain('Complexity by Module');
    expect(output).toContain('HIGH');
  });

  test('shows MEDIUM rating for mid-range complexity', () => {
    const output = mod.formatStats({
      totalFiles: 1,
      totalLines: 50,
      breakdown: [],
      complexity: [
        { filePath: '/root/src/mid.js', complexity: 20, lines: 50 },
      ],
      projectRoot: '/root',
    });

    expect(output).toContain('MEDIUM');
  });

  test('shows LOW rating for low complexity', () => {
    const output = mod.formatStats({
      totalFiles: 1,
      totalLines: 10,
      breakdown: [],
      complexity: [
        { filePath: '/root/src/low.js', complexity: 5, lines: 10 },
      ],
      projectRoot: '/root',
    });

    expect(output).toContain('LOW');
  });

  test('limits complexity output to top 20', () => {
    const complexity = Array.from({ length: 30 }, (_, i) => ({
      filePath: `/root/src/file${i}.js`,
      complexity: 30 - i,
      lines: 10,
    }));

    const output = mod.formatStats({
      totalFiles: 30,
      totalLines: 300,
      breakdown: [],
      complexity,
      projectRoot: '/root',
    });

    // Should show file0 (complexity 30) but not file20+ (complexity 10)
    expect(output).toContain('file0.js');
    expect(output).not.toContain('file25.js');
  });
});

// ── runStats ────────────────────────────────────────────────────────────────

describe('runStats', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('--help prints usage', () => {
    mod.runStats(['--help']);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('Usage:');
    expect(output).toContain('--complexity');
  });

  test('-h also prints help', () => {
    mod.runStats(['-h']);
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('Usage:');
  });

  test('basic run outputs formatted stats', () => {
    // Create some files in scanned dirs
    writeFile('packages/lib/index.js', 'const a = 1;\nconst b = 2;');
    writeFile('bin/tool.js', 'console.log("hi");');
    writeFile('tests/test.js', 'test("x", () => {});');

    mod.runStats([]);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('AIOX Codebase Statistics');
    expect(output).toContain('Total files:');
  });

  test('--json outputs valid JSON', () => {
    writeFile('packages/lib/a.js', 'const x = 1;');

    mod.runStats(['--json']);
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('totalFiles');
    expect(parsed).toHaveProperty('totalLines');
    expect(parsed).toHaveProperty('breakdown');
    expect(parsed).toHaveProperty('scannedDirs');
  });

  test('--complexity includes complexity in output', () => {
    writeFile('packages/lib/complex.js', 'if (a) {}\nfor (;;) {}\nwhile (b) {}');

    mod.runStats(['--complexity']);
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('Complexity by Module');
  });

  test('--complexity --json includes complexity in JSON', () => {
    writeFile('packages/lib/c.js', 'if (a) {}');

    mod.runStats(['--complexity', '--json']);
    const output = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('complexity');
    expect(parsed.complexity.length).toBeGreaterThan(0);
  });

  test('handles empty project gracefully', () => {
    mod.runStats([]);
    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('Total files:');
    expect(output).toContain('0');
  });
});

// ── Constants exports ───────────────────────────────────────────────────────

describe('module exports', () => {
  test('exports all expected functions', () => {
    expect(typeof mod.countLines).toBe('function');
    expect(typeof mod.scanDirectory).toBe('function');
    expect(typeof mod.getLanguageBreakdown).toBe('function');
    expect(typeof mod.calculateComplexity).toBe('function');
    expect(typeof mod.formatStats).toBe('function');
    expect(typeof mod.runStats).toBe('function');
  });

  test('exports SKIP_DIRS constant', () => {
    expect(mod.SKIP_DIRS).toBeInstanceOf(Set);
    expect(mod.SKIP_DIRS.has('node_modules')).toBe(true);
    expect(mod.SKIP_DIRS.has('.git')).toBe(true);
    expect(mod.SKIP_DIRS.has('dist')).toBe(true);
  });

  test('exports DEFAULT_EXTENSIONS', () => {
    expect(Array.isArray(mod.DEFAULT_EXTENSIONS)).toBe(true);
    expect(mod.DEFAULT_EXTENSIONS).toContain('.js');
    expect(mod.DEFAULT_EXTENSIONS).toContain('.md');
  });

  test('exports SCAN_DIRS', () => {
    expect(Array.isArray(mod.SCAN_DIRS)).toBe(true);
    expect(mod.SCAN_DIRS).toContain('packages');
    expect(mod.SCAN_DIRS).toContain('bin');
    expect(mod.SCAN_DIRS).toContain('tests');
  });
});
