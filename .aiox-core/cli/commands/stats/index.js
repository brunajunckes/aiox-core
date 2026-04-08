/**
 * Code Stats & Complexity Dashboard Command Module
 *
 * Provides codebase statistics including LOC counts, language breakdown,
 * and cyclomatic complexity analysis.
 *
 * Subcommands:
 *   aiox stats                — Show basic stats (LOC, files, language breakdown)
 *   aiox stats --complexity   — Add complexity per module
 *   aiox stats --json         — Output as JSON
 *   aiox stats --help         — Show help
 *
 * @module cli/commands/stats
 * @version 1.0.0
 * @story 7.3 — Code Stats & Complexity Dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build']);

const DEFAULT_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.md', '.yaml', '.yml', '.json', '.css', '.html', '.sh'];

const SCAN_DIRS = ['packages', '.aiox-core/cli', 'bin', 'tests'];

const COMPLEXITY_KEYWORDS = /\b(if|else\s+if|for|while|switch|catch)\b|&&|\|\||\?(?!=)/g;

const LANGUAGE_NAMES = {
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript JSX',
  '.jsx': 'JavaScript JSX',
  '.md': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.json': 'JSON',
  '.css': 'CSS',
  '.html': 'HTML',
  '.sh': 'Shell',
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Count lines of code in a file.
 * @param {string} filePath - Absolute path to file
 * @returns {number} Line count
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length === 0) return 0;
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Recursively scan a directory for files matching given extensions.
 * @param {string} dir - Directory path to scan
 * @param {string[]} [extensions] - File extensions to include (e.g. ['.js', '.ts'])
 * @returns {Array<{filePath: string, lines: number, extension: string}>}
 */
function scanDirectory(dir, extensions = DEFAULT_EXTENSIONS) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push({
            filePath: fullPath,
            lines: countLines(fullPath),
            extension: ext,
          });
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Group files by extension and sum LOC.
 * @param {Array<{filePath: string, lines: number, extension: string}>} files
 * @returns {Array<{extension: string, language: string, files: number, lines: number, percentage: number}>}
 */
function getLanguageBreakdown(files) {
  const groups = {};
  let totalLines = 0;

  for (const file of files) {
    const ext = file.extension;
    if (!groups[ext]) {
      groups[ext] = { extension: ext, language: LANGUAGE_NAMES[ext] || ext, files: 0, lines: 0 };
    }
    groups[ext].files += 1;
    groups[ext].lines += file.lines;
    totalLines += file.lines;
  }

  const breakdown = Object.values(groups)
    .map((g) => ({
      ...g,
      percentage: totalLines > 0 ? parseFloat(((g.lines / totalLines) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  return breakdown;
}

/**
 * Calculate simple cyclomatic complexity for a file.
 * Counts occurrences of: if, else if, for, while, switch, catch, &&, ||, ?
 * @param {string} filePath - Absolute path to file
 * @returns {{filePath: string, complexity: number, lines: number}}
 */
function calculateComplexity(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.length === 0 ? 0 : content.split('\n').length;

    // Strip comments and strings to reduce false positives
    const stripped = content
      .replace(/\/\/.*$/gm, '')          // single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')  // multi-line comments
      .replace(/'(?:[^'\\]|\\.)*'/g, '') // single-quoted strings
      .replace(/"(?:[^"\\]|\\.)*"/g, '') // double-quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, ''); // template literals

    const matches = stripped.match(COMPLEXITY_KEYWORDS);
    const complexity = matches ? matches.length : 0;

    return { filePath, complexity, lines };
  } catch {
    return { filePath, complexity: 0, lines: 0 };
  }
}

/**
 * Format stats data for CLI output.
 * @param {object} data
 * @param {number} data.totalFiles
 * @param {number} data.totalLines
 * @param {Array} data.breakdown
 * @param {Array} [data.complexity] - Complexity data (if --complexity flag)
 * @returns {string}
 */
function formatStats(data) {
  const lines = [];

  lines.push('');
  lines.push('AIOX Codebase Statistics');
  lines.push('\u2501'.repeat(40));
  lines.push(`  Total files:    ${data.totalFiles.toLocaleString()}`);
  lines.push(`  Total LOC:      ${data.totalLines.toLocaleString()}`);
  lines.push('');
  lines.push('  Language Breakdown:');

  for (const lang of data.breakdown) {
    const name = `${lang.language} (${lang.extension})`;
    const loc = `${lang.lines.toLocaleString()} LOC`;
    const pct = `(${lang.percentage.toFixed(1)}%)`;
    lines.push(`    ${name.padEnd(25)} ${loc.padStart(12)}  ${pct.padStart(8)}`);
  }

  if (data.complexity && data.complexity.length > 0) {
    lines.push('');
    lines.push('  Complexity by Module (Top 20):');
    lines.push('  ' + '-'.repeat(60));

    const sorted = [...data.complexity].sort((a, b) => b.complexity - a.complexity);
    const top = sorted.slice(0, 20);

    for (const item of top) {
      const rel = data.projectRoot ? path.relative(data.projectRoot, item.filePath) : item.filePath;
      const rating = item.complexity > 30 ? 'HIGH' : item.complexity > 15 ? 'MEDIUM' : 'LOW';
      lines.push(`    ${rel.padEnd(45)} ${String(item.complexity).padStart(4)}  [${rating}]`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Run the stats CLI command.
 * @param {string[]} argv - Command arguments (after 'stats')
 */
function runStats(argv = []) {
  const showComplexity = argv.includes('--complexity');
  const jsonOutput = argv.includes('--json');
  const showHelp = argv.includes('--help') || argv.includes('-h');

  if (showHelp) {
    console.log(`
Usage: aiox stats [options]

Options:
  --complexity   Include cyclomatic complexity per module
  --json         Output as JSON
  --help, -h     Show this help message

Examples:
  aiox stats
  aiox stats --complexity
  aiox stats --json
  aiox stats --complexity --json
`);
    return;
  }

  const projectRoot = process.cwd();
  const allFiles = [];

  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(projectRoot, dir);
    const files = scanDirectory(fullDir);
    allFiles.push(...files);
  }

  const totalFiles = allFiles.length;
  const totalLines = allFiles.reduce((sum, f) => sum + f.lines, 0);
  const breakdown = getLanguageBreakdown(allFiles);

  const result = {
    totalFiles,
    totalLines,
    breakdown,
    scannedDirs: SCAN_DIRS,
    projectRoot,
  };

  if (showComplexity) {
    const codeFiles = allFiles.filter((f) => ['.js', '.ts', '.tsx', '.jsx'].includes(f.extension));
    result.complexity = codeFiles.map((f) => calculateComplexity(f.filePath));
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatStats(result));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  countLines,
  scanDirectory,
  getLanguageBreakdown,
  calculateComplexity,
  formatStats,
  runStats,
  SKIP_DIRS,
  DEFAULT_EXTENSIONS,
  SCAN_DIRS,
  LANGUAGE_NAMES,
  COMPLEXITY_KEYWORDS,
};
