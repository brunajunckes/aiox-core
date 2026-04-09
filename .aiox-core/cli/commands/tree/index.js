/**
 * Directory Tree Viewer
 *
 * ASCII tree of current directory with depth, ignore, type filter,
 * JSON format, and stats options.
 *
 * @module cli/commands/tree
 * @version 1.0.0
 * @story 29.1 - Directory Tree Viewer
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_IGNORE = ['node_modules', '.git'];

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Parse CLI args for tree command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const opts = { depth: Infinity, ignore: [...DEFAULT_IGNORE], type: null, format: 'ascii', stats: false, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--depth' && argv[i + 1]) {
      opts.depth = parseInt(argv[++i], 10);
    } else if (a === '--ignore' && argv[i + 1]) {
      opts.ignore = argv[++i].split(',').map(s => s.trim());
    } else if (a === '--type' && argv[i + 1]) {
      opts.type = argv[++i].replace(/^\./, '');
    } else if (a === '--format' && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === '--stats') {
      opts.stats = true;
    } else if (!a.startsWith('-')) {
      opts.dir = a;
    }
  }
  return opts;
}

/**
 * Build a tree structure from the filesystem.
 * @param {string} dirPath
 * @param {object} opts
 * @param {number} currentDepth
 * @returns {{ name: string, type: string, children?: Array, size?: number }}
 */
function buildTree(dirPath, opts, currentDepth = 0) {
  const name = path.basename(dirPath);
  const stat = fs.statSync(dirPath);

  if (stat.isFile()) {
    return { name, type: 'file', size: stat.size };
  }

  const node = { name, type: 'directory', children: [] };

  if (currentDepth >= opts.depth) return node;

  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return node;
  }

  entries.sort();

  for (const entry of entries) {
    if (opts.ignore.includes(entry)) continue;

    const fullPath = path.join(dirPath, entry);
    let entryStat;
    try {
      entryStat = fs.lstatSync(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isSymbolicLink()) {
      // Show symlinks but don't follow
      if (!opts.type) {
        node.children.push({ name: entry, type: 'symlink' });
      }
      continue;
    }

    if (entryStat.isDirectory()) {
      const child = buildTree(fullPath, opts, currentDepth + 1);
      // If type filter, only include dirs that have matching children
      if (opts.type) {
        if (child.children && child.children.length > 0) {
          node.children.push(child);
        }
      } else {
        node.children.push(child);
      }
    } else if (entryStat.isFile()) {
      if (opts.type) {
        const ext = path.extname(entry).replace(/^\./, '');
        if (ext !== opts.type) continue;
      }
      node.children.push({ name: entry, type: 'file', size: entryStat.size });
    }
  }

  return node;
}

/**
 * Compute stats from a tree node.
 * @param {{ name: string, type: string, children?: Array, size?: number }} node
 * @returns {{ files: number, dirs: number, totalSize: number }}
 */
function computeStats(node) {
  let files = 0;
  let dirs = 0;
  let totalSize = 0;

  if (node.type === 'file') {
    return { files: 1, dirs: 0, totalSize: node.size || 0 };
  }

  if (node.type === 'directory') {
    dirs++; // count self? We skip root typically
  }

  if (node.children) {
    for (const child of node.children) {
      const s = computeStats(child);
      files += s.files;
      dirs += s.dirs;
      totalSize += s.totalSize;
    }
  }

  return { files, dirs, totalSize };
}

/**
 * Format bytes to human readable.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Render a tree node as ASCII lines.
 * @param {{ name: string, type: string, children?: Array }} node
 * @param {string} prefix
 * @param {boolean} isLast
 * @returns {string[]}
 */
function renderAscii(node, prefix = '', isLast = true) {
  const lines = [];
  const connector = prefix === '' ? '' : (isLast ? '└── ' : '├── ');
  const suffix = node.type === 'directory' ? '/' : (node.type === 'symlink' ? ' -> [symlink]' : '');
  lines.push(prefix + connector + node.name + suffix);

  if (node.children) {
    const childPrefix = prefix === '' ? '' : prefix + (isLast ? '    ' : '│   ');
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childIsLast = i === node.children.length - 1;
      lines.push(...renderAscii(child, childPrefix, childIsLast));
    }
  }

  return lines;
}

/**
 * Run tree command.
 * @param {string[]} argv
 */
function runTree(argv) {
  const opts = parseArgs(argv);
  const dir = opts.dir ? path.resolve(opts.dir) : process.cwd();

  if (!fs.existsSync(dir)) {
    console.error(`Error: directory not found: ${dir}`);
    process.exit(1);
  }

  const tree = buildTree(dir, opts);

  if (opts.format === 'json') {
    console.log(JSON.stringify(tree, null, 2));
    return;
  }

  const lines = renderAscii(tree);
  console.log(lines.join('\n'));

  if (opts.stats) {
    const s = computeStats(tree);
    console.log('');
    console.log(`${s.files} files, ${s.dirs} directories, ${formatBytes(s.totalSize)} total`);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runTree,
  parseArgs,
  buildTree,
  computeStats,
  formatBytes,
  renderAscii,
};
