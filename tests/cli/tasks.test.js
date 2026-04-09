/**
 * Tests for Task Runner with Dependencies
 *
 * @module tests/cli/tasks
 * @story 15.1 — Task Runner with Dependencies
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseTasks,
  serializeTasks,
  loadTasks,
  saveTasks,
  getTasksFilePath,
  detectCycles,
  resolveOrder,
  executeTask,
  runTask,
  listTasks,
  addTask,
  removeTask,
  getHelpText,
} = require('../../.aiox-core/cli/commands/tasks/index.js');

// ── Helpers ─────────────────────────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-tasks-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── parseTasks ──────────────────────────────────────────────────────────────

describe('parseTasks', () => {
  test('parses valid YAML-like content', () => {
    const content = `- name: lint\n  command: "npm run lint"\n  deps: []\n- name: test\n  command: "npm test"\n  deps: ["lint"]`;
    const tasks = parseTasks(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].name).toBe('lint');
    expect(tasks[0].command).toBe('npm run lint');
    expect(tasks[0].deps).toEqual([]);
    expect(tasks[1].deps).toEqual(['lint']);
  });

  test('returns empty array for null/empty input', () => {
    expect(parseTasks(null)).toEqual([]);
    expect(parseTasks('')).toEqual([]);
    expect(parseTasks(undefined)).toEqual([]);
  });

  test('skips comments and blank lines', () => {
    const content = `# comment\n\n- name: build\n  command: "npm run build"\n  deps: []`;
    const tasks = parseTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('build');
  });

  test('parses description field', () => {
    const content = `- name: lint\n  command: "npm run lint"\n  deps: []\n  description: "Run linter"`;
    const tasks = parseTasks(content);
    expect(tasks[0].description).toBe('Run linter');
  });
});

// ── serializeTasks ──────────────────────────────────────────────────────────

describe('serializeTasks', () => {
  test('serializes tasks to YAML-like format', () => {
    const tasks = [{ name: 'lint', command: 'npm run lint', deps: ['format'], description: '' }];
    const output = serializeTasks(tasks);
    expect(output).toContain('- name: lint');
    expect(output).toContain('command: "npm run lint"');
    expect(output).toContain('deps: ["format"]');
  });

  test('returns header for empty array', () => {
    const output = serializeTasks([]);
    expect(output).toContain('No tasks defined');
  });
});

// ── File I/O ────────────────────────────────────────────────────────────────

describe('file I/O', () => {
  test('getTasksFilePath returns correct path', () => {
    const p = getTasksFilePath(tmpDir);
    expect(p).toBe(path.join(tmpDir, '.aiox', 'tasks.yaml'));
  });

  test('loadTasks returns empty array when file missing', () => {
    expect(loadTasks(tmpDir)).toEqual([]);
  });

  test('saveTasks creates directory and file', () => {
    const tasks = [{ name: 'test', command: 'npm test', deps: [], description: '' }];
    saveTasks(tasks, tmpDir);
    expect(fs.existsSync(getTasksFilePath(tmpDir))).toBe(true);
    const loaded = loadTasks(tmpDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('test');
  });
});

// ── detectCycles ────────────────────────────────────────────────────────────

describe('detectCycles', () => {
  test('no cycle in linear dependencies', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
      { name: 'c', command: 'echo c', deps: ['b'], description: '' },
    ];
    expect(detectCycles(tasks).hasCycle).toBe(false);
  });

  test('detects direct cycle', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: ['b'], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
    ];
    const result = detectCycles(tasks);
    expect(result.hasCycle).toBe(true);
    expect(result.cycle.length).toBeGreaterThan(0);
  });

  test('detects indirect cycle', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: ['c'], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
      { name: 'c', command: 'echo c', deps: ['b'], description: '' },
    ];
    expect(detectCycles(tasks).hasCycle).toBe(true);
  });

  test('no cycle with independent tasks', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'echo b', deps: [], description: '' },
    ];
    expect(detectCycles(tasks).hasCycle).toBe(false);
  });
});

// ── resolveOrder ────────────────────────────────────────────────────────────

describe('resolveOrder', () => {
  test('resolves linear dependency chain', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
      { name: 'c', command: 'echo c', deps: ['b'], description: '' },
    ];
    const order = resolveOrder('c', tasks);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  test('resolves diamond dependency', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
      { name: 'c', command: 'echo c', deps: ['a'], description: '' },
      { name: 'd', command: 'echo d', deps: ['b', 'c'], description: '' },
    ];
    const order = resolveOrder('d', tasks);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  test('single task with no deps', () => {
    const tasks = [{ name: 'x', command: 'echo x', deps: [], description: '' }];
    expect(resolveOrder('x', tasks)).toEqual(['x']);
  });
});

// ── executeTask ─────────────────────────────────────────────────────────────

describe('executeTask', () => {
  test('returns success for passing command', () => {
    const mockExec = jest.fn().mockReturnValue('done\n');
    const result = executeTask({ name: 'test', command: 'echo done' }, { execFn: mockExec });
    expect(result.success).toBe(true);
    expect(result.name).toBe('test');
    expect(result.output).toBe('done\n');
  });

  test('returns failure for failing command', () => {
    const mockExec = jest.fn().mockImplementation(() => {
      const err = new Error('fail');
      err.stderr = 'error output';
      throw err;
    });
    const result = executeTask({ name: 'bad', command: 'exit 1' }, { execFn: mockExec });
    expect(result.success).toBe(false);
    expect(result.error).toContain('error output');
  });
});

// ── runTask ─────────────────────────────────────────────────────────────────

describe('runTask', () => {
  test('runs single task without deps', () => {
    const mockExec = jest.fn().mockReturnValue('ok');
    const tasks = [{ name: 'a', command: 'echo a', deps: [], description: '' }];
    const result = runTask('a', tasks, { execFn: mockExec });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
  });

  test('runs tasks in dependency order', () => {
    const calls = [];
    const mockExec = jest.fn().mockImplementation((cmd) => {
      calls.push(cmd);
      return 'ok';
    });
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
    ];
    const result = runTask('b', tasks, { execFn: mockExec });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].name).toBe('a');
    expect(result.results[1].name).toBe('b');
  });

  test('returns error for nonexistent task', () => {
    const result = runTask('missing', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('stops on first failure', () => {
    const mockExec = jest.fn().mockImplementation((cmd) => {
      if (cmd.includes('echo a')) return 'ok';
      throw new Error('fail');
    });
    const tasks = [
      { name: 'a', command: 'echo a', deps: [], description: '' },
      { name: 'b', command: 'fail cmd', deps: ['a'], description: '' },
    ];
    const result = runTask('b', tasks, { execFn: mockExec });
    expect(result.success).toBe(false);
  });

  test('rejects circular dependencies', () => {
    const tasks = [
      { name: 'a', command: 'echo a', deps: ['b'], description: '' },
      { name: 'b', command: 'echo b', deps: ['a'], description: '' },
    ];
    const result = runTask('a', tasks);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Circular');
  });
});

// ── listTasks / addTask / removeTask ────────────────────────────────────────

describe('listTasks', () => {
  test('returns message when no tasks', () => {
    const msg = listTasks(tmpDir);
    expect(msg).toContain('No tasks defined');
  });

  test('lists tasks after adding', () => {
    saveTasks([{ name: 'lint', command: 'npm run lint', deps: [], description: '' }], tmpDir);
    const msg = listTasks(tmpDir);
    expect(msg).toContain('lint');
    expect(msg).toContain('npm run lint');
  });
});

describe('addTask', () => {
  test('adds a task successfully', () => {
    const msg = addTask('lint', 'npm run lint', [], tmpDir);
    expect(msg).toContain('added');
    expect(loadTasks(tmpDir)).toHaveLength(1);
  });

  test('rejects duplicate task name', () => {
    addTask('lint', 'npm run lint', [], tmpDir);
    const msg = addTask('lint', 'another cmd', [], tmpDir);
    expect(msg).toContain('already exists');
  });

  test('rejects circular dependency on add', () => {
    addTask('a', 'echo a', ['b'], tmpDir);
    addTask('b', 'echo b', [], tmpDir);
    // Now modify b to depend on a — add a new task creating a cycle
    const tasks = loadTasks(tmpDir);
    tasks.find(t => t.name === 'b').deps = ['a'];
    saveTasks(tasks, tmpDir);
    // Adding c that depends on b (which now cycles) won't create new cycle by itself
    // But adding c -> a where a -> b -> a is a cycle already
    const msg = addTask('c', 'echo c', ['a'], tmpDir);
    expect(msg).toContain('circular');
  });

  test('returns error for missing name', () => {
    expect(addTask('', 'cmd', [], tmpDir)).toContain('Error');
  });

  test('returns error for missing command', () => {
    expect(addTask('test', '', [], tmpDir)).toContain('Error');
  });
});

describe('removeTask', () => {
  test('removes an existing task', () => {
    addTask('lint', 'npm run lint', [], tmpDir);
    const msg = removeTask('lint', tmpDir);
    expect(msg).toContain('removed');
    expect(loadTasks(tmpDir)).toHaveLength(0);
  });

  test('returns error for nonexistent task', () => {
    const msg = removeTask('ghost', tmpDir);
    expect(msg).toContain('not found');
  });

  test('returns error for missing name', () => {
    expect(removeTask(undefined, tmpDir)).toContain('Error');
  });
});

// ── getHelpText ─────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    const help = getHelpText();
    expect(help).toContain('TASK RUNNER');
    expect(help).toContain('aiox tasks');
  });
});
