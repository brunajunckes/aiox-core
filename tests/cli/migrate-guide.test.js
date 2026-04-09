/**
 * Tests for Migration Guide Generator Command Module
 * @story 20.2 — Migration Guide Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-migrate-guide-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/migrate-guide/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/migrate-guide/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('migrate-guide command', () => {
  // ── getCommits ─────────────────────────────────────────────────────────────
  describe('getCommits', () => {
    it('parses commits from git output', () => {
      const sep = '---AIOX-SEP---';
      const execFn = () => `abc1234|feat!: remove old API|BREAKING CHANGE: removed v1${sep}\ndef5678|fix: patch bug|${sep}`;
      const commits = mod.getCommits({ execFn });
      expect(commits.length).toBe(2);
      expect(commits[0].hash).toBe('abc1234');
      expect(commits[0].message).toBe('feat!: remove old API');
    });

    it('returns empty array on error', () => {
      const execFn = () => { throw new Error('fail'); };
      expect(mod.getCommits({ execFn })).toEqual([]);
    });

    it('returns empty array on empty output', () => {
      const execFn = () => '';
      expect(mod.getCommits({ execFn })).toEqual([]);
    });
  });

  // ── detectBreakingChanges ──────────────────────────────────────────────────
  describe('detectBreakingChanges', () => {
    it('detects BREAKING CHANGE in body', () => {
      const commits = [{ hash: 'a1', message: 'feat: something', body: 'BREAKING CHANGE: removed API' }];
      const changes = mod.detectBreakingChanges(commits);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('breaking-change');
    });

    it('detects ! in conventional commit', () => {
      const commits = [{ hash: 'b2', message: 'feat!: new approach', body: '' }];
      const changes = mod.detectBreakingChanges(commits);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('breaking-commit');
    });

    it('detects keyword "removed"', () => {
      const commits = [{ hash: 'c3', message: 'removed legacy endpoint', body: '' }];
      const changes = mod.detectBreakingChanges(commits);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('keyword-detected');
    });

    it('detects keyword "deprecated"', () => {
      const commits = [{ hash: 'd4', message: 'deprecated old method', body: '' }];
      const changes = mod.detectBreakingChanges(commits);
      expect(changes).toHaveLength(1);
    });

    it('ignores non-breaking commits', () => {
      const commits = [{ hash: 'e5', message: 'fix: small patch', body: '' }];
      expect(mod.detectBreakingChanges(commits)).toHaveLength(0);
    });

    it('returns empty for invalid input', () => {
      expect(mod.detectBreakingChanges(null)).toEqual([]);
      expect(mod.detectBreakingChanges('string')).toEqual([]);
    });
  });

  // ── formatMarkdown ─────────────────────────────────────────────────────────
  describe('formatMarkdown', () => {
    it('formats with breaking changes', () => {
      const changes = [{ hash: 'abc1234', description: 'removed API', type: 'breaking-change' }];
      const md = mod.formatMarkdown(changes, { from: 'v1.0.0', to: 'v2.0.0' });
      expect(md).toContain('Migration Guide');
      expect(md).toContain('v1.0.0');
      expect(md).toContain('removed API');
      expect(md).toContain('abc1234');
    });

    it('formats with no breaking changes', () => {
      const md = mod.formatMarkdown([], { from: 'v1', to: 'v2' });
      expect(md).toContain('No breaking changes');
    });
  });

  // ── formatJSON ─────────────────────────────────────────────────────────────
  describe('formatJSON', () => {
    it('returns valid JSON', () => {
      const changes = [{ hash: 'x', description: 'y', type: 'z' }];
      const json = mod.formatJSON(changes, { from: 'v1', to: 'v2' });
      const parsed = JSON.parse(json);
      expect(parsed.breakingChanges).toHaveLength(1);
      expect(parsed.count).toBe(1);
      expect(parsed.from).toBe('v1');
    });
  });

  // ── runMigrateGuide ────────────────────────────────────────────────────────
  describe('runMigrateGuide', () => {
    it('generates guide from mock commits', () => {
      const sep = '---AIOX-SEP---';
      const execFn = () => `abc1234|feat!: remove v1|body${sep}`;
      const lines = [];
      mod.runMigrateGuide([], { log: (m) => lines.push(m), execFn });
      expect(lines[0]).toContain('Migration Guide');
    });

    it('generates JSON format', () => {
      const execFn = () => '';
      const lines = [];
      mod.runMigrateGuide(['--format', 'json'], { log: (m) => lines.push(m), execFn });
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('breakingChanges');
    });

    it('writes to output file', () => {
      const execFn = () => '';
      const outPath = path.join(tmpDir, 'migration.md');
      const lines = [];
      mod.runMigrateGuide(['--output', outPath], { log: (m) => lines.push(m), execFn });
      expect(fs.existsSync(outPath)).toBe(true);
    });

    it('shows help with --help', () => {
      const lines = [];
      mod.runMigrateGuide(['--help'], { log: (m) => lines.push(m) });
      expect(lines[0]).toContain('Migration Guide Generator');
    });

    it('passes --from and --to to getCommits', () => {
      let capturedCmd = '';
      const execFn = (cmd) => { capturedCmd = cmd; return ''; };
      mod.runMigrateGuide(['--from', 'v1.0.0', '--to', 'v2.0.0'], { log: () => {}, execFn });
      expect(capturedCmd).toContain('v1.0.0..v2.0.0');
    });
  });

  // ── getHelpText ────────────────────────────────────────────────────────────
  describe('getHelpText', () => {
    it('returns help with usage info', () => {
      const help = mod.getHelpText();
      expect(help).toContain('aiox migrate-guide');
      expect(help.length).toBeGreaterThan(50);
    });
  });
});
