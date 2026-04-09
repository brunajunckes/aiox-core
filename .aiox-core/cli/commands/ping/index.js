/**
 * Ping & Latency Command Module
 *
 * TCP ping to a host, measuring connection latency.
 *
 * Usage:
 *   aiox ping <host>              — TCP ping to host, show latency
 *   aiox ping <host> --count N    — ping N times
 *   aiox ping <host> --port 443   — specific port
 *   aiox ping <host> --format json — output as JSON
 *
 * @module cli/commands/ping
 * @version 1.0.0
 * @story 30.1 — Ping & Latency
 */

'use strict';

const net = require('net');

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PORT = 80;
const DEFAULT_COUNT = 4;
const DEFAULT_TIMEOUT = 5000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments for ping command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const result = { host: null, port: DEFAULT_PORT, count: DEFAULT_COUNT, timeout: DEFAULT_TIMEOUT, format: 'text' };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      result.port = parseInt(argv[++i], 10);
    } else if (arg === '--count' && argv[i + 1]) {
      result.count = parseInt(argv[++i], 10);
    } else if (arg === '--timeout' && argv[i + 1]) {
      result.timeout = parseInt(argv[++i], 10);
    } else if (arg === '--format' && argv[i + 1]) {
      result.format = argv[++i];
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) result.host = positional[0];
  return result;
}

/**
 * Perform a single TCP ping to host:port, returning latency in ms.
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<{success: boolean, latency: number, error: string|null}>}
 */
function tcpPing(host, port, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ success: true, latency, error: null });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, latency: Date.now() - start, error: 'timeout' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, latency: Date.now() - start, error: err.message });
    });

    socket.connect(port, host);
  });
}

/**
 * Run multiple pings and collect results.
 * @param {string} host
 * @param {number} port
 * @param {number} count
 * @param {number} timeout
 * @returns {Promise<object>}
 */
async function runPings(host, port, count, timeout) {
  const results = [];

  for (let i = 0; i < count; i++) {
    const result = await tcpPing(host, port, timeout);
    results.push(result);
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const latencies = successful.map(r => r.latency);

  const stats = {
    host,
    port,
    count,
    successful: successful.length,
    failed: failed.length,
    results,
  };

  if (latencies.length > 0) {
    stats.min = Math.min(...latencies);
    stats.max = Math.max(...latencies);
    stats.avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  } else {
    stats.min = 0;
    stats.max = 0;
    stats.avg = 0;
  }

  return stats;
}

/**
 * Format ping results as text.
 * @param {object} stats
 * @returns {string}
 */
function formatText(stats) {
  const lines = [];
  lines.push(`TCP PING ${stats.host}:${stats.port}`);
  lines.push('');

  for (let i = 0; i < stats.results.length; i++) {
    const r = stats.results[i];
    if (r.success) {
      lines.push(`  #${i + 1}  ${r.latency}ms  OK`);
    } else {
      lines.push(`  #${i + 1}  ${r.error}`);
    }
  }

  lines.push('');
  lines.push(`--- ${stats.host} ping statistics ---`);
  lines.push(`${stats.count} pings, ${stats.successful} ok, ${stats.failed} failed`);

  if (stats.successful > 0) {
    lines.push(`min/avg/max = ${stats.min}/${stats.avg}/${stats.max} ms`);
  }

  return lines.join('\n');
}

/**
 * Format ping results as JSON.
 * @param {object} stats
 * @returns {string}
 */
function formatJson(stats) {
  return JSON.stringify(stats, null, 2);
}

/**
 * Main entry point for ping command.
 * @param {string[]} argv
 */
async function runPing(argv) {
  const opts = parseArgs(argv || []);

  if (!opts.host) {
    console.error('Usage: aiox ping <host> [--port N] [--count N] [--format json]');
    process.exitCode = 1;
    return { error: 'No host specified' };
  }

  if (isNaN(opts.port) || opts.port < 1 || opts.port > 65535) {
    console.error('Invalid port number');
    process.exitCode = 1;
    return { error: 'Invalid port' };
  }

  if (isNaN(opts.count) || opts.count < 1) {
    console.error('Invalid count');
    process.exitCode = 1;
    return { error: 'Invalid count' };
  }

  const stats = await runPings(opts.host, opts.port, opts.count, opts.timeout);

  if (opts.format === 'json') {
    console.log(formatJson(stats));
  } else {
    console.log(formatText(stats));
  }

  return stats;
}

module.exports = {
  runPing,
  parseArgs,
  tcpPing,
  runPings,
  formatText,
  formatJson,
  DEFAULT_PORT,
  DEFAULT_COUNT,
  DEFAULT_TIMEOUT,
};
