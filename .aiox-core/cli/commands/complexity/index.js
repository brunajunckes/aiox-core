/**
 * Code Complexity Analyzer Command Module
 *
 * Analyzes JS files and reports cyclomatic complexity per function.
 *
 * Subcommands:
 *   aiox complexity              — analyze all JS files in project
 *   aiox complexity <file>       — analyze specific file
 *   aiox complexity --threshold N — only show functions above N
 *   aiox complexity --format json — output as JSON
 *   aiox complexity --top N      — top N most complex functions
 *
 * @module cli/commands/complexity
 * @version 1.0.0
 * @story 21.1 — Code Complexity Analyzer
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

/**
 * Pattern to detect function declarations.
 * Captures: function name(...) / const name = function / const name = (...) => / method(...)
 */
const FUNCTION_PATTERNS = [
  /^[ \t]*function\s+(\w+)\s*\(/,
  /^[ \t]*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
  /^[ \t]*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
  /^[ \t]*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\w+\s*=>/,
  /^[ \t]*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
];

/**
 * Complexity increment tokens.
 * Each occurrence adds 1 to cyclomatic complexity.
 */
const COMPLEXITY_REGEX = /\b(if|else\s+if|for|while|switch|case|catch)\b|&&|\|\||\?(?!=)/g;

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Walk directory collecting JS files.
 * @param {string} dir
 * @param {string[]} results
 * @returns {string[]}
 */
function collectJSFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        collectJSFiles(full, results);
      }
    } else if (entry.isFile() && JS_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract function names and their line ranges from source code.
 * @param {string} source
 * @returns {Array<{name: string, startLine: number, endLine: number, body: string}>}
 */
function extractFunctions(source) {
  const lines = source.split('\n');
  const functions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let funcName = null;

    for (const pattern of FUNCTION_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // Get the actual function name from capture groups
        funcName = match[2] || match[1];
        if (funcName === 'async') funcName = null;
        break;
      }
    }

    if (funcName) {
      // Find function body by counting braces
      let braceCount = 0;
      let started = false;
      let endLine = i;

      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') {
            braceCount++;
            started = true;
          } else if (ch === '}') {
            braceCount--;
          }
        }
        if (started && braceCount <= 0) {
          endLine = j;
          break;
        }
        if (j === lines.length - 1) {
          endLine = j;
        }
      }

      const bodyLines = lines.slice(i, endLine + 1);
      functions.push({
        name: funcName,
        startLine: i + 1,
        endLine: endLine + 1,
        body: bodyLines.join('\n'),
      });
    }
  }

  return functions;
}

/**
 * Calculate cyclomatic complexity for a function body.
 * Base complexity is 1 + count of decision points.
 * @param {string} body
 * @returns {number}
 */
function calculateComplexity(body) {
  const matches = body.match(COMPLEXITY_REGEX);
  return 1 + (matches ? matches.length : 0);
}

/**
 * Analyze a single file for complexity.
 * @param {string} filePath
 * @returns {Array<{file: string, function: string, line: number, complexity: number}>}
 */
function analyzeFile(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const funcs = extractFunctions(source);
  const results = [];

  for (const fn of funcs) {
    const complexity = calculateComplexity(fn.body);
    results.push({
      file: filePath,
      function: fn.name,
      line: fn.startLine,
      complexity,
    });
  }

  return results;
}

/**
 * Analyze all JS files in the project.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.file] - specific file to analyze
 * @param {number} [options.threshold] - minimum complexity to report
 * @param {number} [options.top] - top N most complex
 * @param {string} [options.format] - 'text' or 'json'
 * @returns {Array<{file: string, function: string, line: number, complexity: number}>}
 */
function analyzeComplexity(options = {}) {
  const cwd = options.cwd || process.cwd();
  let files;

  if (options.file) {
    const filePath = path.isAbsolute(options.file)
      ? options.file
      : path.join(cwd, options.file);
    files = [filePath];
  } else {
    files = collectJSFiles(cwd);
  }

  let results = [];
  for (const file of files) {
    results = results.concat(analyzeFile(file));
  }

  // Sort by complexity descending
  results.sort((a, b) => b.complexity - a.complexity);

  // Apply threshold filter
  if (options.threshold) {
    results = results.filter((r) => r.complexity >= options.threshold);
  }

  // Apply top N
  if (options.top) {
    results = results.slice(0, options.top);
  }

  return results;
}

/**
 * Format results as text table.
 * @param {Array} results
 * @param {string} cwd
 * @returns {string}
 */
function formatText(results, cwd) {
  if (results.length === 0) {
    return 'No functions found or all below threshold.';
  }

  const lines = [];
  lines.push('Code Complexity Report');
  lines.push('='.repeat(70));
  lines.push('');
  lines.push(
    `${'Complexity'.padEnd(12)} ${'Function'.padEnd(30)} ${'File'.padEnd(20)} Line`
  );
  lines.push('-'.repeat(70));

  for (const r of results) {
    const relFile = path.relative(cwd, r.file);
    const complexity = String(r.complexity).padEnd(12);
    const funcName = r.function.length > 28 ? r.function.slice(0, 28) + '..' : r.function.padEnd(30);
    const fileName = relFile.length > 18 ? '...' + relFile.slice(-17) : relFile.padEnd(20);
    lines.push(`${complexity} ${funcName} ${fileName} ${r.line}`);
  }

  lines.push('');
  lines.push(`Total functions analyzed: ${results.length}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run complexity analysis.
 * @param {string[]} argv
 */
function runComplexity(argv = []) {
  const options = { format: 'text' };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--threshold' && argv[i + 1]) {
      options.threshold = parseInt(argv[++i], 10);
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--top' && argv[i + 1]) {
      options.top = parseInt(argv[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox complexity [file] [--threshold N] [--format json] [--top N]');
      return;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    options.file = positional[0];
  }

  const cwd = process.cwd();
  options.cwd = cwd;
  const results = analyzeComplexity(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatText(results, cwd));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runComplexity,
  analyzeComplexity,
  analyzeFile,
  extractFunctions,
  calculateComplexity,
  collectJSFiles,
  formatText,
};
