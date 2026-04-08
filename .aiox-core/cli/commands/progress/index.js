/**
 * Story Progress Tracker & Burndown Command Module
 *
 * Reads all story files from docs/stories/, groups by sprint,
 * and displays a visual burndown with per-status counts.
 *
 * Subcommands:
 *   aiox progress              -- Show all sprints progress
 *   aiox progress --sprint N   -- Filter by sprint number
 *   aiox progress --json       -- JSON output
 *   aiox progress --help       -- Show help
 *
 * @module cli/commands/progress
 * @version 1.0.0
 * @story 6.2 -- Story Progress Tracker & Burndown
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const BAR_WIDTH = 20;
const FILLED_CHAR = '\u2588';   // █
const EMPTY_CHAR = '\u2591';    // ░

const VALID_STATUSES = ['Done', 'InProgress', 'InReview', 'Ready', 'Draft'];

// ── Story Reading ────────────────────────────────────────────────────────────

/**
 * Extract status from story file content.
 *
 * Supports two formats:
 *   1. Checkbox: "- [x] Done" (the checked item wins)
 *   2. Plain text: "Done" / "InProgress" / "Draft" on a line by itself
 *
 * @param {string} content - Raw file content
 * @returns {string} Detected status or 'Unknown'
 */
function extractStatus(content) {
  const statusMatch = content.match(/^## Status\s*$/m);
  if (!statusMatch) return 'Unknown';

  const afterStatus = content.slice(statusMatch.index + statusMatch[0].length);
  const nextSection = afterStatus.search(/^## /m);
  const statusBlock = nextSection === -1
    ? afterStatus
    : afterStatus.slice(0, nextSection);

  // Format 1: Checkbox list — find the checked item
  const checkboxChecked = statusBlock.match(/- \[x\]\s+(\w+)/i);
  if (checkboxChecked) {
    const found = checkboxChecked[1].trim();
    // Normalize to known status
    const normalized = VALID_STATUSES.find(
      (s) => s.toLowerCase() === found.toLowerCase()
    );
    return normalized || found;
  }

  // Format 2: Plain text status on its own line
  const lines = statusBlock.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const normalized = VALID_STATUSES.find(
      (s) => s.toLowerCase() === line.toLowerCase()
    );
    if (normalized) return normalized;
  }

  return 'Unknown';
}

/**
 * Extract title from story file content (first H1).
 *
 * @param {string} content - Raw file content
 * @returns {string} Title or 'Untitled'
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Parse sprint number from filename.
 * Expected: "1.2.story.md" -> sprint 1, story 2
 *
 * @param {string} filename - e.g. "3.4.story.md"
 * @returns {{ sprint: number, story: number } | null}
 */
function parseFilename(filename) {
  const match = filename.match(/^(\d+)\.(\d+)\.story\.md$/);
  if (!match) return null;
  return { sprint: parseInt(match[1], 10), story: parseInt(match[2], 10) };
}

/**
 * Read all story files from storiesDir.
 *
 * @param {string} storiesDir - Absolute path to stories directory
 * @returns {Array<{ filename: string, sprint: number, story: number, status: string, title: string }>}
 */
function readAllStories(storiesDir) {
  if (!fs.existsSync(storiesDir)) {
    return [];
  }

  const files = fs.readdirSync(storiesDir).filter((f) => f.endsWith('.story.md'));
  const stories = [];

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) continue;

    const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
    stories.push({
      filename: file,
      sprint: parsed.sprint,
      story: parsed.story,
      status: extractStatus(content),
      title: extractTitle(content),
    });
  }

  // Sort by sprint, then story number
  stories.sort((a, b) => a.sprint - b.sprint || a.story - b.story);
  return stories;
}

// ── Grouping & Calculation ───────────────────────────────────────────────────

/**
 * Group stories by sprint number.
 *
 * @param {Array} stories - Array of story objects
 * @returns {Object} Map of sprint number -> array of stories
 */
function groupBySprint(stories) {
  const groups = {};
  for (const story of stories) {
    if (!groups[story.sprint]) {
      groups[story.sprint] = [];
    }
    groups[story.sprint].push(story);
  }
  return groups;
}

/**
 * Calculate progress for a set of sprint stories.
 *
 * @param {Array} sprintStories - Array of story objects for one sprint
 * @returns {{ total: number, done: number, inProgress: number, inReview: number, ready: number, draft: number, unknown: number, percent: number }}
 */
function calculateProgress(sprintStories) {
  const result = {
    total: sprintStories.length,
    done: 0,
    inProgress: 0,
    inReview: 0,
    ready: 0,
    draft: 0,
    unknown: 0,
    percent: 0,
  };

  for (const story of sprintStories) {
    switch (story.status) {
      case 'Done': result.done++; break;
      case 'InProgress': result.inProgress++; break;
      case 'InReview': result.inReview++; break;
      case 'Ready': result.ready++; break;
      case 'Draft': result.draft++; break;
      default: result.unknown++; break;
    }
  }

  result.percent = result.total > 0
    ? Math.round((result.done / result.total) * 100)
    : 0;

  return result;
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Render an ASCII progress bar.
 *
 * @param {number} percent - 0-100
 * @param {number} [width=BAR_WIDTH] - Total bar width in chars
 * @returns {string} e.g. "████████████░░░░░░░░"
 */
function renderBar(percent, width = BAR_WIDTH) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return FILLED_CHAR.repeat(filled) + EMPTY_CHAR.repeat(empty);
}

/**
 * Render ASCII bar chart of progress per sprint.
 *
 * @param {Object} sprintGroups - Map of sprint number -> stories
 * @returns {string} Multi-line ASCII chart
 */
function renderASCIIChart(sprintGroups) {
  const lines = [];
  const sprintNumbers = Object.keys(sprintGroups)
    .map(Number)
    .sort((a, b) => a - b);

  for (const num of sprintNumbers) {
    const progress = calculateProgress(sprintGroups[num]);
    const bar = renderBar(progress.percent);
    const pctStr = String(progress.percent).padStart(3);
    lines.push(
      `Sprint ${num}  ${bar} ${pctStr}%  (${progress.done}/${progress.total} done)`
    );
  }

  return lines.join('\n');
}

/**
 * Format a full progress report.
 *
 * @param {Object} data - { stories, groups, overallProgress }
 * @param {Object} [options={}] - { json: boolean }
 * @returns {string}
 */
function formatProgress(data, options = {}) {
  if (options.json) {
    const jsonData = {
      sprints: {},
      overall: data.overallProgress,
    };
    const sprintNumbers = Object.keys(data.groups)
      .map(Number)
      .sort((a, b) => a - b);

    for (const num of sprintNumbers) {
      const progress = calculateProgress(data.groups[num]);
      jsonData.sprints[num] = {
        ...progress,
        stories: data.groups[num].map((s) => ({
          id: `${s.sprint}.${s.story}`,
          title: s.title,
          status: s.status,
        })),
      };
    }
    return JSON.stringify(jsonData, null, 2);
  }

  const lines = [];
  lines.push('AIOX Sprint Progress');
  lines.push('\u2501'.repeat(35));
  lines.push('');
  lines.push(renderASCIIChart(data.groups));
  lines.push('');
  lines.push(
    `Overall: ${data.overallProgress.done}/${data.overallProgress.total} stories complete (${data.overallProgress.percent}%)`
  );

  return lines.join('\n');
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Show help text.
 */
function showHelp() {
  console.log(`
AIOX Story Progress Tracker

USAGE:
  aiox progress              Show all sprints progress
  aiox progress --sprint N   Filter by sprint number
  aiox progress --json       Output as JSON
  aiox progress --help       Show this help

EXAMPLES:
  aiox progress
  aiox progress --sprint 3
  aiox progress --sprint 1 --json
`);
}

/**
 * Parse argv for progress command options.
 *
 * @param {string[]} argv - Arguments after "progress"
 * @returns {{ help: boolean, json: boolean, sprint: number | null }}
 */
function parseArgs(argv) {
  const opts = { help: false, json: false, sprint: null };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--sprint') {
      const val = argv[i + 1];
      if (val && !val.startsWith('-')) {
        opts.sprint = parseInt(val, 10);
        i++;
      }
    }
  }

  return opts;
}

/**
 * Main CLI handler for `aiox progress`.
 *
 * @param {string[]} argv - Arguments after "progress"
 */
function runProgress(argv = []) {
  const opts = parseArgs(argv);

  if (opts.help) {
    showHelp();
    return;
  }

  const storiesDir = path.join(process.cwd(), 'docs', 'stories');
  const stories = readAllStories(storiesDir);

  if (stories.length === 0) {
    console.log('No stories found in docs/stories/');
    return;
  }

  let groups = groupBySprint(stories);

  // Filter by sprint if requested
  if (opts.sprint !== null) {
    if (!groups[opts.sprint]) {
      console.log(`No stories found for Sprint ${opts.sprint}`);
      return;
    }
    groups = { [opts.sprint]: groups[opts.sprint] };
  }

  // Calculate overall progress across visible sprints
  const allVisible = Object.values(groups).flat();
  const overallProgress = calculateProgress(allVisible);

  const output = formatProgress(
    { stories: allVisible, groups, overallProgress },
    { json: opts.json }
  );

  console.log(output);
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  readAllStories,
  groupBySprint,
  calculateProgress,
  renderASCIIChart,
  renderBar,
  formatProgress,
  extractStatus,
  extractTitle,
  parseFilename,
  parseArgs,
  runProgress,
  VALID_STATUSES,
  BAR_WIDTH,
  FILLED_CHAR,
  EMPTY_CHAR,
};
