/**
 * Tests for Workflow Automation Engine
 *
 * @story 7.1 - Workflow Automation Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve the module under test
const MODULE_PATH = path.resolve(__dirname, '../../.aiox-core/cli/commands/workflow/index.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-wf-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeYaml(dir, name, content) {
  const fp = path.join(dir, `${name}.yaml`);
  fs.writeFileSync(fp, content, 'utf8');
  return fp;
}

// ── parseWorkflowYaml ─────────────────────────────────────────────────────────

describe('parseWorkflowYaml', () => {
  const { parseWorkflowYaml } = require(MODULE_PATH);

  test('parses a complete workflow file', () => {
    const yaml = `name: my-workflow
description: Does things
steps:
  - name: step-a
    command: echo a
  - name: step-b
    command: echo b
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.name).toBe('my-workflow');
    expect(result.description).toBe('Does things');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toEqual({ name: 'step-a', command: 'echo a' });
    expect(result.steps[1]).toEqual({ name: 'step-b', command: 'echo b' });
  });

  test('handles comments and blank lines', () => {
    const yaml = `# This is a comment
name: commented

# Another comment
description: Has comments
steps:
  - name: only
    command: echo ok
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.name).toBe('commented');
    expect(result.steps).toHaveLength(1);
  });

  test('returns defaults for empty input', () => {
    const result = parseWorkflowYaml('');
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.steps).toEqual([]);
  });

  test('handles steps with no command field', () => {
    const yaml = `name: incomplete
steps:
  - name: no-cmd
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].name).toBe('no-cmd');
    expect(result.steps[0].command).toBe('');
  });

  test('parses Windows-style line endings', () => {
    const yaml = 'name: win\r\ndescription: crlf\r\nsteps:\r\n  - name: s1\r\n    command: echo 1\r\n';
    const result = parseWorkflowYaml(yaml);
    expect(result.name).toBe('win');
    expect(result.steps).toHaveLength(1);
  });

  test('handles single-step workflow', () => {
    const yaml = `name: single
description: One step
steps:
  - name: only-step
    command: echo hello
`;
    const result = parseWorkflowYaml(yaml);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].command).toBe('echo hello');
  });
});

// ── loadWorkflow ──────────────────────────────────────────────────────────────

describe('loadWorkflow', () => {
  let mod;
  let tmpUser;
  let tmpBuiltin;
  let origCwd;

  beforeEach(() => {
    // Isolate by overwriting module-level constants
    jest.resetModules();
    tmpUser = makeTmpDir();
    tmpBuiltin = makeTmpDir();
    origCwd = process.cwd();

    // We need to patch the constants. Easiest: mock fs paths via the module.
    mod = require(MODULE_PATH);
    // Overwrite the exported constants for testing
    mod.WORKFLOWS_DIR = tmpUser;
    mod.BUILTIN_DIR = tmpBuiltin;
  });

  afterEach(() => {
    process.chdir(origCwd);
    cleanup(tmpUser);
    cleanup(tmpBuiltin);
  });

  test('loads workflow from user directory', () => {
    writeYaml(tmpUser, 'my-wf', 'name: my-wf\ndescription: user\nsteps:\n  - name: s\n    command: echo hi\n');
    // Patch loadWorkflow to use our dirs
    const wf = loadFromDir(mod, 'my-wf', tmpUser, tmpBuiltin);
    expect(wf.name).toBe('my-wf');
    expect(wf.source).toContain(tmpUser);
  });

  test('loads workflow from builtin directory when user dir has no match', () => {
    writeYaml(tmpBuiltin, 'builtin-wf', 'name: builtin-wf\ndescription: built\nsteps:\n  - name: s\n    command: echo ok\n');
    const wf = loadFromDir(mod, 'builtin-wf', tmpUser, tmpBuiltin);
    expect(wf.name).toBe('builtin-wf');
    expect(wf.source).toContain(tmpBuiltin);
  });

  test('user workflow takes precedence over builtin with same name', () => {
    writeYaml(tmpUser, 'shared', 'name: user-ver\ndescription: from user\nsteps:\n  - name: s\n    command: echo user\n');
    writeYaml(tmpBuiltin, 'shared', 'name: builtin-ver\ndescription: from builtin\nsteps:\n  - name: s\n    command: echo builtin\n');
    const wf = loadFromDir(mod, 'shared', tmpUser, tmpBuiltin);
    expect(wf.name).toBe('user-ver');
  });

  test('throws on missing workflow', () => {
    expect(() => loadFromDir(mod, 'nonexistent', tmpUser, tmpBuiltin)).toThrow('Workflow not found');
  });

  test('throws on empty name', () => {
    expect(() => mod.loadWorkflow('')).toThrow('Workflow name is required');
  });

  test('throws on null name', () => {
    expect(() => mod.loadWorkflow(null)).toThrow('Workflow name is required');
  });

  test('sanitizes name — removes special characters', () => {
    expect(() => loadFromDir(mod, '../etc/passwd', tmpUser, tmpBuiltin)).toThrow('Workflow not found');
  });
});

// Helper to call loadWorkflow with patched dirs
function loadFromDir(mod, name, userDir, builtinDir) {
  const origUser = mod.WORKFLOWS_DIR;
  const origBuiltin = mod.BUILTIN_DIR;
  mod.WORKFLOWS_DIR = userDir;
  mod.BUILTIN_DIR = builtinDir;
  try {
    return mod.loadWorkflow(name);
  } finally {
    mod.WORKFLOWS_DIR = origUser;
    mod.BUILTIN_DIR = origBuiltin;
  }
}

// ── listWorkflows ─────────────────────────────────────────────────────────────

describe('listWorkflows', () => {
  let mod;
  let tmpUser;
  let tmpBuiltin;

  beforeEach(() => {
    jest.resetModules();
    tmpUser = makeTmpDir();
    tmpBuiltin = makeTmpDir();
    mod = require(MODULE_PATH);
  });

  afterEach(() => {
    cleanup(tmpUser);
    cleanup(tmpBuiltin);
  });

  test('lists workflows from both dirs', () => {
    writeYaml(tmpUser, 'user-wf', 'name: user-wf\ndescription: User\nsteps:\n  - name: s\n    command: echo 1\n');
    writeYaml(tmpBuiltin, 'builtin-wf', 'name: builtin-wf\ndescription: Builtin\nsteps:\n  - name: s\n    command: echo 2\n');

    mod.WORKFLOWS_DIR = tmpUser;
    mod.BUILTIN_DIR = tmpBuiltin;
    const list = mod.listWorkflows();

    expect(list).toHaveLength(2);
    expect(list.map((w) => w.name)).toContain('user-wf');
    expect(list.map((w) => w.name)).toContain('builtin-wf');
  });

  test('deduplicates user over builtin', () => {
    writeYaml(tmpUser, 'dup', 'name: user-dup\ndescription: User version\nsteps:\n  - name: s\n    command: echo 1\n');
    writeYaml(tmpBuiltin, 'dup', 'name: builtin-dup\ndescription: Builtin version\nsteps:\n  - name: s\n    command: echo 2\n');

    mod.WORKFLOWS_DIR = tmpUser;
    mod.BUILTIN_DIR = tmpBuiltin;
    const list = mod.listWorkflows();

    expect(list).toHaveLength(1);
    expect(list[0].source).toBe('user');
  });

  test('returns empty array when no workflows exist', () => {
    mod.WORKFLOWS_DIR = tmpUser;
    mod.BUILTIN_DIR = tmpBuiltin;
    const list = mod.listWorkflows();
    expect(list).toEqual([]);
  });

  test('handles missing directories gracefully', () => {
    mod.WORKFLOWS_DIR = '/nonexistent/path/a';
    mod.BUILTIN_DIR = '/nonexistent/path/b';
    const list = mod.listWorkflows();
    expect(list).toEqual([]);
  });
});

// ── createWorkflow ────────────────────────────────────────────────────────────

describe('createWorkflow', () => {
  let mod;
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = makeTmpDir();
    mod = require(MODULE_PATH);
    mod.WORKFLOWS_DIR = tmpDir;
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates a new workflow file', () => {
    const filePath = mod.createWorkflow('my-new');
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('name: my-new');
    expect(content).toContain('steps:');
  });

  test('throws if workflow already exists', () => {
    mod.createWorkflow('existing');
    expect(() => mod.createWorkflow('existing')).toThrow('Workflow already exists');
  });

  test('throws on empty name', () => {
    expect(() => mod.createWorkflow('')).toThrow('Workflow name is required');
  });

  test('throws on null name', () => {
    expect(() => mod.createWorkflow(null)).toThrow('Workflow name is required');
  });

  test('sanitizes name', () => {
    const filePath = mod.createWorkflow('my-wf_2');
    expect(filePath).toContain('my-wf_2.yaml');
  });

  test('creates workflow directory if missing', () => {
    const nestedDir = path.join(tmpDir, 'sub', 'dir');
    mod.WORKFLOWS_DIR = nestedDir;
    // createWorkflow calls ensureWorkflowsDir
    const filePath = mod.createWorkflow('nested');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

// ── executeWorkflow ───────────────────────────────────────────────────────────

describe('executeWorkflow', () => {
  const { executeWorkflow } = require(MODULE_PATH);
  const noop = () => {};

  test('executes all steps sequentially', () => {
    const calls = [];
    const mockExec = (cmd) => {
      calls.push(cmd);
      return 'ok';
    };

    const wf = {
      name: 'test-wf',
      steps: [
        { name: 'a', command: 'echo a' },
        { name: 'b', command: 'echo b' },
      ],
    };

    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(calls).toEqual(['echo a', 'echo b']);
  });

  test('stops on first failure', () => {
    const mockExec = (cmd) => {
      if (cmd === 'fail-cmd') {
        const err = new Error('boom');
        err.stderr = 'command failed';
        throw err;
      }
      return 'ok';
    };

    const wf = {
      name: 'fail-wf',
      steps: [
        { name: 'ok', command: 'echo ok' },
        { name: 'bad', command: 'fail-cmd' },
        { name: 'never', command: 'echo never' },
      ],
    };

    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[1].status).toBe('fail');
  });

  test('dry-run mode does not execute commands', () => {
    let executed = false;
    const mockExec = () => { executed = true; return ''; };

    const wf = {
      name: 'dry',
      steps: [{ name: 's', command: 'echo hello' }],
    };

    const result = executeWorkflow(wf, { dryRun: true, execFn: mockExec, log: noop });
    expect(executed).toBe(false);
    expect(result.success).toBe(true);
    expect(result.results[0].status).toBe('dry-run');
  });

  test('skips steps without a command', () => {
    const wf = {
      name: 'skip-wf',
      steps: [
        { name: 'empty', command: '' },
        { name: 'real', command: 'echo real' },
      ],
    };

    const mockExec = () => 'ok';
    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.results[0].status).toBe('skipped');
    expect(result.results[1].status).toBe('pass');
  });

  test('throws on invalid workflow (no steps)', () => {
    expect(() => executeWorkflow({ name: 'bad' }, { log: noop })).toThrow('missing steps array');
  });

  test('throws on empty steps array', () => {
    expect(() => executeWorkflow({ name: 'empty', steps: [] }, { log: noop })).toThrow('no steps to execute');
  });

  test('captures output from successful steps', () => {
    const mockExec = () => '  output-text  ';
    const wf = { name: 'out', steps: [{ name: 's', command: 'echo x' }] };
    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.results[0].output).toBe('output-text');
  });

  test('captures error from failed steps', () => {
    const mockExec = () => {
      const err = new Error('fail');
      err.stderr = Buffer.from('stderr output');
      throw err;
    };
    const wf = { name: 'err', steps: [{ name: 's', command: 'x' }] };
    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.results[0].error).toBe('stderr output');
  });

  test('uses error.message when stderr is empty', () => {
    const mockExec = () => { throw new Error('direct error'); };
    const wf = { name: 'err2', steps: [{ name: 's', command: 'x' }] };
    const result = executeWorkflow(wf, { execFn: mockExec, log: noop });
    expect(result.results[0].error).toBe('direct error');
  });
});

// ── runWorkflow (CLI handler) ─────────────────────────────────────────────────

describe('runWorkflow CLI handler', () => {
  const cliNoop = () => {};
  let mod;
  let tmpUser;
  let tmpBuiltin;
  let exitSpy;

  beforeEach(() => {
    jest.resetModules();
    tmpUser = makeTmpDir();
    tmpBuiltin = makeTmpDir();
    mod = require(MODULE_PATH);
    mod.WORKFLOWS_DIR = tmpUser;
    mod.BUILTIN_DIR = tmpBuiltin;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    cleanup(tmpUser);
    cleanup(tmpBuiltin);
  });

  test('--help shows usage', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(cliNoop);
    mod.runWorkflow(['--help']);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test('no args shows help', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(cliNoop);
    mod.runWorkflow([]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test('list subcommand works', () => {
    writeYaml(tmpUser, 'test-wf', 'name: test-wf\ndescription: Test\nsteps:\n  - name: s\n    command: echo 1\n');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(cliNoop);
    mod.runWorkflow(['list']);
    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('test-wf');
    logSpy.mockRestore();
  });

  test('create subcommand works', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(cliNoop);
    mod.runWorkflow(['create', 'new-wf']);
    expect(fs.existsSync(path.join(tmpUser, 'new-wf.yaml'))).toBe(true);
    logSpy.mockRestore();
  });

  test('run subcommand without name exits with error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(cliNoop);
    expect(() => mod.runWorkflow(['run'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    errSpy.mockRestore();
  });

  test('unknown subcommand exits with error', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(cliNoop);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(cliNoop);
    expect(() => mod.runWorkflow(['bogus'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});

// ── Built-in Workflows ────────────────────────────────────────────────────────

describe('built-in workflow files', () => {
  const { parseWorkflowYaml } = require(MODULE_PATH);
  const dataDir = path.resolve(__dirname, '../../.aiox-core/data/workflows');

  test('full-cycle.yaml is parseable and has steps', () => {
    const content = fs.readFileSync(path.join(dataDir, 'full-cycle.yaml'), 'utf8');
    const wf = parseWorkflowYaml(content);
    expect(wf.name).toBe('full-cycle');
    expect(wf.steps.length).toBeGreaterThanOrEqual(3);
    expect(wf.steps.every((s) => s.name && s.command)).toBe(true);
  });

  test('quick-check.yaml is parseable and has steps', () => {
    const content = fs.readFileSync(path.join(dataDir, 'quick-check.yaml'), 'utf8');
    const wf = parseWorkflowYaml(content);
    expect(wf.name).toBe('quick-check');
    expect(wf.steps.length).toBeGreaterThanOrEqual(2);
  });
});
