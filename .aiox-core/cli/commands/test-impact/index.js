/**
 * Test Impact Analysis Command Module
 *
 * Analyzes which test files cover which source files.
 *
 * Subcommands:
 *   aiox test-impact              — show source→test mapping
 *   aiox test-impact <file>       — tests affected by changing a file
 *   aiox test-impact --format json — output as JSON
 *   aiox test-impact --suggest    — suggest tests for uncommitted changes
 *   aiox test-impact --help       — show help
 *
 * @module cli/commands/test-impact
 * @version 1.0.0
 * @story 18.3 — Test Impact Analysis
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
TEST IMPACT ANALYSIS

USAGE:
  aiox test-impact                Show source→test mapping for the project
  aiox test-impact <file>         Show tests affected by changing a file
  aiox test-impact --format json  Output as JSON
  aiox test-impact --suggest      Suggest tests to run for uncommitted changes
  aiox test-impact --help         Show this help

EXAMPLES:
  aiox test-impact src/utils.js
  aiox test-impact --suggest
  aiox test-impact --format json
`.trim();

const TEST_PATTERNS = ['.test.js', '.spec.js', '.test.ts', '.spec.ts'];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get project root.
 * @returns {string}
 */
function getProjectRoot() {
  return process.cwd();
}

/**
 * Recursively collect JS/TS files in a directory.
 * @param {string} dir - Directory to scan
 * @param {string[]} [results] - Accumulator
 * @returns {string[]} File paths
 */
function collectFiles(dir, results) {
  if (!results) results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'coverage') continue;
      collectFiles(full, results);
    } else if (entry.isFile() && /\.(js|ts)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Check if a file is a test file.
 * @param {string} filePath
 * @returns {boolean}
 */
function isTestFile(filePath) {
  return TEST_PATTERNS.some(p => filePath.endsWith(p));
}

/**
 * Parse require/import statements from a file to find dependencies.
 * @param {string} content - File content
 * @returns {string[]} Relative import paths
 */
function parseImports(content) {
  const imports = [];

  // CommonJS: require('...')
  const reqMatches = content.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of reqMatches) {
    if (m[1].startsWith('.')) {
      imports.push(m[1]);
    }
  }

  // ES imports: import ... from '...'
  const esMatches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  for (const m of esMatches) {
    if (m[1].startsWith('.')) {
      imports.push(m[1]);
    }
  }

  return imports;
}

/**
 * Resolve an import path relative to the importing file.
 * @param {string} importerDir - Directory of the importing file
 * @param {string} importPath - Relative import path
 * @returns {string|null} Resolved absolute path or null
 */
function resolveImport(importerDir, importPath) {
  const candidates = [
    importPath + '.js',
    importPath + '.ts',
    path.join(importPath, 'index.js'),
    path.join(importPath, 'index.ts'),
  ];

  // Check exact path first, but only if it's a file
  const exact = path.resolve(importerDir, importPath);
  if (fs.existsSync(exact) && fs.statSync(exact).isFile()) {
    return exact;
  }

  for (const c of candidates) {
    const resolved = path.resolve(importerDir, c);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return null;
}

/**
 * Build a mapping of source files → test files that import them.
 * @param {string} root - Project root
 * @param {string[]} allFiles - All JS/TS files
 * @returns {object} { sourceFile: [testFile, ...] }
 */
function buildImpactMap(root, allFiles) {
  const testFiles = allFiles.filter(isTestFile);
  const map = {};

  for (const testFile of testFiles) {
    let content;
    try {
      content = fs.readFileSync(testFile, 'utf8');
    } catch {
      continue;
    }

    const imports = parseImports(content);
    const testDir = path.dirname(testFile);

    for (const imp of imports) {
      const resolved = resolveImport(testDir, imp);
      if (resolved && !isTestFile(resolved)) {
        const relSource = path.relative(root, resolved);
        if (!map[relSource]) map[relSource] = [];
        if (!map[relSource].includes(path.relative(root, testFile))) {
          map[relSource].push(path.relative(root, testFile));
        }
      }
    }
  }

  // Also add naming convention matches
  const sourceFiles = allFiles.filter(f => !isTestFile(f));
  for (const srcFile of sourceFiles) {
    const relSrc = path.relative(root, srcFile);
    for (const pattern of TEST_PATTERNS) {
      const ext = path.extname(srcFile);
      const base = srcFile.slice(0, -ext.length);
      const testPath = base + pattern;
      if (fs.existsSync(testPath)) {
        const relTest = path.relative(root, testPath);
        if (!map[relSrc]) map[relSrc] = [];
        if (!map[relSrc].includes(relTest)) {
          map[relSrc].push(relTest);
        }
      }
    }
  }

  return map;
}

/**
 * Get uncommitted changed files via git diff.
 * @param {string} root - Project root
 * @returns {string[]} Changed file paths (relative)
 */
function getUncommittedChanges(root) {
  try {
    const output = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    });
    const staged = execSync('git diff --name-only --cached', {
      cwd: root,
      encoding: 'utf8',
      timeout: 5000,
    });
    const all = (output + '\n' + staged).trim().split('\n').filter(Boolean);
    return [...new Set(all)];
  } catch {
    return [];
  }
}

/**
 * Suggest tests to run based on uncommitted changes.
 * @param {object} impactMap - Source→test mapping
 * @param {string[]} changedFiles - Changed file paths (relative)
 * @returns {string[]} Test files to run
 */
function suggestTests(impactMap, changedFiles) {
  const tests = new Set();
  for (const file of changedFiles) {
    // If the changed file is itself a test, include it
    if (isTestFile(file)) {
      tests.add(file);
    }
    // If we have a mapping for this source file
    if (impactMap[file]) {
      for (const t of impactMap[file]) {
        tests.add(t);
      }
    }
  }
  return Array.from(tests).sort();
}

// ── Main Runner ─────────────────────────────────────────────────────────────

/**
 * Run the test-impact command.
 * @param {string[]} argv - Command arguments
 */
function runTestImpact(argv) {
  if (!argv) argv = [];

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const root = getProjectRoot();
  const formatIdx = argv.indexOf('--format');
  const jsonOutput = formatIdx !== -1 && argv[formatIdx + 1] === 'json';

  const allFiles = collectFiles(root);
  const impactMap = buildImpactMap(root, allFiles);

  // --suggest
  if (argv.includes('--suggest')) {
    const changed = getUncommittedChanges(root);
    if (changed.length === 0) {
      if (jsonOutput) {
        console.log(JSON.stringify({ changed: [], suggestedTests: [] }, null, 2));
      } else {
        console.log('No uncommitted changes detected.');
      }
      return;
    }
    const suggested = suggestTests(impactMap, changed);
    if (jsonOutput) {
      console.log(JSON.stringify({ changed, suggestedTests: suggested }, null, 2));
    } else {
      console.log('Changed files:');
      for (const f of changed) console.log(`  ${f}`);
      console.log('\nSuggested tests:');
      if (suggested.length === 0) {
        console.log('  (no matching tests found)');
      } else {
        for (const t of suggested) console.log(`  ${t}`);
      }
    }
    return;
  }

  // test-impact <file>
  const positionalArgs = argv.filter(a => !a.startsWith('--'));
  if (positionalArgs.length > 0) {
    const file = positionalArgs[0];
    const tests = impactMap[file] || [];
    if (jsonOutput) {
      console.log(JSON.stringify({ file, tests }, null, 2));
    } else {
      console.log(`Tests affected by ${file}:`);
      if (tests.length === 0) {
        console.log('  (no matching tests found)');
      } else {
        for (const t of tests) console.log(`  ${t}`);
      }
    }
    return;
  }

  // Default: show full map
  const entries = Object.entries(impactMap).sort((a, b) => a[0].localeCompare(b[0]));
  if (jsonOutput) {
    console.log(JSON.stringify(impactMap, null, 2));
    return;
  }

  if (entries.length === 0) {
    console.log('No source→test mappings found.');
    return;
  }

  console.log('Source → Test Mapping:\n');
  for (const [src, tests] of entries) {
    console.log(`  ${src}`);
    for (const t of tests) {
      console.log(`    → ${t}`);
    }
  }
  console.log(`\nTotal: ${entries.length} source file(s) with test coverage.`);
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runTestImpact,
  parseImports,
  resolveImport,
  buildImpactMap,
  getUncommittedChanges,
  suggestTests,
  collectFiles,
  isTestFile,
};
