/**
 * Standup Report Generator Command Module
 *
 * Subcommands:
 *   aiox standup                   — generate standup report
 *   aiox standup --format json     — output as JSON
 *   aiox standup --since 2d        — lookback period
 *   aiox standup --output file.md  — write to file
 *
 * @module cli/commands/standup
 * @version 1.0.0
 * @story 25.3 — Standup Report Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const BLOCKERS_FILE = () => path.join(process.cwd(), '.aiox', 'blockers.json');
const STORIES_DIR = () => path.join(process.cwd(), 'docs', 'stories');

const HELP_TEXT = `
STANDUP REPORT GENERATOR

USAGE:
  aiox standup                   Generate standup report
  aiox standup --format json     Output as JSON
  aiox standup --since 2d        Lookback period (e.g., 1d, 3d, 1w)
  aiox standup --output file.md  Write report to file
  aiox standup --help            Show this help

SECTIONS:
  - What I did: recent git commits
  - What I'll do: in-progress stories
  - Blockers: from .aiox/blockers.json

EXAMPLES:
  aiox standup
  aiox standup --since 3d --format json
  aiox standup --output standup-report.md
`.trim();

// ── Data Gathering ───────────────────────────────────────────────────────────

/**
 * Parse --since value to a git-compatible since string.
 * Supports: 1d, 2d, 1w, etc.
 * @param {string} since
 * @returns {string} git --since value
 */
function parseSince(since) {
  if (!since) return '1.day.ago';

  const match = since.match(/^(\d+)([dwm])$/);
  if (!match) return '1.day.ago';

  const num = match[1];
  const unit = match[2];

  const unitMap = { d: 'day', w: 'week', m: 'month' };
  const gitUnit = unitMap[unit] || 'day';

  return `${num}.${gitUnit}.ago`;
}

/**
 * Get recent commits from git log.
 * @param {string} since - git --since value
 * @returns {string[]} commit messages
 */
function getRecentCommits(since) {
  try {
    const output = execSync(
      `git log --oneline --since="${since}" --no-merges 2>/dev/null`,
      { encoding: 'utf8', cwd: process.cwd(), timeout: 10000 },
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get in-progress stories from docs/stories/.
 * @returns {Object[]} stories with id and title
 */
function getInProgressStories() {
  const storiesDir = STORIES_DIR();
  const stories = [];

  try {
    if (!fs.existsSync(storiesDir)) return stories;

    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md') || f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
        const statusMatch = content.match(/^##?\s*Status\s*\n+\s*(.*)/m);
        const titleMatch = content.match(/^#\s+(.+)/m);

        if (statusMatch) {
          const status = statusMatch[1].trim();
          if (status === 'InProgress' || status === 'Ready') {
            stories.push({
              id: file.replace(/\.story\.md$/, '').replace(/\.md$/, ''),
              title: titleMatch ? titleMatch[1].trim() : file,
              status,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Stories dir not accessible
  }

  return stories;
}

/**
 * Get blockers from .aiox/blockers.json.
 * @returns {Object[]} blockers
 */
function getBlockers() {
  const filePath = BLOCKERS_FILE();
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Report Generation ────────────────────────────────────────────────────────

/**
 * Generate standup report data.
 * @param {string} sinceRaw - raw --since value
 * @returns {Object} report data
 */
function generateReport(sinceRaw) {
  const since = parseSince(sinceRaw);
  const commits = getRecentCommits(since);
  const stories = getInProgressStories();
  const blockers = getBlockers();

  return {
    date: new Date().toISOString().split('T')[0],
    whatIDid: commits,
    whatIllDo: stories,
    blockers,
    since: sinceRaw || '1d',
  };
}

/**
 * Format report as markdown text.
 * @param {Object} report
 * @returns {string}
 */
function formatMarkdown(report) {
  const lines = [];
  lines.push(`# Standup Report — ${report.date}`);
  lines.push('');

  lines.push('## What I Did');
  if (report.whatIDid.length === 0) {
    lines.push('- (no recent commits)');
  } else {
    for (const commit of report.whatIDid) {
      lines.push(`- ${commit}`);
    }
  }
  lines.push('');

  lines.push('## What I\'ll Do');
  if (report.whatIllDo.length === 0) {
    lines.push('- (no in-progress stories)');
  } else {
    for (const story of report.whatIllDo) {
      lines.push(`- [${story.id}] ${story.title} (${story.status})`);
    }
  }
  lines.push('');

  lines.push('## Blockers');
  if (report.blockers.length === 0) {
    lines.push('- (none)');
  } else {
    for (const blocker of report.blockers) {
      const desc = typeof blocker === 'string' ? blocker : (blocker.description || blocker.title || JSON.stringify(blocker));
      lines.push(`- ${desc}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  if (!args) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runStandup(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sinceRaw = extractFlag(args, '--since');
  const format = extractFlag(args, '--format');
  const output = extractFlag(args, '--output');

  const report = generateReport(sinceRaw);

  if (format === 'json') {
    const json = JSON.stringify(report, null, 2);
    if (output) {
      fs.writeFileSync(output, json, 'utf8');
      console.log(`Report written to ${output}`);
    } else {
      console.log(json);
    }
    return report;
  }

  const markdown = formatMarkdown(report);
  if (output) {
    fs.writeFileSync(output, markdown, 'utf8');
    console.log(`Report written to ${output}`);
  } else {
    console.log(markdown);
  }

  return report;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runStandup,
  parseSince,
  getRecentCommits,
  getInProgressStories,
  getBlockers,
  generateReport,
  formatMarkdown,
  HELP_TEXT,
};
