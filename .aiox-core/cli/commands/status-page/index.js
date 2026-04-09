/**
 * Status Page Generator Command Module
 *
 * Generates a self-contained HTML status page showing system health.
 *
 * Subcommands:
 *   aiox status-page                       — Print HTML to stdout
 *   aiox status-page --output status.html  — Write to file
 *   aiox status-page --json                — Output data as JSON
 *
 * @module cli/commands/status-page
 * @version 1.0.0
 * @story 26.3 — Status Page Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ── Service Checks ──────────────────────────────────────────────────────────

/**
 * Check if a command is available and return version.
 * @param {string} cmd
 * @returns {{available: boolean, version: string}}
 */
function checkCommand(cmd) {
  try {
    const version = execSync(`${cmd} --version 2>&1`, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
    return { available: true, version };
  } catch {
    return { available: false, version: 'N/A' };
  }
}

/**
 * Check if Ollama is running.
 * @returns {{available: boolean, version: string}}
 */
function checkOllama() {
  try {
    const version = execSync('ollama --version 2>&1', { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
    return { available: true, version };
  } catch {
    return { available: false, version: 'N/A' };
  }
}

/**
 * Collect service statuses.
 * @param {object} [options]
 * @param {Function} [options.execFn] - Custom exec function for testing
 * @returns {Array<{name: string, status: string, detail: string}>}
 */
function collectServices(options = {}) {
  const exec = options.execFn || ((cmd) => {
    try {
      return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
    } catch {
      return null;
    }
  });

  const services = [];

  // Node.js
  const nodeVer = exec('node --version 2>&1');
  services.push({
    name: 'Node.js',
    status: nodeVer ? 'operational' : 'down',
    detail: nodeVer || 'Not found',
  });

  // Git
  const gitVer = exec('git --version 2>&1');
  services.push({
    name: 'Git',
    status: gitVer ? 'operational' : 'down',
    detail: gitVer || 'Not found',
  });

  // npm
  const npmVer = exec('npm --version 2>&1');
  services.push({
    name: 'npm',
    status: npmVer ? 'operational' : 'down',
    detail: npmVer ? `v${npmVer}` : 'Not found',
  });

  // Ollama
  const ollamaVer = exec('ollama --version 2>&1');
  services.push({
    name: 'Ollama',
    status: ollamaVer ? 'operational' : 'down',
    detail: ollamaVer || 'Not found',
  });

  return services;
}

/**
 * Collect test status.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @returns {{lastRun: string, passing: boolean}}
 */
function collectTestStatus(options = {}) {
  const cwd = options.cwd || process.cwd();
  // Check for jest cache or coverage report
  const coverageDir = path.join(cwd, 'coverage');
  try {
    if (fs.existsSync(coverageDir)) {
      const stat = fs.statSync(coverageDir);
      return { lastRun: stat.mtime.toISOString(), passing: true };
    }
  } catch {
    // ignore
  }
  return { lastRun: 'unknown', passing: false };
}

/**
 * Collect full status page data.
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {Function} [options.execFn]
 * @returns {object}
 */
function collectStatusData(options = {}) {
  const services = collectServices(options);
  const testStatus = collectTestStatus(options);
  const allOperational = services.every(s => s.status === 'operational');
  const uptime = os.uptime();

  return {
    generatedAt: new Date().toISOString(),
    overall: allOperational ? 'All Systems Operational' : 'Degraded',
    services,
    tests: testStatus,
    system: {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      platform: os.platform(),
      nodeVersion: process.version,
    },
  };
}

// ── HTML Generation ─────────────────────────────────────────────────────────

/**
 * Generate self-contained status page HTML.
 * @param {object} data
 * @returns {string}
 */
function generateStatusHTML(data) {
  const serviceRows = data.services
    .map(s => {
      const color = s.status === 'operational' ? '#4ade80' : '#f87171';
      const icon = s.status === 'operational' ? '&#10003;' : '&#10007;';
      return `<tr><td>${s.name}</td><td style="color:${color}">${icon} ${s.status}</td><td>${s.detail}</td></tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AIOX Status Page</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { color: #38bdf8; margin-bottom: 0.5rem; }
  .overall { font-size: 1.2rem; margin-bottom: 2rem; padding: 1rem; border-radius: 8px; background: ${data.overall === 'All Systems Operational' ? '#166534' : '#991b1b'}; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; margin-bottom: 2rem; }
  th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #334155; }
  th { background: #334155; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; }
  .info { background: #1e293b; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
  .info span { color: #94a3b8; }
  footer { margin-top: 2rem; color: #64748b; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>AIOX Status Page</h1>
<div class="overall">${data.overall}</div>
<h2 style="color:#94a3b8;margin-bottom:1rem;">Services</h2>
<table>
<thead><tr><th>Service</th><th>Status</th><th>Detail</th></tr></thead>
<tbody>${serviceRows}</tbody>
</table>
<div class="info"><span>System Uptime:</span> ${data.system.uptime}</div>
<div class="info"><span>Platform:</span> ${data.system.platform}</div>
<div class="info"><span>Node.js:</span> ${data.system.nodeVersion}</div>
<div class="info"><span>Last Test Run:</span> ${data.tests.lastRun}</div>
<footer>Generated at ${data.generatedAt}</footer>
</body>
</html>`;
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse args and run status page generation.
 * @param {string[]} argv
 * @returns {string}
 */
function runStatusPage(argv = []) {
  let outputFile = '';
  let jsonMode = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output' && argv[i + 1]) { outputFile = argv[++i]; continue; }
    if (argv[i] === '--json') { jsonMode = true; continue; }
  }

  const data = collectStatusData();

  if (jsonMode) {
    const output = JSON.stringify(data, null, 2);
    console.log(output);
    return output;
  }

  const html = generateStatusHTML(data);

  if (outputFile) {
    const resolvedPath = path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(resolvedPath, html, 'utf8');
    console.log(`Status page written to ${resolvedPath}`);
    return html;
  }

  console.log(html);
  return html;
}

module.exports = {
  runStatusPage,
  collectServices,
  collectTestStatus,
  collectStatusData,
  generateStatusHTML,
};
