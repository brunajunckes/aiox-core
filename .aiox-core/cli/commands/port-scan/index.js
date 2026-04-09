/**
 * Port Scanner Command Module
 *
 * Scan ports on a host using TCP connect.
 *
 * Usage:
 *   aiox port-scan <host>                — scan common ports
 *   aiox port-scan <host> --range 1-1024 — custom range
 *   aiox port-scan <host> --format json  — output as JSON
 *   aiox port-scan <host> --timeout 1000 — connection timeout ms
 *
 * @module cli/commands/port-scan
 * @version 1.0.0
 * @story 30.3 — Port Scanner
 */

'use strict';

const net = require('net');

// ── Constants ───────────────────────────────────────────────────────────────

const COMMON_PORTS = [22, 80, 443, 3000, 5432, 8080];
const DEFAULT_TIMEOUT = 2000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments for port-scan command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const result = { host: null, range: null, format: 'text', timeout: DEFAULT_TIMEOUT };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--range' && argv[i + 1]) {
      result.range = argv[++i];
    } else if (arg === '--format' && argv[i + 1]) {
      result.format = argv[++i];
    } else if (arg === '--timeout' && argv[i + 1]) {
      result.timeout = parseInt(argv[++i], 10);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) result.host = positional[0];
  return result;
}

/**
 * Parse a port range string like "1-1024".
 * @param {string} rangeStr
 * @returns {number[]|null}
 */
function parseRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;

  const match = rangeStr.match(/^(\d+)-(\d+)$/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);

  if (start < 1 || end > 65535 || start > end) return null;

  const ports = [];
  for (let p = start; p <= end; p++) {
    ports.push(p);
  }
  return ports;
}

/**
 * Check if a single port is open.
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<{port: number, open: boolean, error: string|null}>}
 */
function checkPort(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve({ port, open: true, error: null });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, open: false, error: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ port, open: false, error: err.message });
    });

    socket.connect(port, host);
  });
}

/**
 * Scan multiple ports on a host.
 * @param {string} host
 * @param {number[]} ports
 * @param {number} timeout
 * @returns {Promise<object>}
 */
async function scanPorts(host, ports, timeout) {
  const results = await Promise.all(
    ports.map(port => checkPort(host, port, timeout))
  );

  const openPorts = results.filter(r => r.open);
  const closedPorts = results.filter(r => !r.open);

  return {
    host,
    scanned: ports.length,
    open: openPorts.length,
    closed: closedPorts.length,
    results,
    openPorts: openPorts.map(r => r.port),
  };
}

/**
 * Format scan results as text.
 * @param {object} stats
 * @returns {string}
 */
function formatText(stats) {
  const lines = [];
  lines.push(`PORT SCAN ${stats.host}`);
  lines.push(`Scanned ${stats.scanned} ports`);
  lines.push('');

  for (const r of stats.results) {
    const status = r.open ? 'OPEN' : 'CLOSED';
    lines.push(`  ${String(r.port).padEnd(6)} ${status}`);
  }

  lines.push('');
  lines.push(`${stats.open} open, ${stats.closed} closed`);

  return lines.join('\n');
}

/**
 * Format scan results as JSON.
 * @param {object} stats
 * @returns {string}
 */
function formatJson(stats) {
  return JSON.stringify(stats, null, 2);
}

/**
 * Main entry point for port-scan command.
 * @param {string[]} argv
 */
async function runPortScan(argv) {
  const opts = parseArgs(argv || []);

  if (!opts.host) {
    console.error('Usage: aiox port-scan <host> [--range N-M] [--timeout N] [--format json]');
    process.exitCode = 1;
    return { error: 'No host specified' };
  }

  let ports = COMMON_PORTS;
  if (opts.range) {
    const parsed = parseRange(opts.range);
    if (!parsed) {
      console.error('Invalid range format. Use: --range START-END (e.g., 1-1024)');
      process.exitCode = 1;
      return { error: 'Invalid range' };
    }
    ports = parsed;
  }

  const stats = await scanPorts(opts.host, ports, opts.timeout);

  if (opts.format === 'json') {
    console.log(formatJson(stats));
  } else {
    console.log(formatText(stats));
  }

  return stats;
}

module.exports = {
  runPortScan,
  parseArgs,
  parseRange,
  checkPort,
  scanPorts,
  formatText,
  formatJson,
  COMMON_PORTS,
  DEFAULT_TIMEOUT,
};
