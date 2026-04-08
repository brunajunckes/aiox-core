/**
 * Git Flow Command Tests
 *
 * @story 8.3 — Git Workflow Automation
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Mock child_process before requiring module
jest.mock('child_process');
jest.mock('fs');

const { execSync } = require('child_process');
const {
  slugify,
  readStoryFile,
  getBranchName,
  startFlow,
  finishFlow,
  flowStatus,
  runGitFlow,
  extractStoryId,
  getCurrentBranch,
  HELP_TEXT,
} = require('../../.aiox-core/cli/commands/git-flow/index.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORY_CONTENT = `# Story 3.2: Implement User Authentication

## Objective
Add user auth to the platform.

**Status:** InProgress

## Acceptance Criteria
- [ ] Login works
`;

function mockExecSync(map = {}) {
  execSync.mockImplementation((cmd, opts) => {
    for (const [pattern, result] of Object.entries(map)) {
      if (cmd.includes(pattern)) {
        if (result instanceof Error) throw result;
        return typeof result === 'string' ? result : '';
      }
    }
    return '';
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default fs mocks
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue(STORY_CONTENT);
  // Default execSync
  execSync.mockReturnValue('');
  // Suppress console in tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

// ── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  test('converts title to lowercase kebab-case', () => {
    expect(slugify('Implement User Authentication')).toBe('implement-user-authentication');
  });

  test('removes special characters', () => {
    expect(slugify('Fix Bug #123: Login & Auth')).toBe('fix-bug-123-login-auth');
  });

  test('trims leading and trailing hyphens', () => {
    expect(slugify('---hello world---')).toBe('hello-world');
  });

  test('collapses multiple hyphens', () => {
    expect(slugify('foo   bar   baz')).toBe('foo-bar-baz');
  });

  test('returns empty string for null/undefined/empty', () => {
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
    expect(slugify('')).toBe('');
  });

  test('returns empty string for non-string input', () => {
    expect(slugify(42)).toBe('');
    expect(slugify({})).toBe('');
  });

  test('handles single word', () => {
    expect(slugify('Setup')).toBe('setup');
  });

  test('handles accented characters by removing them', () => {
    expect(slugify('Cafe Latte')).toBe('cafe-latte');
  });
});

// ── extractStoryId ───────────────────────────────────────────────────────────

describe('extractStoryId', () => {
  test('extracts ID from story branch', () => {
    expect(extractStoryId('story/3.2-implement-auth')).toBe('3.2');
  });

  test('extracts ID from branch without slug', () => {
    expect(extractStoryId('story/1.1')).toBe('1.1');
  });

  test('returns null for non-story branch', () => {
    expect(extractStoryId('main')).toBeNull();
    expect(extractStoryId('feat/something')).toBeNull();
  });

  test('handles multi-digit IDs', () => {
    expect(extractStoryId('story/12.34-some-title')).toBe('12.34');
  });
});

// ── readStoryFile ────────────────────────────────────────────────────────────

describe('readStoryFile', () => {
  test('reads story file and extracts title', () => {
    const result = readStoryFile('3.2', '/project');
    expect(result.title).toBe('Implement User Authentication');
    expect(result.status).toBe('InProgress');
  });

  test('throws when story file not found', () => {
    fs.existsSync.mockReturnValue(false);
    expect(() => readStoryFile('99.99', '/project')).toThrow('Story file not found');
  });

  test('falls back to storyId when no title heading found', () => {
    fs.readFileSync.mockReturnValue('No heading here\nJust text.');
    const result = readStoryFile('3.2', '/project');
    expect(result.title).toBe('3.2');
  });

  test('returns null status when not present', () => {
    fs.readFileSync.mockReturnValue('# Story 1.1: Title\nSome content');
    const result = readStoryFile('1.1', '/project');
    expect(result.status).toBeNull();
  });

  test('uses process.cwd() when no cwd provided', () => {
    readStoryFile('3.2');
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringContaining('3.2.story.md')
    );
  });
});

// ── getBranchName ────────────────────────────────────────────────────────────

describe('getBranchName', () => {
  test('generates branch name from story', () => {
    const name = getBranchName('3.2', '/project');
    expect(name).toBe('story/3.2-implement-user-authentication');
  });

  test('handles story with empty title gracefully', () => {
    fs.readFileSync.mockReturnValue('No heading\nJust text.');
    const name = getBranchName('5.1', '/project');
    expect(name).toBe('story/5.1-5-1');
  });
});

// ── startFlow ────────────────────────────────────────────────────────────────

describe('startFlow', () => {
  test('creates and switches to new branch', () => {
    execSync.mockReturnValue('');
    const result = startFlow('3.2', '/project');
    expect(result.branch).toBe('story/3.2-implement-user-authentication');
    expect(result.storyTitle).toBe('Implement User Authentication');
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git checkout -b story/3.2'),
      expect.any(Object)
    );
  });

  test('switches to existing branch if it already exists', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('git branch --list')) {
        return '  story/3.2-implement-user-authentication\n  main\n';
      }
      return '';
    });

    const result = startFlow('3.2', '/project');
    expect(result.branch).toBe('story/3.2-implement-user-authentication');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Switched to existing branch')
    );
  });

  test('throws when storyId is missing', () => {
    expect(() => startFlow(null)).toThrow('Story ID is required');
    expect(() => startFlow('')).toThrow('Story ID is required');
  });

  test('throws when story file does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    expect(() => startFlow('99.1', '/project')).toThrow('Story file not found');
  });
});

// ── finishFlow ───────────────────────────────────────────────────────────────

describe('finishFlow', () => {
  beforeEach(() => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-implement-user-authentication';
      if (cmd.includes('status --porcelain')) return ' M src/auth.js\n';
      if (cmd.includes('rev-parse --short HEAD')) return 'abc1234';
      return '';
    });
  });

  test('runs lint, tests, stages, and commits', () => {
    finishFlow('/project');
    const calls = execSync.mock.calls.map(c => c[0]);
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('npm run lint'),
      expect.stringContaining('npm test'),
      expect.stringContaining('git add -A'),
      expect.stringContaining('git commit'),
    ]));
  });

  test('commit message includes story reference', () => {
    finishFlow('/project');
    const commitCall = execSync.mock.calls.find(c => c[0].includes('git commit'));
    expect(commitCall[0]).toContain('[Story 3.2]');
  });

  test('returns branch, storyId, commitHash', () => {
    const result = finishFlow('/project');
    expect(result.branch).toBe('story/3.2-implement-user-authentication');
    expect(result.storyId).toBe('3.2');
    expect(result.commitHash).toBe('abc1234');
  });

  test('throws when not on story branch', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'main';
      return '';
    });
    expect(() => finishFlow('/project')).toThrow('not a story branch');
  });

  test('throws when working tree is clean', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-implement-user-authentication';
      if (cmd.includes('status --porcelain')) return '';
      return '';
    });
    expect(() => finishFlow('/project')).toThrow('No changes to commit');
  });

  test('throws when lint fails', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-implement-user-authentication';
      if (cmd.includes('status --porcelain')) return ' M file.js\n';
      if (cmd.includes('npm run lint')) throw new Error('lint error');
      return '';
    });
    expect(() => finishFlow('/project')).toThrow('Lint failed');
  });

  test('throws when tests fail', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-implement-user-authentication';
      if (cmd.includes('status --porcelain')) return ' M file.js\n';
      if (cmd.includes('npm test')) throw new Error('test failure');
      return '';
    });
    expect(() => finishFlow('/project')).toThrow('Tests failed');
  });

  test('uses custom commit message when provided', () => {
    finishFlow('/project', { message: 'fix: resolve auth bug' });
    const commitCall = execSync.mock.calls.find(c => c[0].includes('git commit'));
    expect(commitCall[0]).toContain('fix: resolve auth bug');
    expect(commitCall[0]).toContain('[Story 3.2]');
  });

  test('does NOT call git push', () => {
    finishFlow('/project');
    const calls = execSync.mock.calls.map(c => c[0]);
    const pushCalls = calls.filter(c => c.includes('git push'));
    expect(pushCalls).toHaveLength(0);
  });
});

// ── flowStatus ───────────────────────────────────────────────────────────────

describe('flowStatus', () => {
  test('displays status for story branch', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-implement-user-authentication';
      if (cmd.includes('status --porcelain')) return ' M src/auth.js\n';
      if (cmd.includes('npm test')) return '';
      return '';
    });

    const result = flowStatus('/project');
    expect(result.branch).toBe('story/3.2-implement-user-authentication');
    expect(result.storyId).toBe('3.2');
    expect(result.hasChanges).toBe(true);
    expect(result.testsPass).toBe(true);
  });

  test('shows clean tree when no changes', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/1.1-setup';
      if (cmd.includes('status --porcelain')) return '';
      if (cmd.includes('npm test')) return '';
      return '';
    });

    const result = flowStatus('/project');
    expect(result.hasChanges).toBe(false);
  });

  test('reports failing tests', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-auth';
      if (cmd.includes('status --porcelain')) return '';
      if (cmd.includes('npm test')) throw new Error('fail');
      return '';
    });

    const result = flowStatus('/project');
    expect(result.testsPass).toBe(false);
  });

  test('handles non-story branch gracefully', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'main';
      if (cmd.includes('status --porcelain')) return '';
      if (cmd.includes('npm test')) return '';
      return '';
    });

    const result = flowStatus('/project');
    expect(result.storyId).toBeNull();
    expect(result.story).toBeNull();
  });

  test('handles missing story file gracefully', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/99.1-nonexistent';
      if (cmd.includes('status --porcelain')) return '';
      if (cmd.includes('npm test')) return '';
      return '';
    });
    fs.existsSync.mockReturnValue(false);

    const result = flowStatus('/project');
    expect(result.storyId).toBe('99.1');
    expect(result.story).toBeNull();
  });
});

// ── runGitFlow (CLI handler) ─────────────────────────────────────────────────

describe('runGitFlow', () => {
  test('shows help with --help', () => {
    runGitFlow(['--help']);
    expect(console.log).toHaveBeenCalledWith(HELP_TEXT);
  });

  test('shows help with -h', () => {
    runGitFlow(['-h']);
    expect(console.log).toHaveBeenCalledWith(HELP_TEXT);
  });

  test('shows help when no args', () => {
    runGitFlow([]);
    expect(console.log).toHaveBeenCalledWith(HELP_TEXT);
  });

  test('shows help when argv is undefined', () => {
    runGitFlow(undefined);
    expect(console.log).toHaveBeenCalledWith(HELP_TEXT);
  });

  test('handles start subcommand', () => {
    execSync.mockReturnValue('');
    runGitFlow(['start', '3.2']);
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git checkout -b'),
      expect.any(Object)
    );
  });

  test('errors on start without story-id', () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    expect(() => runGitFlow(['start'])).toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Story ID is required'));
    mockExit.mockRestore();
  });

  test('handles finish subcommand', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-auth';
      if (cmd.includes('status --porcelain')) return ' M f.js\n';
      if (cmd.includes('rev-parse --short HEAD')) return 'abc1234';
      return '';
    });
    runGitFlow(['finish']);
    const calls = execSync.mock.calls.map(c => c[0]);
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('git commit'),
    ]));
  });

  test('handles finish with -m flag', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'story/3.2-auth';
      if (cmd.includes('status --porcelain')) return ' M f.js\n';
      if (cmd.includes('rev-parse --short HEAD')) return 'def5678';
      return '';
    });
    runGitFlow(['finish', '-m', 'fix: custom message']);
    const commitCall = execSync.mock.calls.find(c => c[0].includes('git commit'));
    expect(commitCall[0]).toContain('fix: custom message');
  });

  test('handles status subcommand', () => {
    execSync.mockImplementation((cmd) => {
      if (cmd.includes('rev-parse --abbrev-ref')) return 'main';
      if (cmd.includes('status --porcelain')) return '';
      if (cmd.includes('npm test')) return '';
      return '';
    });
    runGitFlow(['status']);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Git Flow Status'));
  });

  test('errors on unknown subcommand', () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    expect(() => runGitFlow(['unknown'])).toThrow('process.exit');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
    mockExit.mockRestore();
  });
});
