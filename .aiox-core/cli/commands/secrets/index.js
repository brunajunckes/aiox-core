/**
 * Secret Scanner Command Module
 *
 * Scans project files for leaked secrets (API keys, tokens, passwords).
 *
 * Subcommands:
 *   aiox secrets scan           — Scan for leaked secrets
 *   aiox secrets scan --fix     — Replace found secrets with placeholders
 *   aiox secrets scan --format json — Output as JSON
 *   aiox secrets --help         — Show help
 *
 * @module cli/commands/secrets
 * @version 1.0.0
 * @story 12.1 — Secret Scanner
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Constants ────────────────────────────────────────────────────────────────

const IGNORE_DIRS = ['node_modules', '.git', '.aiox-core', 'dist', 'build', 'coverage'];
const IGNORE_FILES = ['.env.example', '.env.sample', '.env.template'];
const IGNORE_EXTENSIONS = ['.test.js', '.spec.js', '.test.ts', '.spec.ts'];

const SECRET_PATTERNS = [
  { name: 'API_KEY assignment', pattern: /\bAPI[_-]?KEY\s*[=:]\s*['"]?([A-Za-z0-9_\-/.+]{8,})['"]?/gi },
  { name: 'SECRET assignment', pattern: /\bSECRET\s*[=:]\s*['"]?([A-Za-z0-9_\-/.+]{8,})['"]?/gi },
  { name: 'PASSWORD assignment', pattern: /\bPASSWORD\s*[=:]\s*['"]?([^\s'"]{4,})['"]?/gi },
  { name: 'TOKEN assignment', pattern: /\bTOKEN\s*[=:]\s*['"]?([A-Za-z0-9_\-/.+]{8,})['"]?/gi },
  { name: 'Private Key block', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi },
  { name: 'Bearer token', pattern: /Bearer\s+[A-Za-z0-9_\-/.+=]{20,}/gi },
  { name: 'AWS Access Key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Base64 secret (long)', pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g },
];

const HELP_TEXT = `
AIOX Secret Scanner

Usage:
  aiox secrets scan              Scan project for leaked secrets
  aiox secrets scan --fix        Replace secrets with placeholders
  aiox secrets scan --format json  Output findings as JSON
  aiox secrets --help            Show this help message

Patterns detected:
  API_KEY=, SECRET=, PASSWORD=, TOKEN=
  Private keys, Bearer tokens, AWS keys (AKIA...)
  Base64-encoded secrets (40+ chars)

Ignored:
  node_modules/, .git/, .env.example, *.test.js
`.trim();

// ── File Walking ─────────────────────────────────────────────────────────────

/**
 * Recursively collect files to scan.
 * @param {string} dir - Directory to scan
 * @param {string[]} [results=[]] - Accumulator
 * @returns {string[]} Array of file paths
 */
function collectFiles(dir, results) {
  results = results || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        collectFiles(fullPath, results);
      }
    } else if (entry.isFile()) {
      if (!shouldIgnoreFile(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Check if file should be ignored.
 * @param {string} filename - The filename (basename)
 * @returns {boolean}
 */
function shouldIgnoreFile(filename) {
  if (IGNORE_FILES.includes(filename)) return true;
  for (const ext of IGNORE_EXTENSIONS) {
    if (filename.endsWith(ext)) return true;
  }
  // Skip binary-ish extensions
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.tar', '.gz'];
  const ext = path.extname(filename).toLowerCase();
  if (binaryExts.includes(ext)) return true;
  return false;
}

// ── Scanning ─────────────────────────────────────────────────────────────────

/**
 * Scan a single file for secrets.
 * @param {string} filePath - Path to file
 * @param {string} rootDir - Project root for relative paths
 * @returns {Array<{file: string, line: number, pattern: string, match: string}>}
 */
function scanFile(filePath, rootDir) {
  const findings = [];
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return findings;
  }

  const lines = content.split('\n');
  const relativePath = path.relative(rootDir, filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sp of SECRET_PATTERNS) {
      // Reset lastIndex for global regex
      sp.pattern.lastIndex = 0;
      let m;
      while ((m = sp.pattern.exec(line)) !== null) {
        findings.push({
          file: relativePath,
          line: i + 1,
          pattern: sp.name,
          match: m[0].length > 60 ? m[0].substring(0, 60) + '...' : m[0],
        });
      }
    }
  }
  return findings;
}

/**
 * Scan all project files for secrets.
 * @param {string} [rootDir] - Project root
 * @returns {Array<{file: string, line: number, pattern: string, match: string}>}
 */
function scanProject(rootDir) {
  rootDir = rootDir || process.cwd();
  const files = collectFiles(rootDir);
  const allFindings = [];
  for (const f of files) {
    const findings = scanFile(f, rootDir);
    allFindings.push(...findings);
  }
  return allFindings;
}

// ── Fix Mode ─────────────────────────────────────────────────────────────────

/**
 * Replace found secrets with placeholders in-place.
 * @param {Array<{file: string, line: number, pattern: string, match: string}>} findings
 * @param {string} rootDir - Project root
 * @returns {number} Number of files modified
 */
function fixSecrets(findings, rootDir) {
  rootDir = rootDir || process.cwd();
  const fileGroups = {};
  for (const f of findings) {
    if (!fileGroups[f.file]) fileGroups[f.file] = [];
    fileGroups[f.file].push(f);
  }

  let modifiedCount = 0;
  for (const [relFile, fileFindings] of Object.entries(fileGroups)) {
    const absPath = path.join(rootDir, relFile);
    let content;
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch (_e) {
      continue;
    }

    let modified = false;
    for (const finding of fileFindings) {
      const fullMatch = finding.match.endsWith('...') ? finding.match.slice(0, -3) : finding.match;
      if (content.includes(fullMatch)) {
        content = content.replace(fullMatch, '<REDACTED>');
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(absPath, content, 'utf8');
      modifiedCount++;
    }
  }
  return modifiedCount;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format findings for console output.
 * @param {Array} findings
 * @returns {string}
 */
function formatConsole(findings) {
  if (findings.length === 0) {
    return 'No secrets found. Project is clean.';
  }
  const lines = [`Found ${findings.length} potential secret(s):\n`];
  for (const f of findings) {
    lines.push(`  ${f.file}:${f.line} [${f.pattern}]`);
    lines.push(`    ${f.match}`);
  }
  lines.push(`\nTotal: ${findings.length} finding(s)`);
  return lines.join('\n');
}

/**
 * Format findings as JSON.
 * @param {Array} findings
 * @returns {string}
 */
function formatJSON(findings) {
  return JSON.stringify({
    totalFindings: findings.length,
    findings,
    scannedAt: new Date().toISOString(),
  }, null, 2);
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Run the secrets command.
 * @param {string[]} argv - Arguments after 'secrets'
 */
function runSecrets(argv) {
  argv = argv || [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sub = argv[0];
  if (sub !== 'scan' && sub !== undefined) {
    console.error(`Unknown subcommand: ${sub}`);
    console.log('Run aiox secrets --help for usage');
    process.exitCode = 1;
    return;
  }

  const doFix = argv.includes('--fix');
  const formatIdx = argv.indexOf('--format');
  const format = formatIdx >= 0 ? argv[formatIdx + 1] : 'text';

  const rootDir = process.cwd();
  const findings = scanProject(rootDir);

  if (doFix) {
    const modified = fixSecrets(findings, rootDir);
    console.log(`Scanned and fixed: ${modified} file(s) modified, ${findings.length} secret(s) found`);
    return;
  }

  if (format === 'json') {
    console.log(formatJSON(findings));
    return;
  }

  console.log(formatConsole(findings));
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  collectFiles,
  shouldIgnoreFile,
  scanFile,
  scanProject,
  fixSecrets,
  formatConsole,
  formatJSON,
  runSecrets,
  SECRET_PATTERNS,
  IGNORE_DIRS,
  IGNORE_FILES,
  IGNORE_EXTENSIONS,
  HELP_TEXT,
};
