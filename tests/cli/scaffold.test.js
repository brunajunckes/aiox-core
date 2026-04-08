'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getScaffoldsDir,
  listScaffolds,
  loadTemplate,
  interpolate,
  generateScaffold,
  runScaffold,
  SCAFFOLD_TYPES,
} = require('../../.aiox-core/cli/commands/scaffold/index.js');

// Helpers
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
}

function cleanTmpDir(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── getScaffoldsDir ───────────────────────────────────────────────────────────

describe('getScaffoldsDir', () => {
  it('returns a string path', () => {
    const dir = getScaffoldsDir();
    expect(typeof dir).toBe('string');
  });

  it('points to data/scaffolds directory', () => {
    const dir = getScaffoldsDir();
    expect(dir).toContain(path.join('data', 'scaffolds'));
  });

  it('directory actually exists', () => {
    const dir = getScaffoldsDir();
    expect(fs.existsSync(dir)).toBe(true);
  });
});

// ─── listScaffolds ─────────────────────────────────────────────────────────────

describe('listScaffolds', () => {
  it('returns an array', () => {
    const result = listScaffolds();
    expect(Array.isArray(result)).toBe(true);
  });

  it('includes all 6 scaffold types', () => {
    const result = listScaffolds();
    expect(result).toContain('component');
    expect(result).toContain('module');
    expect(result).toContain('test');
    expect(result).toContain('story');
    expect(result).toContain('workflow');
    expect(result).toContain('squad');
  });

  it('returns sorted results', () => {
    const result = listScaffolds();
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it('has exactly 6 types', () => {
    const result = listScaffolds();
    expect(result.length).toBe(6);
  });
});

// ─── SCAFFOLD_TYPES constant ───────────────────────────────────────────────────

describe('SCAFFOLD_TYPES', () => {
  it('is an array with 6 entries', () => {
    expect(Array.isArray(SCAFFOLD_TYPES)).toBe(true);
    expect(SCAFFOLD_TYPES.length).toBe(6);
  });

  it('contains all expected types', () => {
    expect(SCAFFOLD_TYPES).toEqual(
      expect.arrayContaining(['component', 'module', 'test', 'story', 'workflow', 'squad'])
    );
  });
});

// ─── loadTemplate ──────────────────────────────────────────────────────────────

describe('loadTemplate', () => {
  it('loads component template', () => {
    const content = loadTemplate('component');
    expect(content).toContain('{{Name}}');
    expect(content).toContain('{{name}}');
  });

  it('loads module template', () => {
    const content = loadTemplate('module');
    expect(content).toContain('{{Name}}');
  });

  it('loads test template', () => {
    const content = loadTemplate('test');
    expect(content).toContain('describe');
  });

  it('loads story template', () => {
    const content = loadTemplate('story');
    expect(content).toContain('Acceptance Criteria');
  });

  it('loads workflow template', () => {
    const content = loadTemplate('workflow');
    expect(content).toContain('steps');
  });

  it('loads squad template', () => {
    const content = loadTemplate('squad');
    expect(content).toContain('agents');
  });

  it('throws on unknown type', () => {
    expect(() => loadTemplate('nonexistent')).toThrow('Unknown scaffold type');
  });

  it('throws on empty type', () => {
    expect(() => loadTemplate('')).toThrow('Scaffold type is required');
  });

  it('throws on null type', () => {
    expect(() => loadTemplate(null)).toThrow('Scaffold type is required');
  });
});

// ─── interpolate ───────────────────────────────────────────────────────────────

describe('interpolate', () => {
  it('replaces single placeholder', () => {
    expect(interpolate('Hello {{name}}', { name: 'World' })).toBe('Hello World');
  });

  it('replaces multiple placeholders', () => {
    const result = interpolate('{{name}} by {{author}} on {{date}}', {
      name: 'Test',
      author: 'Dex',
      date: '2026-04-08',
    });
    expect(result).toBe('Test by Dex on 2026-04-08');
  });

  it('leaves unmatched placeholders untouched', () => {
    expect(interpolate('{{name}} and {{missing}}', { name: 'ok' })).toBe('ok and {{missing}}');
  });

  it('handles empty content', () => {
    expect(interpolate('', { name: 'test' })).toBe('');
  });

  it('handles null content', () => {
    expect(interpolate(null, { name: 'test' })).toBe('');
  });

  it('handles null vars', () => {
    expect(interpolate('{{name}}', null)).toBe('{{name}}');
  });

  it('handles empty vars', () => {
    expect(interpolate('{{name}}', {})).toBe('{{name}}');
  });

  it('converts non-string values to string', () => {
    expect(interpolate('count: {{n}}', { n: 42 })).toBe('count: 42');
  });
});

// ─── generateScaffold ──────────────────────────────────────────────────────────

describe('generateScaffold', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanTmpDir(tmpDir);
  });

  it('generates a component file', () => {
    const result = generateScaffold('component', 'user-card', { output: tmpDir });
    expect(fs.existsSync(result.filePath)).toBe(true);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content).toContain('User-card');
    expect(content).not.toContain('{{name}}');
  });

  it('generates a module file', () => {
    const result = generateScaffold('module', 'auth', { output: tmpDir });
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.content).toContain('auth');
  });

  it('generates a story file with .md extension', () => {
    const result = generateScaffold('story', 'login-feature', { output: tmpDir });
    expect(result.filePath).toMatch(/\.md$/);
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('generates a workflow file with .yaml extension', () => {
    const result = generateScaffold('workflow', 'deploy', { output: tmpDir });
    expect(result.filePath).toMatch(/\.yaml$/);
  });

  it('respects --author option', () => {
    const result = generateScaffold('module', 'svc', { output: tmpDir, author: 'TestAuthor' });
    expect(result.content).toContain('TestAuthor');
  });

  it('uses date in YYYY-MM-DD format', () => {
    const result = generateScaffold('module', 'svc', { output: tmpDir });
    expect(result.content).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('dry-run does not write file', () => {
    const result = generateScaffold('component', 'ghost', { output: tmpDir, dryRun: true });
    expect(fs.existsSync(result.filePath)).toBe(false);
    expect(result.content).toBeTruthy();
  });

  it('throws on missing name', () => {
    expect(() => generateScaffold('component', '')).toThrow('Scaffold name is required');
  });

  it('throws on null name', () => {
    expect(() => generateScaffold('component', null)).toThrow('Scaffold name is required');
  });

  it('throws if file exists without --force', () => {
    generateScaffold('component', 'dup', { output: tmpDir });
    expect(() => generateScaffold('component', 'dup', { output: tmpDir })).toThrow(
      'File already exists'
    );
  });

  it('overwrites with --force', () => {
    generateScaffold('component', 'dup', { output: tmpDir });
    const result = generateScaffold('component', 'dup', { output: tmpDir, force: true });
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('creates output directory if missing', () => {
    const nested = path.join(tmpDir, 'deep', 'nested');
    const result = generateScaffold('module', 'deep-mod', { output: nested });
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('applies extraVars', () => {
    const result = generateScaffold('component', 'ex', {
      output: tmpDir,
      extraVars: { description: 'Custom desc' },
    });
    expect(result.content).toContain('Custom desc');
  });
});

// ─── runScaffold CLI handler ───────────────────────────────────────────────────

describe('runScaffold', () => {
  let tmpDir;
  let origCwd;
  let consoleLogSpy;
  let consoleErrorSpy;
  let exitSpy;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    origCwd = process.cwd();
    process.chdir(tmpDir);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    process.chdir(origCwd);
    cleanTmpDir(tmpDir);
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('prints help with no args', () => {
    runScaffold([]);
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('AIOX Scaffold Generator');
  });

  it('prints help with --help', () => {
    runScaffold(['--help']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('prints help with -h', () => {
    runScaffold(['-h']);
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('lists scaffolds', () => {
    runScaffold(['list']);
    expect(consoleLogSpy).toHaveBeenCalledWith('Available scaffold types:');
  });

  it('creates a file with type and name', () => {
    runScaffold(['component', 'my-widget']);
    const created = fs.readdirSync(tmpDir).find((f) => f.startsWith('my-widget'));
    expect(created).toBeDefined();
  });

  it('errors when name is missing', () => {
    expect(() => runScaffold(['component'])).toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('supports --dry-run flag', () => {
    runScaffold(['module', 'dry-test', '--dry-run']);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
    const files = fs.readdirSync(tmpDir);
    expect(files.find((f) => f.startsWith('dry-test'))).toBeUndefined();
  });

  it('supports --author= flag', () => {
    runScaffold(['module', 'authored', '--author=CustomDev', '--dry-run']);
    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('CustomDev');
  });

  it('supports --force flag', () => {
    runScaffold(['component', 'forcible']);
    consoleLogSpy.mockClear();
    runScaffold(['component', 'forcible', '--force']);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Created:'));
  });

  it('errors on unknown scaffold type', () => {
    expect(() => runScaffold(['bogus', 'thing'])).toThrow('process.exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown scaffold type'));
  });
});
