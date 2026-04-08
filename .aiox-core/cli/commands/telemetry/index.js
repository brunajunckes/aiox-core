/**
 * Telemetry Command Module
 *
 * Opt-in anonymous usage metrics collection.
 * Local-only storage — no network calls.
 *
 * @module cli/commands/telemetry
 * @version 1.0.0
 * @story 4.1 - Opt-in Usage Metrics Collection
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Path Helpers (functions, not constants — evaluated at call time) ──────────

/**
 * Resolve .aiox directory path.
 * @returns {string}
 */
function getAioxDir() {
  return path.join(process.cwd(), '.aiox');
}

/**
 * Resolve telemetry state file path.
 * @returns {string}
 */
function getTelemetryFile() {
  return path.join(getAioxDir(), 'telemetry.json');
}

/**
 * Resolve metrics directory path.
 * @returns {string}
 */
function getMetricsDir() {
  return path.join(getAioxDir(), 'metrics');
}

// ── State Management ─────────────────────────────────────────────────────────

/**
 * Read current telemetry state from disk.
 * Returns { enabled: false } if file is missing or corrupt.
 * @returns {{ enabled: boolean, enabledAt?: string, disabledAt?: string }}
 */
function readTelemetryState() {
  const filePath = getTelemetryFile();
  try {
    if (!fs.existsSync(filePath)) {
      return { enabled: false };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.enabled !== 'boolean') {
      return { enabled: false };
    }
    return parsed;
  } catch {
    return { enabled: false };
  }
}

/**
 * Write telemetry state atomically (temp file + rename).
 * Creates .aiox/ directory if it does not exist.
 * @param {object} state - State object to persist
 */
function writeTelemetryState(state) {
  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getTelemetryFile();
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/**
 * Record a metric event. No-op when telemetry is disabled.
 * Appends to .aiox/metrics/{name}.json.
 * @param {string} name - Metric category name (e.g. 'commands', 'sessions')
 * @param {object} data - Metric payload
 */
function recordMetric(name, data) {
  const state = readTelemetryState();
  if (!state.enabled) return;

  const metricsDir = getMetricsDir();
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const filePath = path.join(metricsDir, `${name}.json`);
  let entries = [];

  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        entries = parsed;
      }
    }
  } catch {
    entries = [];
  }

  entries.push({
    timestamp: new Date().toISOString(),
    ...data,
  });

  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Read all metric files from .aiox/metrics/.
 * Skips corrupt files silently.
 * @returns {Object<string, Array>} Map of metric name -> entries
 */
function readMetrics() {
  const metricsDir = getMetricsDir();
  const result = {};

  if (!fs.existsSync(metricsDir)) {
    return result;
  }

  let files;
  try {
    files = fs.readdirSync(metricsDir).filter(f => f.endsWith('.json'));
  } catch {
    return result;
  }

  for (const file of files) {
    const name = path.basename(file, '.json');
    try {
      const raw = fs.readFileSync(path.join(metricsDir, file), 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        result[name] = parsed;
      }
    } catch {
      // Skip corrupt files
    }
  }

  return result;
}

/**
 * Format a metrics summary for human-readable display.
 * @param {Object<string, Array>} metrics - Metrics map from readMetrics()
 * @returns {string} Formatted summary text
 */
function formatMetricsSummary(metrics) {
  const names = Object.keys(metrics);
  if (names.length === 0) {
    return 'No metrics recorded yet.';
  }

  const lines = [];
  let totalEvents = 0;

  for (const name of names.sort()) {
    const entries = metrics[name];
    totalEvents += entries.length;
    lines.push(`  ${name}: ${entries.length} event${entries.length !== 1 ? 's' : ''}`);
  }

  const header = `Metrics summary (${totalEvents} total event${totalEvents !== 1 ? 's' : ''}, ${names.length} categor${names.length !== 1 ? 'ies' : 'y'}):`;
  return [header, ...lines].join('\n');
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Show telemetry help text.
 */
function showHelp() {
  console.log(`
AIOX Telemetry — Opt-in Usage Metrics

USAGE:
  aiox telemetry on       Enable metrics collection
  aiox telemetry off      Disable metrics collection
  aiox telemetry status   Show current state and metrics summary
  aiox telemetry export   Export all metrics as JSON to stdout
  aiox telemetry help     Show this help message

STORAGE:
  State:   .aiox/telemetry.json
  Metrics: .aiox/metrics/*.json

All data is stored locally. No network calls are made.
`);
}

/**
 * CLI handler for telemetry subcommands.
 * @param {string[]} argv - Subcommand arguments (e.g. ['on'], ['status'])
 */
function runTelemetry(argv) {
  const subcommand = (argv && argv[0]) || '';

  switch (subcommand) {
    case 'on': {
      const state = {
        enabled: true,
        enabledAt: new Date().toISOString(),
      };
      writeTelemetryState(state);
      console.log('Telemetry enabled. Metrics will be collected locally.');
      console.log('Run "aiox telemetry off" to disable at any time.');
      break;
    }

    case 'off': {
      const state = {
        enabled: false,
        disabledAt: new Date().toISOString(),
      };
      writeTelemetryState(state);
      console.log('Telemetry disabled. No metrics will be collected.');
      break;
    }

    case 'status': {
      const state = readTelemetryState();
      const statusLabel = state.enabled ? 'ENABLED' : 'DISABLED';
      console.log(`Telemetry: ${statusLabel}`);

      if (state.enabledAt) {
        console.log(`Enabled at: ${state.enabledAt}`);
      }
      if (state.disabledAt) {
        console.log(`Disabled at: ${state.disabledAt}`);
      }

      const metrics = readMetrics();
      console.log('');
      console.log(formatMetricsSummary(metrics));
      break;
    }

    case 'export': {
      const metrics = readMetrics();
      const state = readTelemetryState();
      const exportData = {
        telemetry: state,
        metrics,
        exportedAt: new Date().toISOString(),
      };
      console.log(JSON.stringify(exportData, null, 2));
      break;
    }

    case 'help':
      showHelp();
      break;

    default:
      showHelp();
      break;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getAioxDir,
  getTelemetryFile,
  getMetricsDir,
  readTelemetryState,
  writeTelemetryState,
  recordMetric,
  readMetrics,
  formatMetricsSummary,
  runTelemetry,
};
