/**
 * Tests for Release Checklist Runner Command Module
 * @story 20.3 — Release Checklist Runner
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-release-check-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/release-check/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/release-check/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('release-check command', () => {
  // ── runCheck ───────────────────────────────────────────────────────────────
  describe('runCheck', () => {
    it('returns pass when function succeeds', () => {
      const result = mod.runCheck('Test', () => ({ pass: true, message: 'ok' }));
      expect(result.pass).toBe(true);
      expect(result.name).toBe('Test');
    });

    it('returns fail when function throws', () => {
      const result = mod.runCheck('Bad', () => { throw new Error('boom'); });
      expect(result.pass).toBe(false);
      expect(result.message).toBe('boom');
    });
  });

  // ── checkVersionBumped ─────────────────────────────────────────────────────
  describe('checkVersionBumped', () => {
    it('passes for valid version', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      const result = mod.checkVersionBumped({ cwd: tmpDir });
      expect(result.pass).toBe(true);
      expect(result.message).toContain('1.0.0');
    });

    it('fails for 0.0.0 version', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '0.0.0' }));
      const result = mod.checkVersionBumped({ cwd: tmpDir });
      expect(result.pass).toBe(false);
    });

    it('fails when package.json missing', () => {
      const result = mod.checkVersionBumped({ cwd: tmpDir });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkChangelog ─────────────────────────────────────────────────────────
  describe('checkChangelog', () => {
    it('passes when CHANGELOG.md exists', () => {
      fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), '# Changelog');
      const result = mod.checkChangelog({ cwd: tmpDir });
      expect(result.pass).toBe(true);
    });

    it('fails when no changelog', () => {
      const result = mod.checkChangelog({ cwd: tmpDir });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkCleanWorkingDir ───────────────────────────────────────────────────
  describe('checkCleanWorkingDir', () => {
    it('passes on clean status', () => {
      const execFn = () => '';
      const result = mod.checkCleanWorkingDir({ execFn });
      expect(result.pass).toBe(true);
    });

    it('fails on dirty status', () => {
      const execFn = () => 'M file.js\n?? new.js';
      const result = mod.checkCleanWorkingDir({ execFn });
      expect(result.pass).toBe(false);
      expect(result.message).toContain('2');
    });

    it('handles exec error', () => {
      const execFn = () => { throw new Error('nope'); };
      const result = mod.checkCleanWorkingDir({ execFn });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkNoTodos ───────────────────────────────────────────────────────────
  describe('checkNoTodos', () => {
    it('passes when grep returns exit 1 (no matches)', () => {
      const execFn = () => { const e = new Error(); e.status = 1; throw e; };
      const result = mod.checkNoTodos({ execFn });
      expect(result.pass).toBe(true);
    });

    it('fails when TODOs found', () => {
      const execFn = () => 'file.js:10:// TODO: fix this';
      const result = mod.checkNoTodos({ execFn });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkDependencies ──────────────────────────────────────────────────────
  describe('checkDependencies', () => {
    it('passes when node_modules exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      const result = mod.checkDependencies({ cwd: tmpDir });
      expect(result.pass).toBe(true);
    });

    it('fails when node_modules missing', () => {
      const result = mod.checkDependencies({ cwd: tmpDir });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkTests ─────────────────────────────────────────────────────────────
  describe('checkTests', () => {
    it('passes when exec succeeds', () => {
      const execFn = () => 'all good';
      const result = mod.checkTests({ execFn });
      expect(result.pass).toBe(true);
    });

    it('fails when exec throws', () => {
      const execFn = () => { throw new Error('test failure'); };
      const result = mod.checkTests({ execFn });
      expect(result.pass).toBe(false);
    });
  });

  // ── checkLint ──────────────────────────────────────────────────────────────
  describe('checkLint', () => {
    it('passes when lint succeeds', () => {
      const execFn = () => '';
      const result = mod.checkLint({ execFn });
      expect(result.pass).toBe(true);
    });

    it('fails and is fixable', () => {
      const execFn = () => { throw new Error('lint errors'); };
      const result = mod.checkLint({ execFn });
      expect(result.pass).toBe(false);
      expect(result.fixable).toBe(true);
    });
  });

  // ── formatText ─────────────────────────────────────────────────────────────
  describe('formatText', () => {
    it('formats results as text', () => {
      const results = [
        { name: 'A', pass: true, message: 'ok', fixable: false },
        { name: 'B', pass: false, message: 'fail', fixable: false },
      ];
      const text = mod.formatText(results);
      expect(text).toContain('[PASS] A');
      expect(text).toContain('[FAIL] B');
      expect(text).toContain('1 passed, 1 failed');
    });

    it('shows ready message when all pass', () => {
      const results = [{ name: 'X', pass: true, message: 'ok', fixable: false }];
      expect(mod.formatText(results)).toContain('Ready for release');
    });
  });

  // ── formatJSON ─────────────────────────────────────────────────────────────
  describe('formatJSON', () => {
    it('returns valid JSON', () => {
      const results = [{ name: 'T', pass: true, message: 'm', fixable: false }];
      const parsed = JSON.parse(mod.formatJSON(results));
      expect(parsed.total).toBe(1);
      expect(parsed.passed).toBe(1);
      expect(parsed.ready).toBe(true);
    });
  });

  // ── runReleaseCheck ────────────────────────────────────────────────────────
  describe('runReleaseCheck', () => {
    it('runs all checks and outputs text', () => {
      // Setup minimal environment
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), '# Changes');
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));

      const execFn = () => '';
      const lines = [];
      mod.runReleaseCheck([], { log: (m) => lines.push(m), execFn, cwd: tmpDir, skipTests: true });
      expect(lines[0]).toContain('Release Checklist');
    });

    it('outputs JSON format', () => {
      const execFn = () => '';
      const lines = [];
      mod.runReleaseCheck(['--format', 'json'], { log: (m) => lines.push(m), execFn, cwd: tmpDir, skipTests: true });
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('checks');
    });

    it('shows help with --help', () => {
      const lines = [];
      mod.runReleaseCheck(['--help'], { log: (m) => lines.push(m) });
      expect(lines[0]).toContain('Release Checklist Runner');
    });
  });

  // ── getHelpText ────────────────────────────────────────────────────────────
  describe('getHelpText', () => {
    it('returns help text', () => {
      const help = mod.getHelpText();
      expect(help).toContain('aiox release-check');
      expect(help.length).toBeGreaterThan(50);
    });
  });
});
