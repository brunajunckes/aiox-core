/**
 * Feedback Command Module
 *
 * Structured NPS + free-text feedback collection.
 * Local storage with optional GitHub Discussions submission.
 *
 * @module cli/commands/feedback
 * @version 1.0.0
 * @story 4.3 - Community Feedback Loop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────────────────────

const FEEDBACK_REPO = 'SynkraAI/aiox-core';
const FEEDBACK_CATEGORY = 'Feedback';

/**
 * Resolve feedback directory (evaluated at call time for testability).
 * @returns {string}
 */
function getFeedbackDir() {
  return path.join(process.cwd(), '.aiox', 'feedback');
}

/**
 * Resolve state file path.
 * @returns {string}
 */
function getStateFile() {
  return path.join(getFeedbackDir(), 'state.json');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Ensure .aiox/feedback/ directory exists.
 */
function ensureFeedbackDir() {
  const dir = getFeedbackDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a unique feedback ID.
 * @returns {string} Feedback ID in format fb-{epoch}
 */
function generateId() {
  return `fb-${Date.now()}`;
}

/**
 * Validate NPS score.
 * @param {*} value - Raw input value
 * @returns {{ valid: boolean, score?: number, error?: string }}
 */
function validateNps(value) {
  const trimmed = String(value).trim();
  if (trimmed === '') {
    return { valid: false, error: 'NPS score is required.' };
  }
  const num = Number(trimmed);
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'NPS score must be an integer between 1 and 10.' };
  }
  if (num < 1 || num > 10) {
    return { valid: false, error: 'NPS score must be between 1 and 10.' };
  }
  return { valid: true, score: num };
}

/**
 * Create a readline interface for prompting.
 * @returns {readline.Interface}
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question via readline.
 * @param {readline.Interface} rl
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Save a feedback entry to disk atomically.
 * @param {object} entry - Feedback entry object
 * @returns {string} Path to saved file
 */
function saveFeedback(entry) {
  ensureFeedbackDir();
  const dir = getFeedbackDir();
  const filename = `${entry.timestamp.replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.tmp.${process.pid}`;

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(entry, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Windows fallback: rename fails if target exists
    try { fs.unlinkSync(tmpPath); } catch (_e) { /* ignore */ }
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  }

  return filePath;
}

/**
 * List all feedback entries sorted by timestamp descending.
 * @returns {object[]} Array of feedback entry objects
 */
function listFeedback() {
  ensureFeedbackDir();
  const dir = getFeedbackDir();

  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'state.json');

  const entries = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      entries.push(JSON.parse(content));
    } catch (_e) {
      // Skip malformed files
    }
  }

  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return entries;
}

/**
 * Mark a feedback entry as submitted.
 * @param {string} id - Feedback entry ID
 * @returns {boolean} True if entry was found and updated
 */
function markSubmitted(id) {
  ensureFeedbackDir();
  const dir = getFeedbackDir();

  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'state.json');

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const entry = JSON.parse(content);
      if (entry.id === id) {
        entry.submitted = true;
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
        return true;
      }
    } catch (_e) {
      // Skip malformed files
    }
  }

  return false;
}

/**
 * Load trigger state from state.json.
 * @returns {object}
 */
function loadState() {
  try {
    const stateFile = getStateFile();
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (_e) {
    // Corrupted state, return defaults
  }
  return { firstStoryFeedbackSent: false };
}

/**
 * Save trigger state.
 * @param {object} state
 */
function saveState(state) {
  ensureFeedbackDir();
  fs.writeFileSync(getStateFile(), JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Check if gh CLI is available.
 * @returns {boolean}
 */
function isGhAvailable() {
  try {
    execSync('which gh', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Check if gh CLI is authenticated.
 * @returns {boolean}
 */
function isGhAuthenticated() {
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Submit feedback to GitHub Discussions.
 * @param {object} entry - Feedback entry
 * @returns {{ success: boolean, error?: string, url?: string }}
 */
function submitToGitHub(entry) {
  try {
    // Step 1: Get repository ID
    const repoResult = execSync(
      `gh api graphql -f query='{ repository(owner: "${FEEDBACK_REPO.split('/')[0]}", name: "${FEEDBACK_REPO.split('/')[1]}") { id } }'`,
      { stdio: 'pipe', encoding: 'utf8' },
    );
    const repoData = JSON.parse(repoResult);
    const repoId = repoData.data.repository.id;

    // Step 2: Get discussion category ID
    const catResult = execSync(
      `gh api graphql -f query='{ repository(owner: "${FEEDBACK_REPO.split('/')[0]}", name: "${FEEDBACK_REPO.split('/')[1]}") { discussionCategories(first: 20) { nodes { id name } } } }'`,
      { stdio: 'pipe', encoding: 'utf8' },
    );
    const catData = JSON.parse(catResult);
    const category = catData.data.repository.discussionCategories.nodes
      .find((c) => c.name === FEEDBACK_CATEGORY);

    if (!category) {
      return { success: false, error: `Discussion category "${FEEDBACK_CATEGORY}" not found in ${FEEDBACK_REPO}.` };
    }

    // Step 3: Create discussion
    const title = `Feedback: NPS ${entry.nps}/10 (${entry.trigger})`;
    const body = [
      `## NPS Score: ${entry.nps}/10`,
      '',
      entry.comment ? `### Comment\n${entry.comment}` : '_No comment provided._',
      '',
      `**Trigger:** ${entry.trigger}`,
      `**Date:** ${entry.timestamp}`,
      `**ID:** ${entry.id}`,
    ].join('\n');

    const mutation = `mutation {
      createDiscussion(input: {
        repositoryId: "${repoId}",
        categoryId: "${category.id}",
        title: "${title.replace(/"/g, '\\"')}",
        body: "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
      }) {
        discussion { url }
      }
    }`;

    const createResult = execSync(
      `gh api graphql -f query='${mutation.replace(/'/g, "'\\''")}'`,
      { stdio: 'pipe', encoding: 'utf8' },
    );
    const createData = JSON.parse(createResult);
    const url = createData.data.createDiscussion.discussion.url;

    return { success: true, url };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Unknown error during GitHub submission.',
    };
  }
}

// ── Interactive Prompts ────────────────────────────────────────────────────────

/**
 * Run the interactive feedback prompt.
 * @param {string} [trigger='manual'] - Trigger source
 * @returns {Promise<object|null>} Saved feedback entry or null if cancelled
 */
async function promptFeedback(trigger = 'manual') {
  if (!process.stdin.isTTY) return null;

  const rl = createPrompt();
  let nps = null;

  // NPS prompt with validation loop
  while (nps === null) {
    const input = await ask(rl, 'How likely are you to recommend AIOX? (1-10): ');
    const result = validateNps(input);
    if (result.valid) {
      nps = result.score;
    } else {
      console.log(result.error);
    }
  }

  // Comment prompt
  const comment = await ask(rl, 'Any additional feedback? (optional, press Enter to skip): ');
  rl.close();

  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    nps,
    comment: comment.trim() || '',
    trigger,
    submitted: false,
  };

  saveFeedback(entry);
  console.log('\nFeedback saved locally. Run `aiox feedback submit` to share with the team.');

  return entry;
}

/**
 * Maybe prompt for feedback at a trigger point.
 * Non-blocking: defaults to "no" if user presses Enter.
 * @param {string} trigger - Trigger identifier
 * @returns {Promise<object|null>}
 */
async function maybePromptFeedback(trigger) {
  if (!process.stdin.isTTY) return null;

  // Check trigger state for first-story-only logic
  if (trigger === 'post-first-story') {
    const state = loadState();
    if (state.firstStoryFeedbackSent) return null;
  }

  const rl = createPrompt();
  const answer = await ask(rl, 'Got a minute? Share feedback on your experience [y/N]: ');
  rl.close();

  if (answer.trim().toLowerCase() !== 'y') return null;

  const entry = await promptFeedback(trigger);

  // Update state for first-story trigger
  if (trigger === 'post-first-story' && entry) {
    const state = loadState();
    state.firstStoryFeedbackSent = true;
    saveState(state);
  }

  return entry;
}

// ── Subcommand Handlers ────────────────────────────────────────────────────────

/**
 * Handle `aiox feedback list`.
 */
function handleList() {
  const entries = listFeedback();

  if (entries.length === 0) {
    console.log('No feedback entries found.');
    console.log('Run `aiox feedback` to submit your first feedback.');
    return;
  }

  console.log('Feedback History');
  console.log('─'.repeat(72));

  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 16).replace('T', ' ');
    const submittedTag = entry.submitted ? '(submitted)' : '(not submitted)';
    const commentSnippet = entry.comment
      ? entry.comment.slice(0, 60) + (entry.comment.length > 60 ? '...' : '')
      : '';
    console.log(`  ${date}  NPS: ${entry.nps}  ${entry.trigger}  ${submittedTag}`);
    if (commentSnippet) {
      console.log(`    "${commentSnippet}"`);
    }
  }

  console.log(`\n${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} total.`);
}

/**
 * Handle `aiox feedback submit`.
 */
function handleSubmit() {
  // Check gh CLI availability
  if (!isGhAvailable()) {
    console.error('GitHub CLI not found. Install from https://cli.github.com');
    process.exitCode = 1;
    return;
  }

  // Check gh authentication
  if (!isGhAuthenticated()) {
    console.error('Run `gh auth login` to authenticate, then retry.');
    process.exitCode = 1;
    return;
  }

  // Find most recent unsubmitted entry
  const entries = listFeedback();
  const unsubmitted = entries.find((e) => !e.submitted);

  if (!unsubmitted) {
    console.log('No unsubmitted feedback found.');
    console.log('Run `aiox feedback` to create new feedback first.');
    return;
  }

  console.log(`Submitting feedback: NPS ${unsubmitted.nps}/10 (${unsubmitted.trigger})...`);

  const result = submitToGitHub(unsubmitted);

  if (result.success) {
    markSubmitted(unsubmitted.id);
    console.log(`Feedback submitted successfully!`);
    console.log(`Discussion: ${result.url}`);
  } else {
    console.error(`Failed to submit feedback: ${result.error}`);
    console.error('Feedback remains saved locally. Try again later.');
    process.exitCode = 1;
  }
}

// ── CLI Handler ────────────────────────────────────────────────────────────────

/**
 * Main CLI handler for `aiox feedback [subcommand]`.
 * @param {string[]} argv - Arguments after "feedback"
 */
async function runFeedback(argv = []) {
  const subcommand = argv[0];

  switch (subcommand) {
    case 'list':
      handleList();
      break;

    case 'submit':
      handleSubmit();
      break;

    case '--help':
    case '-h':
      console.log(`
AIOX Feedback — Community Feedback Loop

USAGE:
  aiox feedback              Interactive NPS + comment prompt
  aiox feedback list         Show all local feedback entries
  aiox feedback submit       Post most recent unsent feedback to GitHub Discussions
  aiox feedback --help       Show this help

STORAGE:
  Feedback is stored locally in .aiox/feedback/ as JSON files.
  No data leaves your machine unless you explicitly run 'submit'.

GITHUB DISCUSSIONS:
  The 'submit' command requires the GitHub CLI (gh) to be installed
  and authenticated. Install: https://cli.github.com
`);
      break;

    default:
      // Default: interactive prompt
      await promptFeedback('manual');
      break;
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  runFeedback,
  saveFeedback,
  listFeedback,
  markSubmitted,
  promptFeedback,
  maybePromptFeedback,
  validateNps,
  loadState,
  saveState,
  isGhAvailable,
  isGhAuthenticated,
  submitToGitHub,
  handleList,
  handleSubmit,
  // Path helpers (for testing)
  getFeedbackDir,
  getStateFile,
  FEEDBACK_REPO,
  FEEDBACK_CATEGORY,
};
