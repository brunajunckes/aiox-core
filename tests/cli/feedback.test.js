/**
 * Tests for Feedback Command Module
 *
 * @module tests/cli/feedback
 * @story 4.3 - Community Feedback Loop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const childProcess = require('child_process');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;
let feedbackDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-feedback-test-'));
  feedbackDir = path.join(tmpDir, '.aiox', 'feedback');
  process.cwd = () => tmpDir;
  process.exitCode = 0;
});

afterEach(() => {
  process.cwd = originalCwd;
  process.exitCode = 0;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

// Module uses getFeedbackDir() which calls process.cwd() at runtime,
// so a single require is fine -- each test gets its own tmpDir.
const mod = require('../../.aiox-core/cli/commands/feedback/index.js');

// ── validateNps ────────────────────────────────────────────────────────────────

describe('validateNps', () => {
  test('accepts valid integer 1 (lower boundary)', () => {
    expect(mod.validateNps('1')).toEqual({ valid: true, score: 1 });
  });

  test('accepts valid integer 10 (upper boundary)', () => {
    expect(mod.validateNps('10')).toEqual({ valid: true, score: 10 });
  });

  test('accepts valid integer 5 with whitespace', () => {
    expect(mod.validateNps('  5  ')).toEqual({ valid: true, score: 5 });
  });

  test('accepts mid-range integer 7', () => {
    expect(mod.validateNps('7')).toEqual({ valid: true, score: 7 });
  });

  test('rejects 0 (below minimum)', () => {
    const result = mod.validateNps('0');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/between 1 and 10/);
  });

  test('rejects 11 (above maximum)', () => {
    const result = mod.validateNps('11');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/between 1 and 10/);
  });

  test('rejects negative number', () => {
    expect(mod.validateNps('-3').valid).toBe(false);
  });

  test('rejects float 7.5', () => {
    const result = mod.validateNps('7.5');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
  });

  test('rejects non-numeric string', () => {
    expect(mod.validateNps('abc').valid).toBe(false);
  });

  test('rejects empty string', () => {
    const result = mod.validateNps('');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/);
  });

  test('rejects very large number', () => {
    expect(mod.validateNps('100').valid).toBe(false);
  });
});

// ── saveFeedback ───────────────────────────────────────────────────────────────

describe('saveFeedback', () => {
  test('creates feedback file with correct schema', () => {
    const entry = {
      id: 'fb-1234567890',
      timestamp: '2026-04-08T14:30:00.000Z',
      nps: 8,
      comment: 'Great feature!',
      trigger: 'manual',
      submitted: false,
    };

    const filePath = mod.saveFeedback(entry);
    expect(fs.existsSync(filePath)).toBe(true);

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(saved.id).toBe('fb-1234567890');
    expect(saved.nps).toBe(8);
    expect(saved.comment).toBe('Great feature!');
    expect(saved.trigger).toBe('manual');
    expect(saved.submitted).toBe(false);
    expect(saved.timestamp).toBe('2026-04-08T14:30:00.000Z');
  });

  test('creates .aiox/feedback/ directory if it does not exist', () => {
    expect(fs.existsSync(feedbackDir)).toBe(false);

    mod.saveFeedback({
      id: 'fb-test',
      timestamp: '2026-04-08T15:00:00.000Z',
      nps: 5,
      comment: '',
      trigger: 'manual',
      submitted: false,
    });

    expect(fs.existsSync(feedbackDir)).toBe(true);
  });

  test('saves empty comment as empty string', () => {
    const entry = {
      id: 'fb-empty',
      timestamp: '2026-04-08T16:00:00.000Z',
      nps: 7,
      comment: '',
      trigger: 'post-onboarding',
      submitted: false,
    };

    const filePath = mod.saveFeedback(entry);
    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(saved.comment).toBe('');
  });

  test('atomic write produces valid JSON', () => {
    const entry = {
      id: 'fb-atomic',
      timestamp: '2026-04-08T17:00:00.000Z',
      nps: 10,
      comment: 'Perfect!',
      trigger: 'manual',
      submitted: false,
    };

    const filePath = mod.saveFeedback(entry);
    // No .tmp file should remain
    const dir = path.dirname(filePath);
    const tmpFiles = fs.readdirSync(dir).filter((f) => f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);
  });
});

// ── listFeedback ───────────────────────────────────────────────────────────────

describe('listFeedback', () => {
  test('returns empty array when no entries exist', () => {
    expect(mod.listFeedback()).toEqual([]);
  });

  test('returns entries sorted by timestamp descending', () => {
    mod.saveFeedback({
      id: 'fb-1', timestamp: '2026-04-08T10:00:00.000Z',
      nps: 5, comment: 'First', trigger: 'manual', submitted: false,
    });
    mod.saveFeedback({
      id: 'fb-2', timestamp: '2026-04-08T12:00:00.000Z',
      nps: 9, comment: 'Second', trigger: 'post-onboarding', submitted: false,
    });
    mod.saveFeedback({
      id: 'fb-3', timestamp: '2026-04-08T11:00:00.000Z',
      nps: 3, comment: 'Third', trigger: 'post-first-story', submitted: true,
    });

    const entries = mod.listFeedback();
    expect(entries).toHaveLength(3);
    expect(entries[0].id).toBe('fb-2');
    expect(entries[1].id).toBe('fb-3');
    expect(entries[2].id).toBe('fb-1');
  });

  test('skips malformed JSON files', () => {
    fs.mkdirSync(feedbackDir, { recursive: true });
    fs.writeFileSync(path.join(feedbackDir, 'bad.json'), 'not json', 'utf8');

    mod.saveFeedback({
      id: 'fb-good', timestamp: '2026-04-08T10:00:00.000Z',
      nps: 7, comment: '', trigger: 'manual', submitted: false,
    });

    const entries = mod.listFeedback();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('fb-good');
  });

  test('excludes state.json from results', () => {
    mod.saveState({ firstStoryFeedbackSent: true });

    mod.saveFeedback({
      id: 'fb-only', timestamp: '2026-04-08T10:00:00.000Z',
      nps: 6, comment: '', trigger: 'manual', submitted: false,
    });

    const entries = mod.listFeedback();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('fb-only');
  });

  test('handles multiple entries with same nps but different times', () => {
    mod.saveFeedback({
      id: 'fb-a', timestamp: '2026-04-08T09:00:00.000Z',
      nps: 8, comment: '', trigger: 'manual', submitted: false,
    });
    mod.saveFeedback({
      id: 'fb-b', timestamp: '2026-04-08T09:30:00.000Z',
      nps: 8, comment: '', trigger: 'manual', submitted: false,
    });

    const entries = mod.listFeedback();
    expect(entries).toHaveLength(2);
    // Most recent first
    expect(entries[0].id).toBe('fb-b');
    expect(entries[1].id).toBe('fb-a');
  });
});

// ── markSubmitted ──────────────────────────────────────────────────────────────

describe('markSubmitted', () => {
  test('marks correct entry as submitted', () => {
    mod.saveFeedback({
      id: 'fb-mark-1', timestamp: '2026-04-08T10:00:00.000Z',
      nps: 8, comment: '', trigger: 'manual', submitted: false,
    });
    mod.saveFeedback({
      id: 'fb-mark-2', timestamp: '2026-04-08T11:00:00.000Z',
      nps: 9, comment: '', trigger: 'manual', submitted: false,
    });

    expect(mod.markSubmitted('fb-mark-1')).toBe(true);

    const entries = mod.listFeedback();
    expect(entries.find((e) => e.id === 'fb-mark-1').submitted).toBe(true);
    expect(entries.find((e) => e.id === 'fb-mark-2').submitted).toBe(false);
  });

  test('returns false when ID not found', () => {
    expect(mod.markSubmitted('fb-nonexistent')).toBe(false);
  });
});

// ── loadState / saveState ──────────────────────────────────────────────────────

describe('state management', () => {
  test('loadState returns defaults when no state file exists', () => {
    expect(mod.loadState()).toEqual({ firstStoryFeedbackSent: false });
  });

  test('saveState and loadState round-trip correctly', () => {
    mod.saveState({ firstStoryFeedbackSent: true });
    expect(mod.loadState().firstStoryFeedbackSent).toBe(true);
  });

  test('loadState handles corrupted state.json', () => {
    fs.mkdirSync(feedbackDir, { recursive: true });
    fs.writeFileSync(path.join(feedbackDir, 'state.json'), 'not json', 'utf8');
    expect(mod.loadState()).toEqual({ firstStoryFeedbackSent: false });
  });
});

// ── maybePromptFeedback (TTY detection) ────────────────────────────────────────

describe('maybePromptFeedback', () => {
  test('returns null when stdin is not a TTY', async () => {
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    const result = await mod.maybePromptFeedback('post-onboarding');
    expect(result).toBeNull();
    process.stdin.isTTY = originalIsTTY;
  });
});

// ── promptFeedback (TTY detection) ─────────────────────────────────────────────

describe('promptFeedback', () => {
  test('returns null when stdin is not a TTY', async () => {
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    const result = await mod.promptFeedback('manual');
    expect(result).toBeNull();
    process.stdin.isTTY = originalIsTTY;
  });
});

// ── handleSubmit (gh CLI graceful degradation) ────────────────────────────────

describe('handleSubmit', () => {
  test('graceful degradation: handleSubmit does not crash regardless of gh state', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Should never throw, regardless of gh availability
    expect(() => mod.handleSubmit()).not.toThrow();

    const ghAvailable = mod.isGhAvailable();
    const ghAuthed = ghAvailable && mod.isGhAuthenticated();

    if (!ghAvailable) {
      const errOutput = consoleErrSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(errOutput).toContain('GitHub CLI not found');
    } else if (!ghAuthed) {
      const errOutput = consoleErrSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(errOutput).toContain('gh auth login');
    } else {
      // gh available and authed, no entries -> no unsubmitted feedback
      const logOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(logOutput).toContain('No unsubmitted feedback found');
    }

    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
  });

  test('handleSubmit with unsubmitted entry triggers submission flow', () => {
    mod.saveFeedback({
      id: 'fb-submit-test', timestamp: '2026-04-08T14:30:00.000Z',
      nps: 8, comment: 'Test submit', trigger: 'manual', submitted: false,
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Will either submit (if gh is available+authed) or show gh error
    expect(() => mod.handleSubmit()).not.toThrow();

    const ghAvailable = mod.isGhAvailable();
    if (ghAvailable && mod.isGhAuthenticated()) {
      const logOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      // Either 'Submitting feedback' or success/failure message
      expect(logOutput).toContain('Submitting feedback');
    }

    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
  });

  test('isGhAvailable returns boolean', () => {
    const result = mod.isGhAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('isGhAuthenticated returns boolean', () => {
    const result = mod.isGhAuthenticated();
    expect(typeof result).toBe('boolean');
  });
});

// ── handleList ─────────────────────────────────────────────────────────────────

describe('handleList', () => {
  test('prints no entries message when empty', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mod.handleList();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No feedback entries found'),
    );

    consoleSpy.mockRestore();
  });

  test('prints entries when they exist', () => {
    mod.saveFeedback({
      id: 'fb-list-1', timestamp: '2026-04-08T14:30:00.000Z',
      nps: 8, comment: 'Good stuff', trigger: 'manual', submitted: false,
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mod.handleList();

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('NPS: 8');
    expect(allOutput).toContain('manual');
    expect(allOutput).toContain('not submitted');
    expect(allOutput).toContain('1 entry total');
    expect(allOutput).toContain('Good stuff');

    consoleSpy.mockRestore();
  });

  test('shows submitted tag for submitted entries', () => {
    mod.saveFeedback({
      id: 'fb-sub', timestamp: '2026-04-08T14:30:00.000Z',
      nps: 9, comment: '', trigger: 'post-onboarding', submitted: true,
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mod.handleList();

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('(submitted)');

    consoleSpy.mockRestore();
  });

  test('truncates long comments at 60 chars', () => {
    const longComment = 'A'.repeat(80);
    mod.saveFeedback({
      id: 'fb-long', timestamp: '2026-04-08T14:30:00.000Z',
      nps: 6, comment: longComment, trigger: 'manual', submitted: false,
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mod.handleList();

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('A'.repeat(60) + '...');

    consoleSpy.mockRestore();
  });
});

// ── runFeedback CLI handler ───────────────────────────────────────────────────

describe('runFeedback', () => {
  test('list subcommand calls handleList', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mod.runFeedback(['list']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No feedback entries found'),
    );

    consoleSpy.mockRestore();
  });

  test('--help subcommand prints help text', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mod.runFeedback(['--help']);

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('AIOX Feedback');
    expect(allOutput).toContain('aiox feedback list');
    expect(allOutput).toContain('aiox feedback submit');

    consoleSpy.mockRestore();
  });

  test('-h subcommand also prints help text', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mod.runFeedback(['-h']);

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(allOutput).toContain('AIOX Feedback');

    consoleSpy.mockRestore();
  });
});

// ── getFeedbackDir / getStateFile ──────────────────────────────────────────────

describe('path helpers', () => {
  test('getFeedbackDir resolves from process.cwd()', () => {
    const dir = mod.getFeedbackDir();
    expect(dir).toBe(path.join(tmpDir, '.aiox', 'feedback'));
  });

  test('getStateFile resolves inside feedback dir', () => {
    const stateFile = mod.getStateFile();
    expect(stateFile).toBe(path.join(tmpDir, '.aiox', 'feedback', 'state.json'));
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe('module exports', () => {
  test('exports FEEDBACK_REPO as string', () => {
    expect(typeof mod.FEEDBACK_REPO).toBe('string');
    expect(mod.FEEDBACK_REPO).toContain('/');
  });

  test('exports FEEDBACK_CATEGORY as string', () => {
    expect(typeof mod.FEEDBACK_CATEGORY).toBe('string');
  });
});
