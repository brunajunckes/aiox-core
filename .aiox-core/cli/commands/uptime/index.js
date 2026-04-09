/**
 * Uptime Tracker Command Module
 *
 * Shows project uptime stats based on git history.
 *
 * Subcommands:
 *   aiox uptime              — Show project uptime stats
 *   aiox uptime --format json — Output as JSON
 *   aiox uptime --calendar   — ASCII calendar heatmap (last 3 months)
 *   aiox uptime --streak     — Current and longest commit streak
 *   aiox uptime --help       — Show help
 *
 * @module cli/commands/uptime
 * @version 1.0.0
 * @story 24.4 — Uptime Tracker
 */

'use strict';

const { execSync } = require('child_process');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Execute a git command and return trimmed output.
 * @param {string} cmd
 * @returns {string}
 */
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: 'utf8',
      timeout: 10000,
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Get the first commit date.
 * @returns {string|null} ISO date string
 */
function getFirstCommitDate() {
  const output = git('log --reverse --format=%aI');
  if (!output) return null;
  const first = output.split('\n')[0];
  return first || null;
}

/**
 * Get the latest commit date.
 * @returns {string|null} ISO date string
 */
function getLatestCommitDate() {
  const output = git('log --format=%aI --max-count=1');
  return output || null;
}

/**
 * Get total number of commits.
 * @returns {number}
 */
function getTotalCommits() {
  const output = git('rev-list --count HEAD');
  return parseInt(output, 10) || 0;
}

/**
 * Get commit dates as an array of YYYY-MM-DD strings.
 * @param {number} [days] — limit to last N days
 * @returns {string[]}
 */
function getCommitDates(days) {
  const sinceArg = days ? `--since="${days} days ago"` : '';
  const output = git(`log --format=%aI ${sinceArg}`);
  if (!output) return [];

  return output.split('\n').filter(Boolean).map(d => d.substring(0, 10));
}

/**
 * Compute days active (unique commit days).
 * @param {string[]} commitDates — array of YYYY-MM-DD
 * @returns {number}
 */
function getDaysActive(commitDates) {
  return new Set(commitDates).size;
}

/**
 * Compute days between two date strings.
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  const msPerDay = 86400000;
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.ceil(Math.abs(d2 - d1) / msPerDay);
}

/**
 * Compute commit frequency (commits per day).
 * @param {number} totalCommits
 * @param {string} firstDate
 * @param {string} latestDate
 * @returns {string}
 */
function commitFrequency(totalCommits, firstDate, latestDate) {
  if (!firstDate || !latestDate) return '0';
  const days = daysBetween(firstDate, latestDate) || 1;
  return (totalCommits / days).toFixed(1);
}

/**
 * Collect uptime stats.
 * @returns {{ firstCommit: string|null, latestCommit: string|null, totalCommits: number, daysActive: number, totalDays: number, frequency: string }}
 */
function collectStats() {
  const firstCommit = getFirstCommitDate();
  const latestCommit = getLatestCommitDate();
  const totalCommits = getTotalCommits();
  const allDates = getCommitDates();
  const daysActive = getDaysActive(allDates);
  const totalDays = firstCommit && latestCommit
    ? daysBetween(firstCommit, latestCommit) || 1
    : 0;
  const frequency = commitFrequency(totalCommits, firstCommit, latestCommit);

  return {
    firstCommit: firstCommit ? firstCommit.substring(0, 10) : null,
    latestCommit: latestCommit ? latestCommit.substring(0, 10) : null,
    totalCommits,
    daysActive,
    totalDays,
    frequency,
  };
}

/**
 * Get commit counts per day for the last N days.
 * @param {number} days
 * @returns {Map<string, number>}
 */
function getCommitCounts(days = 90) {
  const dates = getCommitDates(days);
  const counts = new Map();
  for (const d of dates) {
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  return counts;
}

/**
 * Generate ASCII calendar heatmap for last 3 months.
 * @param {Map<string, number>} counts
 * @returns {string}
 */
function generateCalendar(counts) {
  const lines = ['Commit Activity (last 90 days)', ''];
  const today = new Date();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build 13 weeks of data
  const weeks = [];
  for (let w = 12; w >= 0; w--) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const key = date.toISOString().substring(0, 10);
      week.push({ date: key, count: counts.get(key) || 0 });
    }
    weeks.push(week);
  }

  // Render: rows are days of week, columns are weeks
  for (let d = 0; d < 7; d++) {
    let row = `  ${dayLabels[d]} `;
    for (const week of weeks) {
      const c = week[d].count;
      if (c === 0) row += '·  ';
      else if (c <= 2) row += '░  ';
      else if (c <= 5) row += '▒  ';
      else row += '█  ';
    }
    lines.push(row);
  }

  lines.push('');
  lines.push('  Legend: · = 0  ░ = 1-2  ▒ = 3-5  █ = 6+');

  return lines.join('\n');
}

/**
 * Compute commit streaks.
 * @param {string[]} allDates — array of YYYY-MM-DD (may have duplicates)
 * @returns {{ current: number, longest: number }}
 */
function computeStreaks(allDates) {
  if (allDates.length === 0) return { current: 0, longest: 0 };

  const uniqueDays = [...new Set(allDates)].sort();
  if (uniqueDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let current = 1;
  let streakLen = 1;

  const todayStr = new Date().toISOString().substring(0, 10);
  const lastDay = uniqueDays[uniqueDays.length - 1];

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = Math.round((curr - prev) / 86400000);

    if (diffDays === 1) {
      streakLen++;
    } else {
      if (streakLen > longest) longest = streakLen;
      streakLen = 1;
    }
  }
  if (streakLen > longest) longest = streakLen;

  // Current streak: count backwards from today or last commit day
  current = 0;
  const refDay = lastDay === todayStr ? todayStr : lastDay;
  for (let i = uniqueDays.length - 1; i >= 0; i--) {
    const expected = new Date(refDay);
    expected.setDate(expected.getDate() - (uniqueDays.length - 1 - i));
    // Simple: walk backwards from last day
    break;
  }

  // Recalculate current streak from the end
  current = 1;
  for (let i = uniqueDays.length - 2; i >= 0; i--) {
    const curr = new Date(uniqueDays[i + 1]);
    const prev = new Date(uniqueDays[i]);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      current++;
    } else {
      break;
    }
  }

  return { current, longest };
}

/**
 * Format uptime stats as table.
 * @param {object} stats
 * @returns {string}
 */
function formatTable(stats) {
  const lines = [
    'AIOX Uptime Tracker',
    '',
    `  First commit:      ${stats.firstCommit || 'N/A'}`,
    `  Latest commit:     ${stats.latestCommit || 'N/A'}`,
    `  Total commits:     ${stats.totalCommits}`,
    `  Days active:       ${stats.daysActive}`,
    `  Project lifespan:  ${stats.totalDays} days`,
    `  Commit frequency:  ${stats.frequency} commits/day`,
  ];
  return lines.join('\n');
}

/**
 * Run the uptime command.
 * @param {string[]} argv
 */
function runUptime(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
AIOX Uptime Tracker

USAGE:
  aiox uptime              Show project uptime stats
  aiox uptime --format json  Output as JSON
  aiox uptime --calendar   ASCII calendar heatmap (last 3 months)
  aiox uptime --streak     Current and longest commit streak
  aiox uptime --help       Show this help
`);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 ? argv[formatIdx + 1] : 'table';

  // --calendar
  if (argv.includes('--calendar')) {
    const counts = getCommitCounts(90);
    if (format === 'json') {
      const obj = {};
      for (const [k, v] of counts) obj[k] = v;
      console.log(JSON.stringify(obj, null, 2));
    } else {
      console.log(generateCalendar(counts));
    }
    return;
  }

  // --streak
  if (argv.includes('--streak')) {
    const allDates = getCommitDates();
    const streaks = computeStreaks(allDates);
    if (format === 'json') {
      console.log(JSON.stringify(streaks, null, 2));
    } else {
      console.log(`Current streak: ${streaks.current} day(s)`);
      console.log(`Longest streak: ${streaks.longest} day(s)`);
    }
    return;
  }

  // default: show stats
  const stats = collectStats();
  if (format === 'json') {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log(formatTable(stats));
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runUptime,
  getFirstCommitDate,
  getLatestCommitDate,
  getTotalCommits,
  getCommitDates,
  getDaysActive,
  daysBetween,
  commitFrequency,
  collectStats,
  getCommitCounts,
  generateCalendar,
  computeStreaks,
  formatTable,
  git,
};
