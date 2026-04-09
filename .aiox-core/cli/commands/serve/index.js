/**
 * Local REST API Server
 *
 * Subcommands:
 *   aiox serve              — Start HTTP server on port 3456
 *   aiox serve --port 8080  — Custom port
 *
 * Endpoints:
 *   GET /api/status   — Project status
 *   GET /api/stories  — List stories
 *   GET /api/commands — List registered commands
 *   GET /api/health   — Health check
 *
 * @module cli/commands/serve
 * @version 1.0.0
 * @story 16.1 — Local REST API Server
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 3456;

const HELP_TEXT = `
LOCAL REST API SERVER

USAGE:
  aiox serve              Start HTTP server on port ${DEFAULT_PORT}
  aiox serve --port 8080  Start on custom port
  aiox serve --help       Show this help

ENDPOINTS:
  GET /api/status    Project status information
  GET /api/stories   List development stories
  GET /api/commands  List registered CLI commands
  GET /api/health    Health check endpoint
`.trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse port from args.
 * @param {string[]} args
 * @returns {number}
 */
function parsePort(args) {
  const idx = args.indexOf('--port');
  if (idx !== -1 && args[idx + 1]) {
    const port = parseInt(args[idx + 1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${args[idx + 1]}. Must be 1-65535.`);
    }
    return port;
  }
  return DEFAULT_PORT;
}

/**
 * Get project status info.
 * @returns {object}
 */
function getStatus() {
  const root = process.cwd();
  const pkgPath = path.join(root, 'package.json');
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (_e) { /* no package.json */ }

  const aioxCoreExists = fs.existsSync(path.join(root, '.aiox-core'));
  const storiesDir = path.join(root, 'docs', 'stories');
  const storiesExist = fs.existsSync(storiesDir);

  return {
    project: pkg.name || path.basename(root),
    version: pkg.version || 'unknown',
    aioxCore: aioxCoreExists,
    storiesDirectory: storiesExist,
    cwd: root,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };
}

/**
 * List story files.
 * @returns {object[]}
 */
function getStories() {
  const storiesDir = path.join(process.cwd(), 'docs', 'stories');
  if (!fs.existsSync(storiesDir)) {
    return [];
  }
  const files = fs.readdirSync(storiesDir).filter(f => f.endsWith('.story.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(storiesDir, f), 'utf8');
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/^##\s+Status\s*\n+(\S+)/m);
    return {
      file: f,
      title: titleMatch ? titleMatch[1] : f,
      status: statusMatch ? statusMatch[1] : 'unknown',
    };
  });
}

/**
 * List registered CLI commands from bin/aiox.js.
 * @returns {object[]}
 */
function getCommands() {
  const aioxPath = path.join(process.cwd(), 'bin', 'aiox.js');
  if (!fs.existsSync(aioxPath)) {
    return [];
  }
  const content = fs.readFileSync(aioxPath, 'utf8');
  const commands = [];
  const caseRegex = /case\s+'([^']+)':\s*\{?\s*\n\s*\/\/\s*(.+)/g;
  let match;
  while ((match = caseRegex.exec(content)) !== null) {
    commands.push({
      name: match[1],
      description: match[2].replace(/—\s*Story\s+[\d.]+/, '').trim(),
    });
  }
  return commands;
}

/**
 * Health check result.
 * @returns {object}
 */
function getHealth() {
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  };
}

/**
 * Route an HTTP request to the correct handler.
 * @param {string} method
 * @param {string} url
 * @returns {{ status: number, body: object }}
 */
function routeRequest(method, url) {
  if (method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  // Strip query string
  const pathname = url.split('?')[0];

  switch (pathname) {
    case '/api/status':
      return { status: 200, body: getStatus() };
    case '/api/stories':
      return { status: 200, body: getStories() };
    case '/api/commands':
      return { status: 200, body: getCommands() };
    case '/api/health':
      return { status: 200, body: getHealth() };
    default:
      return { status: 404, body: { error: 'Not found', availableEndpoints: ['/api/status', '/api/stories', '/api/commands', '/api/health'] } };
  }
}

/**
 * Create the HTTP request handler.
 * @returns {function}
 */
function createHandler() {
  return (req, res) => {
    const result = routeRequest(req.method, req.url);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.body, null, 2));
  };
}

/**
 * Start the server.
 * @param {number} port
 * @returns {http.Server}
 */
function startServer(port) {
  const server = http.createServer(createHandler());

  const shutdown = () => {
    console.log('\nShutting down server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, () => {
    console.log(`AIOX API server running on http://localhost:${port}`);
    console.log('Endpoints:');
    console.log('  GET /api/status   — Project status');
    console.log('  GET /api/stories  — Story list');
    console.log('  GET /api/commands — CLI commands');
    console.log('  GET /api/health   — Health check');
    console.log('\nPress Ctrl+C to stop.');
  });

  return server;
}

/**
 * Main entry point.
 * @param {string[]} args
 */
function runServe(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const port = parsePort(args);
  startServer(port);
}

module.exports = {
  runServe,
  parsePort,
  getStatus,
  getStories,
  getCommands,
  getHealth,
  routeRequest,
  createHandler,
  startServer,
  DEFAULT_PORT,
  HELP_TEXT,
};
