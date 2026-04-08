/**
 * Health Dashboard Command Module
 *
 * Aggregates data from existing modules to show comprehensive project health.
 *
 * Subcommands:
 *   aiox health          — Show project health report
 *   aiox health --json   — Output health data as JSON
 *
 * @module cli/commands/health
 * @version 1.0.0
 * @story 5.3 — Project Health Dashboard CLI
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Path Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolve project root (cwd).
 * @returns {string}
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Resolve stories directory path.
 * @returns {string}
 */
function getStoriesDir() {
  return path.join(getProjectRoot(), 'docs', 'stories');
}

/**
 * Resolve squads directory path.
 * @returns {string}
 */
function getSquadsDir() {
  return path.join(getProjectRoot(), 'squads');
}

// ── Collectors ────────────────────────────────────────────────────────────────

/**
 * Run npm test silently and capture pass/fail counts.
 * Returns { passing, failing, status } or { status: 'UNKNOWN' } on error.
 *
 * @returns {{ passing: number, failing: number, status: string } | { status: string }}
 */
function collectTestStatus() {
  try {
    const output = execSync('npm test -- --silent 2>&1', {
      cwd: getProjectRoot(),
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseTestOutput(output);
  } catch (error) {
    // npm test exits non-zero when tests fail — still has output
    if (error.stdout || error.stderr) {
      const combined = (error.stdout || '') + (error.stderr || '');
      return parseTestOutput(combined);
    }
    return { passing: 0, failing: 0, status: 'UNKNOWN' };
  }
}

/**
 * Parse Jest output for pass/fail counts.
 * Handles patterns like:
 *   Tests:       10 failed, 7885 passed, 7895 total
 *   Test Suites: 2 failed, 150 passed, 152 total
 *
 * @param {string} output - Raw test runner output
 * @returns {{ passing: number, failing: number, status: string }}
 */
function parseTestOutput(output) {
  const result = { passing: 0, failing: 0, status: 'UNKNOWN' };

  if (!output || typeof output !== 'string') {
    return result;
  }

  // Match Jest "Tests:" summary line
  const testsLine = output.match(/Tests:\s+(.+)/);
  if (testsLine) {
    const line = testsLine[1];
    const passMatch = line.match(/(\d+)\s+passed/);
    const failMatch = line.match(/(\d+)\s+failed/);
    if (passMatch) result.passing = parseInt(passMatch[1], 10);
    if (failMatch) result.failing = parseInt(failMatch[1], 10);
    result.status = result.failing > 0 ? 'FAILING' : 'PASSING';
    return result;
  }

  // Fallback: count "PASS" and "FAIL" lines (Jest suite output)
  const passLines = (output.match(/^PASS\s/gm) || []).length;
  const failLines = (output.match(/^FAIL\s/gm) || []).length;
  if (passLines > 0 || failLines > 0) {
    result.passing = passLines;
    result.failing = failLines;
    result.status = failLines > 0 ? 'FAILING' : 'PASSING';
  }

  return result;
}

/**
 * Read story files and count by status.
 * Looks for status markers: Done/Complete, InProgress, Ready, Draft.
 *
 * @returns {{ done: number, inProgress: number, ready: number, draft: number, total: number }}
 */
function collectStoryProgress() {
  const result = { done: 0, inProgress: 0, ready: 0, draft: 0, total: 0 };
  const storiesDir = getStoriesDir();

  try {
    if (!fs.existsSync(storiesDir)) {
      return result;
    }

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
 * Checks for checkbox markers first (most reliable), then status section text.
 * Priority: checkbox [x] Done > [x] InProgress > [x] Ready > text patterns > draft
 *
 * @param {string} content - Story file content
 * @returns {'done' | 'inProgress' | 'ready' | 'draft'}
 */
function detectStoryStatus(content) {
  if (!content || typeof content !== 'string') {
    return 'draft';
  }

  // Priority 1: Check checkbox-based status markers (most reliable)
  const doneChecked = content.match(/- \[x\]\s*(Done|Complete)/i);
  const inProgressChecked = content.match(/- \[x\]\s*InProgress/i);
  const readyChecked = content.match(/- \[x\]\s*Ready/i);

  if (doneChecked) return 'done';
  if (inProgressChecked) return 'inProgress';

  // Priority 2: Check status section for explicit status text
  const statusSection = extractStatusSection(content);
  if (statusSection) {
    const statusLower = statusSection.toLowerCase();

    // Check for completion markers in status section prose (not checkbox labels)
    // Strip out unchecked checkbox lines before checking for completion keywords
    const withoutUnchecked = statusLower.replace(/- \[ \]\s*.*/g, '');
    const hasCompletionText = withoutUnchecked.match(
      /(complete|done|ready for merge)/
    );
    if (hasCompletionText) return 'done';

    // Check for in-progress as plain text status
    const hasInProgressText = statusLower.match(
      /(?:^|\n)\s*(?:\*\*status:\*\*|status:)?\s*inprogress|(?:^|\n)inprogress/
    );
    if (hasInProgressText) return 'inProgress';
  }

  // Priority 3: Ready checkbox (after ruling out done/inProgress)
  if (readyChecked) return 'ready';

  // Priority 4: Text-based ready detection in status section
  if (statusSection) {
    const statusLower = statusSection.toLowerCase();
    if (statusLower.match(/(?:^|\n)\s*(?:\*\*status:\*\*|status:)?\s*ready/)) return 'ready';
  }

  return 'draft';
}

/**
 * Extract the ## Status section from story content.
 * @param {string} content
 * @returns {string | null}
 */
function extractStatusSection(content) {
  const match = content.match(/## Status\s*\n([\s\S]*?)(?=\n## |\n---|\n$|$)/);
  return match ? match[1] : null;
}

/**
 * Import and read telemetry state from the telemetry module.
 * @returns {{ enabled: boolean }}
 */
function collectTelemetryStatus() {
  try {
    const telemetryPath = path.join(
      getProjectRoot(),
      '.aiox-core', 'cli', 'commands', 'telemetry', 'index.js'
    );
    if (!fs.existsSync(telemetryPath)) {
      return { enabled: false, status: 'N/A' };
    }
    const { readTelemetryState } = require(telemetryPath);
    const state = readTelemetryState();
    return { enabled: state.enabled, status: state.enabled ? 'enabled' : 'disabled' };
  } catch {
    return { enabled: false, status: 'N/A' };
  }
}

/**
 * Read squads directory and count installed squads.
 * Excludes hidden dirs and the _example template.
 *
 * @returns {{ installed: number, names: string[] }}
 */
function collectSquadsStatus() {
  const result = { installed: 0, names: [] };
  const squadsDir = getSquadsDir();

  try {
    if (!fs.existsSync(squadsDir)) {
      return result;
    }

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

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Collect all health data.
 * @param {{ skipTests?: boolean }} options
 * @returns {object}
 */
function collectAll(options = {}) {
  const tests = options.skipTests
    ? { passing: 0, failing: 0, status: 'SKIPPED' }
    : collectTestStatus();
  const stories = collectStoryProgress();
  const telemetry = collectTelemetryStatus();
  const squads = collectSquadsStatus();
  const branch = collectGitBranch();
  const version = collectVersion();

  const overall = determineOverallStatus({ tests, stories });

  return {
    tests,
    stories,
    telemetry,
    squads,
    branch,
    version,
    overall,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Determine overall project health status.
 * @param {{ tests: object, stories: object }} data
 * @returns {string}
 */
function determineOverallStatus({ tests, stories }) {
  if (tests.status === 'UNKNOWN') return 'UNKNOWN';
  if (tests.status === 'FAILING' && tests.failing > tests.passing * 0.1) return 'DEGRADED';
  if (tests.status === 'FAILING') return 'HEALTHY (with failures)';
  if (stories.total === 0) return 'HEALTHY';
  return 'HEALTHY';
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format health data as a human-readable CLI report.
 * @param {object} data - Health data from collectAll()
 * @returns {string}
 */
function formatHealthReport(data) {
  const lines = [];
  const sep = '\u2500'.repeat(36);

  lines.push('');
  lines.push('AIOX Project Health Report');
  lines.push(sep);

  // Tests
  const testsStr = formatTestsLine(data.tests);
  lines.push(`  Tests:      ${testsStr}`);

  // Stories
  const storiesStr = formatStoriesLine(data.stories);
  lines.push(`  Stories:    ${storiesStr}`);

  // Telemetry
  const telStr = data.telemetry ? data.telemetry.status || 'N/A' : 'N/A';
  lines.push(`  Telemetry:  ${telStr}`);

  // Squads
  const squadsStr = data.squads
    ? `${data.squads.installed} installed`
    : 'N/A';
  lines.push(`  Squads:     ${squadsStr}`);

  // Branch
  lines.push(`  Branch:     ${data.branch || 'N/A'}`);

  // Version
  lines.push(`  Version:    ${data.version || 'N/A'}`);

  lines.push(sep);
  lines.push(`  Overall: ${data.overall || 'UNKNOWN'}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format tests line for report.
 * @param {object} tests
 * @returns {string}
 */
function formatTestsLine(tests) {
  if (!tests || tests.status === 'UNKNOWN') return 'UNKNOWN';
  if (tests.status === 'SKIPPED') return 'SKIPPED';
  const parts = [];
  if (tests.passing > 0) parts.push(`${tests.passing} passing`);
  if (tests.failing > 0) parts.push(`${tests.failing} failing`);
  if (parts.length === 0) return 'no tests found';
  return parts.join(', ');
}

/**
 * Format stories line for report.
 * @param {object} stories
 * @returns {string}
 */
function formatStoriesLine(stories) {
  if (!stories || stories.total === 0) return 'no stories found';
  const parts = [];
  if (stories.done > 0) parts.push(`${stories.done} done`);
  if (stories.inProgress > 0) parts.push(`${stories.inProgress} in progress`);
  if (stories.ready > 0) parts.push(`${stories.ready} ready`);
  if (stories.draft > 0) parts.push(`${stories.draft} draft`);
  return `${parts.join(', ')} (${stories.total} total)`;
}

// ── CLI Handler ───────────────────────────────────────────────────────────────

/**
 * CLI handler for the health command.
 * @param {string[]} argv - Subcommand arguments
 */
function runHealth(argv) {
  const args = argv || [];
  const jsonFlag = args.includes('--json');
  const skipTests = args.includes('--skip-tests');

  const data = collectAll({ skipTests });

  if (jsonFlag) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatHealthReport(data));
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Collectors
  collectTestStatus,
  collectStoryProgress,
  collectTelemetryStatus,
  collectSquadsStatus,
  collectGitBranch,
  collectVersion,
  collectAll,

  // Parsing
  parseTestOutput,
  detectStoryStatus,
  extractStatusSection,

  // Formatting
  formatHealthReport,
  formatTestsLine,
  formatStoriesLine,
  determineOverallStatus,

  // CLI
  runHealth,

  // Path helpers (for testing)
  getProjectRoot,
  getStoriesDir,
  getSquadsDir,
};
