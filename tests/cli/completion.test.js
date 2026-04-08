'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// Module under test
const {
  COMMANDS,
  getCommands,
  getAgentNames,
  generateBashCompletion,
  generateZshCompletion,
  generateFishCompletion,
  detectShell,
  installCompletion,
  showHelp,
  runCompletion,
} = require('../../.aiox-core/cli/commands/completion/index.js');

describe('AIOX CLI Completion Module', () => {
  // ─── getCommands ────────────────────────────────────────────────
  describe('getCommands()', () => {
    test('returns an array of strings', () => {
      const cmds = getCommands();
      expect(Array.isArray(cmds)).toBe(true);
      expect(cmds.length).toBeGreaterThan(0);
      cmds.forEach((c) => expect(typeof c).toBe('string'));
    });

    test('includes known commands', () => {
      const cmds = getCommands();
      expect(cmds).toContain('agents');
      expect(cmds).toContain('help');
      expect(cmds).toContain('completion');
      expect(cmds).toContain('doctor');
      expect(cmds).toContain('graph');
    });

    test('returns a copy (not the original array)', () => {
      const a = getCommands();
      const b = getCommands();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    test('COMMANDS constant matches getCommands output', () => {
      expect(getCommands()).toEqual(COMMANDS);
    });
  });

  // ─── getAgentNames ─────────────────────────────────────────────
  describe('getAgentNames()', () => {
    test('returns agent IDs from project root', () => {
      const projectRoot = path.resolve(__dirname, '..', '..');
      const agents = getAgentNames(projectRoot);
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('dev');
      expect(agents).toContain('qa');
      expect(agents).toContain('aiox-master');
    });

    test('returns sorted array', () => {
      const projectRoot = path.resolve(__dirname, '..', '..');
      const agents = getAgentNames(projectRoot);
      const sorted = [...agents].sort();
      expect(agents).toEqual(sorted);
    });

    test('falls back to hardcoded list for invalid path', () => {
      const agents = getAgentNames('/nonexistent/path/xyz');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('dev');
      expect(agents).toContain('pm');
      expect(agents).toContain('aiox-master');
    });

    test('all entries are strings without .md extension', () => {
      const agents = getAgentNames();
      agents.forEach((a) => {
        expect(typeof a).toBe('string');
        expect(a).not.toMatch(/\.md$/);
      });
    });
  });

  // ─── generateBashCompletion ─────────────────────────────────────
  describe('generateBashCompletion()', () => {
    let script;
    beforeAll(() => {
      script = generateBashCompletion(path.resolve(__dirname, '..', '..'));
    });

    test('contains _aiox_completions function', () => {
      expect(script).toContain('_aiox_completions');
    });

    test('contains complete -F directive', () => {
      expect(script).toContain('complete -F _aiox_completions aiox');
    });

    test('contains all commands', () => {
      for (const cmd of COMMANDS) {
        expect(script).toContain(cmd);
      }
    });

    test('contains agent names with @ prefix', () => {
      expect(script).toContain('@dev');
      expect(script).toContain('@qa');
    });

    test('contains COMPREPLY', () => {
      expect(script).toContain('COMPREPLY');
    });

    test('starts with shebang', () => {
      expect(script.startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    test('contains completion subcommands', () => {
      expect(script).toContain('bash zsh fish install --help');
    });
  });

  // ─── generateZshCompletion ──────────────────────────────────────
  describe('generateZshCompletion()', () => {
    let script;
    beforeAll(() => {
      script = generateZshCompletion(path.resolve(__dirname, '..', '..'));
    });

    test('contains compdef directive', () => {
      expect(script).toContain('compdef _aiox aiox');
    });

    test('contains _aiox function', () => {
      expect(script).toContain('_aiox()');
    });

    test('contains all commands', () => {
      for (const cmd of COMMANDS) {
        expect(script).toContain(cmd);
      }
    });

    test('contains _describe for commands', () => {
      expect(script).toContain('_describe');
    });

    test('contains agent names', () => {
      expect(script).toContain('@dev');
    });
  });

  // ─── generateFishCompletion ─────────────────────────────────────
  describe('generateFishCompletion()', () => {
    let script;
    beforeAll(() => {
      script = generateFishCompletion(path.resolve(__dirname, '..', '..'));
    });

    test('contains complete -c aiox directives', () => {
      expect(script).toContain('complete -c aiox');
    });

    test('uses __fish_use_subcommand for top-level commands', () => {
      expect(script).toContain('__fish_use_subcommand');
    });

    test('uses __fish_seen_subcommand_from for completion subcommands', () => {
      expect(script).toContain('__fish_seen_subcommand_from completion');
    });

    test('contains all commands', () => {
      for (const cmd of COMMANDS) {
        expect(script).toContain(cmd);
      }
    });

    test('disables file completions', () => {
      expect(script).toContain('complete -c aiox -f');
    });

    test('contains agent names with @ prefix', () => {
      expect(script).toContain('@dev');
      expect(script).toContain('@aiox-master');
    });
  });

  // ─── detectShell ────────────────────────────────────────────────
  describe('detectShell()', () => {
    const origShell = process.env.SHELL;
    afterEach(() => {
      if (origShell !== undefined) {
        process.env.SHELL = origShell;
      } else {
        delete process.env.SHELL;
      }
    });

    test('detects bash', () => {
      process.env.SHELL = '/bin/bash';
      expect(detectShell()).toBe('bash');
    });

    test('detects zsh', () => {
      process.env.SHELL = '/usr/bin/zsh';
      expect(detectShell()).toBe('zsh');
    });

    test('detects fish', () => {
      process.env.SHELL = '/usr/bin/fish';
      expect(detectShell()).toBe('fish');
    });

    test('returns unknown for unrecognized shell', () => {
      process.env.SHELL = '/usr/bin/csh';
      expect(detectShell()).toBe('unknown');
    });

    test('returns unknown when SHELL is unset', () => {
      delete process.env.SHELL;
      expect(detectShell()).toBe('unknown');
    });
  });

  // ─── installCompletion ──────────────────────────────────────────
  describe('installCompletion()', () => {
    let tmpDir;
    const origShell = process.env.SHELL;
    const origHome = process.env.HOME;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-completion-test-'));
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.SHELL = origShell;
      process.env.HOME = origHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('installs bash completion', () => {
      process.env.SHELL = '/bin/bash';
      const result = installCompletion();
      expect(result.shell).toBe('bash');
      expect(fs.existsSync(result.path)).toBe(true);
      const content = fs.readFileSync(result.path, 'utf8');
      expect(content).toContain('_aiox_completions');
    });

    test('installs zsh completion', () => {
      process.env.SHELL = '/bin/zsh';
      const result = installCompletion();
      expect(result.shell).toBe('zsh');
      expect(fs.existsSync(result.path)).toBe(true);
    });

    test('installs fish completion', () => {
      process.env.SHELL = '/usr/bin/fish';
      const result = installCompletion();
      expect(result.shell).toBe('fish');
      expect(fs.existsSync(result.path)).toBe(true);
      expect(result.path).toContain('completions/aiox.fish');
    });

    test('throws for unknown shell', () => {
      process.env.SHELL = '/usr/bin/csh';
      expect(() => installCompletion()).toThrow('Cannot detect shell');
    });

    test('does not duplicate source line in bashrc', () => {
      process.env.SHELL = '/bin/bash';
      installCompletion();
      installCompletion(); // second call
      const rc = fs.readFileSync(path.join(tmpDir, '.bashrc'), 'utf8');
      const matches = rc.match(/# AIOX CLI completion/g);
      expect(matches.length).toBe(1);
    });
  });

  // ─── runCompletion ──────────────────────────────────────────────
  describe('runCompletion()', () => {
    let stdoutData;
    const origWrite = process.stdout.write;
    const origLog = console.log;
    const origError = console.error;
    const origExit = process.exit;

    beforeEach(() => {
      stdoutData = '';
      process.stdout.write = jest.fn((data) => { stdoutData += data; });
      console.log = jest.fn();
      console.error = jest.fn();
      process.exit = jest.fn();
    });

    afterEach(() => {
      process.stdout.write = origWrite;
      console.log = origLog;
      console.error = origError;
      process.exit = origExit;
    });

    test('bash subcommand outputs bash script', () => {
      runCompletion(['bash']);
      expect(stdoutData).toContain('_aiox_completions');
    });

    test('zsh subcommand outputs zsh script', () => {
      runCompletion(['zsh']);
      expect(stdoutData).toContain('compdef');
    });

    test('fish subcommand outputs fish script', () => {
      runCompletion(['fish']);
      expect(stdoutData).toContain('complete -c aiox');
    });

    test('--help shows help text', () => {
      runCompletion(['--help']);
      expect(console.log).toHaveBeenCalled();
      const output = console.log.mock.calls[0][0];
      expect(output).toContain('AIOX CLI Completion');
    });

    test('empty argv shows help', () => {
      runCompletion([]);
      expect(console.log).toHaveBeenCalled();
    });

    test('unknown subcommand exits with error', () => {
      runCompletion(['powershell']);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown completion subcommand'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
