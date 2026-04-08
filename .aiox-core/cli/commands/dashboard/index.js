/**
 * Interactive CLI Dashboard Command Module
 *
 * Renders a live-updating ANSI terminal dashboard showing system metrics,
 * story progress, test status, telemetry state, and squad info.
 *
 * Subcommands:
 *   aiox dashboard              — Start live dashboard (refreshes every 5s)
 *   aiox dashboard --once       — Render once and exit
 *   aiox dashboard --interval 3 — Custom refresh interval in seconds
 *   aiox dashboard --json       — Output raw data as JSON
 *
 * @module cli/commands/dashboard
 * @version 1.0.0
 * @story 8.4 — Interactive CLI Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_SEC = 5;
const MIN_INTERVAL_SEC = 1;
const MAX_INTERVAL_SEC = 300;
const BOX_WIDTH = 52;

// ANSI escape codes
const ESC = '\x1B';
const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const CYAN = `${ESC}[36m`;
const WHITE = `${ESC}[37m`;
const RED = `${ESC}[31m`;
const MAGENTA = `${ESC}[35m`;

// Box-drawing characters (Unicode)
const BOX = {
  topLeft: '\u250C',
  topRight: '\u2510',
  bottomLeft: '\u2514',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502',
  teeLeft: '\u251C',
  teeRight: '\u2524',
};

// ── Internal state ───────────────────────────────────────────────────────────

let _intervalHandle = null;
let _running = false;

// ── Path Helpers ─────────────────────────────────────────────────────────────

function getProjectRoot() {
  return process.cwd();
}

function getStoriesDir() {
  return path.join(getProjectRoot(), 'docs', 'stories');
}

function getSquadsDir() {
  return path.join(getProjectRoot(), 'squads');
}

// ── System Metrics ───────────────────────────────────────────────────────────

/**
 * Collect CPU usage percentage (1-second sample on Linux, fallback on others).
 * @returns {number} CPU usage percentage 0-100
 */
function collectCpuUsage() {
  try {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) return 0;

    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      const { user, nice, sys, idle, irq } = cpu.times;
      totalTick += user + nice + sys + idle + irq;
      totalIdle += idle;
    }
    // Rough approximation from snapshot
    const usage = Math.round(((totalTick - totalIdle) / totalTick) * 100);
    return Math.min(100, Math.max(0, usage));
  } catch {
    return 0;
  }
}

/**
 * Collect RAM usage percentage.
 * @returns {number} RAM usage percentage 0-100
 */
function collectRamUsage() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    if (total === 0) return 0;
    return Math.round(((total - free) / total) * 100);
  } catch {
    return 0;
  }
}

/**
 * Collect disk usage percentage for the root partition.
 * @returns {number} Disk usage percentage 0-100
 */
function collectDiskUsage() {
  try {
    const output = execSync("df -P / | tail -1 | awk '{print $5}'", {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const parsed = parseInt(output.replace('%', ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

// ── Project Data Collectors ──────────────────────────────────────────────────

/**
 * Get project version from package.json.
 * @returns {string}
 */
function collectVersion() {
  try {
    const pkgPath = path.join(getProjectRoot(), 'package.json');
    if (!fs.existsSync(pkgPath)) return 'N/A';
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'N/A';
  } catch {
    return 'N/A';
  }
}

/**
 * Get current git branch name.
 * @returns {string}
 */
function collectGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: getProjectRoot(),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'N/A';
  }
}

/**
 * Read story files and count by status.
 * @returns {{ done: number, inProgress: number, ready: number, draft: number, total: number }}
 */
function collectStoryProgress() {
  const result = { done: 0, inProgress: 0, ready: 0, draft: 0, total: 0 };
  const storiesDir = getStoriesDir();

  try {
    if (!fs.existsSync(storiesDir)) return result;

    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md'));
    result.total = files.length;

    for (const file of files) {
      const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      const status = detectStoryStatus(content);
      if (status === 'done') result.done++;
      else if (status === 'inProgress') result.inProgress++;
      else if (status === 'ready') result.ready++;
      else result.draft++;
    }
  } catch {
    // Graceful degradation
  }

  return result;
}

/**
 * Detect story status from file content.
 * @param {string} content
 * @returns {'done' | 'inProgress' | 'ready' | 'draft'}
 */
function detectStoryStatus(content) {
  if (!content || typeof content !== 'string') return 'draft';

  if (content.match(/- \[x\]\s*(Done|Complete)/i)) return 'done';
  if (content.match(/- \[x\]\s*InProgress/i)) return 'inProgress';
  if (content.match(/- \[x\]\s*Ready/i)) return 'ready';

  return 'draft';
}

/**
 * Collect test status without running tests (fast — reads cached result or returns unknown).
 * @returns {{ passing: number, failing: number, status: string }}
 */
function collectTestStatus() {
  try {
    // Try to read cached Jest results from common locations
    const cachePaths = [
      path.join(getProjectRoot(), '.aiox', 'cache', 'test-results.json'),
      path.join(getProjectRoot(), 'test-results.json'),
    ];

    for (const cachePath of cachePaths) {
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (data && typeof data.numPassedTests === 'number') {
          return {
            passing: data.numPassedTests,
            failing: data.numFailedTests || 0,
            status: (data.numFailedTests || 0) > 0 ? 'FAILING' : 'PASSING',
          };
        }
      }
    }

    return { passing: 0, failing: 0, status: 'UNKNOWN' };
  } catch {
    return { passing: 0, failing: 0, status: 'UNKNOWN' };
  }
}

/**
 * Collect telemetry status.
 * @returns {{ enabled: boolean, status: string }}
 */
function collectTelemetryStatus() {
  try {
    const telemetryPath = path.join(
      getProjectRoot(),
      '.aiox-core', 'cli', 'commands', 'telemetry', 'index.js'
    );
    if (!fs.existsSync(telemetryPath)) return { enabled: false, status: 'N/A' };
    const { readTelemetryState } = require(telemetryPath);
    const state = readTelemetryState();
    return { enabled: state.enabled, status: state.enabled ? 'enabled' : 'disabled' };
  } catch {
    return { enabled: false, status: 'N/A' };
  }
}

/**
 * Collect installed squads.
 * @returns {{ installed: number, names: string[] }}
 */
function collectSquadsStatus() {
  const result = { installed: 0, names: [] };
  const squadsDir = getSquadsDir();

  try {
    if (!fs.existsSync(squadsDir)) return result;

    const entries = fs.readdirSync(squadsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        result.names.push(entry.name);
        result.installed++;
      }
    }
  } catch {
    // Graceful degradation
  }

  return result;
}

/**
 * Collect recent git log entries.
 * @param {number} [count=5]
 * @returns {string[]}
 */
function collectRecentCommits(count = 5) {
  try {
    const output = execSync(`git log --oneline -${count}`, {
      cwd: getProjectRoot(),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!output) return [];
    return output.split('\n').map(line => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Data Aggregator ──────────────────────────────────────────────────────────

/**
 * Aggregate all dashboard data sources into a single object.
 * @returns {object} Dashboard data
 */
function collectDashboardData() {
  const version = collectVersion();
  const branch = collectGitBranch();
  const cpu = collectCpuUsage();
  const ram = collectRamUsage();
  const disk = collectDiskUsage();
  const stories = collectStoryProgress();
  const tests = collectTestStatus();
  const telemetry = collectTelemetryStatus();
  const squads = collectSquadsStatus();
  const recentCommits = collectRecentCommits();
  const timestamp = new Date().toISOString();

  return {
    version,
    branch,
    system: { cpu, ram, disk },
    stories,
    tests,
    telemetry,
    squads,
    recentCommits,
    timestamp,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Create a horizontal line segment.
 * @param {string} left - Left connector character
 * @param {string} right - Right connector character
 * @param {number} width - Inner width
 * @returns {string}
 */
function hLine(left, right, width) {
  return `${left}${BOX.horizontal.repeat(width)}${right}`;
}

/**
 * Pad a string to fit inside the box with a vertical border.
 * @param {string} text - Content text (may contain ANSI codes)
 * @param {number} width - Inner width
 * @returns {string}
 */
function boxLine(text, width) {
  // Strip ANSI codes for length calculation
  const stripped = text.replace(/\x1B\[[0-9;]*m/g, '');
  const padding = Math.max(0, width - 2 - stripped.length);
  return `${BOX.vertical} ${text}${' '.repeat(padding)} ${BOX.vertical}`;
}

/**
 * Format a percentage with color coding.
 * @param {number} pct
 * @returns {string}
 */
function colorPct(pct) {
  if (pct >= 80) return `${RED}${pct}%${RESET}`;
  if (pct >= 60) return `${YELLOW}${pct}%${RESET}`;
  return `${GREEN}${pct}%${RESET}`;
}

/**
 * Render the full dashboard as an ANSI-formatted string.
 * @param {object} data - Output from collectDashboardData()
 * @returns {string}
 */
function renderDashboard(data) {
  const w = BOX_WIDTH;
  const lines = [];

  // ── Header ──
  lines.push(hLine(BOX.topLeft, BOX.topRight, w));

  const title = `${BOLD}${CYAN}AIOX Dashboard${RESET}  ${WHITE}v${data.version}${RESET}  ${DIM}${data.branch}${RESET}`;
  lines.push(boxLine(title, w));

  // ── Separator ──
  lines.push(hLine(BOX.teeLeft, BOX.teeRight, w));

  // ── System Metrics ──
  const sysLine = `${BOLD}System:${RESET} CPU ${colorPct(data.system.cpu)} | RAM ${colorPct(data.system.ram)} | Disk ${colorPct(data.system.disk)}`;
  lines.push(boxLine(sysLine, w));

  // ── Stories ──
  const storyPct = data.stories.total > 0
    ? Math.round((data.stories.done / data.stories.total) * 100)
    : 0;
  const storyColor = storyPct >= 80 ? GREEN : storyPct >= 50 ? YELLOW : WHITE;
  const storiesLine = `${BOLD}Stories:${RESET} ${storyColor}${data.stories.done} done${RESET} / ${data.stories.total} total (${storyColor}${storyPct}%${RESET})`;
  lines.push(boxLine(storiesLine, w));

  // ── Tests ──
  const testStatusColor = data.tests.status === 'PASSING' ? GREEN
    : data.tests.status === 'FAILING' ? RED : DIM;
  const testLabel = data.tests.passing > 0
    ? `${data.tests.passing}+ passing`
    : data.tests.status;
  const testsLine = `${BOLD}Tests:${RESET} ${testStatusColor}${testLabel}${RESET}`;
  if (data.tests.failing > 0) {
    lines.push(boxLine(`${testsLine} ${RED}(${data.tests.failing} failing)${RESET}`, w));
  } else {
    lines.push(boxLine(testsLine, w));
  }

  // ── Telemetry ──
  const telColor = data.telemetry.enabled ? GREEN : DIM;
  const telLine = `${BOLD}Telemetry:${RESET} ${telColor}${data.telemetry.status}${RESET}`;
  lines.push(boxLine(telLine, w));

  // ── Squads ──
  const squadLine = `${BOLD}Squads:${RESET} ${data.squads.installed} installed${data.squads.names.length > 0 ? ` (${data.squads.names.join(', ')})` : ''}`;
  lines.push(boxLine(squadLine, w));

  // ── Recent Commits ──
  if (data.recentCommits.length > 0) {
    lines.push(hLine(BOX.teeLeft, BOX.teeRight, w));
    lines.push(boxLine(`${BOLD}Recent Commits:${RESET}`, w));
    for (const commit of data.recentCommits.slice(0, 3)) {
      const truncated = commit.length > (w - 6)
        ? commit.substring(0, w - 9) + '...'
        : commit;
      lines.push(boxLine(`${DIM}  ${truncated}${RESET}`, w));
    }
  }

  // ── Footer ──
  lines.push(hLine(BOX.teeLeft, BOX.teeRight, w));
  const ts = data.timestamp ? data.timestamp.replace('T', ' ').substring(0, 19) : '';
  lines.push(boxLine(`${DIM}Updated: ${ts}  |  Press Ctrl+C to exit${RESET}`, w));
  lines.push(hLine(BOX.bottomLeft, BOX.bottomRight, w));

  return lines.join('\n');
}

// ── Dashboard Lifecycle ──────────────────────────────────────────────────────

/**
 * Start the live dashboard with periodic refresh.
 * @param {number} [intervalSec=5] - Refresh interval in seconds
 */
function startDashboard(intervalSec = DEFAULT_INTERVAL_SEC) {
  if (_running) return;
  _running = true;

  const renderCycle = () => {
    const data = collectDashboardData();
    const output = renderDashboard(data);
    process.stdout.write(CLEAR_SCREEN + output + '\n');
  };

  // Initial render
  renderCycle();

  // Schedule refresh
  const ms = Math.max(MIN_INTERVAL_SEC, Math.min(MAX_INTERVAL_SEC, intervalSec)) * 1000;
  _intervalHandle = setInterval(renderCycle, ms);
}

/**
 * Stop the live dashboard and restore terminal state.
 */
function stopDashboard() {
  _running = false;
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

/**
 * Parse argv flags.
 * @param {string[]} argv
 * @returns {{ once: boolean, json: boolean, interval: number }}
 */
function parseArgs(argv) {
  const result = { once: false, json: false, interval: DEFAULT_INTERVAL_SEC };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--once') {
      result.once = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--interval' && i + 1 < argv.length) {
      const val = parseInt(argv[i + 1], 10);
      if (!isNaN(val) && val >= MIN_INTERVAL_SEC && val <= MAX_INTERVAL_SEC) {
        result.interval = val;
      }
      i++;
    }
  }

  return result;
}

/**
 * CLI handler — entry point for `aiox dashboard`.
 * @param {string[]} argv - Arguments after "dashboard"
 */
function runDashboard(argv = []) {
  const opts = parseArgs(argv);

  if (opts.json) {
    const data = collectDashboardData();
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (opts.once) {
    const data = collectDashboardData();
    const output = renderDashboard(data);
    console.log(output);
    return;
  }

  // Live mode — handle SIGINT for graceful cleanup
  const cleanup = () => {
    stopDashboard();
    process.stdout.write(`${RESET}\n`);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  startDashboard(opts.interval);
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Main entry
  runDashboard,

  // Lifecycle
  startDashboard,
  stopDashboard,

  // Data
  collectDashboardData,
  collectCpuUsage,
  collectRamUsage,
  collectDiskUsage,
  collectVersion,
  collectGitBranch,
  collectStoryProgress,
  collectTestStatus,
  collectTelemetryStatus,
  collectSquadsStatus,
  collectRecentCommits,
  detectStoryStatus,

  // Rendering
  renderDashboard,
  hLine,
  boxLine,
  colorPct,

  // Arg parsing
  parseArgs,

  // Constants (for testing)
  DEFAULT_INTERVAL_SEC,
  MIN_INTERVAL_SEC,
  MAX_INTERVAL_SEC,
  BOX_WIDTH,
  BOX,
  CLEAR_SCREEN,
};
