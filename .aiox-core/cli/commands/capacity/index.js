/**
 * Capacity Planner Command Module
 *
 * Subcommands:
 *   aiox capacity              — shows team capacity: stories/sprint avg, velocity trend
 *   aiox capacity --forecast N — forecast completion for N stories
 *   aiox capacity --format json — as JSON
 *   aiox capacity --history    — velocity per sprint
 *
 * @module cli/commands/capacity
 * @version 1.0.0
 * @story 27.4 — Capacity Planner
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
CAPACITY PLANNER

USAGE:
  aiox capacity              Show team capacity: stories/sprint avg, velocity trend
  aiox capacity --forecast N Forecast completion for N stories
  aiox capacity --format json Output as JSON
  aiox capacity --history    Show velocity per sprint
  aiox capacity --help       Show this help

EXAMPLES:
  aiox capacity
  aiox capacity --forecast 20
  aiox capacity --history
  aiox capacity --format json
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
  const match = filename.match(/^(\d+)\.(\d+)\.story\.md$/);
  if (!match) return null;

  const sprint = parseInt(match[1], 10);
  const storyNum = parseInt(match[2], 10);

  const statusMatch = content.match(/^## Status\s*\n\s*(\w+)/m);
  const status = statusMatch ? statusMatch[1] : 'unknown';

  const titleMatch = content.match(/^# (.+)/m);
  const title = titleMatch ? titleMatch[1] : filename;

  const done = status === 'Done' || status === 'InReview';

  return { sprint, storyNum, title, status, filename, done };
}

// ── Capacity Calculation ─────────────────────────────────────────────────────

function calculateVelocity(stories) {
  // Group stories by sprint
  const sprints = {};
  for (const s of stories) {
    if (!sprints[s.sprint]) {
      sprints[s.sprint] = { total: 0, done: 0 };
    }
    sprints[s.sprint].total++;
    if (s.done) sprints[s.sprint].done++;
  }

  const sprintNumbers = Object.keys(sprints).map(Number).sort((a, b) => a - b);
  const history = sprintNumbers.map(n => ({
    sprint: n,
    total: sprints[n].total,
    done: sprints[n].done,
  }));

  // Only count sprints that have completed stories for velocity
  const completedSprints = history.filter(h => h.done > 0);
  const totalDone = completedSprints.reduce((sum, h) => sum + h.done, 0);
  const avgVelocity = completedSprints.length > 0
    ? totalDone / completedSprints.length
    : 0;

  // Trend: compare last 3 sprints vs prior 3
  let trend = 'stable';
  if (completedSprints.length >= 6) {
    const recent = completedSprints.slice(-3).reduce((s, h) => s + h.done, 0) / 3;
    const prior = completedSprints.slice(-6, -3).reduce((s, h) => s + h.done, 0) / 3;
    if (recent > prior * 1.1) trend = 'increasing';
    else if (recent < prior * 0.9) trend = 'decreasing';
  } else if (completedSprints.length >= 2) {
    const last = completedSprints[completedSprints.length - 1].done;
    const prev = completedSprints[completedSprints.length - 2].done;
    if (last > prev) trend = 'increasing';
    else if (last < prev) trend = 'decreasing';
  }

  return {
    history,
    totalSprints: sprintNumbers.length,
    totalStories: stories.length,
    totalDone,
    avgVelocity: Math.round(avgVelocity * 10) / 10,
    trend,
  };
}

function forecastCompletion(velocity, numStories) {
  if (velocity.avgVelocity <= 0) {
    return { sprints: Infinity, message: 'Cannot forecast: no velocity data' };
  }
  const sprints = Math.ceil(numStories / velocity.avgVelocity);
  return {
    stories: numStories,
    velocityPerSprint: velocity.avgVelocity,
    sprintsNeeded: sprints,
    message: `${numStories} stories at ${velocity.avgVelocity} stories/sprint = ~${sprints} sprints`,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderCapacity(velocity) {
  const lines = [];

  lines.push('\nCapacity Planner\n');
  lines.push(`  Total sprints:     ${velocity.totalSprints}`);
  lines.push(`  Total stories:     ${velocity.totalStories}`);
  lines.push(`  Stories completed: ${velocity.totalDone}`);
  lines.push(`  Avg velocity:      ${velocity.avgVelocity} stories/sprint`);
  lines.push(`  Trend:             ${velocity.trend}`);
  lines.push('');

  return lines.join('\n');
}

function renderHistory(velocity) {
  const lines = [];

  lines.push('\nVelocity History\n');
  if (velocity.history.length === 0) {
    lines.push('  No sprint data found.');
    return lines.join('\n');
  }

  lines.push('  Sprint  | Total | Done | Bar');
  lines.push('  --------+-------+------+' + '-'.repeat(22));

  for (const h of velocity.history) {
    const bar = '#'.repeat(h.done) + '-'.repeat(Math.max(0, h.total - h.done));
    const sprintStr = String(h.sprint).padStart(6);
    const totalStr = String(h.total).padStart(5);
    const doneStr = String(h.done).padStart(4);
    lines.push(`  ${sprintStr} | ${totalStr} | ${doneStr} | [${bar}]`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── Runner ───────────────────────────────────────────────────────────────────

function runCapacity(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const storiesDir = path.join(process.cwd(), 'docs', 'stories');
  const allStories = scanStories(storiesDir);
  const format = extractFlag(args, '--format');
  const forecastArg = extractFlag(args, '--forecast');
  const showHistory = args.includes('--history');

  const velocity = calculateVelocity(allStories);

  if (format === 'json') {
    const result = { velocity };
    if (forecastArg) {
      result.forecast = forecastCompletion(velocity, parseInt(forecastArg, 10));
    }
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(renderCapacity(velocity));

  if (showHistory) {
    console.log(renderHistory(velocity));
  }

  if (forecastArg) {
    const num = parseInt(forecastArg, 10);
    if (isNaN(num) || num <= 0) {
      console.error('Error: forecast must be a positive number');
      return null;
    }
    const forecast = forecastCompletion(velocity, num);
    console.log(`  Forecast: ${forecast.message}\n`);
    return { velocity, forecast };
  }

  return { velocity };
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
  runCapacity,
  scanStories,
  parseStory,
  calculateVelocity,
  forecastCompletion,
  renderCapacity,
  renderHistory,
  HELP_TEXT,
};
