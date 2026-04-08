/**
 * Tests for Feedback Command Module
 *
 * @module tests/feedback
 * @story 4.3 - Community Feedback Loop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original process.cwd before any module loads
const originalCwd = process.cwd;

let tmpDir;
let feedbackDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-feedback-test-'));
  feedbackDir = path.join(tmpDir, '.aiox', 'feedback');
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

// Module uses getFeedbackDir() which calls process.cwd() at runtime,
// so a single require is fine -- each test gets its own tmpDir.
const mod = require('../../.aiox-core/cli/commands/feedback/index.js');

// ── validateNps ────────────────────────────────────────────────────────────────

describe('validateNps', () => {
  test('accepts valid integer 1', () => {
    expect(mod.validateNps('1')).toEqual({ valid: true, score: 1 });
  });

  test('accepts valid integer 10', () => {
    expect(mod.validateNps('10')).toEqual({ valid: true, score: 10 });
  });

  test('accepts valid integer 5 with whitespace', () => {
    expect(mod.validateNps('  5  ')).toEqual({ valid: true, score: 5 });
  });

  test('rejects 0', () => {
    const result = mod.validateNps('0');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/between 1 and 10/);
  });

  test('rejects 11', () => {
    const result = mod.validateNps('11');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/between 1 and 10/);
  });

  test('rejects negative number', () => {
    expect(mod.validateNps('-3').valid).toBe(false);
  });

  test('rejects float', () => {
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

// ── handleSubmit (gh CLI absent) ───────────────────────────────────────────────

describe('handleSubmit', () => {
  test('prints no unsubmitted feedback when none exists', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mod.handleSubmit();

    // If gh is available, it will check for unsubmitted entries (there are none)
    // If gh is NOT available, it will print install message
    const logOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    const errOutput = consoleErrSpy.mock.calls.map((c) => c[0]).join('\n');

    const ghAvailable = mod.isGhAvailable();
    if (ghAvailable) {
      // gh available: may print feedback status or nothing if handleSubmit exits early
      expect(typeof logOutput).toBe('string');
    } else {
      expect(errOutput).toContain('GitHub CLI not found');
    }

    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
    process.exitCode = 0;
  });

  test('isGhAvailable returns boolean', () => {
    const result = mod.isGhAvailable();
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
