/**
 * Sprint Report Generator
 *
 * Generates reports for sprints: stories, status, velocity.
 * Reads from docs/stories/ to determine sprint membership and status.
 *
 * @module cli/commands/sprint-report
 * @version 1.0.0
 * @story 14.2 — Sprint Report Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
SPRINT REPORT GENERATOR

USAGE:
  aiox sprint-report                  Report for current sprint
  aiox sprint-report --sprint N       Report for sprint N
  aiox sprint-report --all            Summary across all sprints
  aiox sprint-report --format json    Output as JSON
  aiox sprint-report --help           Show this help

Reads story files from docs/stories/ with naming convention {sprint}.{story}.story.md.
`.trim();

const STATUS_REGEX = /^##?\s*Status\s*\n+\s*(.+)/mi;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * List story files from a directory.
 * @param {string} storiesDir
 * @param {object} [options]
 * @param {function} [options.readdir]
 * @returns {string[]}
 */
function listStoryFiles(storiesDir, options = {}) {
  const readdir = options.readdir || fs.readdirSync;
  try {
    const files = readdir(storiesDir);
    return files.filter(f => /^\d+\.\d+\.story\.md$/.test(f)).sort();
  } catch {
    return [];
  }
}

/**
 * Parse sprint number and story number from filename.
 * @param {string} filename - e.g. "14.2.story.md"
 * @returns {{ sprint: number, story: number } | null}
 */
function parseStoryFilename(filename) {
  const match = filename.match(/^(\d+)\.(\d+)\.story\.md$/);
  if (!match) return null;
  return { sprint: parseInt(match[1], 10), story: parseInt(match[2], 10) };
}

/**
 * Extract status from a story file's content.
 * @param {string} content
 * @returns {string}
 */
function extractStatus(content) {
  if (!content) return 'Unknown';
  const match = content.match(STATUS_REGEX);
  if (match) return match[1].trim();
  return 'Unknown';
}

/**
 * Extract title from a story file (first # heading).
 * @param {string} content
 * @returns {string}
 */
function extractTitle(content) {
  if (!content) return 'Untitled';
  const match = content.match(/^#\s+(.+)/m);
  if (match) return match[1].trim();
  return 'Untitled';
}

/**
 * Parse all stories from the stories directory.
 * @param {string} storiesDir
 * @param {object} [options]
 * @param {function} [options.readdir]
 * @param {function} [options.readFile]
 * @returns {object[]}
 */
function parseAllStories(storiesDir, options = {}) {
  const readFile = options.readFile || fs.readFileSync;
  const files = listStoryFiles(storiesDir, options);
  const stories = [];

  for (const file of files) {
    const parsed = parseStoryFilename(file);
    if (!parsed) continue;
    let content = '';
    try {
      content = readFile(path.join(storiesDir, file), 'utf8');
    } catch { /* skip unreadable */ }
    stories.push({
      file,
      sprint: parsed.sprint,
      story: parsed.story,
      title: extractTitle(content),
      status: extractStatus(content),
    });
  }
  return stories;
}

/**
 * Detect the current (latest) sprint number.
 * @param {object[]} stories
 * @returns {number}
 */
function detectCurrentSprint(stories) {
  if (!stories.length) return 0;
  return Math.max(...stories.map(s => s.sprint));
}

/**
 * Filter stories for a specific sprint.
 * @param {object[]} stories
 * @param {number} sprintNum
 * @returns {object[]}
 */
function filterBySprint(stories, sprintNum) {
  return stories.filter(s => s.sprint === sprintNum);
}

/**
 * Calculate velocity for a sprint (count of Done stories).
 * @param {object[]} sprintStories
 * @returns {number}
 */
function calculateVelocity(sprintStories) {
  return sprintStories.filter(s =>
    s.status === 'Done' || s.status === 'InReview'
  ).length;
}

/**
 * Group story statuses for summary.
 * @param {object[]} stories
 * @returns {object}
 */
function groupStatuses(stories) {
  const groups = {};
  for (const s of stories) {
    groups[s.status] = (groups[s.status] || 0) + 1;
  }
  return groups;
}

/**
 * Generate report data for a single sprint.
 * @param {object[]} allStories
 * @param {number} sprintNum
 * @returns {object}
 */
function generateSprintReport(allStories, sprintNum) {
  const stories = filterBySprint(allStories, sprintNum);
  return {
    sprint: sprintNum,
    totalStories: stories.length,
    velocity: calculateVelocity(stories),
    statuses: groupStatuses(stories),
    stories: stories.map(s => ({
      id: `${s.sprint}.${s.story}`,
      title: s.title,
      status: s.status,
    })),
  };
}

/**
 * Generate summary across all sprints.
 * @param {object[]} allStories
 * @returns {object}
 */
function generateAllSprintsReport(allStories) {
  const sprintNums = [...new Set(allStories.map(s => s.sprint))].sort((a, b) => a - b);
  const sprints = sprintNums.map(num => generateSprintReport(allStories, num));
  const totalVelocity = sprints.reduce((sum, s) => sum + s.velocity, 0);
  const avgVelocity = sprints.length ? (totalVelocity / sprints.length) : 0;

  return {
    totalSprints: sprintNums.length,
    totalStories: allStories.length,
    totalVelocity,
    averageVelocity: Math.round(avgVelocity * 10) / 10,
    sprints,
  };
}

/**
 * Format a single sprint report for display.
 * @param {object} report
 * @returns {string}
 */
function formatSprintReport(report) {
  const lines = [];
  lines.push(`SPRINT ${report.sprint} REPORT`);
  lines.push('='.repeat(40));
  lines.push('');
  lines.push(`Total Stories: ${report.totalStories}`);
  lines.push(`Velocity:      ${report.velocity}`);
  lines.push('');
  lines.push('Status Breakdown:');
  for (const [status, count] of Object.entries(report.statuses)) {
    lines.push(`  ${status}: ${count}`);
  }
  lines.push('');
  lines.push('Stories:');
  for (const s of report.stories) {
    lines.push(`  [${s.status}] ${s.id} — ${s.title}`);
  }
  return lines.join('\n');
}

/**
 * Format all-sprints summary for display.
 * @param {object} report
 * @returns {string}
 */
function formatAllSprintsReport(report) {
  const lines = [];
  lines.push('ALL SPRINTS SUMMARY');
  lines.push('='.repeat(40));
  lines.push('');
  lines.push(`Total Sprints:    ${report.totalSprints}`);
  lines.push(`Total Stories:    ${report.totalStories}`);
  lines.push(`Total Velocity:   ${report.totalVelocity}`);
  lines.push(`Avg Velocity:     ${report.averageVelocity}`);
  lines.push('');
  for (const sprint of report.sprints) {
    lines.push(`  Sprint ${sprint.sprint}: ${sprint.totalStories} stories, velocity ${sprint.velocity}`);
  }
  return lines.join('\n');
}

/**
 * Main entry point.
 * @param {string[]} argv
 * @param {object} [options]
 */
function runSprintReport(argv = [], options = {}) {
  const log = options.log || console.log;
  const projectRoot = options.projectRoot || process.cwd();
  const storiesDir = path.join(projectRoot, 'docs', 'stories');

  if (argv.includes('--help') || argv.includes('-h')) {
    log(HELP_TEXT);
    return;
  }

  const isJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
  const isAll = argv.includes('--all');
  const sprintIdx = argv.indexOf('--sprint');
  const sprintNum = sprintIdx >= 0 ? parseInt(argv[sprintIdx + 1], 10) : null;

  const allStories = parseAllStories(storiesDir, options);

  if (isAll) {
    const report = generateAllSprintsReport(allStories);
    if (isJson) {
      log(JSON.stringify(report, null, 2));
    } else {
      log(formatAllSprintsReport(report));
    }
    return;
  }

  const targetSprint = sprintNum || detectCurrentSprint(allStories);
  if (targetSprint === 0) {
    log('No stories found.');
    return;
  }

  const report = generateSprintReport(allStories, targetSprint);
  if (isJson) {
    log(JSON.stringify(report, null, 2));
  } else {
    log(formatSprintReport(report));
  }
}

function getHelpText() {
  return HELP_TEXT;
}

module.exports = {
  listStoryFiles,
  parseStoryFilename,
  extractStatus,
  extractTitle,
  parseAllStories,
  detectCurrentSprint,
  filterBySprint,
  calculateVelocity,
  groupStatuses,
  generateSprintReport,
  generateAllSprintsReport,
  formatSprintReport,
  formatAllSprintsReport,
  runSprintReport,
  getHelpText,
  HELP_TEXT,
};
