/**
 * Git Workflow Automation Command Module
 *
 * Subcommands:
 *   aiox flow start <story-id>  — Create branch from story, switch to it
 *   aiox flow finish             — Lint + test, commit with story ref (NO push)
 *   aiox flow status             — Show current branch, story, test status
 *   aiox flow --help             — Show help
 *
 * IMPORTANT: finish does NOT push. Push is @devops exclusive authority.
 *
 * @module cli/commands/git-flow
 * @version 1.0.0
 * @story 8.3 — Git Workflow Automation
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const STORY_DIR = 'docs/stories';
const BRANCH_PREFIX = 'story';

const HELP_TEXT = `
AIOX Git Workflow Automation

Usage:
  aiox flow start <story-id>   Create story branch and switch to it
  aiox flow finish              Run lint+test, commit with story reference
  aiox flow status              Show current branch, story, and test status
  aiox flow --help              Show this help message

Examples:
  aiox flow start 3.2           # Creates branch story/3.2-some-title
  aiox flow finish              # Lint, test, commit (NO push)
  aiox flow status              # Branch info + story + test status

Note: finish does NOT push to remote. Use @devops for push operations.
`.trim();

// ── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert a story title to a URL-friendly branch slug.
 * Lowercases, replaces non-alphanumeric with hyphens, trims/collapses hyphens.
 *
 * @param {string} title - The story title
 * @returns {string} Slugified string
 */
function slugify(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Find and read a story file for the given story ID.
 *
 * @param {string} storyId - Story identifier (e.g. '3.2')
 * @param {string} [cwd] - Working directory
 * @returns {{ title: string, filePath: string, status: string|null }} Story info
 * @throws {Error} If story file not found
 */
function readStoryFile(storyId, cwd) {
  const projectRoot = cwd || process.cwd();
  const storyFile = path.join(projectRoot, STORY_DIR, `${storyId}.story.md`);

  if (!fs.existsSync(storyFile)) {
    throw new Error(`Story file not found: ${storyFile}`);
  }

  const content = fs.readFileSync(storyFile, 'utf8');

  // Extract title from first markdown heading
  const titleMatch = content.match(/^#\s+(?:Story\s+[\d.]+:\s*)?(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : storyId;

  // Extract status if present
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/i) ||
                      content.match(/Status:\s*(.+)/i);
  const status = statusMatch ? statusMatch[1].trim() : null;

  return { title, filePath: storyFile, status };
}

/**
 * Generate branch name from story ID.
 * Reads the story file to get the title for the slug.
 *
 * @param {string} storyId - Story identifier (e.g. '3.2')
 * @param {string} [cwd] - Working directory
 * @returns {string} Branch name like 'story/3.2-some-title'
 */
function getBranchName(storyId, cwd) {
  const { title } = readStoryFile(storyId, cwd);
  const slug = slugify(title);
  const suffix = slug ? `-${slug}` : '';
  return `${BRANCH_PREFIX}/${storyId}${suffix}`;
}

/**
 * Execute a shell command and return trimmed stdout.
 *
 * @param {string} cmd - Command to run
 * @param {object} [opts] - execSync options
 * @returns {string} Trimmed stdout
 */
function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim();
}

/**
 * Get current git branch name.
 *
 * @returns {string} Current branch
 */
function getCurrentBranch() {
  return exec('git rev-parse --abbrev-ref HEAD');
}

/**
 * Extract story ID from a branch name following the pattern story/{id}-{slug}.
 *
 * @param {string} branchName - Branch name
 * @returns {string|null} Story ID or null
 */
function extractStoryId(branchName) {
  const match = branchName.match(/^story\/([\d.]+)/);
  return match ? match[1] : null;
}

// ── Core Flow Functions ──────────────────────────────────────────────────────

/**
 * Start a git flow: create a story branch and switch to it.
 *
 * @param {string} storyId - Story identifier
 * @param {string} [cwd] - Working directory
 * @returns {{ branch: string, storyTitle: string }}
 */
function startFlow(storyId, cwd) {
  if (!storyId) {
    throw new Error('Story ID is required. Usage: aiox flow start <story-id>');
  }

  const projectRoot = cwd || process.cwd();
  const execOpts = { cwd: projectRoot, encoding: 'utf8' };

  // Validate story exists
  const { title } = readStoryFile(storyId, projectRoot);
  const branchName = getBranchName(storyId, projectRoot);

  // Check if branch already exists
  try {
    const existingBranches = exec('git branch --list', execOpts);
    if (existingBranches.includes(branchName)) {
      // Branch exists, just switch to it
      exec(`git checkout ${branchName}`, execOpts);
      console.log(`Switched to existing branch: ${branchName}`);
      return { branch: branchName, storyTitle: title };
    }
  } catch {
    // git branch --list may fail in some edge cases, continue
  }

  // Create and switch to new branch
  exec(`git checkout -b ${branchName}`, execOpts);
  console.log(`Created and switched to branch: ${branchName}`);
  console.log(`Story: ${title}`);

  return { branch: branchName, storyTitle: title };
}

/**
 * Finish the current flow: run lint+test, then commit with story reference.
 * Does NOT push — push is @devops exclusive authority.
 *
 * @param {string} [cwd] - Working directory
 * @param {object} [options] - Options
 * @param {string} [options.message] - Custom commit message
 * @returns {{ branch: string, storyId: string, commitHash: string }}
 */
function finishFlow(cwd, options = {}) {
  const projectRoot = cwd || process.cwd();
  const execOpts = { cwd: projectRoot, encoding: 'utf8' };

  const branch = getCurrentBranch();
  const storyId = extractStoryId(branch);

  if (!storyId) {
    throw new Error(
      `Current branch "${branch}" is not a story branch. ` +
      'Expected pattern: story/{id}-{slug}. Use "aiox flow start <story-id>" first.'
    );
  }

  // Validate story file exists
  let storyTitle;
  try {
    const info = readStoryFile(storyId, projectRoot);
    storyTitle = info.title;
  } catch {
    storyTitle = `Story ${storyId}`;
  }

  // Check for staged or unstaged changes
  const status = exec('git status --porcelain', execOpts);
  if (!status) {
    throw new Error('No changes to commit. Working tree is clean.');
  }

  // Run lint
  console.log('Running lint...');
  try {
    exec('npm run lint', execOpts);
    console.log('Lint: PASSED');
  } catch (error) {
    throw new Error(`Lint failed. Fix lint errors before finishing.\n${error.message}`);
  }

  // Run tests
  console.log('Running tests...');
  try {
    exec('npm test', execOpts);
    console.log('Tests: PASSED');
  } catch (error) {
    throw new Error(`Tests failed. Fix test failures before finishing.\n${error.message}`);
  }

  // Stage all changes
  exec('git add -A', execOpts);

  // Build commit message
  const commitMsg = options.message
    ? `${options.message} [Story ${storyId}]`
    : `feat: implement ${storyTitle} [Story ${storyId}]`;

  exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, execOpts);

  const commitHash = exec('git rev-parse --short HEAD', execOpts);

  console.log(`Committed: ${commitHash} — ${commitMsg}`);
  console.log('NOTE: Changes are local only. Delegate to @devops for push.');

  return { branch, storyId, commitHash };
}

/**
 * Show flow status: current branch, story info, test status.
 *
 * @param {string} [cwd] - Working directory
 * @returns {{ branch: string, storyId: string|null, story: object|null, hasChanges: boolean, testsPass: boolean|null }}
 */
function flowStatus(cwd) {
  const projectRoot = cwd || process.cwd();
  const execOpts = { cwd: projectRoot, encoding: 'utf8' };

  const branch = getCurrentBranch();
  const storyId = extractStoryId(branch);

  const result = {
    branch,
    storyId,
    story: null,
    hasChanges: false,
    testsPass: null,
  };

  // Git status
  const gitStatus = exec('git status --porcelain', execOpts);
  result.hasChanges = gitStatus.length > 0;

  const changedFiles = gitStatus
    ? gitStatus.split('\n').filter(Boolean).length
    : 0;

  // Story info
  if (storyId) {
    try {
      result.story = readStoryFile(storyId, projectRoot);
    } catch {
      result.story = null;
    }
  }

  // Test status
  try {
    exec('npm test -- --passWithNoTests 2>&1', execOpts);
    result.testsPass = true;
  } catch {
    result.testsPass = false;
  }

  // Display
  console.log('\n--- AIOX Git Flow Status ---');
  console.log(`Branch:    ${branch}`);

  if (storyId) {
    console.log(`Story ID:  ${storyId}`);
    if (result.story) {
      console.log(`Title:     ${result.story.title}`);
      if (result.story.status) {
        console.log(`Status:    ${result.story.status}`);
      }
    }
  } else {
    console.log('Story ID:  (not on a story branch)');
  }

  console.log(`Changes:   ${result.hasChanges ? `${changedFiles} file(s) modified` : 'clean'}`);
  console.log(`Tests:     ${result.testsPass === null ? 'unknown' : result.testsPass ? 'PASSING' : 'FAILING'}`);
  console.log('----------------------------\n');

  return result;
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Main CLI handler for git-flow commands.
 *
 * @param {string[]} argv - Command arguments (after 'flow')
 */
function runGitFlow(argv) {
  const args = argv || [];
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(HELP_TEXT);
    return;
  }

  switch (subcommand) {
    case 'start': {
      const storyId = args[1];
      if (!storyId) {
        console.error('Error: Story ID is required.');
        console.log('Usage: aiox flow start <story-id>');
        process.exit(1);
      }
      try {
        startFlow(storyId);
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'finish': {
      const msgIndex = args.indexOf('-m');
      const message = msgIndex !== -1 ? args[msgIndex + 1] : undefined;
      try {
        finishFlow(undefined, { message });
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      try {
        flowStatus();
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
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
  BRANCH_PREFIX,
  STORY_DIR,
};
