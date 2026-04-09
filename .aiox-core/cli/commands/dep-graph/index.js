/**
 * Dependency Graph Visualizer Command Module
 *
 * Shows dependency tree from package.json with ASCII output.
 *
 * Subcommands:
 *   aiox dep-graph              — show dependency tree
 *   aiox dep-graph --depth N    — limit tree depth
 *   aiox dep-graph --dev        — include devDependencies
 *   aiox dep-graph --format json — output as JSON
 *   aiox dep-graph --circular   — detect circular require() calls
 *
 * @module cli/commands/dep-graph
 * @version 1.0.0
 * @story 21.2 — Dependency Graph Visualizer
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.next', 'build', '.aiox']);

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Read and parse package.json.
 * @param {string} cwd
 * @returns {object|null}
 */
function readPackageJson(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Build dependency tree from package.json.
 * @param {object} options
 * @param {string} [options.cwd]
 * @param {boolean} [options.dev] - include devDependencies
 * @param {number} [options.depth] - max depth (default unlimited)
 * @returns {object} tree structure
 */
function buildDependencyTree(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkg = readPackageJson(cwd);
  if (!pkg) {
    return { name: 'unknown', version: '0.0.0', dependencies: {} };
  }

  const deps = { ...(pkg.dependencies || {}) };
  if (options.dev) {
    Object.assign(deps, pkg.devDependencies || {});
  }

  const maxDepth = options.depth || Infinity;

  function buildNode(depName, version, depth) {
    const node = { name: depName, version: version || '*', dependencies: {} };
    if (depth >= maxDepth) return node;

    // Try to read nested package.json from node_modules
    const nestedPkgPath = path.join(cwd, 'node_modules', depName, 'package.json');
    try {
      const nestedPkg = JSON.parse(fs.readFileSync(nestedPkgPath, 'utf8'));
      node.version = nestedPkg.version || version;
      const nestedDeps = nestedPkg.dependencies || {};
      for (const [name, ver] of Object.entries(nestedDeps)) {
        node.dependencies[name] = buildNode(name, ver, depth + 1);
      }
    } catch {
      // No nested package found, leaf node
    }

    return node;
  }

  const tree = {
    name: pkg.name || 'project',
    version: pkg.version || '0.0.0',
    dependencies: {},
  };

  for (const [name, version] of Object.entries(deps)) {
    tree.dependencies[name] = buildNode(name, version, 1);
  }

  return tree;
}

/**
 * Render dependency tree as ASCII.
 * @param {object} tree
 * @param {string} [prefix]
 * @param {boolean} [isLast]
 * @returns {string}
 */
function renderAsciiTree(tree, prefix = '', isLast = true, isRoot = true) {
  const lines = [];

  if (isRoot) {
    lines.push(`${tree.name}@${tree.version}`);
  } else {
    const connector = isLast ? '\\-- ' : '|-- ';
    lines.push(`${prefix}${connector}${tree.name}@${tree.version}`);
  }

  const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '|   ');
  const deps = Object.values(tree.dependencies);

  for (let i = 0; i < deps.length; i++) {
    const child = deps[i];
    const childIsLast = i === deps.length - 1;
    lines.push(renderAsciiTree(child, newPrefix, childIsLast, false));
  }

  return lines.join('\n');
}

/**
 * Count total dependencies in the tree.
 * @param {object} tree
 * @returns {number}
 */
function countDependencies(tree) {
  let count = Object.keys(tree.dependencies).length;
  for (const child of Object.values(tree.dependencies)) {
    count += countDependencies(child);
  }
  return count;
}

/**
 * Collect JS files for circular dependency detection.
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
 * Extract local require() calls from a JS file.
 * @param {string} filePath
 * @returns {string[]} resolved paths
 */
function extractRequires(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const requirePattern = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  const requires = [];
  let match;

  while ((match = requirePattern.exec(source)) !== null) {
    const reqPath = match[1];
    const dir = path.dirname(filePath);
    let resolved = path.resolve(dir, reqPath);

    // Try resolving with extensions
    if (!fs.existsSync(resolved)) {
      for (const ext of ['.js', '.mjs', '.cjs', '/index.js']) {
        if (fs.existsSync(resolved + ext)) {
          resolved = resolved + ext;
          break;
        }
      }
    }

    requires.push(resolved);
  }

  return requires;
}

/**
 * Detect circular dependencies in local require() calls.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<string[]>} array of circular chains
 */
function detectCircular(options = {}) {
  const cwd = options.cwd || process.cwd();
  const files = collectJSFiles(cwd);

  // Build adjacency map
  const graph = new Map();
  for (const file of files) {
    graph.set(file, extractRequires(file));
  }

  const circles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, stack) {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = stack.indexOf(node);
      if (cycleStart >= 0) {
        const cycle = stack.slice(cycleStart).concat(node);
        circles.push(cycle.map((f) => path.relative(cwd, f)));
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (graph.has(dep)) {
        dfs(dep, [...stack]);
      }
    }

    inStack.delete(node);
  }

  for (const file of files) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return circles;
}

/**
 * Parse CLI args and run dep-graph.
 * @param {string[]} argv
 */
function runDepGraph(argv = []) {
  const options = { format: 'text' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--depth' && argv[i + 1]) {
      options.depth = parseInt(argv[++i], 10);
    } else if (arg === '--dev') {
      options.dev = true;
    } else if (arg === '--format' && argv[i + 1]) {
      options.format = argv[++i];
    } else if (arg === '--circular') {
      options.circular = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: aiox dep-graph [--depth N] [--dev] [--format json] [--circular]');
      return;
    }
  }

  const cwd = process.cwd();
  options.cwd = cwd;

  if (options.circular) {
    const circles = detectCircular(options);
    if (options.format === 'json') {
      console.log(JSON.stringify(circles, null, 2));
    } else if (circles.length === 0) {
      console.log('No circular dependencies detected.');
    } else {
      console.log(`Found ${circles.length} circular dependency chain(s):\n`);
      for (let i = 0; i < circles.length; i++) {
        console.log(`  ${i + 1}. ${circles[i].join(' -> ')}`);
      }
    }
    return;
  }

  const tree = buildDependencyTree(options);

  if (options.format === 'json') {
    console.log(JSON.stringify(tree, null, 2));
  } else {
    console.log('Dependency Graph');
    console.log('='.repeat(50));
    console.log('');
    console.log(renderAsciiTree(tree));
    console.log('');
    console.log(`Total dependencies: ${countDependencies(tree)}`);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDepGraph,
  buildDependencyTree,
  renderAsciiTree,
  countDependencies,
  detectCircular,
  collectJSFiles,
  extractRequires,
  readPackageJson,
};
