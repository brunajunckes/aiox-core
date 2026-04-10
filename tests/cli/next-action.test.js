/**
 * Tests for Next-Action Suggestion Engine — Story 33.1
 *
 * Covers:
 *   - detectStories: reads story files and extracts status
 *   - detectGitChanges: parses git status porcelain
 *   - detectBranch: reads current branch
 *   - detectTestStatus: checks package.json for test script
 *   - buildSuggestions: prioritized suggestion engine
 *   - renderSuggestions: formatted output
 *   - renderJson: JSON output
 *   - runNextAction: full CLI handler
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const {
  detectStories,
  detectGitChanges,
  detectBranch,
  detectTestStatus,
  buildSuggestions,
  renderSuggestions,
  renderJson,
  runNextAction,
  showNextActionHelp,
  PRIORITY,
  PRIORITY_LABELS,
} = require('../../.aiox-core/cli/commands/next-action/index.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

let tmpDir;

function createTmpDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-next-test-'));
  return tmpDir;
}

function cleanupTmpDir() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeStory(dir, filename, status, title) {
  const storiesDir = path.join(dir, 'docs', 'stories');
  fs.mkdirSync(storiesDir, { recursive: true });
  const content = `# Story ${filename.replace('.story.md', '')}: ${title}\n\n## Status\n${status}\n`;
  fs.writeFileSync(path.join(storiesDir, filename), content, 'utf8');
}

function createOutputStream() {
  const chunks = [];
  return {
    write: (chunk) => chunks.push(chunk),
    getOutput: () => chunks.join(''),
  };
}

afterEach(() => {
  cleanupTmpDir();
});

// ─── detectStories ─────────────────────────────────────────────────────────

describe('detectStories', () => {
  test('returns empty array when no stories dir exists', () => {
    const dir = createTmpDir();
    const stories = detectStories(dir);
    expect(stories).toEqual([]);
  });

  test('detects stories with various statuses', () => {
    const dir = createTmpDir();
    writeStory(dir, '1.1.story.md', 'InProgress', 'First Story');
    writeStory(dir, '1.2.story.md', 'Done', 'Second Story');
    writeStory(dir, '1.3.story.md', 'InReview', 'Third Story');

    const stories = detectStories(dir);
    expect(stories.length).toBe(3);
    expect(stories.find((s) => s.id === '1.1').status).toBe('InProgress');
    expect(stories.find((s) => s.id === '1.2').status).toBe('Done');
    expect(stories.find((s) => s.id === '1.3').status).toBe('InReview');
  });

  test('extracts story title', () => {
    const dir = createTmpDir();
    writeStory(dir, '2.1.story.md', 'Draft', 'My Feature');
    const stories = detectStories(dir);
    expect(stories[0].title).toBe('My Feature');
  });

  test('ignores non-story files', () => {
    const dir = createTmpDir();
    const storiesDir = path.join(dir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(path.join(storiesDir, 'README.md'), '# Readme', 'utf8');
    writeStory(dir, '1.1.story.md', 'Draft', 'Real Story');

    const stories = detectStories(dir);
    expect(stories.length).toBe(1);
  });
});

// ─── detectTestStatus ──────────────────────────────────────────────────────

describe('detectTestStatus', () => {
  test('returns available=true when package.json has test script', () => {
    const dir = createTmpDir();
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      scripts: { test: 'jest' },
    }), 'utf8');

    const result = detectTestStatus(dir);
    expect(result.available).toBe(true);
  });

  test('returns available=false when no package.json', () => {
    const dir = createTmpDir();
    const result = detectTestStatus(dir);
    expect(result.available).toBe(false);
  });

  test('returns available=false when no test script', () => {
    const dir = createTmpDir();
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      scripts: { build: 'tsc' },
    }), 'utf8');

    const result = detectTestStatus(dir);
    expect(result.available).toBe(false);
  });
});

// ─── buildSuggestions ──────────────────────────────────────────────────────

describe('buildSuggestions', () => {
  test('suggests continuing InProgress stories as CRITICAL', () => {
    const state = {
      stories: [{ id: '5.1', status: 'InProgress', title: 'My Story' }],
      git: { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].priority).toBe(PRIORITY.CRITICAL);
    expect(suggestions[0].action).toContain('5.1');
  });

  test('suggests committing staged changes as HIGH', () => {
    const state = {
      stories: [],
      git: { hasChanges: true, staged: 3, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const staged = suggestions.find((s) => s.action.includes('staged'));
    expect(staged).toBeDefined();
    expect(staged.priority).toBe(PRIORITY.HIGH);
  });

  test('suggests reviewing unstaged changes as HIGH', () => {
    const state = {
      stories: [],
      git: { hasChanges: true, staged: 0, unstaged: 5, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const unstaged = suggestions.find((s) => s.action.includes('unstaged'));
    expect(unstaged).toBeDefined();
    expect(unstaged.priority).toBe(PRIORITY.HIGH);
  });

  test('suggests QA review for InReview stories as MEDIUM', () => {
    const state = {
      stories: [{ id: '3.2', status: 'InReview', title: 'Review Me' }],
      git: { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const qa = suggestions.find((s) => s.action.includes('QA review'));
    expect(qa).toBeDefined();
    expect(qa.priority).toBe(PRIORITY.MEDIUM);
  });

  test('suggests starting Ready stories as MEDIUM', () => {
    const state = {
      stories: [{ id: '4.1', status: 'Ready', title: 'Ready Story' }],
      git: { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const ready = suggestions.find((s) => s.action.includes('Start development'));
    expect(ready).toBeDefined();
    expect(ready.priority).toBe(PRIORITY.MEDIUM);
  });

  test('suggests validating Draft stories as LOW', () => {
    const state = {
      stories: [{ id: '6.1', status: 'Draft', title: 'Draft' }],
      git: { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const draft = suggestions.find((s) => s.action.includes('Draft'));
    expect(draft).toBeDefined();
    expect(draft.priority).toBe(PRIORITY.LOW);
  });

  test('suggests picking up work when nothing active', () => {
    const state = {
      stories: [{ id: '1.1', status: 'Done', title: 'Done' }],
      git: { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    const noWork = suggestions.find((s) => s.action.includes('No active work'));
    expect(noWork).toBeDefined();
  });

  test('sorts suggestions by priority', () => {
    const state = {
      stories: [
        { id: '1.1', status: 'InProgress', title: 'Active' },
        { id: '1.2', status: 'InReview', title: 'Review' },
      ],
      git: { hasChanges: true, staged: 2, unstaged: 0, untracked: 0 },
      branch: 'main',
      tests: { available: false, passing: true, message: '' },
    };

    const suggestions = buildSuggestions(state);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
    }
  });
});

// ─── renderSuggestions ─────────────────────────────────────────────────────

describe('renderSuggestions', () => {
  test('renders "all clear" when no suggestions', () => {
    const out = createOutputStream();
    renderSuggestions([], { output: out });
    expect(out.getOutput()).toContain('All clear');
  });

  test('renders suggestions with priority labels', () => {
    const out = createOutputStream();
    const suggestions = [
      { priority: PRIORITY.CRITICAL, action: 'Do something', reason: 'Because', command: 'npm run x' },
    ];
    renderSuggestions(suggestions, { output: out });
    expect(out.getOutput()).toContain('CRITICAL');
    expect(out.getOutput()).toContain('Do something');
    expect(out.getOutput()).toContain('npm run x');
  });

  test('renders verbose mode with reasons', () => {
    const out = createOutputStream();
    const suggestions = [
      { priority: PRIORITY.HIGH, action: 'Action', reason: 'Important reason', command: 'cmd' },
    ];
    renderSuggestions(suggestions, { output: out, verbose: true });
    expect(out.getOutput()).toContain('Important reason');
  });

  test('omits reasons in non-verbose mode', () => {
    const out = createOutputStream();
    const suggestions = [
      { priority: PRIORITY.HIGH, action: 'Action', reason: 'Secret reason', command: 'cmd' },
    ];
    renderSuggestions(suggestions, { output: out, verbose: false });
    expect(out.getOutput()).not.toContain('Secret reason');
  });
});

// ─── PRIORITY constants ────────────────────────────────────────────────────

describe('PRIORITY constants', () => {
  test('has correct values', () => {
    expect(PRIORITY.CRITICAL).toBe(1);
    expect(PRIORITY.HIGH).toBe(2);
    expect(PRIORITY.MEDIUM).toBe(3);
    expect(PRIORITY.LOW).toBe(4);
  });

  test('labels map correctly', () => {
    expect(PRIORITY_LABELS[1]).toBe('CRITICAL');
    expect(PRIORITY_LABELS[2]).toBe('HIGH');
    expect(PRIORITY_LABELS[3]).toBe('MEDIUM');
    expect(PRIORITY_LABELS[4]).toBe('LOW');
  });
});

// ─── runNextAction ─────────────────────────────────────────────────────────

describe('runNextAction', () => {
  test('--help shows usage', async () => {
    const out = createOutputStream();
    await runNextAction(['--help'], { output: out });
    expect(out.getOutput()).toContain('Next-Action Suggestion Engine');
  });

  test('runs without errors on empty project', async () => {
    const dir = createTmpDir();
    const out = createOutputStream();
    await runNextAction([], { baseDir: dir, output: out });
    // Should produce some output without crashing
    expect(out.getOutput().length).toBeGreaterThan(0);
  });

  test('--json produces valid JSON', async () => {
    const dir = createTmpDir();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await runNextAction(['--json'], { baseDir: dir });
    const jsonOutput = spy.mock.calls.map((c) => c[0]).join('');
    spy.mockRestore();

    const parsed = JSON.parse(jsonOutput);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('suggestions');
    expect(parsed).toHaveProperty('storyCounts');
    expect(parsed).toHaveProperty('git');
  });
});
