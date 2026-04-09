/**
 * Git Diff Analyzer Command Module
 *
 * Analyzes uncommitted changes: files changed, lines added/removed, impact score.
 *
 * Subcommands:
 *   aiox diff-analyze              — analyze all uncommitted changes
 *   aiox diff-analyze --staged     — analyze staged changes only
 *   aiox diff-analyze --format json — output as JSON
 *   aiox diff-analyze --risk       — risk assessment
 *   aiox diff-analyze --suggest-reviewers — suggest reviewers via git blame
 *
 * @module cli/commands/diff-analyze
 * @version 1.0.0
 * @story 23.1 — Git Diff Analyzer
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Run a git command and return stdout.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {string}
 */
function gitExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Parse git diff --numstat output into structured data.
 * Each line: added\tremoved\tfilename
 * @param {string} numstatOutput
 * @returns {Array<{file: string, added: number, removed: number}>}
 */
function parseNumstat(numstatOutput) {
  if (!numstatOutput) return [];

  return numstatOutput.split('\n').filter(Boolean).map(line => {
    const parts = line.split('\t');
    if (parts.length < 3) return null;
    const added = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
    const removed = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    const file = parts.slice(2).join('\t');
    return { file, added, removed };
  }).filter(Boolean);
}

/**
 * Calculate impact score from diff stats.
 * Score = totalLines * fileWeight
 * fileWeight increases logarithmically with file count.
 * @param {Array<{file: string, added: number, removed: number}>} files
 * @returns {number} impact score 0-100
 */
function calculateImpactScore(files) {
  if (files.length === 0) return 0;

  const totalLines = files.reduce((sum, f) => sum + f.added + f.removed, 0);
  const fileCount = files.length;

  // Base score from lines changed (max 50 points)
  const lineScore = Math.min(50, (totalLines / 20));

  // File count score (max 30 points)
  const fileScore = Math.min(30, fileCount * 3);

  // Complexity bonus: many files with many lines (max 20 points)
  const complexityScore = Math.min(20, (totalLines * fileCount) / 500);

  return Math.round(Math.min(100, lineScore + fileScore + complexityScore));
}

/**
 * Assess risk level based on diff stats.
 * @param {Array<{file: string, added: number, removed: number}>} files
 * @returns {{ level: string, reasons: string[] }}
 */
function assessRisk(files) {
  const reasons = [];
  const totalLines = files.reduce((sum, f) => sum + f.added + f.removed, 0);
  const fileCount = files.length;

  if (totalLines > 500) {
    reasons.push(`Large change: ${totalLines} lines modified (threshold: 500)`);
  }
  if (fileCount > 10) {
    reasons.push(`Many files: ${fileCount} files changed (threshold: 10)`);
  }

  // Check for config/infrastructure files
  const sensitivePatterns = ['.env', 'package.json', 'Dockerfile', '.yml', '.yaml', 'config'];
  const sensitiveFiles = files.filter(f =>
    sensitivePatterns.some(p => f.file.includes(p)),
  );
  if (sensitiveFiles.length > 0) {
    reasons.push(`Sensitive files: ${sensitiveFiles.map(f => f.file).join(', ')}`);
  }

  // Check for test files
  const testFiles = files.filter(f => f.file.includes('.test.') || f.file.includes('.spec.'));
  if (testFiles.length === 0 && fileCount > 0) {
    reasons.push('No test files in change set');
  }

  let level;
  if (totalLines > 500 || fileCount > 10) {
    level = 'HIGH';
  } else if (totalLines > 200 || fileCount > 5 || sensitiveFiles.length > 0) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return { level, reasons };
}

/**
 * Suggest reviewers based on git blame for changed files.
 * @param {Array<{file: string}>} files
 * @param {string} cwd
 * @returns {Array<{author: string, files: number, percentage: number}>}
 */
function suggestReviewers(files, cwd) {
  const authorCounts = {};

  for (const f of files) {
    const blameOutput = gitExec(`git blame --porcelain "${f.file}" 2>/dev/null | grep "^author "`, cwd);
    if (!blameOutput) continue;

    const authors = blameOutput.split('\n').filter(Boolean).map(line => line.replace('author ', '').trim());
    const unique = new Set(authors);
    for (const author of unique) {
      if (!authorCounts[author]) authorCounts[author] = 0;
      authorCounts[author]++;
    }
  }

  const total = files.length || 1;
  return Object.entries(authorCounts)
    .map(([author, count]) => ({
      author,
      files: count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.files - a.files);
}

/**
 * Analyze git diff and return structured results.
 * @param {object} options
 * @param {string} [options.cwd]
 * @param {boolean} [options.staged]
 * @param {boolean} [options.risk]
 * @param {boolean} [options.suggestReviewers]
 * @returns {object}
 */
function analyzeDiff(options = {}) {
  const cwd = options.cwd || process.cwd();
  const stagedFlag = options.staged ? '--staged' : '';

  const numstat = gitExec(`git diff ${stagedFlag} --numstat`, cwd);
  const files = parseNumstat(numstat);

  const totalAdded = files.reduce((sum, f) => sum + f.added, 0);
  const totalRemoved = files.reduce((sum, f) => sum + f.removed, 0);
  const impactScore = calculateImpactScore(files);

  const result = {
    filesChanged: files.length,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
    totalLines: totalAdded + totalRemoved,
    impactScore,
    files,
  };

  if (options.risk) {
    result.risk = assessRisk(files);
  }

  if (options.suggestReviewers) {
    result.reviewers = suggestReviewers(files, cwd);
  }

  return result;
}

/**
 * Format analysis results as text.
 * @param {object} result
 * @returns {string}
 */
function formatText(result) {
  const lines = [];
  lines.push('Git Diff Analysis');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Files changed:  ${result.filesChanged}`);
  lines.push(`Lines added:    +${result.linesAdded}`);
  lines.push(`Lines removed:  -${result.linesRemoved}`);
  lines.push(`Total changes:  ${result.totalLines}`);
  lines.push(`Impact score:   ${result.impactScore}/100`);

  if (result.files.length > 0) {
    lines.push('');
    lines.push('Files:');
    lines.push('-'.repeat(50));
    for (const f of result.files) {
      lines.push(`  +${f.added} -${f.removed}\t${f.file}`);
    }
  }

  if (result.risk) {
    lines.push('');
    lines.push(`Risk Level: ${result.risk.level}`);
    if (result.risk.reasons.length > 0) {
      lines.push('Reasons:');
      for (const r of result.risk.reasons) {
        lines.push(`  - ${r}`);
      }
    }
  }

  if (result.reviewers && result.reviewers.length > 0) {
    lines.push('');
    lines.push('Suggested Reviewers:');
    lines.push('-'.repeat(50));
    for (const r of result.reviewers) {
      lines.push(`  ${r.author} (${r.files} files, ${r.percentage}%)`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse CLI args and run diff analysis.
 * @param {string[]} argv
 */
function runDiffAnalyze(argv = []) {
  const options = { format: 'text' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--staged') {
      options.staged = true;
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--risk') {
      options.risk = true;
    } else if (arg === '--suggest-reviewers') {
      options.suggestReviewers = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox diff-analyze [--staged] [--format json] [--risk] [--suggest-reviewers]');
      return;
    }
  }

  const result = analyzeDiff(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatText(result));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDiffAnalyze,
  analyzeDiff,
  parseNumstat,
  calculateImpactScore,
  assessRisk,
  suggestReviewers,
  formatText,
  gitExec,
};
