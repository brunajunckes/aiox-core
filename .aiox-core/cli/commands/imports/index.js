/**
 * Import Validator Command Module
 *
 * Validates all require() calls resolve to existing files,
 * detects circular dependencies, and finds unused imports.
 *
 * Subcommands:
 *   aiox imports              — validate all require() calls
 *   aiox imports --circular   — detect circular dependency chains
 *   aiox imports --unused     — find imported but unused modules
 *   aiox imports --format json — output as JSON
 *   aiox imports --fix        — remove unused imports (dry-run by default)
 *
 * @module cli/commands/imports
 * @version 1.0.0
 * @story 22.4 — Import Validator
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

/**
 * Pattern to match require() calls with their full context.
 */
const REQUIRE_FULL_PATTERN = /(?:const|let|var)\s+(?:(\w+)|\{([^}]+)\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Simple require without assignment.
 */
const REQUIRE_SIMPLE_PATTERN = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Walk directory collecting JS files.
 * @param {string} dir
 * @param {string[]} results
 * @returns {string[]}
 */
function collectFiles(dir, results = []) {
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
        collectFiles(full, results);
      }
    } else if (entry.isFile() && JS_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }

  return results;
}

/**
 * Check if a require path is a local (relative) path.
 * @param {string} reqPath
 * @returns {boolean}
 */
function isLocalRequire(reqPath) {
  return reqPath.startsWith('./') || reqPath.startsWith('../') || reqPath.startsWith('/');
}

/**
 * Resolve a require path to an absolute file path.
 * @param {string} reqPath
 * @param {string} fromFile
 * @returns {string|null}
 */
function resolveRequire(reqPath, fromFile) {
  if (!isLocalRequire(reqPath)) return null;

  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, reqPath);

  // Try exact path
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;

  // Try with extensions
  for (const ext of ['.js', '.mjs', '.cjs', '.json']) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt)) return withExt;
  }

  // Try index.js
  const indexPath = path.join(resolved, 'index.js');
  if (fs.existsSync(indexPath)) return indexPath;

  return null;
}

/**
 * Extract all require() calls from a file.
 * @param {string} filePath
 * @returns {Array<{name: string|null, destructured: string[]|null, requirePath: string, line: number}>}
 */
function extractRequires(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const requires = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match full require with assignment
    const fullPattern = /(?:const|let|var)\s+(?:(\w+)|\{([^}]+)\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = fullPattern.exec(line)) !== null) {
      const name = match[1] || null;
      const destructured = match[2]
        ? match[2].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean)
        : null;
      requires.push({
        name,
        destructured,
        requirePath: match[3],
        line: i + 1,
      });
    }

    // Match simple require (no assignment) — only if not already matched
    if (!line.match(/(?:const|let|var)\s+/)) {
      const simplePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = simplePattern.exec(line)) !== null) {
        requires.push({
          name: null,
          destructured: null,
          requirePath: match[1],
          line: i + 1,
        });
      }
    }
  }

  return requires;
}

/**
 * Validate that all local requires resolve to existing files.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<{file: string, line: number, requirePath: string, error: string}>}
 */
function validateImports(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = collectFiles(cwd);
  const errors = [];

  for (const file of files) {
    const requires = extractRequires(file);
    for (const req of requires) {
      if (!isLocalRequire(req.requirePath)) continue;

      const resolved = resolveRequire(req.requirePath, file);
      if (!resolved) {
        errors.push({
          file,
          line: req.line,
          requirePath: req.requirePath,
          error: 'Module not found',
        });
      }
    }
  }

  return errors;
}

/**
 * Build dependency graph for circular detection.
 * @param {string} cwd
 * @returns {Map<string, string[]>}
 */
function buildDependencyGraph(cwd) {
  const files = collectFiles(cwd);
  const graph = new Map();

  for (const file of files) {
    const deps = [];
    const requires = extractRequires(file);

    for (const req of requires) {
      if (!isLocalRequire(req.requirePath)) continue;
      const resolved = resolveRequire(req.requirePath, file);
      if (resolved) {
        deps.push(resolved);
      }
    }

    graph.set(file, deps);
  }

  return graph;
}

/**
 * Detect circular dependency chains using DFS.
 * @param {Map<string, string[]>} graph
 * @returns {Array<string[]>} - Each entry is a chain of files forming a cycle
 */
function detectCircular(graph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, stack) {
    if (inStack.has(node)) {
      // Found cycle — extract from the repeated node onwards
      const cycleStart = stack.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(stack.slice(cycleStart).concat(node));
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, [...stack]);
    }

    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Find imported but unused variables/modules.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<{file: string, line: number, name: string, requirePath: string}>}
 */
function findUnusedImports(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = collectFiles(cwd);
  const unused = [];

  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const requires = extractRequires(file);
    const lines = source.split('\n');

    for (const req of requires) {
      const names = [];
      if (req.name) names.push(req.name);
      if (req.destructured) names.push(...req.destructured);

      for (const name of names) {
        // Count occurrences of the name in the source (excluding the require line itself)
        let usageCount = 0;
        for (let i = 0; i < lines.length; i++) {
          if (i + 1 === req.line) continue; // Skip the require line
          // Use word boundary match
          const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          if (re.test(lines[i])) {
            usageCount++;
            break; // One usage is enough
          }
        }

        if (usageCount === 0) {
          unused.push({
            file,
            line: req.line,
            name,
            requirePath: req.requirePath,
          });
        }
      }
    }
  }

  return unused;
}

/**
 * Format validation errors as text.
 * @param {Array} errors
 * @param {string} cwd
 * @returns {string}
 */
function formatValidationText(errors, cwd) {
  if (errors.length === 0) {
    return 'All imports are valid. No broken requires found.';
  }

  const lines = [];
  lines.push('Import Validation Report');
  lines.push('='.repeat(60));
  lines.push('');

  for (const e of errors) {
    const relFile = path.relative(cwd, e.file);
    lines.push(`${relFile}:${e.line} — require('${e.requirePath}') — ${e.error}`);
  }

  lines.push('');
  lines.push(`Total broken imports: ${errors.length}`);

  return lines.join('\n');
}

/**
 * Format circular dependencies as text.
 * @param {Array<string[]>} cycles
 * @param {string} cwd
 * @returns {string}
 */
function formatCircularText(cycles, cwd) {
  if (cycles.length === 0) {
    return 'No circular dependencies detected.';
  }

  const lines = [];
  lines.push('Circular Dependency Report');
  lines.push('='.repeat(60));
  lines.push('');

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i].map(f => path.relative(cwd, f));
    lines.push(`Cycle #${i + 1}: ${cycle.join(' -> ')}`);
  }

  lines.push('');
  lines.push(`Total circular chains: ${cycles.length}`);

  return lines.join('\n');
}

/**
 * Format unused imports as text.
 * @param {Array} unused
 * @param {string} cwd
 * @returns {string}
 */
function formatUnusedText(unused, cwd) {
  if (unused.length === 0) {
    return 'No unused imports found.';
  }

  const lines = [];
  lines.push('Unused Imports Report');
  lines.push('='.repeat(60));
  lines.push('');

  for (const u of unused) {
    const relFile = path.relative(cwd, u.file);
    lines.push(`${relFile}:${u.line} — '${u.name}' from '${u.requirePath}' is never used`);
  }

  lines.push('');
  lines.push(`Total unused imports: ${unused.length}`);

  return lines.join('\n');
}

/**
 * Parse CLI args and run import validation.
 * @param {string[]} argv
 */
function runImports(argv = []) {
  const options = { format: 'text' };
  let mode = 'validate'; // validate | circular | unused

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--circular') {
      mode = 'circular';
    } else if (arg === '--unused') {
      mode = 'unused';
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--fix') {
      options.fix = true;
      if (mode === 'validate') mode = 'unused'; // --fix implies --unused
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox imports [--circular] [--unused] [--format json] [--fix]');
      return;
    }
  }

  const cwd = process.cwd();
  options.cwd = cwd;

  if (mode === 'circular') {
    const graph = buildDependencyGraph(cwd);
    const cycles = detectCircular(graph);

    if (options.format === 'json') {
      const jsonCycles = cycles.map(c => c.map(f => path.relative(cwd, f)));
      console.log(JSON.stringify(jsonCycles, null, 2));
    } else {
      console.log(formatCircularText(cycles, cwd));
    }
  } else if (mode === 'unused') {
    const unused = findUnusedImports(options);

    if (options.fix) {
      console.log('[DRY-RUN] The following unused imports would be removed:');
    }

    if (options.format === 'json') {
      const jsonUnused = unused.map(u => ({
        ...u,
        file: path.relative(cwd, u.file),
      }));
      console.log(JSON.stringify(jsonUnused, null, 2));
    } else {
      console.log(formatUnusedText(unused, cwd));
    }
  } else {
    const errors = validateImports(options);

    if (options.format === 'json') {
      const jsonErrors = errors.map(e => ({
        ...e,
        file: path.relative(cwd, e.file),
      }));
      console.log(JSON.stringify(jsonErrors, null, 2));
    } else {
      console.log(formatValidationText(errors, cwd));
    }
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runImports,
  validateImports,
  findUnusedImports,
  detectCircular,
  buildDependencyGraph,
  extractRequires,
  collectFiles,
  isLocalRequire,
  resolveRequire,
  formatValidationText,
  formatCircularText,
  formatUnusedText,
};
