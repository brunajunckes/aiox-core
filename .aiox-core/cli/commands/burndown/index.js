/**
 * Burndown Chart Command Module
 *
 * Subcommands:
 *   aiox burndown              — shows burndown chart for current sprint (ASCII)
 *   aiox burndown --sprint N   — specific sprint
 *   aiox burndown --format json — as JSON
 *   aiox burndown --ideal      — include ideal line
 *
 * @module cli/commands/burndown
 * @version 1.0.0
 * @story 27.3 — Burndown Chart
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
BURNDOWN CHART

USAGE:
  aiox burndown              Show burndown chart for current sprint (ASCII)
  aiox burndown --sprint N   Show burndown for specific sprint N
  aiox burndown --format json Output as JSON
  aiox burndown --ideal      Include ideal burndown line
  aiox burndown --help       Show this help

EXAMPLES:
  aiox burndown
  aiox burndown --sprint 25
  aiox burndown --sprint 27 --ideal
  aiox burndown --format json
`.trim();

// ── Story Scanning ───────────────────────────────────────────────────────────

function scanStories(storiesDir) {
  const stories = [];
  try {
    if (!fs.existsSync(storiesDir)) return stories;
    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      const story = parseStory(file, content);
      if (story) stories.push(story);
    }
  } catch {
    // graceful degradation
  }
  return stories;
}

function parseStory(filename, content) {
  // Extract sprint number from filename: e.g., "27.1.story.md" -> sprint 27
  const match = filename.match(/^(\d+)\.(\d+)\.story\.md$/);
  if (!match) return null;

  const sprint = parseInt(match[1], 10);
  const storyNum = parseInt(match[2], 10);

  // Extract status
  const statusMatch = content.match(/^## Status\s*\n\s*(\w+)/m);
  const status = statusMatch ? statusMatch[1] : 'unknown';

  // Extract title
  const titleMatch = content.match(/^# (.+)/m);
  const title = titleMatch ? titleMatch[1] : filename;

  // Count acceptance criteria
  const totalAC = (content.match(/- \[[ x]\]/g) || []).length;
  const doneAC = (content.match(/- \[x\]/g) || []).length;

  return {
    sprint,
    storyNum,
    title,
    status,
    filename,
    totalAC,
    doneAC,
    done: status === 'Done' || status === 'InReview',
  };
}

function detectCurrentSprint(stories) {
  if (stories.length === 0) return 1;
  const sprints = stories.map(s => s.sprint);
  return Math.max(...sprints);
}

// ── Burndown Calculation ─────────────────────────────────────────────────────

function calculateBurndown(stories, sprintNum) {
  const sprintStories = stories.filter(s => s.sprint === sprintNum);
  const total = sprintStories.length;
  const done = sprintStories.filter(s => s.done).length;
  const remaining = total - done;

  // Build data points: simulate day-by-day burndown based on story order
  const points = [];
  let rem = total;

  points.push({ day: 0, remaining: total, label: 'Start' });

  const sorted = [...sprintStories].sort((a, b) => a.storyNum - b.storyNum);
  let dayCounter = 1;
  for (const s of sorted) {
    if (s.done) {
      rem--;
      points.push({ day: dayCounter, remaining: rem, label: `${s.sprint}.${s.storyNum}` });
    }
    dayCounter++;
  }

  // If last point doesn't reflect current state, add it
  if (points[points.length - 1].remaining !== remaining) {
    points.push({ day: dayCounter, remaining, label: 'Current' });
  }

  return {
    sprint: sprintNum,
    total,
    done,
    remaining,
    points,
    stories: sprintStories,
  };
}

function generateIdealLine(total, numDays) {
  const points = [];
  for (let i = 0; i <= numDays; i++) {
    points.push({
      day: i,
      remaining: Math.round(total - (total / numDays) * i),
    });
  }
  return points;
}

// ── ASCII Rendering ──────────────────────────────────────────────────────────

function renderAsciiChart(burndown, showIdeal) {
  const { sprint, total, done, remaining, points } = burndown;
  const lines = [];

  lines.push(`\nBurndown — Sprint ${sprint}`);
  lines.push(`Total: ${total} stories | Done: ${done} | Remaining: ${remaining}\n`);

  if (total === 0) {
    lines.push('  No stories found for this sprint.');
    return lines.join('\n');
  }

  const height = Math.min(total, 20);
  const width = Math.max(points.length, 2);
  const idealPoints = showIdeal ? generateIdealLine(total, width - 1) : [];

  // Render top-down
  for (let row = height; row >= 0; row--) {
    const yVal = Math.round((row / height) * total);
    const label = String(yVal).padStart(3);
    let line = `${label} |`;

    for (let col = 0; col < width; col++) {
      const actual = points.find(p => p.day === col);
      const ideal = idealPoints.find(p => p.day === col);
      const actualMatch = actual && Math.round((actual.remaining / total) * height) === row;
      const idealMatch = ideal && Math.round((ideal.remaining / total) * height) === row;

      if (actualMatch && idealMatch) {
        line += 'X';
      } else if (actualMatch) {
        line += '*';
      } else if (idealMatch) {
        line += '.';
      } else {
        line += ' ';
      }
    }
    lines.push(line);
  }

  // X axis
  lines.push('    +' + '-'.repeat(width));
  const dayLabels = '     ' + Array.from({ length: width }, (_, i) => String(i % 10)).join('');
  lines.push(dayLabels);

  if (showIdeal) {
    lines.push('\n  * = actual   . = ideal   X = overlap');
  } else {
    lines.push('\n  * = stories remaining');
  }

  return lines.join('\n');
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runBurndown(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const storiesDir = path.join(process.cwd(), 'docs', 'stories');
  const allStories = scanStories(storiesDir);
  const format = extractFlag(args, '--format');
  const sprintArg = extractFlag(args, '--sprint');
  const showIdeal = args.includes('--ideal');

  const sprintNum = sprintArg ? parseInt(sprintArg, 10) : detectCurrentSprint(allStories);

  if (isNaN(sprintNum)) {
    console.error('Error: invalid sprint number');
    return null;
  }

  const burndown = calculateBurndown(allStories, sprintNum);

  if (format === 'json') {
    console.log(JSON.stringify(burndown, null, 2));
    return burndown;
  }

  const chart = renderAsciiChart(burndown, showIdeal);
  console.log(chart);
  return burndown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFlag(args, flag) {
  if (!args) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runBurndown,
  scanStories,
  parseStory,
  detectCurrentSprint,
  calculateBurndown,
  generateIdealLine,
  renderAsciiChart,
  HELP_TEXT,
};
