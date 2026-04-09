/**
 * Tests for Git Diff Analyzer Command Module
 * @story 23.1 — Git Diff Analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-diff-analyze-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/diff-analyze/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/diff-analyze/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diff-analyze command', () => {
  // ── parseNumstat ──────────────────────────────────────────────────────
  describe('parseNumstat', () => {
    it('parses standard numstat output', () => {
      const input = '10\t5\tsrc/index.js\n3\t0\tREADME.md';
      const result = mod.parseNumstat(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ file: 'src/index.js', added: 10, removed: 5 });
      expect(result[1]).toEqual({ file: 'README.md', added: 3, removed: 0 });
    });

    it('handles binary files with dashes', () => {
      const input = '-\t-\timage.png';
      const result = mod.parseNumstat(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ file: 'image.png', added: 0, removed: 0 });
    });

    it('returns empty array for empty input', () => {
      expect(mod.parseNumstat('')).toEqual([]);
      expect(mod.parseNumstat(null)).toEqual([]);
      expect(mod.parseNumstat(undefined)).toEqual([]);
    });

    it('handles single file', () => {
      const result = mod.parseNumstat('1\t2\tfile.js');
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('file.js');
    });

    it('handles files with tabs in name', () => {
      const result = mod.parseNumstat('1\t2\tpath/to\tfile.js');
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('path/to\tfile.js');
    });
  });

  // ── calculateImpactScore ──────────────────────────────────────────────
  describe('calculateImpactScore', () => {
    it('returns 0 for no files', () => {
      expect(mod.calculateImpactScore([])).toBe(0);
    });

    it('returns low score for small change', () => {
      const files = [{ file: 'a.js', added: 2, removed: 1 }];
      const score = mod.calculateImpactScore(files);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(30);
    });

    it('returns high score for large change', () => {
      const files = [];
      for (let i = 0; i < 15; i++) {
        files.push({ file: `file${i}.js`, added: 100, removed: 50 });
      }
      const score = mod.calculateImpactScore(files);
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it('caps at 100', () => {
      const files = [];
      for (let i = 0; i < 50; i++) {
        files.push({ file: `file${i}.js`, added: 1000, removed: 500 });
      }
      expect(mod.calculateImpactScore(files)).toBeLessThanOrEqual(100);
    });
  });

  // ── assessRisk ────────────────────────────────────────────────────────
  describe('assessRisk', () => {
    it('returns LOW for small change', () => {
      const files = [{ file: 'a.js', added: 5, removed: 2 }];
      const risk = mod.assessRisk(files);
      expect(risk.level).toBe('LOW');
    });

    it('returns HIGH for >500 lines', () => {
      const files = [{ file: 'big.js', added: 400, removed: 200 }];
      const risk = mod.assessRisk(files);
      expect(risk.level).toBe('HIGH');
      expect(risk.reasons.some(r => r.includes('Large change'))).toBe(true);
    });

    it('returns HIGH for >10 files', () => {
      const files = [];
      for (let i = 0; i < 12; i++) {
        files.push({ file: `f${i}.js`, added: 1, removed: 0 });
      }
      const risk = mod.assessRisk(files);
      expect(risk.level).toBe('HIGH');
      expect(risk.reasons.some(r => r.includes('Many files'))).toBe(true);
    });

    it('flags sensitive files', () => {
      const files = [{ file: '.env', added: 1, removed: 0 }];
      const risk = mod.assessRisk(files);
      expect(risk.reasons.some(r => r.includes('Sensitive'))).toBe(true);
    });

    it('flags missing test files', () => {
      const files = [{ file: 'src/lib.js', added: 10, removed: 0 }];
      const risk = mod.assessRisk(files);
      expect(risk.reasons.some(r => r.includes('No test files'))).toBe(true);
    });

    it('does not flag missing tests when test files present', () => {
      const files = [
        { file: 'src/lib.js', added: 10, removed: 0 },
        { file: 'tests/lib.test.js', added: 5, removed: 0 },
      ];
      const risk = mod.assessRisk(files);
      expect(risk.reasons.some(r => r.includes('No test files'))).toBe(false);
    });
  });

  // ── formatText ────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats basic result', () => {
      const result = {
        filesChanged: 2,
        linesAdded: 10,
        linesRemoved: 3,
        totalLines: 13,
        impactScore: 15,
        files: [{ file: 'a.js', added: 10, removed: 3 }],
      };
      const text = mod.formatText(result);
      expect(text).toContain('Git Diff Analysis');
      expect(text).toContain('Files changed:  2');
      expect(text).toContain('+10');
    });

    it('includes risk when present', () => {
      const result = {
        filesChanged: 1, linesAdded: 1, linesRemoved: 0, totalLines: 1,
        impactScore: 5, files: [],
        risk: { level: 'LOW', reasons: [] },
      };
      const text = mod.formatText(result);
      expect(text).toContain('Risk Level: LOW');
    });

    it('includes reviewers when present', () => {
      const result = {
        filesChanged: 1, linesAdded: 1, linesRemoved: 0, totalLines: 1,
        impactScore: 5, files: [],
        reviewers: [{ author: 'Alice', files: 3, percentage: 75 }],
      };
      const text = mod.formatText(result);
      expect(text).toContain('Suggested Reviewers');
      expect(text).toContain('Alice');
    });
  });

  // ── analyzeDiff ───────────────────────────────────────────────────────
  describe('analyzeDiff', () => {
    it('returns structure with all fields', () => {
      const result = mod.analyzeDiff({ cwd: tmpDir });
      expect(result).toHaveProperty('filesChanged');
      expect(result).toHaveProperty('linesAdded');
      expect(result).toHaveProperty('linesRemoved');
      expect(result).toHaveProperty('totalLines');
      expect(result).toHaveProperty('impactScore');
      expect(result).toHaveProperty('files');
    });

    it('includes risk when option set', () => {
      const result = mod.analyzeDiff({ cwd: tmpDir, risk: true });
      expect(result).toHaveProperty('risk');
      expect(result.risk).toHaveProperty('level');
    });
  });

  // ── runDiffAnalyze ────────────────────────────────────────────────────
  describe('runDiffAnalyze', () => {
    it('runs without error', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDiffAnalyze([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runDiffAnalyze(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
      spy.mockRestore();
    });
  });
});
