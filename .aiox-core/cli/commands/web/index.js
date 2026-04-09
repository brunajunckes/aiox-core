/**
 * Web Dashboard Server Command Module
 *
 * Starts an HTTP server serving a single-page dashboard with project stats.
 *
 * Subcommands:
 *   aiox web                — Start HTTP server on port 4000
 *   aiox web --port 4567   — Custom port
 *   aiox web --api-only    — Only serve JSON API endpoints, no HTML
 *
 * Endpoints:
 *   GET /               — Dashboard HTML
 *   GET /api/dashboard  — Full dashboard data (JSON)
 *   GET /api/stories    — Story list (JSON)
 *   GET /api/commands   — Command list (JSON)
 *   GET /api/health     — Health check (JSON)
 *
 * @module cli/commands/web
 * @version 1.0.0
 * @story 26.1 — Web Dashboard Server
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Data Collection ─────────────────────────────────────────────────────────

/**
 * Collect story data from docs/stories/.
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
 * Count registered commands in bin/aiox.js.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {Array<string>}
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
 * @returns {number}
 */
function countTestFiles(options = {}) {
  const cwd = options.cwd || process.cwd();
  const testsDir = path.join(cwd, 'tests');
  let count = 0;
  try {
    const walk = dir => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
        else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) count++;
      }
    };
    if (fs.existsSync(testsDir)) walk(testsDir);
  } catch {
    // ignore
  }
  return count;
}

/**
 * Collect full dashboard data.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {object}
 */
function collectDashboardData(options = {}) {
  const stories = collectStories(options);
  const commands = collectCommands(options);
  const testCount = countTestFiles(options);

  const storyStats = {
    total: stories.length,
    done: stories.filter(s => s.status === 'Done').length,
    inReview: stories.filter(s => s.status === 'InReview').length,
    inProgress: stories.filter(s => s.status === 'InProgress').length,
    draft: stories.filter(s => s.status === 'Draft').length,
  };

  return {
    project: {
      name: 'AIOX',
      generatedAt: new Date().toISOString(),
    },
    stories: { list: stories, stats: storyStats },
    commands: { list: commands, total: commands.length },
    tests: { total: testCount },
  };
}

// ── HTML Generation ─────────────────────────────────────────────────────────

/**
 * Generate self-contained HTML dashboard.
 * @param {object} data - Dashboard data from collectDashboardData
 * @returns {string}
 */
function generateHTML(data) {
  const storyRows = data.stories.list
    .map(s => `<tr><td>${s.id}</td><td>${s.title}</td><td class="status-${s.status.toLowerCase()}">${s.status}</td></tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AIOX Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { color: #38bdf8; margin-bottom: 1.5rem; font-size: 1.8rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #1e293b; padding: 1.2rem; border-radius: 8px; border: 1px solid #334155; }
  .card h3 { color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; margin-bottom: 0.5rem; }
  .card .value { font-size: 2rem; font-weight: 700; color: #38bdf8; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
  th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #334155; }
  th { background: #334155; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; }
  .status-done { color: #4ade80; }
  .status-inreview { color: #facc15; }
  .status-inprogress { color: #38bdf8; }
  .status-draft { color: #94a3b8; }
  footer { margin-top: 2rem; color: #64748b; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>AIOX Dashboard</h1>
<div class="grid">
  <div class="card"><h3>Stories</h3><div class="value">${data.stories.stats.total}</div></div>
  <div class="card"><h3>Commands</h3><div class="value">${data.commands.total}</div></div>
  <div class="card"><h3>Tests</h3><div class="value">${data.tests.total}</div></div>
  <div class="card"><h3>Done</h3><div class="value">${data.stories.stats.done}</div></div>
</div>
<h2 style="color:#94a3b8;margin-bottom:1rem;">Stories</h2>
<table>
<thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
<tbody>${storyRows}</tbody>
</table>
<footer>Generated at ${data.project.generatedAt}</footer>
</body>
</html>`;
}

// ── HTTP Server ─────────────────────────────────────────────────────────────

/**
 * Create the HTTP server (does NOT call .listen — caller controls that).
 * @param {object} [options]
 * @param {boolean} [options.apiOnly]
 * @param {string} [options.cwd]
 * @returns {http.Server}
 */
function createServer(options = {}) {
  const serverOptions = { cwd: options.cwd };

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    if (url === '/api/dashboard') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(collectDashboardData(serverOptions)));
      return;
    }

    if (url === '/api/stories') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(collectStories(serverOptions)));
      return;
    }

    if (url === '/api/commands') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(collectCommands(serverOptions)));
      return;
    }

    if (url === '/' && !options.apiOnly) {
      const data = collectDashboardData(serverOptions);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(generateHTML(data));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse args and run the web dashboard server.
 * @param {string[]} argv
 */
function runWeb(argv = []) {
  let port = 4000;
  let apiOnly = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      const p = parseInt(argv[i + 1], 10);
      if (!isNaN(p) && p > 0 && p < 65536) port = p;
      i++;
    }
    if (argv[i] === '--api-only') apiOnly = true;
  }

  const server = createServer({ apiOnly });
  server.listen(port, () => {
    console.log(`AIOX Web Dashboard running on http://localhost:${port}`);
    if (apiOnly) console.log('API-only mode: HTML dashboard disabled');
    console.log('Endpoints: /, /api/dashboard, /api/stories, /api/commands, /api/health');
    console.log('Press Ctrl+C to stop');
  });

  return server;
}

module.exports = {
  runWeb,
  createServer,
  collectStories,
  collectCommands,
  countTestFiles,
  collectDashboardData,
  generateHTML,
};
