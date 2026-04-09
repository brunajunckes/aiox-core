/**
 * Webhook Handler
 *
 * Subcommands:
 *   aiox webhooks list                              — List registered webhooks
 *   aiox webhooks add <url> --event <event>         — Register webhook
 *   aiox webhooks remove <id>                       — Remove webhook
 *   aiox webhooks test <id>                         — Send test payload
 *   aiox webhooks fire <event> --data '{"k":"v"}'   — Fire event to hooks
 *
 * @module cli/commands/webhooks
 * @version 1.0.0
 * @story 16.2 — Webhook Handler
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_EVENTS = ['story.completed', 'test.passed', 'test.failed', 'deploy.started'];

const HELP_TEXT = `
WEBHOOK HANDLER

USAGE:
  aiox webhooks list                                List registered webhooks
  aiox webhooks add <url> --event <event>           Register webhook for event
  aiox webhooks remove <id>                         Remove webhook by ID
  aiox webhooks test <id>                           Send test payload to webhook
  aiox webhooks fire <event> --data '{"key":"val"}' Fire event to all hooks
  aiox webhooks --help                              Show this help

EVENTS:
  story.completed   Fired when a story is marked Done
  test.passed       Fired when tests pass
  test.failed       Fired when tests fail
  deploy.started    Fired when deployment starts

EXAMPLES:
  aiox webhooks add https://example.com/hook --event test.passed
  aiox webhooks fire test.passed --data '{"suite":"unit"}'
`.trim();

// ── Path Helpers ─────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getWebhooksFile() {
  return path.join(getAioxDir(), 'webhooks.yaml');
}

// ── Simple YAML-like parser/serializer for webhooks ─────────────────────────

/**
 * Parse webhooks file into array.
 * Format:
 *   - id: abc123
 *     url: https://example.com
 *     event: test.passed
 *     created: 2026-01-01T00:00:00.000Z
 *
 * @returns {object[]}
 */
function loadWebhooks() {
  const filePath = getWebhooksFile();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];

  const webhooks = [];
  let current = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- id:')) {
      if (current) webhooks.push(current);
      current = { id: trimmed.replace('- id:', '').trim() };
    } else if (current && trimmed.startsWith('url:')) {
      current.url = trimmed.replace('url:', '').trim();
    } else if (current && trimmed.startsWith('event:')) {
      current.event = trimmed.replace('event:', '').trim();
    } else if (current && trimmed.startsWith('created:')) {
      current.created = trimmed.replace('created:', '').trim();
    }
  }
  if (current) webhooks.push(current);
  return webhooks;
}

/**
 * Save webhooks array to file.
 * @param {object[]} webhooks
 */
function saveWebhooks(webhooks) {
  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const lines = [];
  for (const wh of webhooks) {
    lines.push(`- id: ${wh.id}`);
    lines.push(`  url: ${wh.url}`);
    lines.push(`  event: ${wh.event}`);
    lines.push(`  created: ${wh.created}`);
  }
  fs.writeFileSync(getWebhooksFile(), lines.join('\n') + '\n', 'utf8');
}

/**
 * Generate short unique ID.
 * @returns {string}
 */
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Add a webhook.
 * @param {string} url
 * @param {string} event
 * @returns {object}
 */
function addWebhook(url, event) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }
  if (!VALID_EVENTS.includes(event)) {
    throw new Error(`Invalid event: ${event}. Valid events: ${VALID_EVENTS.join(', ')}`);
  }

  const webhooks = loadWebhooks();
  const webhook = {
    id: generateId(),
    url,
    event,
    created: new Date().toISOString(),
  };
  webhooks.push(webhook);
  saveWebhooks(webhooks);
  return webhook;
}

/**
 * Remove a webhook by ID.
 * @param {string} id
 * @returns {boolean}
 */
function removeWebhook(id) {
  const webhooks = loadWebhooks();
  const idx = webhooks.findIndex(w => w.id === id);
  if (idx === -1) return false;
  webhooks.splice(idx, 1);
  saveWebhooks(webhooks);
  return true;
}

/**
 * Get a webhook by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getWebhook(id) {
  const webhooks = loadWebhooks();
  return webhooks.find(w => w.id === id) || null;
}

/**
 * Get all webhooks for an event.
 * @param {string} event
 * @returns {object[]}
 */
function getWebhooksForEvent(event) {
  return loadWebhooks().filter(w => w.event === event);
}

/**
 * Send an HTTP POST to a URL with JSON payload.
 * @param {string} url
 * @param {object} payload
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function sendPayload(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-AIOX-Event': payload.event || 'test',
        },
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      },
    );

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

/**
 * Build a test payload for a webhook.
 * @param {object} webhook
 * @returns {object}
 */
function buildTestPayload(webhook) {
  return {
    event: webhook.event,
    test: true,
    webhookId: webhook.id,
    timestamp: new Date().toISOString(),
    data: { message: 'Test payload from AIOX webhooks' },
  };
}

/**
 * Build a fire payload for an event.
 * @param {string} event
 * @param {object} data
 * @returns {object}
 */
function buildFirePayload(event, data) {
  return {
    event,
    test: false,
    timestamp: new Date().toISOString(),
    data: data || {},
  };
}

/**
 * Format webhook for display.
 * @param {object} wh
 * @returns {string}
 */
function formatWebhook(wh) {
  return `  ${wh.id}  ${wh.event.padEnd(20)}  ${wh.url}`;
}

/**
 * Parse --data flag value.
 * @param {string[]} args
 * @returns {object}
 */
function parseData(args) {
  const idx = args.indexOf('--data');
  if (idx === -1 || !args[idx + 1]) return {};
  try {
    return JSON.parse(args[idx + 1]);
  } catch (_e) {
    throw new Error(`Invalid JSON data: ${args[idx + 1]}`);
  }
}

/**
 * Parse --event flag value.
 * @param {string[]} args
 * @returns {string|null}
 */
function parseEvent(args) {
  const idx = args.indexOf('--event');
  if (idx === -1 || !args[idx + 1]) return null;
  return args[idx + 1];
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * @param {string[]} args
 */
async function runWebhooks(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const sub = args[0];

  switch (sub) {
    case 'list': {
      const webhooks = loadWebhooks();
      if (webhooks.length === 0) {
        console.log('No webhooks registered.');
        return;
      }
      console.log('REGISTERED WEBHOOKS\n');
      console.log('  ID        Event                 URL');
      console.log('  ' + '-'.repeat(60));
      for (const wh of webhooks) {
        console.log(formatWebhook(wh));
      }
      console.log(`\nTotal: ${webhooks.length} webhook(s)`);
      break;
    }

    case 'add': {
      const url = args[1];
      const event = parseEvent(args);
      if (!url) {
        console.error('Usage: aiox webhooks add <url> --event <event>');
        process.exitCode = 1;
        return;
      }
      if (!event) {
        console.error('Missing --event flag. Valid events: ' + VALID_EVENTS.join(', '));
        process.exitCode = 1;
        return;
      }
      try {
        const wh = addWebhook(url, event);
        console.log(`Webhook registered: ${wh.id} -> ${wh.event} -> ${wh.url}`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'remove': {
      const id = args[1];
      if (!id) {
        console.error('Usage: aiox webhooks remove <id>');
        process.exitCode = 1;
        return;
      }
      const removed = removeWebhook(id);
      if (removed) {
        console.log(`Webhook ${id} removed.`);
      } else {
        console.error(`Webhook ${id} not found.`);
        process.exitCode = 1;
      }
      break;
    }

    case 'test': {
      const id = args[1];
      if (!id) {
        console.error('Usage: aiox webhooks test <id>');
        process.exitCode = 1;
        return;
      }
      const wh = getWebhook(id);
      if (!wh) {
        console.error(`Webhook ${id} not found.`);
        process.exitCode = 1;
        return;
      }
      const payload = buildTestPayload(wh);
      console.log(`Sending test payload to ${wh.url}...`);
      try {
        const result = await sendPayload(wh.url, payload);
        console.log(`Response: ${result.statusCode}`);
      } catch (err) {
        console.error(`Failed: ${err.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'fire': {
      const event = args[1];
      if (!event || !VALID_EVENTS.includes(event)) {
        console.error(`Usage: aiox webhooks fire <event> --data '{...}'`);
        console.error(`Valid events: ${VALID_EVENTS.join(', ')}`);
        process.exitCode = 1;
        return;
      }
      let data;
      try {
        data = parseData(args);
      } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
      const hooks = getWebhooksForEvent(event);
      if (hooks.length === 0) {
        console.log(`No webhooks registered for event: ${event}`);
        return;
      }
      const payload = buildFirePayload(event, data);
      console.log(`Firing ${event} to ${hooks.length} webhook(s)...`);
      for (const wh of hooks) {
        try {
          const result = await sendPayload(wh.url, payload);
          console.log(`  ${wh.id}: ${result.statusCode}`);
        } catch (err) {
          console.error(`  ${wh.id}: FAILED - ${err.message}`);
        }
      }
      break;
    }

    default:
      console.log(HELP_TEXT);
      break;
  }
}

module.exports = {
  runWebhooks,
  getAioxDir,
  getWebhooksFile,
  loadWebhooks,
  saveWebhooks,
  generateId,
  addWebhook,
  removeWebhook,
  getWebhook,
  getWebhooksForEvent,
  sendPayload,
  buildTestPayload,
  buildFirePayload,
  formatWebhook,
  parseData,
  parseEvent,
  VALID_EVENTS,
  HELP_TEXT,
};
