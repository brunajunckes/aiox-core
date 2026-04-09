/**
 * Tests for Project Analytics Dashboard
 *
 * @module tests/cli/analytics
 * @story 14.1 — Project Analytics Dashboard
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  collectFiles,
  countLines,
  countByExtension,
  countLOC,
  countTests,
  countStories,
  countCommands,
  countDependencies,
  gatherAnalytics,
  formatAnalytics,
  loadTrend,
  appendToHistory,
  formatTrend,
  runAnalytics,
  getHelpText,
} = require('../../.aiox-core/cli/commands/analytics/index.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));
}

function writeFile(base, rel, content) {
  const full = path.join(base, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// ── collectFiles ─────────────────────────────────────────────────────────────

describe('collectFiles', () => {
  test('collects files recursively', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'a.js', 'x');
    writeFile(tmp, 'sub/b.ts', 'y');
    const files = collectFiles(tmp);
    expect(files.length).toBe(2);
  });

  test('skips node_modules and .git', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'a.js', 'x');
    writeFile(tmp, 'node_modules/pkg/index.js', 'y');
    writeFile(tmp, '.git/config', 'z');
    const files = collectFiles(tmp);
    expect(files.length).toBe(1);
  });

  test('returns empty array for nonexistent dir', () => {
    expect(collectFiles('/nonexistent-dir-xyz')).toEqual([]);
  });
});

// ── countLines ───────────────────────────────────────────────────────────────

describe('countLines', () => {
  test('counts lines in a file', () => {
    const tmp = makeTmpDir();
    const f = path.join(tmp, 'test.js');
    fs.writeFileSync(f, 'line1\nline2\nline3');
    expect(countLines(f)).toBe(3);
  });

  test('returns 0 for nonexistent file', () => {
    expect(countLines('/nonexistent-file.txt')).toBe(0);
  });
});

// ── countByExtension ─────────────────────────────────────────────────────────

describe('countByExtension', () => {
  test('counts files by category', () => {
    const files = ['/a.js', '/b.ts', '/c.md', '/d.yaml', '/e.txt'];
    const result = countByExtension(files);
    expect(result).toEqual({ js: 1, ts: 1, md: 1, yaml: 1, other: 1 });
  });

  test('counts jsx as js', () => {
    const result = countByExtension(['/a.jsx']);
    expect(result.js).toBe(1);
  });

  test('counts yml as yaml', () => {
    const result = countByExtension(['/a.yml']);
    expect(result.yaml).toBe(1);
  });

  test('handles empty array', () => {
    const result = countByExtension([]);
    expect(result).toEqual({ js: 0, ts: 0, md: 0, yaml: 0, other: 0 });
  });
});

// ── countLOC ─────────────────────────────────────────────────────────────────

describe('countLOC', () => {
  test('counts LOC by type', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'a.js', 'line1\nline2');
    writeFile(tmp, 'b.md', 'line1\nline2\nline3');
    const files = collectFiles(tmp);
    const loc = countLOC(files);
    expect(loc.js).toBe(2);
    expect(loc.md).toBe(3);
    expect(loc.total).toBe(5);
  });
});

// ── countTests ───────────────────────────────────────────────────────────────

describe('countTests', () => {
  test('counts test files', () => {
    const files = ['/a.test.js', '/b.spec.ts', '/c.js', '/d.test.tsx'];
    expect(countTests(files)).toBe(3);
  });

  test('returns 0 for no test files', () => {
    expect(countTests(['/a.js', '/b.ts'])).toBe(0);
  });
});

// ── countStories ─────────────────────────────────────────────────────────────

describe('countStories', () => {
  test('counts story files', () => {
    const files = ['/docs/1.1.story.md', '/docs/2.1.story.md', '/docs/readme.md'];
    expect(countStories(files)).toBe(2);
  });
});

// ── countCommands ────────────────────────────────────────────────────────────

describe('countCommands', () => {
  test('counts command directories', () => {
    const tmp = makeTmpDir();
    const cmdDir = path.join(tmp, '.aiox-core', 'cli', 'commands');
    fs.mkdirSync(cmdDir, { recursive: true });
    fs.mkdirSync(path.join(cmdDir, 'analytics'));
    fs.mkdirSync(path.join(cmdDir, 'help'));
    expect(countCommands(tmp)).toBe(2);
  });

  test('returns 0 for missing directory', () => {
    expect(countCommands('/nonexistent')).toBe(0);
  });
});

// ── countDependencies ────────────────────────────────────────────────────────

describe('countDependencies', () => {
  test('counts deps from package.json', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'package.json', JSON.stringify({
      dependencies: { a: '1.0', b: '2.0' },
      devDependencies: { c: '3.0' },
    }));
    expect(countDependencies(tmp)).toBe(3);
  });

  test('returns 0 for missing package.json', () => {
    expect(countDependencies('/nonexistent')).toBe(0);
  });
});

// ── gatherAnalytics ──────────────────────────────────────────────────────────

describe('gatherAnalytics', () => {
  test('gathers all analytics', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'a.js', 'code');
    writeFile(tmp, 'b.test.js', 'test');
    writeFile(tmp, 'package.json', JSON.stringify({ dependencies: { x: '1' } }));
    const cmdDir = path.join(tmp, '.aiox-core', 'cli', 'commands', 'help');
    fs.mkdirSync(cmdDir, { recursive: true });

    const result = gatherAnalytics(tmp);
    expect(result.totalFiles).toBeGreaterThanOrEqual(2);
    expect(result.testCount).toBe(1);
    expect(result.commandCount).toBe(1);
    expect(result.dependencyCount).toBe(1);
    expect(result.timestamp).toBeDefined();
  });
});

// ── formatAnalytics ──────────────────────────────────────────────────────────

describe('formatAnalytics', () => {
  test('produces formatted output', () => {
    const analytics = {
      totalFiles: 10,
      filesByExtension: { js: 5, ts: 2, md: 1, yaml: 1, other: 1 },
      linesOfCode: { js: 100, ts: 50, md: 20, yaml: 10, other: 5, total: 185 },
      testCount: 3,
      storyCount: 2,
      commandCount: 4,
      dependencyCount: 7,
    };
    const output = formatAnalytics(analytics);
    expect(output).toContain('PROJECT ANALYTICS DASHBOARD');
    expect(output).toContain('10');
    expect(output).toContain('185');
  });
});

// ── loadTrend / appendToHistory ──────────────────────────────────────────────

describe('trend', () => {
  test('loadTrend returns empty for missing file', () => {
    expect(loadTrend('/nonexistent')).toEqual([]);
  });

  test('appendToHistory creates and appends', () => {
    const tmp = makeTmpDir();
    appendToHistory(tmp, { totalFiles: 5, timestamp: '2026-01-01' });
    appendToHistory(tmp, { totalFiles: 10, timestamp: '2026-02-01' });
    const entries = loadTrend(tmp);
    expect(entries.length).toBe(2);
    expect(entries[0].totalFiles).toBe(5);
  });
});

// ── formatTrend ──────────────────────────────────────────────────────────────

describe('formatTrend', () => {
  test('formats trend entries', () => {
    const entries = [
      { timestamp: '2026-01-01T00:00:00.000Z', totalFiles: 5, linesOfCode: { total: 100 }, testCount: 2, storyCount: 1 },
    ];
    const output = formatTrend(entries);
    expect(output).toContain('ANALYTICS TREND');
    expect(output).toContain('100');
  });

  test('returns message for empty trend', () => {
    expect(formatTrend([])).toContain('No trend data');
  });
});

// ── runAnalytics ─────────────────────────────────────────────────────────────

describe('runAnalytics', () => {
  test('--help shows help text', () => {
    const output = [];
    runAnalytics(['--help'], { log: m => output.push(m) });
    expect(output[0]).toContain('PROJECT ANALYTICS DASHBOARD');
  });

  test('--format json outputs valid JSON', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'a.js', 'code');
    const output = [];
    runAnalytics(['--format', 'json'], {
      log: m => output.push(m),
      projectRoot: tmp,
      appendFile: () => {},
      mkdirSync: () => {},
    });
    const parsed = JSON.parse(output[0]);
    expect(parsed.totalFiles).toBeDefined();
  });

  test('--trend outputs trend data', () => {
    const tmp = makeTmpDir();
    const histDir = path.join(tmp, '.aiox');
    fs.mkdirSync(histDir, { recursive: true });
    fs.writeFileSync(
      path.join(histDir, 'analytics-history.jsonl'),
      JSON.stringify({ totalFiles: 5, timestamp: '2026-01-01T00:00:00', linesOfCode: { total: 50 }, testCount: 1, storyCount: 1 }) + '\n'
    );
    const output = [];
    runAnalytics(['--trend'], { log: m => output.push(m), projectRoot: tmp });
    expect(output[0]).toContain('ANALYTICS TREND');
  });

  test('default outputs formatted text', () => {
    const tmp = makeTmpDir();
    writeFile(tmp, 'x.js', 'hello');
    const output = [];
    runAnalytics([], {
      log: m => output.push(m),
      projectRoot: tmp,
      appendFile: () => {},
      mkdirSync: () => {},
    });
    expect(output[0]).toContain('PROJECT ANALYTICS DASHBOARD');
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    expect(getHelpText()).toContain('PROJECT ANALYTICS DASHBOARD');
  });
});
