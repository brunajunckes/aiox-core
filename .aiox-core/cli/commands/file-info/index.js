/**
 * File Info Inspector
 *
 * Shows file metadata: size, dates, permissions, type, lines, encoding guess,
 * checksum, and directory summary.
 *
 * @module cli/commands/file-info
 * @version 1.0.0
 * @story 29.4 - File Info Inspector
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Functions ──────────────────────────────────────────────────────────────────

/**
 * Parse CLI args for file-info command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const opts = { path: null, format: 'text', checksum: false, summary: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format' && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === '--checksum') {
      opts.checksum = true;
    } else if (a === '--summary') {
      opts.summary = true;
    } else if (!a.startsWith('-')) {
      opts.path = a;
    }
  }
  return opts;
}

/**
 * Guess encoding of a file by reading the first bytes.
 * @param {string} filePath
 * @returns {string}
 */
function guessEncoding(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);

    if (bytesRead === 0) return 'empty';

    const slice = buf.slice(0, bytesRead);

    // Check BOM
    if (bytesRead >= 3 && slice[0] === 0xEF && slice[1] === 0xBB && slice[2] === 0xBF) return 'utf-8-bom';
    if (bytesRead >= 2 && slice[0] === 0xFF && slice[1] === 0xFE) return 'utf-16le';
    if (bytesRead >= 2 && slice[0] === 0xFE && slice[1] === 0xFF) return 'utf-16be';

    // Check for null bytes (binary)
    for (let i = 0; i < bytesRead; i++) {
      if (slice[i] === 0) return 'binary';
    }

    return 'utf-8';
  } catch {
    return 'unknown';
  }
}

/**
 * Count lines in a file.
 * @param {string} filePath
 * @returns {number}
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.length === 0) return 0;
    return content.split('\n').length;
  } catch {
    return -1;
  }
}

/**
 * Compute SHA256 checksum.
 * @param {string} filePath
 * @returns {string}
 */
function computeChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Format file permissions from mode.
 * @param {number} mode
 * @returns {string}
 */
function formatPermissions(mode) {
  const octal = (mode & 0o777).toString(8);
  const rwx = (m) => {
    let s = '';
    s += (m & 4) ? 'r' : '-';
    s += (m & 2) ? 'w' : '-';
    s += (m & 1) ? 'x' : '-';
    return s;
  };
  const owner = rwx((mode >> 6) & 7);
  const group = rwx((mode >> 3) & 7);
  const other = rwx(mode & 7);
  return `${owner}${group}${other} (${octal})`;
}

/**
 * Get file type description.
 * @param {fs.Stats} stat
 * @param {string} filePath
 * @returns {string}
 */
function getFileType(stat, filePath) {
  if (stat.isDirectory()) return 'directory';
  if (stat.isSymbolicLink()) return 'symlink';
  if (stat.isBlockDevice()) return 'block device';
  if (stat.isCharacterDevice()) return 'character device';
  if (stat.isFIFO()) return 'FIFO';
  if (stat.isSocket()) return 'socket';

  const ext = path.extname(filePath).toLowerCase();
  const textExts = ['.js', '.ts', '.json', '.md', '.txt', '.css', '.html', '.xml', '.yaml', '.yml', '.sh', '.py', '.rb', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.jsx', '.tsx', '.vue', '.svelte', '.toml', '.ini', '.cfg', '.env', '.csv', '.sql'];
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico', '.webp'];
  const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.zip', '.tar', '.gz', '.7z', '.rar'];

  if (textExts.includes(ext)) return `text (${ext.slice(1)})`;
  if (imageExts.includes(ext)) return `image (${ext.slice(1)})`;
  if (binaryExts.includes(ext)) return `binary (${ext.slice(1)})`;

  return 'file';
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
 * Get file info.
 * @param {string} filePath
 * @param {object} opts
 * @returns {object}
 */
function getFileInfo(filePath, opts = {}) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  const info = {
    name: path.basename(resolved),
    path: resolved,
    size: stat.size,
    sizeHuman: formatBytes(stat.size),
    created: stat.birthtime.toISOString(),
    modified: stat.mtime.toISOString(),
    accessed: stat.atime.toISOString(),
    permissions: formatPermissions(stat.mode),
    type: getFileType(stat, resolved),
    isDirectory: stat.isDirectory(),
    isSymlink: stat.isSymbolicLink(),
  };

  if (stat.isFile()) {
    const encoding = guessEncoding(resolved);
    info.encoding = encoding;
    if (encoding !== 'binary') {
      info.lines = countLines(resolved);
    }
  }

  if (opts.checksum && stat.isFile()) {
    info.checksum = computeChecksum(resolved);
  }

  if (stat.isSymbolicLink()) {
    try {
      info.symlinkTarget = fs.readlinkSync(resolved);
    } catch {
      info.symlinkTarget = '[unreadable]';
    }
  }

  return info;
}

/**
 * Get directory summary.
 * @param {string} dirPath
 * @returns {object}
 */
function getDirSummary(dirPath) {
  const resolved = path.resolve(dirPath);
  let files = 0;
  let dirs = 0;
  let totalSize = 0;
  const extensions = {};

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.lstatSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        dirs++;
        walk(fullPath);
      } else if (stat.isFile()) {
        files++;
        totalSize += stat.size;
        const ext = path.extname(entry).toLowerCase() || '(none)';
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    }
  }

  walk(resolved);

  // Sort extensions by count descending
  const topExtensions = Object.entries(extensions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ext, count]) => ({ ext, count }));

  return {
    path: resolved,
    files,
    dirs,
    totalSize,
    totalSizeHuman: formatBytes(totalSize),
    topExtensions,
  };
}

/**
 * Format file info for text display.
 * @param {object} info
 * @returns {string}
 */
function formatInfo(info) {
  const lines = [];
  lines.push(`File: ${info.name}`);
  lines.push(`Path: ${info.path}`);
  lines.push(`Type: ${info.type}`);
  lines.push(`Size: ${info.sizeHuman} (${info.size} bytes)`);
  lines.push(`Created:  ${info.created}`);
  lines.push(`Modified: ${info.modified}`);
  lines.push(`Permissions: ${info.permissions}`);
  if (info.encoding) lines.push(`Encoding: ${info.encoding}`);
  if (info.lines !== undefined && info.lines >= 0) lines.push(`Lines: ${info.lines}`);
  if (info.checksum) lines.push(`SHA256: ${info.checksum}`);
  if (info.symlinkTarget) lines.push(`Symlink target: ${info.symlinkTarget}`);
  return lines.join('\n');
}

/**
 * Run file-info command.
 * @param {string[]} argv
 */
function runFileInfo(argv) {
  const opts = parseArgs(argv);

  if (!opts.path) {
    console.error('Usage: aiox file-info <path> [--format json] [--checksum] [--summary]');
    process.exit(1);
  }

  const target = path.resolve(opts.path);
  if (!fs.existsSync(target)) {
    console.error(`Error: path not found: ${target}`);
    process.exit(1);
  }

  if (opts.summary) {
    const summary = getDirSummary(target);
    if (opts.format === 'json') {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`Directory: ${summary.path}`);
      console.log(`Files: ${summary.files}`);
      console.log(`Directories: ${summary.dirs}`);
      console.log(`Total size: ${summary.totalSizeHuman}`);
      if (summary.topExtensions.length > 0) {
        console.log('\nTop extensions:');
        for (const e of summary.topExtensions) {
          console.log(`  ${e.ext}: ${e.count}`);
        }
      }
    }
    return;
  }

  const info = getFileInfo(target, opts);
  if (opts.format === 'json') {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(formatInfo(info));
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  runFileInfo,
  parseArgs,
  getFileInfo,
  getDirSummary,
  guessEncoding,
  countLines,
  computeChecksum,
  formatPermissions,
  getFileType,
  formatBytes,
  formatInfo,
};
