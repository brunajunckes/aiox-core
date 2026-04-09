/**
 * HTTP Health Checker Command Module
 *
 * Check URL status code, response time, and headers.
 *
 * Usage:
 *   aiox http-check <url>              — check URL status
 *   aiox http-check <url> --expect 200 — exit 1 if status mismatch
 *   aiox http-check <url> --format json — output as JSON
 *   aiox http-check <url> --headers    — show response headers
 *
 * @module cli/commands/http-check
 * @version 1.0.0
 * @story 30.2 — HTTP Health Checker
 */

'use strict';

const http = require('http');
const https = require('https');

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 10000;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments for http-check command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const result = { url: null, expect: null, format: 'text', headers: false, timeout: DEFAULT_TIMEOUT };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--expect' && argv[i + 1]) {
      result.expect = parseInt(argv[++i], 10);
    } else if (arg === '--format' && argv[i + 1]) {
      result.format = argv[++i];
    } else if (arg === '--headers') {
      result.headers = true;
    } else if (arg === '--timeout' && argv[i + 1]) {
      result.timeout = parseInt(argv[++i], 10);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) result.url = positional[0];
  return result;
}

/**
 * Parse a URL string into components.
 * @param {string} urlStr
 * @returns {object|null}
 */
function parseUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
    };
  } catch {
    return null;
  }
}

/**
 * Perform HTTP request and return result.
 * @param {string} urlStr
 * @param {number} timeout
 * @returns {Promise<object>}
 */
function httpCheck(urlStr, timeout) {
  return new Promise((resolve) => {
    const parsed = parseUrl(urlStr);
    if (!parsed) {
      resolve({ success: false, error: 'Invalid URL', url: urlStr });
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const start = Date.now();

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: 'GET',
      timeout: timeout,
    };

    const req = client.request(options, (res) => {
      const responseTime = Date.now() - start;
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          success: true,
          url: urlStr,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          responseTime,
          headers: res.headers,
          bodySize: Buffer.concat(chunks).length,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, url: urlStr, error: 'Request timeout', responseTime: Date.now() - start });
    });

    req.on('error', (err) => {
      resolve({ success: false, url: urlStr, error: err.message, responseTime: Date.now() - start });
    });

    req.end();
  });
}

/**
 * Format result as text.
 * @param {object} result
 * @param {boolean} showHeaders
 * @returns {string}
 */
function formatText(result, showHeaders) {
  const lines = [];

  if (!result.success) {
    lines.push(`FAIL  ${result.url}`);
    lines.push(`  Error: ${result.error}`);
    return lines.join('\n');
  }

  const statusIndicator = result.statusCode < 400 ? 'OK' : 'FAIL';
  lines.push(`${statusIndicator}  ${result.url}`);
  lines.push(`  Status:        ${result.statusCode} ${result.statusMessage}`);
  lines.push(`  Response Time: ${result.responseTime}ms`);
  lines.push(`  Body Size:     ${result.bodySize} bytes`);

  if (showHeaders && result.headers) {
    lines.push('  Headers:');
    for (const [key, value] of Object.entries(result.headers)) {
      lines.push(`    ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format result as JSON.
 * @param {object} result
 * @returns {string}
 */
function formatJson(result) {
  return JSON.stringify(result, null, 2);
}

/**
 * Main entry point for http-check command.
 * @param {string[]} argv
 */
async function runHttpCheck(argv) {
  const opts = parseArgs(argv || []);

  if (!opts.url) {
    console.error('Usage: aiox http-check <url> [--expect N] [--headers] [--format json]');
    process.exitCode = 1;
    return { error: 'No URL specified' };
  }

  const result = await httpCheck(opts.url, opts.timeout);

  if (opts.expect && result.success && result.statusCode !== opts.expect) {
    result.expectMismatch = true;
    result.expected = opts.expect;
    process.exitCode = 1;
  }

  if (opts.format === 'json') {
    console.log(formatJson(result));
  } else {
    console.log(formatText(result, opts.headers));
  }

  return result;
}

module.exports = {
  runHttpCheck,
  parseArgs,
  parseUrl,
  httpCheck,
  formatText,
  formatJson,
  DEFAULT_TIMEOUT,
};
