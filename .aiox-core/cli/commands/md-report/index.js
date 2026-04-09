/**
 * Markdown Report Engine Command Module
 *
 * Generates comprehensive markdown reports of the entire project.
 *
 * Subcommands:
 *   aiox md-report                                        — Full report to stdout
 *   aiox md-report --sections "stats,stories,commands"    — Select sections
 *   aiox md-report --output PROJECT-REPORT.md             — Write to file
 *   aiox md-report --format json                          — Output as JSON
 *
 * @module cli/commands/md-report
 * @version 1.0.0
 * @story 26.4 — Markdown Report Engine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Available Sections ──────────────────────────────────────────────────────

const ALL_SECTIONS = ['stats', 'stories', 'commands', 'tests', 'dependencies', 'contributors'];

// ── Data Collectors ─────────────────────────────────────────────────────────

/**
 * Collect project stats.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {object}
 */
function collectStats(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    // ignore
  }

  let jsFileCount = 0;
  const countJs = dir => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) countJs(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) jsFileCount++;
      }
    } catch { /* ignore */ }
  };

  // Count only in key directories to avoid heavy traversal
  for (const sub of ['bin', 'packages', '.aiox-core/cli', 'tests']) {
    const d = path.join(cwd, sub);
    if (fs.existsSync(d)) countJs(d);
  }

  return {
    name: pkg.name || path.basename(cwd),
    version: pkg.version || 'unknown',
    description: pkg.description || '',
    jsFiles: jsFileCount,
  };
}

/**
 * Collect story summaries.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<{id: string, title: string, status: string}>}
 */
function collectStories(options = {}) {
  const cwd = options.cwd || process.cwd();
  const storiesDir = path.join(cwd, 'docs', 'stories');
  const stories = [];
  try {
    if (!fs.existsSync(storiesDir)) return stories;
    const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md')).sort();
    for (const file of files) {
      const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      const titleMatch = content.match(/^#\s+(.+)/m);
      const statusMatch = content.match(/^##\s+Status\s*\n+\s*(\S+)/mi);
      stories.push({
        id: file.replace('.story.md', ''),
        title: titleMatch ? titleMatch[1].trim() : file,
        status: statusMatch ? statusMatch[1].trim() : 'Unknown',
      });
    }
  } catch {
    // ignore
  }
  return stories;
}

/**
 * Collect registered CLI commands.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {string[]}
 */
function collectCommands(options = {}) {
  const cwd = options.cwd || process.cwd();
  const aioxPath = path.join(cwd, 'bin', 'aiox.js');
  try {
    const content = fs.readFileSync(aioxPath, 'utf8');
    const matches = content.match(/case\s+'([^']+)'/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/case\s+'/, '').replace(/'$/, ''));
  } catch {
    return [];
  }
}

/**
 * Count test files.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{total: number, dirs: string[]}}
 */
function collectTests(options = {}) {
  const cwd = options.cwd || process.cwd();
  const testsDir = path.join(cwd, 'tests');
  let total = 0;
  const dirs = new Set();
  try {
    const walk = dir => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
        else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
          total++;
          dirs.add(path.relative(path.join(cwd, 'tests'), path.dirname(full)));
        }
      }
    };
    if (fs.existsSync(testsDir)) walk(testsDir);
  } catch {
    // ignore
  }
  return { total, dirs: Array.from(dirs).filter(Boolean).sort() };
}

/**
 * Collect dependencies from package.json.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{deps: string[], devDeps: string[]}}
 */
function collectDependencies(options = {}) {
  const cwd = options.cwd || process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return {
      deps: Object.keys(pkg.dependencies || {}),
      devDeps: Object.keys(pkg.devDependencies || {}),
    };
  } catch {
    return { deps: [], devDeps: [] };
  }
}

/**
 * Collect contributors from git log.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {Function} [options.execFn]
 * @returns {string[]}
 */
function collectContributors(options = {}) {
  const cwd = options.cwd || process.cwd();
  const exec = options.execFn;
  try {
    const result = exec
      ? exec('git log --format="%aN" | sort -u')
      : execSync('git log --format="%aN" | sort -u', { cwd, encoding: 'utf8', timeout: 10000 });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// ── Report Generation ───────────────────────────────────────────────────────

/**
 * Generate markdown report.
 * @param {object} [options]
 * @param {string[]} [options.sections]
 * @param {string} [options.cwd]
 * @param {Function} [options.execFn]
 * @returns {string}
 */
function generateReport(options = {}) {
  const sections = options.sections || ALL_SECTIONS;
  const cwd = options.cwd || process.cwd();
  const collOpts = { cwd, execFn: options.execFn };
  const lines = [];
  const date = new Date().toISOString().split('T')[0];

  lines.push('# AIOX Project Report');
  lines.push('');
  lines.push(`Generated: ${date}`);
  lines.push('');

  if (sections.includes('stats')) {
    const stats = collectStats(collOpts);
    lines.push('## Project Overview');
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Name | ${stats.name} |`);
    lines.push(`| Version | ${stats.version} |`);
    lines.push(`| Description | ${stats.description} |`);
    lines.push(`| JS Files | ${stats.jsFiles} |`);
    lines.push('');
  }

  if (sections.includes('stories')) {
    const stories = collectStories(collOpts);
    lines.push('## Sprint Summary');
    lines.push('');
    if (stories.length === 0) {
      lines.push('No stories found.');
    } else {
      lines.push(`| ID | Title | Status |`);
      lines.push(`|----|-------|--------|`);
      for (const s of stories) {
        lines.push(`| ${s.id} | ${s.title} | ${s.status} |`);
      }
    }
    lines.push('');
  }

  if (sections.includes('commands')) {
    const commands = collectCommands(collOpts);
    lines.push('## Command Inventory');
    lines.push('');
    lines.push(`Total commands: ${commands.length}`);
    lines.push('');
    if (commands.length > 0) {
      for (const cmd of commands) {
        lines.push(`- \`aiox ${cmd}\``);
      }
    }
    lines.push('');
  }

  if (sections.includes('tests')) {
    const tests = collectTests(collOpts);
    lines.push('## Test Coverage');
    lines.push('');
    lines.push(`Total test files: ${tests.total}`);
    lines.push('');
    if (tests.dirs.length > 0) {
      lines.push('Test directories:');
      for (const d of tests.dirs) {
        lines.push(`- \`tests/${d}\``);
      }
    }
    lines.push('');
  }

  if (sections.includes('dependencies')) {
    const deps = collectDependencies(collOpts);
    lines.push('## Dependencies');
    lines.push('');
    lines.push(`Production: ${deps.deps.length}`);
    lines.push(`Development: ${deps.devDeps.length}`);
    lines.push('');
    if (deps.deps.length > 0) {
      lines.push('### Production');
      for (const d of deps.deps) lines.push(`- ${d}`);
      lines.push('');
    }
    if (deps.devDeps.length > 0) {
      lines.push('### Development');
      for (const d of deps.devDeps) lines.push(`- ${d}`);
      lines.push('');
    }
  }

  if (sections.includes('contributors')) {
    const contribs = collectContributors(collOpts);
    lines.push('## Contributors');
    lines.push('');
    if (contribs.length === 0) {
      lines.push('No contributors found.');
    } else {
      for (const c of contribs) lines.push(`- ${c}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by AIOX Markdown Report Engine*');

  return lines.join('\n');
}

/**
 * Generate report as JSON.
 * @param {object} [options]
 * @param {string[]} [options.sections]
 * @param {string} [options.cwd]
 * @param {Function} [options.execFn]
 * @returns {object}
 */
function generateReportJSON(options = {}) {
  const sections = options.sections || ALL_SECTIONS;
  const cwd = options.cwd || process.cwd();
  const collOpts = { cwd, execFn: options.execFn };
  const data = {};

  if (sections.includes('stats')) data.stats = collectStats(collOpts);
  if (sections.includes('stories')) data.stories = collectStories(collOpts);
  if (sections.includes('commands')) data.commands = collectCommands(collOpts);
  if (sections.includes('tests')) data.tests = collectTests(collOpts);
  if (sections.includes('dependencies')) data.dependencies = collectDependencies(collOpts);
  if (sections.includes('contributors')) data.contributors = collectContributors(collOpts);

  return data;
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse args and run markdown report generation.
 * @param {string[]} argv
 * @returns {string}
 */
function runMdReport(argv = []) {
  let outputFile = '';
  let format = 'markdown';
  let sections = ALL_SECTIONS;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1]) { outputFile = argv[++i]; continue; }
    if (argv[i] === '--format' && argv[i + 1]) { format = argv[++i]; continue; }
    if (argv[i] === '--sections' && argv[i + 1]) {
      sections = argv[++i].split(',').map(s => s.trim()).filter(s => ALL_SECTIONS.includes(s));
      if (sections.length === 0) sections = ALL_SECTIONS;
      continue;
    }
  }

  if (format === 'json') {
    const data = generateReportJSON({ sections });
    const output = JSON.stringify(data, null, 2);
    console.log(output);
    return output;
  }

  const report = generateReport({ sections });

  if (outputFile) {
    const resolvedPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(resolvedPath, report, 'utf8');
    console.log(`Report written to ${resolvedPath}`);
    return report;
  }

  console.log(report);
  return report;
}

module.exports = {
  runMdReport,
  collectStats,
  collectStories,
  collectCommands,
  collectTests,
  collectDependencies,
  collectContributors,
  generateReport,
  generateReportJSON,
  ALL_SECTIONS,
};
