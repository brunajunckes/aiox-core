/**
 * Tests for Session State Persistence — Story 3.3
 *
 * Covers:
 *   - readSessionState / writeSessionState round-trip
 *   - Atomic write (tmp file cleanup)
 *   - Corrupt JSON handling
 *   - formatSessionSummary
 *   - suggestNextAction
 *   - runResume with no state / valid state
 *   - runStatus output
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// We test against the real filesystem using a temp directory
let tmpDir;
let originalCwd;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-session-test-'));
  originalCwd = process.cwd();
  process.chdir(tmpDir);

  // Create .aiox directory
  fs.mkdirSync(path.join(tmpDir, '.aiox'), { recursive: true });
});

afterEach(() => {
  process.chdir(originalCwd);
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {
    // Ignore cleanup errors on Windows
  }
});

// Re-require the module after chdir so STATE_FILE uses the new cwd
function loadModule() {
  // Clear require cache to pick up new cwd
  const modulePath = require.resolve('../../.aiox-core/cli/commands/session/index.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

describe('readSessionState', () => {
  test('returns null when file does not exist', () => {
    const { readSessionState } = loadModule();
    // Ensure the file does NOT exist at cwd-based path
    const statePath = path.join(tmpDir, '.aiox', 'session-state.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
    expect(readSessionState()).toBeNull();
  });

  test('returns null for empty file', () => {
    const { readSessionState } = loadModule();
    fs.writeFileSync(path.join(tmpDir, '.aiox', 'session-state.json'), '', 'utf8');
    expect(readSessionState()).toBeNull();
  });

  test('returns null for corrupt JSON', () => {
    const { readSessionState } = loadModule();
    fs.writeFileSync(path.join(tmpDir, '.aiox', 'session-state.json'), '{not valid json!!!', 'utf8');
    expect(readSessionState()).toBeNull();
  });

  test('returns null for JSON array (not an object)', () => {
    const { readSessionState } = loadModule();
    fs.writeFileSync(path.join(tmpDir, '.aiox', 'session-state.json'), '[1,2,3]', 'utf8');
    expect(readSessionState()).toBeNull();
  });

  test('returns parsed object for valid JSON', () => {
    const { readSessionState } = loadModule();
    const state = { activeStoryId: '3.1', activeAgent: 'dev' };
    fs.writeFileSync(
      path.join(tmpDir, '.aiox', 'session-state.json'),
      JSON.stringify(state),
      'utf8'
    );
    expect(readSessionState()).toEqual(state);
  });
});

describe('writeSessionState', () => {
  test('writes state and reads it back identically (round-trip)', () => {
    const { readSessionState, writeSessionState } = loadModule();
    const state = {
      activeStoryId: '3.1',
      activeStoryPath: 'docs/stories/3.1.story.md',
      activeAgent: 'dev',
      gitBranch: 'story/3.1-agent-discovery',
      lastActionTimestamp: '2026-04-08T14:30:00.000Z',
      workflowPosition: 'InProgress',
    };
    writeSessionState(state);
    expect(readSessionState()).toEqual(state);
  });

  test('atomic write: no .tmp file remains after successful write', () => {
    const { writeSessionState } = loadModule();
    writeSessionState({ activeStoryId: '1.0' });
    const tmpPath = path.join(tmpDir, '.aiox', 'session-state.json.tmp');
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  test('creates .aiox directory if missing', () => {
    // Remove .aiox dir
    fs.rmSync(path.join(tmpDir, '.aiox'), { recursive: true, force: true });
    const { writeSessionState } = loadModule();
    writeSessionState({ activeStoryId: '1.0' });
    expect(fs.existsSync(path.join(tmpDir, '.aiox', 'session-state.json'))).toBe(true);
  });

  test('throws for null state', () => {
    const { writeSessionState } = loadModule();
    expect(() => writeSessionState(null)).toThrow('state must be a non-null object');
  });

  test('throws for non-object state', () => {
    const { writeSessionState } = loadModule();
    expect(() => writeSessionState('string')).toThrow('state must be a non-null object');
  });
});

describe('formatSessionSummary', () => {
  test('returns fallback text for null state', () => {
    const { formatSessionSummary } = loadModule();
    expect(formatSessionSummary(null)).toBe('No session data available.');
  });

  test('includes story ID, agent, branch, position', () => {
    const { formatSessionSummary } = loadModule();
    const state = {
      activeStoryId: '3.1',
      activeAgent: 'dev',
      gitBranch: 'main',
      workflowPosition: 'InProgress',
      lastActionTimestamp: new Date().toISOString(),
    };
    const output = formatSessionSummary(state);
    expect(output).toContain('3.1');
    expect(output).toContain('@dev');
    expect(output).toContain('main');
    expect(output).toContain('InProgress');
  });
});

describe('formatTimeAgo', () => {
  test('returns "just now" for timestamps less than a minute ago', () => {
    const { formatTimeAgo } = loadModule();
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('just now');
  });

  test('returns "unknown" for null', () => {
    const { formatTimeAgo } = loadModule();
    expect(formatTimeAgo(null)).toBe('unknown');
  });

  test('returns minutes ago for recent timestamps', () => {
    const { formatTimeAgo } = loadModule();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('5 minutes ago');
  });

  test('returns hours ago', () => {
    const { formatTimeAgo } = loadModule();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe('2 hours ago');
  });

  test('returns days ago', () => {
    const { formatTimeAgo } = loadModule();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeDaysAgo)).toBe('3 days ago');
  });
});

describe('suggestNextAction', () => {
  test('Draft -> suggest po validate', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'Draft' });
    expect(result).toContain('Draft');
    expect(result).toContain('@po');
  });

  test('Ready -> suggest dev', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'Ready' });
    expect(result).toContain('Ready');
    expect(result).toContain('aiox dev');
  });

  test('InProgress -> suggest continue dev with story ID', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'InProgress', activeStoryId: '3.1' });
    expect(result).toContain('InProgress');
    expect(result).toContain('3.1');
  });

  test('InReview -> suggest qa', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'InReview' });
    expect(result).toContain('QA');
  });

  test('Done -> suggest create next story', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'Done' });
    expect(result).toContain('Done');
    expect(result).toContain('create-story');
  });

  test('null state -> fallback suggestion', () => {
    const { suggestNextAction } = loadModule();
    expect(suggestNextAction(null)).toContain('aiox agents');
  });

  test('unknown position -> fallback', () => {
    const { suggestNextAction } = loadModule();
    const result = suggestNextAction({ workflowPosition: 'Bogus' });
    expect(result).toContain('Unknown');
  });
});

describe('runResume', () => {
  test('prints helpful message when no state file', async () => {
    const { runResume } = loadModule();
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await runResume();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('No saved session found');
  });

  test('prints summary and suggestion for valid state', async () => {
    const { runResume, writeSessionState } = loadModule();
    writeSessionState({
      activeStoryId: '3.1',
      activeStoryPath: 'docs/stories/3.1.story.md',
      activeAgent: 'dev',
      gitBranch: 'main',
      lastActionTimestamp: new Date().toISOString(),
      workflowPosition: 'InProgress',
    });

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await runResume();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('3.1');
    expect(output).toContain('@dev');
    expect(output).toContain('InProgress');
    expect(output).toContain('Suggested');
  });
});

describe('runStatus', () => {
  test('includes session section with "No active session" when no state', async () => {
    const { runStatus } = loadModule();
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await runStatus();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('AIOX Status');
    expect(output).toContain('Session');
    expect(output).toContain('No active session');
  });

  test('includes session data when state exists', async () => {
    const { runStatus, writeSessionState } = loadModule();
    writeSessionState({
      activeStoryId: '2.1',
      activeAgent: 'qa',
      gitBranch: 'main',
      lastActionTimestamp: new Date().toISOString(),
      workflowPosition: 'InReview',
    });

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await runStatus();
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('AIOX Status');
    expect(output).toContain('2.1');
    expect(output).toContain('@qa');
    expect(output).toContain('InReview');
  });
});
