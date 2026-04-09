/**
 * Dead Code Detector Command Module
 *
 * Finds exported functions that are never imported/required elsewhere.
 *
 * Subcommands:
 *   aiox dead-code              — find dead exports in project
 *   aiox dead-code --type js    — filter by file type
 *   aiox dead-code --format json — output as JSON
 *   aiox dead-code --ignore "tests/**" — ignore patterns
 *
 * @module cli/commands/dead-code
 * @version 1.0.0
 * @story 22.1 — Dead Code Detector
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const EXTENSION_MAP = {
  js: new Set(['.js', '.mjs', '.cjs']),
  ts: new Set(['.ts', '.tsx']),
};

const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

/**
 * Pattern to match module.exports assignments.
 * Captures named exports: module.exports = { fn1, fn2 } or module.exports.name = ...
 */
const EXPORT_PATTERNS = [
  /module\.exports\s*=\s*\{([^}]+)\}/g,
  /module\.exports\.(\w+)\s*=/g,
  /exports\.(\w+)\s*=/g,
];

/**
 * Pattern to match require() calls.
 */
const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Pattern to match destructured requires.
 * const { fn1, fn2 } = require(...)
 */
const DESTRUCTURE_REQUIRE = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check if a path matches any of the ignore patterns.
 * Supports simple glob: "tests/**", "*.test.js", "dist/"
 * @param {string} filePath
 * @param {string[]} ignorePatterns
 * @returns {boolean}
 */
function matchesIgnorePattern(filePath, ignorePatterns) {
  if (!ignorePatterns || ignorePatterns.length === 0) return false;

  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of ignorePatterns) {
    const p = pattern.replace(/\\/g, '/');

    // "dir/**" — matches anything under dir
    if (p.endsWith('/**')) {
      const prefix = p.slice(0, -3);
      if (normalized.includes(prefix + '/') || normalized === prefix) return true;
    }
    // "*.ext" — matches files with that extension
    else if (p.startsWith('*.')) {
      const ext = p.slice(1);
      if (normalized.endsWith(ext)) return true;
    }
    // "dir/" — matches directory prefix
    else if (p.endsWith('/')) {
      if (normalized.includes(p) || normalized.includes(p.slice(0, -1) + '/')) return true;
    }
    // Exact or substring match
    else {
      if (normalized.includes(p)) return true;
    }
  }

  return false;
}

/**
 * Walk directory collecting files by extension set.
 * @param {string} dir
 * @param {Set<string>} extensions
 * @param {string[]} ignorePatterns
 * @param {string[]} results
 * @returns {string[]}
 */
function collectFiles(dir, extensions, ignorePatterns = [], results = []) {
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
        collectFiles(full, extensions, ignorePatterns, results);
      }
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      if (!matchesIgnorePattern(full, ignorePatterns)) {
        results.push(full);
      }
    }
  }

  return results;
}

/**
 * Extract exported names from a file's source code.
 * @param {string} source
 * @returns {string[]}
 */
function extractExports(source) {
  const exports = new Set();

  // module.exports = { fn1, fn2, fn3 }
  const objPattern = /module\.exports\s*=\s*\{([^}]+)\}/g;
  let match;
  while ((match = objPattern.exec(source)) !== null) {
    const inner = match[1];
    const names = inner.split(',').map(s => {
      const trimmed = s.trim();
      // Handle "name: value" or just "name"
      const colonIdx = trimmed.indexOf(':');
      return colonIdx >= 0 ? trimmed.slice(0, colonIdx).trim() : trimmed;
    }).filter(Boolean);
    names.forEach(n => exports.add(n));
  }

  // module.exports.name = ...
  const dotPattern = /module\.exports\.(\w+)\s*=/g;
  while ((match = dotPattern.exec(source)) !== null) {
    exports.add(match[1]);
  }

  // exports.name = ...
  const exportsPattern = /exports\.(\w+)\s*=/g;
  while ((match = exportsPattern.exec(source)) !== null) {
    exports.add(match[1]);
  }

  return Array.from(exports);
}

/**
 * Extract imported/required names from a file's source code.
 * @param {string} source
 * @returns {string[]}
 */
function extractImports(source) {
  const imports = new Set();

  // const { fn1, fn2 } = require('...')
  const destructPattern = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"][^'"]+['"]\s*\)/g;
  let match;
  while ((match = destructPattern.exec(source)) !== null) {
    const inner = match[1];
    const names = inner.split(',').map(s => {
      const trimmed = s.trim();
      // Handle "name: alias" — the name being imported is before the colon
      const colonIdx = trimmed.indexOf(':');
      return colonIdx >= 0 ? trimmed.slice(0, colonIdx).trim() : trimmed;
    }).filter(Boolean);
    names.forEach(n => imports.add(n));
  }

  // Also track plain requires for module-level usage
  const plainRequire = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = plainRequire.exec(source)) !== null) {
    imports.add('__module__:' + match[1]);
  }

  return Array.from(imports);
}

/**
 * Build a usage map of all exports and imports across the project.
 * @param {string[]} files
 * @returns {{ exports: Array<{file: string, name: string}>, imports: Set<string> }}
 */
function buildUsageMap(files) {
  const allExports = [];
  const allImports = new Set();

  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const fileExports = extractExports(source);
    for (const name of fileExports) {
      allExports.push({ file, name });
    }

    const fileImports = extractImports(source);
    for (const name of fileImports) {
      allImports.add(name);
    }
  }

  return { exports: allExports, imports: allImports };
}

/**
 * Find dead (unused) exports across the project.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.type] - file type filter
 * @param {string[]} [options.ignore] - ignore patterns
 * @param {string} [options.format] - 'text' or 'json'
 * @returns {Array<{file: string, name: string}>}
 */
function findDeadCode(options = {}) {
  const cwd = options.cwd || process.cwd();
  const extensions = options.type && EXTENSION_MAP[options.type]
    ? EXTENSION_MAP[options.type]
    : DEFAULT_EXTENSIONS;

  const files = collectFiles(cwd, extensions, options.ignore || []);
  const { exports: allExports, imports: allImports } = buildUsageMap(files);

  // An export is "dead" if its name is never seen in any import across all files
  const deadExports = allExports.filter(exp => !allImports.has(exp.name));

  return deadExports;
}

/**
 * Format dead code results as text.
 * @param {Array<{file: string, name: string}>} results
 * @param {string} cwd
 * @returns {string}
 */
function formatText(results, cwd) {
  if (results.length === 0) {
    return 'No dead code found. All exports are used.';
  }

  const lines = [];
  lines.push('Dead Code Report');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`${'Export'.padEnd(30)} ${'File'}`);
  lines.push('-'.repeat(60));

  for (const r of results) {
    const relFile = path.relative(cwd, r.file);
    const name = r.name.length > 28 ? r.name.slice(0, 28) + '..' : r.name.padEnd(30);
    lines.push(`${name} ${relFile}`);
  }

  lines.push('');
  lines.push(`Total dead exports: ${results.length}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run dead code detection.
 * @param {string[]} argv
 */
function runDeadCode(argv = []) {
  const options = { format: 'text', ignore: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) {
      options.type = argv[++i];
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--ignore' && argv[i + 1]) {
      options.ignore.push(argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox dead-code [--type js] [--format json] [--ignore "pattern"]');
      return;
    }
  }

  const cwd = process.cwd();
  options.cwd = cwd;
  const results = findDeadCode(options);

  if (options.format === 'json') {
    const jsonResults = results.map(r => ({
      ...r,
      file: path.relative(cwd, r.file),
    }));
    console.log(JSON.stringify(jsonResults, null, 2));
  } else {
    console.log(formatText(results, cwd));
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDeadCode,
  findDeadCode,
  extractExports,
  extractImports,
  buildUsageMap,
  collectFiles,
  matchesIgnorePattern,
  formatText,
};
