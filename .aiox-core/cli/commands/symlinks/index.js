/**
 * Symlink Manager
 *
 * List, check, create, and remove symlinks in project.
 *
 * @module cli/commands/symlinks
 * @version 1.0.0
 * @story 29.3 - Symlink Manager
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_IGNORE = ['node_modules', '.git'];

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Parse CLI args for symlinks command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const opts = { subcommand: null, target: null, link: null, format: 'text', dir: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format' && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === '--dir' && argv[i + 1]) {
      opts.dir = argv[++i];
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }
  opts.subcommand = positional[0] || null;
  if (opts.subcommand === 'create') {
    opts.target = positional[1] || null;
    opts.link = positional[2] || null;
  } else if (opts.subcommand === 'remove') {
    opts.link = positional[1] || null;
  }
  return opts;
}

/**
 * Recursively find all symlinks in a directory.
 * @param {string} dirPath
 * @param {string[]} ignore
 * @returns {Array<{ path: string, target: string, exists: boolean }>}
 */
function findSymlinks(dirPath, ignore = DEFAULT_IGNORE) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.lstatSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) {
        let target;
        let exists;
        try {
          target = fs.readlinkSync(fullPath);
          // Check if target resolves
          const resolved = path.resolve(path.dirname(fullPath), target);
          exists = fs.existsSync(resolved);
        } catch {
          target = '[unreadable]';
          exists = false;
        }
        results.push({ path: fullPath, target, exists });
      } else if (stat.isDirectory()) {
        walk(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * List all symlinks.
 * @param {string} dir
 * @param {string} format
 * @returns {{ symlinks: Array, count: number }}
 */
function listSymlinks(dir, format) {
  const symlinks = findSymlinks(dir);
  return { symlinks, count: symlinks.length };
}

/**
 * Check symlinks for broken targets.
 * @param {string} dir
 * @returns {{ total: number, valid: number, broken: Array }}
 */
function checkSymlinks(dir) {
  const symlinks = findSymlinks(dir);
  const broken = symlinks.filter(s => !s.exists);
  return { total: symlinks.length, valid: symlinks.length - broken.length, broken };
}

/**
 * Create a symlink.
 * @param {string} target
 * @param {string} linkPath
 * @returns {{ success: boolean, target: string, link: string, error?: string }}
 */
function createSymlink(target, linkPath) {
  try {
    const resolvedTarget = path.resolve(target);
    const resolvedLink = path.resolve(linkPath);

    if (fs.existsSync(resolvedLink)) {
      return { success: false, target: resolvedTarget, link: resolvedLink, error: 'Link path already exists' };
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(resolvedLink);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.symlinkSync(resolvedTarget, resolvedLink);
    return { success: true, target: resolvedTarget, link: resolvedLink };
  } catch (err) {
    return { success: false, target, link: linkPath, error: err.message };
  }
}

/**
 * Remove a symlink.
 * @param {string} linkPath
 * @returns {{ success: boolean, link: string, error?: string }}
 */
function removeSymlink(linkPath) {
  try {
    const resolved = path.resolve(linkPath);
    const stat = fs.lstatSync(resolved);
    if (!stat.isSymbolicLink()) {
      return { success: false, link: resolved, error: 'Path is not a symlink' };
    }
    fs.unlinkSync(resolved);
    return { success: true, link: resolved };
  } catch (err) {
    return { success: false, link: linkPath, error: err.message };
  }
}

/**
 * Format symlinks result for display.
 * @param {Array} symlinks
 * @param {string} baseDir
 * @returns {string}
 */
function formatSymlinks(symlinks, baseDir) {
  if (symlinks.length === 0) return 'No symlinks found.';
  const lines = [];
  for (const s of symlinks) {
    const rel = path.relative(baseDir, s.path);
    const status = s.exists ? 'OK' : 'BROKEN';
    lines.push(`  ${rel} -> ${s.target} [${status}]`);
  }
  return lines.join('\n');
}

/**
 * Run symlinks command.
 * @param {string[]} argv
 */
function runSymlinks(argv) {
  const opts = parseArgs(argv);
  const dir = opts.dir ? path.resolve(opts.dir) : process.cwd();

  if (!opts.subcommand) {
    console.error('Usage: aiox symlinks <list|check|create|remove> [options]');
    process.exit(1);
  }

  switch (opts.subcommand) {
    case 'list': {
      const result = listSymlinks(dir);
      if (opts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Symlinks (${result.count}):`);
        console.log(formatSymlinks(result.symlinks, dir));
      }
      break;
    }
    case 'check': {
      const result = checkSymlinks(dir);
      if (opts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Total: ${result.total}, Valid: ${result.valid}, Broken: ${result.broken.length}`);
        if (result.broken.length > 0) {
          console.log('\nBroken symlinks:');
          for (const b of result.broken) {
            console.log(`  ${path.relative(dir, b.path)} -> ${b.target}`);
          }
        }
      }
      break;
    }
    case 'create': {
      if (!opts.target || !opts.link) {
        console.error('Usage: aiox symlinks create <target> <link>');
        process.exit(1);
      }
      const result = createSymlink(opts.target, opts.link);
      if (opts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`Created: ${result.link} -> ${result.target}`);
      } else {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }
    case 'remove': {
      if (!opts.link) {
        console.error('Usage: aiox symlinks remove <link>');
        process.exit(1);
      }
      const result = removeSymlink(opts.link);
      if (opts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`Removed: ${result.link}`);
      } else {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
      break;
    }
    default:
      console.error(`Unknown subcommand: ${opts.subcommand}`);
      process.exit(1);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runSymlinks,
  parseArgs,
  findSymlinks,
  listSymlinks,
  checkSymlinks,
  createSymlink,
  removeSymlink,
  formatSymlinks,
};
