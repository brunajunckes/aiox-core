/**
 * Experiment Command Module
 *
 * Onboarding A/B testing framework.
 * Local-only experiment variant assignment and tracking.
 *
 * @module cli/commands/experiment
 * @version 1.0.0
 * @story 4.2 - Onboarding A/B Testing Framework
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
 * Resolve experiment state file path.
 * @returns {string}
 */
function getExperimentFile() {
  return path.join(getAioxDir(), 'experiment.json');
}

// ── Known Experiments ────────────────────────────────────────────────────────

const KNOWN_EXPERIMENTS = {
  'onboarding-flow': {
    variants: ['guided', 'minimal'],
    description: 'Onboarding experience: guided (current quickstart) vs minimal (streamlined)',
  },
};

// ── State Management ─────────────────────────────────────────────────────────

/**
 * Read current experiment state from disk.
 * Returns null if file is missing or corrupt.
 * @returns {object|null}
 */
function readExperiment() {
  const filePath = getExperimentFile();
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.experiments) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write experiment state atomically (temp file + rename).
 * Creates .aiox/ directory if it does not exist.
 * @param {object} data - Experiment state object to persist
 */
function writeExperiment(data) {
  const dir = getAioxDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = getExperimentFile();
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ── Variant Assignment ───────────────────────────────────────────────────────

/**
 * Assign a random variant for an experiment (50/50).
 * If already assigned, returns the existing variant.
 * Persists the choice to disk.
 * @param {string} experimentId - Experiment identifier
 * @returns {string} Assigned variant name
 */
function assignVariant(experimentId) {
  const experiment = KNOWN_EXPERIMENTS[experimentId];
  if (!experiment) {
    throw new Error(`Unknown experiment: ${experimentId}`);
  }

  // Check for existing assignment
  const state = readExperiment() || { experiments: {} };
  if (state.experiments[experimentId] && state.experiments[experimentId].variant) {
    return state.experiments[experimentId].variant;
  }

  // 50/50 random assignment
  const variants = experiment.variants;
  const variant = variants[Math.random() < 0.5 ? 0 : 1];

  state.experiments[experimentId] = {
    variant,
    assignedAt: new Date().toISOString(),
    completions: 0,
  };

  writeExperiment(state);
  return variant;
}

/**
 * Get the assigned variant for an experiment without assigning.
 * Returns null if not yet assigned.
 * @param {string} experimentId - Experiment identifier
 * @returns {string|null} Variant name or null
 */
function getVariant(experimentId) {
  const state = readExperiment();
  if (!state || !state.experiments || !state.experiments[experimentId]) {
    return null;
  }
  return state.experiments[experimentId].variant || null;
}

// ── CLI Handler ──────────────────────────────────────────────────────────────

/**
 * Show experiment help text.
 */
function showHelp() {
  console.log(`
AIOX Experiment — Onboarding A/B Testing

USAGE:
  aiox experiment list      Show all experiments with variant assignments
  aiox experiment status    Show experiment status with metrics
  aiox experiment reset <id>  Reset variant assignment for an experiment
  aiox experiment help      Show this help message

EXPERIMENTS:
  onboarding-flow    Guided (current quickstart) vs Minimal (streamlined)

STORAGE:
  State: .aiox/experiment.json

All data is stored locally. No network calls are made.
`);
}

/**
 * CLI handler for experiment subcommands.
 * @param {string[]} argv - Subcommand arguments
 */
function runExperiment(argv) {
  const subcommand = (argv && argv[0]) || '';

  switch (subcommand) {
    case 'list': {
      const state = readExperiment();
      const experimentIds = Object.keys(KNOWN_EXPERIMENTS);

      if (experimentIds.length === 0) {
        console.log('No experiments defined.');
        break;
      }

      console.log('Experiments:\n');
      for (const id of experimentIds) {
        const def = KNOWN_EXPERIMENTS[id];
        const assignment = state && state.experiments && state.experiments[id];
        const variantLabel = assignment ? assignment.variant : '(not assigned)';
        const assignedAt = assignment && assignment.assignedAt
          ? ` — assigned ${assignment.assignedAt}`
          : '';
        console.log(`  ${id}: ${variantLabel}${assignedAt}`);
        console.log(`    ${def.description}`);
        console.log(`    Variants: ${def.variants.join(', ')}`);
        console.log('');
      }
      break;
    }

    case 'status': {
      const state = readExperiment();

      // Import telemetry to check if metrics are available
      let telemetryEnabled = false;
      let metrics = {};
      try {
        const { readTelemetryState, readMetrics } = require('../telemetry/index.js');
        const telemetryState = readTelemetryState();
        telemetryEnabled = telemetryState.enabled;
        if (telemetryEnabled) {
          metrics = readMetrics();
        }
      } catch {
        // Telemetry module not available — continue without metrics
      }

      console.log('Experiment Status:\n');
      console.log(`  Telemetry: ${telemetryEnabled ? 'ENABLED' : 'DISABLED'}`);
      console.log('');

      const experimentIds = Object.keys(KNOWN_EXPERIMENTS);
      for (const id of experimentIds) {
        const assignment = state && state.experiments && state.experiments[id];
        if (assignment) {
          console.log(`  ${id}:`);
          console.log(`    Variant:     ${assignment.variant}`);
          console.log(`    Assigned at: ${assignment.assignedAt}`);
          console.log(`    Completions: ${assignment.completions}`);
        } else {
          console.log(`  ${id}: not assigned`);
        }

        // Show experiment-related metrics if available
        const experimentMetrics = metrics[`experiment-${id}`];
        if (experimentMetrics && experimentMetrics.length > 0) {
          console.log(`    Events:      ${experimentMetrics.length}`);
        }
        console.log('');
      }
      break;
    }

    case 'reset': {
      const experimentId = argv[1];
      if (!experimentId) {
        console.error('Usage: aiox experiment reset <experiment-id>');
        console.error(`Available: ${Object.keys(KNOWN_EXPERIMENTS).join(', ')}`);
        process.exitCode = 1;
        break;
      }

      if (!KNOWN_EXPERIMENTS[experimentId]) {
        console.error(`Unknown experiment: ${experimentId}`);
        console.error(`Available: ${Object.keys(KNOWN_EXPERIMENTS).join(', ')}`);
        process.exitCode = 1;
        break;
      }

      const state = readExperiment() || { experiments: {} };
      if (!state.experiments[experimentId]) {
        console.log(`Experiment "${experimentId}" has no assignment to reset.`);
        break;
      }

      delete state.experiments[experimentId];
      writeExperiment(state);
      console.log(`Reset variant assignment for "${experimentId}".`);
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
  getExperimentFile,
  KNOWN_EXPERIMENTS,
  readExperiment,
  writeExperiment,
  assignVariant,
  getVariant,
  runExperiment,
};
