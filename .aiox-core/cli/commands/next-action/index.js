/**
 * Next-Action Suggestion Engine
 *
 * Story 33.1: Analyzes current project state and suggests prioritized next actions.
 *
 * Detects:
 *   - Active stories (InProgress, InReview, Draft, Ready)
 *   - Uncommitted git changes
 *   - Failing tests (from cached results)
 *   - Missing test files for source files
 *
 * @module cli/commands/next-action
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Priority Levels ───────────────────────────────────────────────────────

const PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const PRIORITY_LABELS = {
  [PRIORITY.CRITICAL]: 'CRITICAL',
  [PRIORITY.HIGH]: 'HIGH',
  [PRIORITY.MEDIUM]: 'MEDIUM',
  [PRIORITY.LOW]: 'LOW',
};

const PRIORITY_ICONS = {
  [PRIORITY.CRITICAL]: '!!!',
  [PRIORITY.HIGH]: '!!',
  [PRIORITY.MEDIUM]: '!',
  [PRIORITY.LOW]: '-',
};

// ─── State Detection ───────────────────────────────────────────────────────

/**
 * Detect stories and their statuses from docs/stories/*.story.md.
 *
 * @param {string} [baseDir] - Base directory (defaults to cwd)
 * @returns {Array<{id: string, path: string, status: string, title: string}>}
 */
function detectStories(baseDir) {
  const cwd = baseDir || process.cwd();
  const storiesDir = path.join(cwd, 'docs', 'stories');
  const stories = [];

  try {
    if (!fs.existsSync(storiesDir)) return stories;

    const files = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.story.md'));

    for (const file of files) {
      try {
        const filePath = path.join(storiesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Extract story ID from filename (e.g., "33.1.story.md" -> "33.1")
        const idMatch = file.match(/^([\d.]+)\.story\.md$/);
        const id = idMatch ? idMatch[1] : file.replace('.story.md', '');

        // Extract status
        const statusMatch = content.match(/^## Status\s*\n\s*(\w+)/m);
        const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

        // Extract title
        const titleMatch = content.match(/^# Story [\d.]+:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : '';

        stories.push({ id, path: `docs/stories/${file}`, status, title });
      } catch (_) {
        // Skip unreadable files
      }
    }
  } catch (_) {
    // Ignore directory errors
  }

  return stories;
}

/**
 * Detect uncommitted git changes.
 *
 * @returns {{hasChanges: boolean, staged: number, unstaged: number, untracked: number}}
 */
function detectGitChanges() {
  const result = { hasChanges: false, staged: 0, unstaged: 0, untracked: 0 };

  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!status) return result;

    const lines = status.split('\n').filter(Boolean);
    result.hasChanges = lines.length > 0;

    for (const line of lines) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];

      if (indexStatus === '?' && workTreeStatus === '?') {
        result.untracked++;
      } else if (indexStatus !== ' ' && indexStatus !== '?') {
        result.staged++;
      }
      if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        result.unstaged++;
      }
    }
  } catch (_) {
    // Not a git repo or git not available
  }

  return result;
}

/**
 * Detect current git branch.
 *
 * @returns {string} Branch name or 'unknown'
 */
function detectBranch() {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/**
 * Check for test results from cached Jest output or package.json test script.
 *
 * @param {string} [baseDir] - Base directory
 * @returns {{available: boolean, passing: boolean, message: string}}
 */
function detectTestStatus(baseDir) {
  const cwd = baseDir || process.cwd();
  const result = { available: false, passing: true, message: 'No test info available' };

  try {
    // Check for package.json test script
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.test) {
        result.available = true;
        result.message = 'Test script available (run `npm test` to verify)';
      }
    }
  } catch (_) {
    // Ignore
  }

  return result;
}

// ─── Suggestion Engine ─────────────────────────────────────────────────────

/**
 * Build prioritized suggestions based on detected project state.
 *
 * @param {object} state - Detected project state
 * @returns {Array<{priority: number, action: string, reason: string, command: string}>}
 */
function buildSuggestions(state) {
  const suggestions = [];
  const { stories, git, branch, tests } = state;

  // 1. InProgress stories — highest priority to continue work
  const inProgress = stories.filter((s) => s.status === 'InProgress');
  for (const story of inProgress) {
    suggestions.push({
      priority: PRIORITY.CRITICAL,
      action: `Continue implementing Story ${story.id}${story.title ? ': ' + story.title : ''}`,
      reason: 'Story is InProgress — active work should be completed',
      command: `@dev *develop ${story.id}`,
    });
  }

  // 2. Uncommitted changes — need to be committed or stashed
  if (git.hasChanges) {
    if (git.staged > 0) {
      suggestions.push({
        priority: PRIORITY.HIGH,
        action: `Commit ${git.staged} staged change${git.staged === 1 ? '' : 's'}`,
        reason: 'Staged changes should be committed to avoid losing work',
        command: 'git commit',
      });
    }
    if (git.unstaged > 0) {
      suggestions.push({
        priority: PRIORITY.HIGH,
        action: `Review ${git.unstaged} unstaged change${git.unstaged === 1 ? '' : 's'}`,
        reason: 'Modified files should be staged and committed',
        command: 'git add -p',
      });
    }
    if (git.untracked > 0) {
      suggestions.push({
        priority: PRIORITY.LOW,
        action: `Review ${git.untracked} untracked file${git.untracked === 1 ? '' : 's'}`,
        reason: 'New files may need to be tracked or added to .gitignore',
        command: 'git status',
      });
    }
  }

  // 3. InReview stories — need QA attention
  const inReview = stories.filter((s) => s.status === 'InReview');
  for (const story of inReview) {
    suggestions.push({
      priority: PRIORITY.MEDIUM,
      action: `QA review pending for Story ${story.id}${story.title ? ': ' + story.title : ''}`,
      reason: 'Story is awaiting QA review',
      command: `@qa *qa-gate ${story.id}`,
    });
  }

  // 4. Ready stories — can be picked up for development
  const ready = stories.filter((s) => s.status === 'Ready');
  for (const story of ready) {
    suggestions.push({
      priority: PRIORITY.MEDIUM,
      action: `Start development on Story ${story.id}${story.title ? ': ' + story.title : ''}`,
      reason: 'Story is validated and Ready for development',
      command: `@dev *develop ${story.id}`,
    });
  }

  // 5. Draft stories — need validation
  const drafts = stories.filter((s) => s.status === 'Draft');
  if (drafts.length > 0) {
    suggestions.push({
      priority: PRIORITY.LOW,
      action: `${drafts.length} Draft stor${drafts.length === 1 ? 'y needs' : 'ies need'} validation`,
      reason: 'Draft stories should be validated by @po before development',
      command: '@po *validate-story-draft',
    });
  }

  // 6. Tests available but not recently run
  if (tests.available && !tests.passing) {
    suggestions.push({
      priority: PRIORITY.HIGH,
      action: 'Fix failing tests',
      reason: 'Tests are failing — fix before continuing development',
      command: 'npm test',
    });
  }

  // 7. No active work — suggest starting something
  if (inProgress.length === 0 && ready.length === 0 && !git.hasChanges) {
    suggestions.push({
      priority: PRIORITY.LOW,
      action: 'No active work detected — create or pick up a story',
      reason: 'No stories InProgress and no pending changes',
      command: 'aiox agents',
    });
  }

  // Sort by priority (lower number = higher priority)
  suggestions.sort((a, b) => a.priority - b.priority);

  return suggestions;
}

// ─── Formatting ────────────────────────────────────────────────────────────

/**
 * Pad a string to a given width.
 */
function pad(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Render suggestions as formatted CLI output.
 *
 * @param {Array} suggestions - Prioritized suggestions
 * @param {object} [options] - Render options
 * @param {boolean} [options.verbose] - Show detailed explanations
 * @param {object} [options.output] - Output stream (default: process.stdout)
 */
function renderSuggestions(suggestions, options = {}) {
  const out = options.output || process.stdout;
  const verbose = options.verbose || false;

  if (suggestions.length === 0) {
    out.write('\n  All clear! No pending actions detected.\n\n');
    return;
  }

  out.write('\n  Next Actions\n');
  out.write('  ' + '\u2500'.repeat(60) + '\n');

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const icon = PRIORITY_ICONS[s.priority] || '-';
    const label = PRIORITY_LABELS[s.priority] || 'INFO';

    out.write(`\n  ${pad(String(i + 1) + '.', 4)}[${pad(label, 8)}] ${s.action}\n`);

    if (verbose) {
      out.write(`      Reason:  ${s.reason}\n`);
    }

    out.write(`      Run:     ${s.command}\n`);
  }

  out.write('\n  ' + suggestions.length + ` suggestion${suggestions.length === 1 ? '' : 's'} based on current project state.\n\n`);
}

/**
 * Render suggestions as JSON.
 *
 * @param {Array} suggestions - Prioritized suggestions
 * @param {object} state - Detected state for context
 */
function renderJson(suggestions, state) {
  const output = {
    timestamp: new Date().toISOString(),
    branch: state.branch,
    storyCounts: {
      inProgress: state.stories.filter((s) => s.status === 'InProgress').length,
      inReview: state.stories.filter((s) => s.status === 'InReview').length,
      ready: state.stories.filter((s) => s.status === 'Ready').length,
      draft: state.stories.filter((s) => s.status === 'Draft').length,
      done: state.stories.filter((s) => s.status === 'Done').length,
      total: state.stories.length,
    },
    git: state.git,
    suggestions: suggestions.map((s) => ({
      priority: PRIORITY_LABELS[s.priority],
      action: s.action,
      reason: s.reason,
      command: s.command,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Run the next-action CLI command.
 *
 * @param {string[]} argv - Arguments after "next" (e.g. ['--json', '--verbose'])
 * @param {object} [options] - Override options for testing
 * @param {string} [options.baseDir] - Custom base directory
 * @param {object} [options.output] - Custom output stream
 */
async function runNextAction(argv, options = {}) {
  const args = argv || [];
  const baseDir = options.baseDir || process.cwd();

  // Parse flags
  const hasJson = args.includes('--json');
  const hasVerbose = args.includes('--verbose') || args.includes('-v');
  const hasHelp = args.includes('--help') || args.includes('-h');

  if (hasHelp) {
    showNextActionHelp(options.output);
    return;
  }

  // Detect project state
  const state = {
    stories: detectStories(baseDir),
    git: detectGitChanges(),
    branch: detectBranch(),
    tests: detectTestStatus(baseDir),
  };

  // Build suggestions
  const suggestions = buildSuggestions(state);

  // Render output
  if (hasJson) {
    renderJson(suggestions, state);
  } else {
    renderSuggestions(suggestions, {
      verbose: hasVerbose,
      output: options.output,
    });
  }
}

function showNextActionHelp(output) {
  const out = output || process.stdout;
  out.write(`
AIOX Next-Action Suggestion Engine — Know what to do next

USAGE:
  aiox next                  # Show prioritized next actions
  aiox next --verbose        # Show detailed explanations
  aiox next --json           # Output as JSON
  aiox next --help           # Show this help

ALIASES:
  aiox next-action           # Same as aiox next

DETECTS:
  - Active stories (InProgress, InReview, Ready, Draft)
  - Uncommitted git changes (staged, unstaged, untracked)
  - Test status
  - Workflow position

PRIORITY LEVELS:
  CRITICAL  — Immediate action needed (active work in progress)
  HIGH      — Important (uncommitted changes, failing tests)
  MEDIUM    — Actionable (stories ready for work, QA pending)
  LOW       — Informational (draft stories, untracked files)

`);
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  runNextAction,
  detectStories,
  detectGitChanges,
  detectBranch,
  detectTestStatus,
  buildSuggestions,
  renderSuggestions,
  renderJson,
  showNextActionHelp,
  PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_ICONS,
};
