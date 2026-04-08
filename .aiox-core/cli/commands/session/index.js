/**
 * Session State Persistence & CLI Commands
 *
 * Story 3.3: Enhanced Session Persistence
 * Provides cross-session state carry-over via `.aiox/session-state.json`.
 *
 * Functions:
 *   readSessionState()      — reads and parses state file; returns null on missing/corrupt
 *   writeSessionState(state) — atomic write (write .tmp then rename)
 *   formatSessionSummary(state) — format state as readable CLI text
 *   suggestNextAction(state)  — suggest next action based on workflowPosition
 *   runResume()              — CLI handler for `aiox resume`
 *   runStatus()              — CLI handler for `aiox status`
 *
 * @module cli/commands/session
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Resolve paths at call time so they respect the current working directory.
 */
function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getStateFile() {
  return path.join(getAioxDir(), 'session-state.json');
}

/**
 * Read and parse session state from disk.
 * Returns null if the file is missing, empty, or contains invalid JSON.
 *
 * @returns {object|null} Parsed session state or null
 */
function readSessionState() {
  try {
    const stateFile = getStateFile();
    if (!fs.existsSync(stateFile)) {
      return null;
    }
    const raw = fs.readFileSync(stateFile, 'utf8');
    if (!raw || !raw.trim()) {
      return null;
    }
    const state = JSON.parse(raw);
    // Validate it has at least the expected shape
    if (typeof state !== 'object' || state === null || Array.isArray(state)) {
      return null;
    }
    return state;
  } catch (error) {
    // Corrupt JSON or filesystem error — return null gracefully
    return null;
  }
}

/**
 * Atomically write session state to disk.
 * Uses write-to-temp-then-rename pattern to prevent corruption on crash.
 * Auto-creates `.aiox/` directory if missing.
 *
 * @param {object} state - Session state object to persist
 * @throws {Error} If write or rename fails
 */
function writeSessionState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('writeSessionState: state must be a non-null object');
  }

  const aioxDir = getAioxDir();
  const stateFile = getStateFile();

  // Ensure .aiox/ directory exists
  if (!fs.existsSync(aioxDir)) {
    fs.mkdirSync(aioxDir, { recursive: true });
  }

  const tmpPath = stateFile + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, stateFile);
  } catch (error) {
    // Clean up tmp file if rename failed
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch (_) {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to write session state: ${error.message}`);
  }
}

/**
 * Format a human-readable time-ago string from an ISO timestamp.
 *
 * @param {string} isoTimestamp - ISO 8601 timestamp
 * @returns {string} Human-readable relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(isoTimestamp) {
  if (!isoTimestamp) return 'unknown';
  try {
    const then = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now - then;
    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch (_) {
    return 'unknown';
  }
}

/**
 * Format session state as a structured CLI summary.
 *
 * @param {object} state - Session state object
 * @returns {string} Formatted multi-line summary
 */
function formatSessionSummary(state) {
  if (!state) return 'No session data available.';

  const storyId = state.activeStoryId || 'none';
  const storyPath = state.activeStoryPath || '';
  const agent = state.activeAgent ? `@${state.activeAgent}` : 'none';
  const branch = state.gitBranch || 'unknown';
  const position = state.workflowPosition || 'unknown';
  const timeAgo = formatTimeAgo(state.lastActionTimestamp);

  // Try to read story title from the file
  let storyTitle = '';
  if (storyPath) {
    try {
      const fullPath = path.join(process.cwd(), storyPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const titleMatch = content.match(/^#\s+Story\s+[\d.]+:\s*(.+)$/m);
        if (titleMatch) storyTitle = ` — ${titleMatch[1].trim()}`;
      }
    } catch (_) {
      // Ignore read errors
    }
  }

  const lines = [
    '',
    '  Last Session State',
    '  ' + '-'.repeat(40),
    `    Story:    ${storyId}${storyTitle} (${position})`,
    `    Agent:    ${agent}`,
    `    Branch:   ${branch}`,
    `    Last:     ${timeAgo}`,
    '',
  ];

  return lines.join('\n');
}

/**
 * Suggest the next action based on the workflow position.
 *
 * @param {object} state - Session state object
 * @returns {string} Suggested next action text
 */
function suggestNextAction(state) {
  if (!state || !state.workflowPosition) {
    return 'No workflow position detected. Run `aiox agents` to get started.';
  }

  const storyId = state.activeStoryId || '';

  const suggestions = {
    'Draft': `Story is in Draft — ask @po to validate: \`aiox po validate\``,
    'Ready': `Story is Ready for development — start with: \`aiox dev\``,
    'InProgress': `Story is InProgress — continue implementation: \`aiox dev\`${storyId ? ` (Story ${storyId})` : ''}`,
    'InReview': `Story is in QA review — check QA status: \`aiox qa\``,
    'Done': `Story is Done — create next story: \`aiox sm create-story\``,
  };

  return suggestions[state.workflowPosition]
    || `Unknown workflow position "${state.workflowPosition}". Run \`aiox agents\` to get started.`;
}

/**
 * Get the current git branch name.
 *
 * @returns {string} Branch name or 'unknown'
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/**
 * Count stories by status from docs/stories/*.story.md files.
 *
 * @returns {{ total: number, complete: number, inProgress: number }}
 */
function countStories() {
  const result = { total: 0, complete: 0, inProgress: 0 };
  try {
    const storiesDir = path.join(process.cwd(), 'docs', 'stories');
    if (!fs.existsSync(storiesDir)) return result;

    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md'));
    result.total = files.length;

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
        const statusMatch = content.match(/^## Status\s*\n\s*(\w+)/m);
        if (statusMatch) {
          const status = statusMatch[1].trim();
          if (status === 'Done') result.complete++;
          else if (status === 'InProgress') result.inProgress++;
        }
      } catch (_) {
        // Skip unreadable files
      }
    }
  } catch (_) {
    // Ignore directory errors
  }
  return result;
}

/**
 * Read the AIOX version from package.json.
 *
 * @returns {string} Version string or 'unknown'
 */
function getAioxVersion() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || 'unknown';
    }
  } catch (_) {
    // Ignore
  }
  return 'unknown';
}

/**
 * CLI handler for `aiox resume`.
 * Reads session state and prints a summary with suggested next action.
 */
async function runResume() {
  const state = readSessionState();

  if (!state || !state.activeStoryId) {
    console.log('\nNo saved session found. Run `aiox agents` to get started.\n');
    return;
  }

  console.log(formatSessionSummary(state));

  const suggestion = suggestNextAction(state);
  console.log(`  Suggested: ${suggestion}`);
  console.log('');
}

/**
 * CLI handler for `aiox status`.
 * Prints system status and appends session info.
 */
async function runStatus() {
  const version = getAioxVersion();
  const branch = getCurrentBranch();
  const stories = countStories();

  console.log('');
  console.log('  AIOX Status');
  console.log('  ' + '-'.repeat(40));
  console.log(`    Version:  ${version}`);
  console.log(`    Branch:   ${branch}`);
  console.log(`    Stories:  ${stories.complete} complete, ${stories.inProgress} in progress (${stories.total} total)`);

  // Session section
  const state = readSessionState();
  console.log('');
  console.log('  Session');
  console.log('  ' + '-'.repeat(40));

  if (!state || !state.activeStoryId) {
    console.log('    No active session');
  } else {
    const storyId = state.activeStoryId || 'none';
    const position = state.workflowPosition || 'unknown';
    const agent = state.activeAgent ? `@${state.activeAgent}` : 'none';
    const timeAgo = formatTimeAgo(state.lastActionTimestamp);

    console.log(`    Story:    ${storyId} (${position})`);
    console.log(`    Agent:    ${agent}`);
    console.log(`    Since:    ${timeAgo}`);
  }

  console.log('');
}

module.exports = {
  readSessionState,
  writeSessionState,
  formatSessionSummary,
  suggestNextAction,
  formatTimeAgo,
  runResume,
  runStatus,
  // Exported for testing
  getStateFile,
  getAioxDir,
  getCurrentBranch,
  countStories,
  getAioxVersion,
};
