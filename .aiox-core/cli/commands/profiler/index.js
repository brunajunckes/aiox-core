/**
 * Performance Profiler for Large Codebases
 *
 * Analyze project structure, sizes, dependencies, and performance metrics.
 *
 * Subcommands:
 *   aiox profiler             - run full performance profile
 *   aiox profiler --files     - profile file count, sizes, largest files
 *   aiox profiler --deps      - profile dependency tree depth and size
 *   aiox profiler --tests     - profile test count and estimates
 *   aiox profiler --commands  - profile CLI command count
 *   aiox profiler --json      - JSON output
 *
 * @module cli/commands/profiler
 * @version 1.0.0
 * @story 35.3 - Performance Profiler for Large Codebases
 */

'use strict';

const fs = require('fs');
const path = require('path');

// -- Constants ----------------------------------------------------------------

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'coverage', '.next', 'build',
  '.aiox', '.cache', '.tmp', 'vendor',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.md',
  '.css', '.scss', '.less', '.html',
  '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.sh', '.bash', '.zsh',
]);

// -- Core Functions -----------------------------------------------------------

/**
 * Walk directory tree collecting file stats.
 * @param {string} dir
 * @param {object} stats - accumulator
 * @param {number} depth - current depth
 * @returns {object}
 */
function walkDirectory(dir, stats, depth) {
  if (!stats) {
    stats = {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
      deepestDepth: 0,
      deepestPath: '',
      files: [],
      dirCount: 0,
      extensionCounts: {},
    };
  }
  if (depth > stats.deepestDepth) {
    stats.deepestDepth = depth;
    stats.deepestPath = dir;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return stats;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        stats.dirCount++;
        walkDirectory(full, stats, depth + 1);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext)) continue;
      let size = 0;
      let lines = 0;
      try {
        const stat = fs.statSync(full);
        size = stat.size;
        const content = fs.readFileSync(full, 'utf8');
        lines = content.split('\n').length;
      } catch {
        // skip unreadable files
      }
      stats.totalFiles++;
      stats.totalSize += size;
      stats.totalLines += lines;
      stats.extensionCounts[ext] = (stats.extensionCounts[ext] || 0) + 1;
      stats.files.push({ path: full, size, lines, ext });
    }
  }
  return stats;
}

/**
 * Profile files in the project.
 * @param {string} root
 * @returns {object}
 */
function profileFiles(root) {
  const stats = walkDirectory(root, null, 0);
  // Sort files by size descending for top-N
  stats.files.sort((a, b) => b.size - a.size);
  const largestFiles = stats.files.slice(0, 10).map(f => ({
    path: path.relative(root, f.path),
    size: f.size,
    lines: f.lines,
  }));
  return {
    totalFiles: stats.totalFiles,
    totalSize: stats.totalSize,
    totalLines: stats.totalLines,
    avgFileSize: stats.totalFiles > 0 ? Math.round(stats.totalSize / stats.totalFiles) : 0,
    avgFileLines: stats.totalFiles > 0 ? Math.round(stats.totalLines / stats.totalFiles) : 0,
    deepestDepth: stats.deepestDepth,
    deepestPath: path.relative(root, stats.deepestPath) || '.',
    dirCount: stats.dirCount,
    extensionCounts: stats.extensionCounts,
    largestFiles,
  };
}

/**
 * Profile dependencies from package.json.
 * @param {string} root
 * @returns {object}
 */
function profileDeps(root) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { deps: 0, devDeps: 0, total: 0, heaviest: null };
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    // Check node_modules sizes for heaviest dep
    let heaviest = null;
    let heaviestSize = 0;
    const nmDir = path.join(root, 'node_modules');
    if (fs.existsSync(nmDir)) {
      for (const dep of deps.concat(devDeps).slice(0, 50)) {
        const depDir = path.join(nmDir, dep);
        try {
          if (fs.existsSync(depDir)) {
            const stat = fs.statSync(depDir);
            if (stat.isDirectory()) {
              // Rough size from package.json
              const depPkg = path.join(depDir, 'package.json');
              if (fs.existsSync(depPkg)) {
                const sz = fs.statSync(depDir).size || 0;
                if (sz > heaviestSize) {
                  heaviestSize = sz;
                  heaviest = dep;
                }
              }
            }
          }
        } catch {
          // skip
        }
      }
    }
    return {
      deps: deps.length,
      devDeps: devDeps.length,
      total: deps.length + devDeps.length,
      topDeps: deps.slice(0, 10),
      heaviest,
    };
  } catch {
    return { deps: 0, devDeps: 0, total: 0, heaviest: null };
  }
}

/**
 * Profile tests in the project.
 * @param {string} root
 * @returns {object}
 */
function profileTests(root) {
  const testDir = path.join(root, 'tests');
  let testFiles = 0;
  let testLines = 0;
  let describeCount = 0;
  let itCount = 0;

  function walkTests(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
        walkTests(full);
      } else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
        testFiles++;
        try {
          const content = fs.readFileSync(full, 'utf8');
          testLines += content.split('\n').length;
          const describes = content.match(/describe\(/g);
          const its = content.match(/\bit\(/g);
          if (describes) describeCount += describes.length;
          if (its) itCount += its.length;
        } catch {
          // skip
        }
      }
    }
  }

  // Also check src for co-located tests
  walkTests(root);

  return {
    testFiles,
    testLines,
    describeCount,
    itCount,
    estimatedTestCount: itCount,
    estimatedTimeMs: itCount * 15, // ~15ms per test estimate
  };
}

/**
 * Profile CLI commands.
 * @param {string} root
 * @returns {object}
 */
function profileCommands(root) {
  const cmdDir = path.join(root, '.aiox-core', 'cli', 'commands');
  if (!fs.existsSync(cmdDir)) {
    return { commandCount: 0, commands: [] };
  }
  let entries;
  try {
    entries = fs.readdirSync(cmdDir, { withFileTypes: true });
  } catch {
    return { commandCount: 0, commands: [] };
  }
  const commands = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  return {
    commandCount: commands.length,
    commands,
  };
}

/**
 * Format bytes as human readable.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Run full profile.
 * @param {string} root
 * @returns {object}
 */
function runFullProfile(root) {
  return {
    files: profileFiles(root),
    deps: profileDeps(root),
    tests: profileTests(root),
    commands: profileCommands(root),
    timestamp: new Date().toISOString(),
  };
}

// -- CLI Runner ---------------------------------------------------------------

/**
 * Run the profiler command.
 * @param {string[]} argv
 */
function runProfiler(argv) {
  const root = process.cwd();
  const isJson = argv.includes('--json');
  const isFiles = argv.includes('--files');
  const isDeps = argv.includes('--deps');
  const isTests = argv.includes('--tests');
  const isCommands = argv.includes('--commands');

  const specific = isFiles || isDeps || isTests || isCommands;

  if (!specific) {
    // Full profile
    const profile = runFullProfile(root);
    if (isJson) {
      console.log(JSON.stringify(profile, null, 2));
      return;
    }
    console.log('AIOX Performance Profile\n');
    console.log('Files:');
    console.log(`  Total files: ${profile.files.totalFiles}`);
    console.log(`  Total size: ${formatBytes(profile.files.totalSize)}`);
    console.log(`  Total LOC: ${profile.files.totalLines.toLocaleString()}`);
    console.log(`  Avg file size: ${formatBytes(profile.files.avgFileSize)}`);
    console.log(`  Deepest directory: ${profile.files.deepestPath} (depth ${profile.files.deepestDepth})`);
    console.log(`\nDependencies:`);
    console.log(`  Production: ${profile.deps.deps}`);
    console.log(`  Dev: ${profile.deps.devDeps}`);
    console.log(`  Total: ${profile.deps.total}`);
    console.log(`\nTests:`);
    console.log(`  Test files: ${profile.tests.testFiles}`);
    console.log(`  Test cases: ${profile.tests.estimatedTestCount}`);
    console.log(`  Estimated time: ${(profile.tests.estimatedTimeMs / 1000).toFixed(1)}s`);
    console.log(`\nCLI Commands: ${profile.commands.commandCount}`);
    return;
  }

  if (isFiles) {
    const files = profileFiles(root);
    if (isJson) {
      console.log(JSON.stringify(files, null, 2));
      return;
    }
    console.log('File Profile:\n');
    console.log(`  Total files: ${files.totalFiles}`);
    console.log(`  Total size: ${formatBytes(files.totalSize)}`);
    console.log(`  Total LOC: ${files.totalLines.toLocaleString()}`);
    console.log(`  Avg file size: ${formatBytes(files.avgFileSize)}`);
    console.log(`  Deepest dir: ${files.deepestPath} (depth ${files.deepestDepth})`);
    if (files.largestFiles.length > 0) {
      console.log('\n  Largest Files:');
      for (const f of files.largestFiles) {
        console.log(`    ${formatBytes(f.size).padEnd(10)} ${f.lines} lines  ${f.path}`);
      }
    }
  }

  if (isDeps) {
    const deps = profileDeps(root);
    if (isJson) {
      console.log(JSON.stringify(deps, null, 2));
      return;
    }
    console.log('Dependency Profile:\n');
    console.log(`  Production: ${deps.deps}`);
    console.log(`  Dev: ${deps.devDeps}`);
    console.log(`  Total: ${deps.total}`);
    if (deps.topDeps && deps.topDeps.length > 0) {
      console.log('\n  Top Dependencies:');
      for (const d of deps.topDeps) {
        console.log(`    - ${d}`);
      }
    }
  }

  if (isTests) {
    const tests = profileTests(root);
    if (isJson) {
      console.log(JSON.stringify(tests, null, 2));
      return;
    }
    console.log('Test Profile:\n');
    console.log(`  Test files: ${tests.testFiles}`);
    console.log(`  Describe blocks: ${tests.describeCount}`);
    console.log(`  Test cases (it): ${tests.itCount}`);
    console.log(`  Total lines: ${tests.testLines}`);
    console.log(`  Estimated time: ${(tests.estimatedTimeMs / 1000).toFixed(1)}s`);
  }

  if (isCommands) {
    const cmds = profileCommands(root);
    if (isJson) {
      console.log(JSON.stringify(cmds, null, 2));
      return;
    }
    console.log('CLI Command Profile:\n');
    console.log(`  Total commands: ${cmds.commandCount}`);
    if (cmds.commands.length > 0) {
      console.log('\n  Commands:');
      for (let i = 0; i < cmds.commands.length; i += 4) {
        const row = cmds.commands.slice(i, i + 4).map(c => c.padEnd(20)).join('');
        console.log(`    ${row}`);
      }
    }
  }
}

module.exports = {
  runProfiler,
  walkDirectory,
  profileFiles,
  profileDeps,
  profileTests,
  profileCommands,
  formatBytes,
  runFullProfile,
  IGNORE_DIRS,
  CODE_EXTENSIONS,
};
