/**
 * System Event Logger Command Module
 *
 * Manages system events stored in .aiox/events.jsonl.
 *
 * Subcommands:
 *   aiox events              — Show last 20 events
 *   aiox events --level X    — Filter by level (info, warn, error)
 *   aiox events --since Nh   — Events from last N hours
 *   aiox events --clear      — Clear event log
 *   aiox events --tail       — Watch mode (prints new events)
 *
 * @module cli/commands/events
 * @version 1.0.0
 * @story 11.1 — System Event Logger
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Path Helpers ──────────────────────────────────────────────────────────────

function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

function getEventsFile() {
  return path.join(getAioxDir(), 'events.jsonl');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const VALID_LEVELS = ['info', 'warn', 'error'];

/**
 * Log a system event to events.jsonl.
 * @param {string} level - Event level (info, warn, error)
 * @param {string} source - Event source (e.g. command name)
 * @param {string} message - Event message
 * @param {object} [data] - Optional additional data
 * @returns {{ timestamp: string, level: string, source: string, message: string, data?: object }}
 */
function logEvent(level, source, message, data) {
  if (!VALID_LEVELS.includes(level)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  if (!source || typeof source !== 'string') {
    throw new Error('Source is required and must be a string');
  }
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }

  const event = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  };
  if (data !== undefined) {
    event.data = data;
  }

  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(getEventsFile(), JSON.stringify(event) + '\n', 'utf8');
  return event;
}

/**
 * Read all events from file.
 * @returns {Array<object>}
 */
function readEvents() {
  const filePath = getEventsFile();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Parse a duration string like "2h", "30m", "1d" to milliseconds.
 * @param {string} since
 * @returns {number} milliseconds
 */
function parseSince(since) {
  const match = since.match(/^(\d+)\s*(h|m|d)$/i);
  if (!match) {
    throw new Error(`Invalid --since format: "${since}". Use Nh, Nm, or Nd (e.g. 2h, 30m, 1d)`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { h: 3600000, m: 60000, d: 86400000 };
  return value * multipliers[unit];
}

/**
 * Filter events by level.
 * @param {Array<object>} events
 * @param {string} level
 * @returns {Array<object>}
 */
function filterByLevel(events, level) {
  const normalized = level.toLowerCase();
  if (!VALID_LEVELS.includes(normalized)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  return events.filter(e => e.level === normalized);
}

/**
 * Filter events by time window.
 * @param {Array<object>} events
 * @param {string} since - Duration string (e.g. "2h")
 * @returns {Array<object>}
 */
function filterBySince(events, since) {
  const ms = parseSince(since);
  const cutoff = Date.now() - ms;
  return events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
}

/**
 * Clear the event log file.
 * @returns {boolean} true if cleared, false if file didn't exist
 */
function clearEvents() {
  const filePath = getEventsFile();
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.writeFileSync(filePath, '', 'utf8');
  return true;
}

/**
 * Format a single event for display.
 * @param {object} event
 * @returns {string}
 */
function formatEvent(event) {
  const ts = event.timestamp || 'unknown';
  const level = (event.level || 'info').toUpperCase().padEnd(5);
  const source = event.source || 'unknown';
  const msg = event.message || '';
  let line = `[${ts}] ${level} [${source}] ${msg}`;
  if (event.data) {
    line += ` ${JSON.stringify(event.data)}`;
  }
  return line;
}

/**
 * Watch events file for new entries (tail mode).
 * @param {object} [options]
 * @param {function} [options.onEvent] - Callback for each new event
 * @param {number} [options.interval] - Poll interval in ms (default 1000)
 * @returns {{ stop: function }} Controller to stop watching
 */
function watchEvents(options = {}) {
  const { onEvent, interval = 1000 } = options;
  const filePath = getEventsFile();
  let lastSize = 0;

  try {
    if (fs.existsSync(filePath)) {
      lastSize = fs.statSync(filePath).size;
    }
  } catch {
    // ignore
  }

  const timer = setInterval(() => {
    try {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      if (stat.size > lastSize) {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        const newContent = buf.toString('utf8').trim();
        if (newContent) {
          const lines = newContent.split('\n');
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (onEvent) {
                onEvent(event);
              }
            } catch {
              // skip malformed lines
            }
          }
        }
        lastSize = stat.size;
      }
    } catch {
      // ignore errors in watch loop
    }
  }, interval);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

// ── Main Runner ──────────────────────────────────────────────────────────────

/**
 * Run the events command.
 * @param {string[]} argv - CLI arguments after 'events'
 */
function runEvents(argv = []) {
  // Parse flags
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--level' && argv[i + 1]) {
      flags.level = argv[++i];
    } else if (argv[i] === '--since' && argv[i + 1]) {
      flags.since = argv[++i];
    } else if (argv[i] === '--clear') {
      flags.clear = true;
    } else if (argv[i] === '--tail') {
      flags.tail = true;
    }
  }

  if (flags.clear) {
    const cleared = clearEvents();
    if (cleared) {
      console.log('Event log cleared.');
    } else {
      console.log('No event log to clear.');
    }
    return;
  }

  if (flags.tail) {
    console.log('Watching events (Ctrl+C to stop)...');
    const watcher = watchEvents({
      onEvent(event) {
        console.log(formatEvent(event));
      },
      interval: 500,
    });

    process.on('SIGINT', () => {
      watcher.stop();
      process.exit(0);
    });
    return;
  }

  let events = readEvents();

  if (flags.level) {
    events = filterByLevel(events, flags.level);
  }

  if (flags.since) {
    events = filterBySince(events, flags.since);
  }

  // Show last 20 by default
  const display = events.slice(-20);

  if (display.length === 0) {
    console.log('No events found.');
    return;
  }

  console.log(`Showing ${display.length} event(s):\n`);
  for (const event of display) {
    console.log(formatEvent(event));
  }
}

module.exports = {
  getAioxDir,
  getEventsFile,
  logEvent,
  readEvents,
  parseSince,
  filterByLevel,
  filterBySince,
  clearEvents,
  formatEvent,
  watchEvents,
  runEvents,
  VALID_LEVELS,
};
