#!/usr/bin/env node

/**
 * Squad Performance Metrics CLI
 * Real-time performance tracking for active squads.
 *
 * Usage:
 *   aiox squad-metrics <squad-id>        Show metrics for squad
 *   aiox squad-metrics --all             Show metrics for all squads
 */

const fs = require('fs');
const path = require('path');

const METRICS_DIR = path.join(__dirname, '../../data/squad-metrics');
const SQUAD_REGISTRY_PATH = path.join(__dirname, '../../data/squad-registry.json');

/**
 * Load squad registry
 */
function loadRegistry() {
  if (!fs.existsSync(SQUAD_REGISTRY_PATH)) {
    return { squads: {} };
  }
  return JSON.parse(fs.readFileSync(SQUAD_REGISTRY_PATH, 'utf8'));
}

/**
 * Load metrics for a squad
 */
function loadMetrics(squadId) {
  const metricsFile = path.join(METRICS_DIR, `${squadId}.jsonl`);
  if (!fs.existsSync(metricsFile)) {
    return {
      squadId,
      velocity: 0,
      quality: 0,
      reliability: 0,
      entries: []
    };
  }

  const lines = fs.readFileSync(metricsFile, 'utf8').trim().split('\n').filter(l => l);
  const entries = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return {
    squadId,
    entries,
    velocity: calculateVelocity(entries),
    quality: calculateQuality(entries),
    reliability: calculateReliability(entries)
  };
}

/**
 * Calculate velocity (stories/sprint)
 */
function calculateVelocity(entries) {
  const storiesCompleted = entries.filter(e => e.type === 'story_completed').length;
  return storiesCompleted;
}

/**
 * Calculate quality (test pass rate %)
 */
function calculateQuality(entries) {
  const testEntries = entries.filter(e => e.type === 'test_result');
  if (testEntries.length === 0) return 100;
  const passed = testEntries.filter(e => e.status === 'passed').length;
  return Math.round((passed / testEntries.length) * 100);
}

/**
 * Calculate reliability (success rate %)
 */
function calculateReliability(entries) {
  if (entries.length === 0) return 100;
  const successful = entries.filter(e => e.status === 'success' || e.status === 'passed').length;
  return Math.round((successful / entries.length) * 100);
}

/**
 * Record metric entry
 */
function recordMetric(squadId, metric) {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const metricsFile = path.join(METRICS_DIR, `${squadId}.jsonl`);
  const entry = {
    timestamp: new Date().toISOString(),
    ...metric
  };

  fs.appendFileSync(metricsFile, JSON.stringify(entry) + '\n');
}

/**
 * Format metrics for display
 */
function formatMetrics(metrics) {
  return {
    squadId: metrics.squadId,
    velocity: {
      value: metrics.velocity,
      unit: 'stories/sprint'
    },
    quality: {
      value: metrics.quality,
      unit: 'test_pass_rate_%'
    },
    reliability: {
      value: metrics.reliability,
      unit: 'success_rate_%'
    },
    lastUpdated: metrics.entries.length > 0
      ? metrics.entries[metrics.entries.length - 1].timestamp
      : null
  };
}

/**
 * Export metrics as CSV
 */
function exportCSV(metrics) {
  const headers = ['Timestamp', 'Type', 'Status', 'Details'];
  const rows = metrics.entries.map(e => [
    e.timestamp,
    e.type,
    e.status,
    JSON.stringify(e.details || {})
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  return csv;
}

/**
 * Get scorecard for squad
 */
function getScorecard(squadId) {
  const metrics = loadMetrics(squadId);
  return {
    squadId: metrics.squadId,
    scorecard: {
      velocity: metrics.velocity,
      quality: metrics.quality,
      reliability: metrics.reliability,
      overall: Math.round((metrics.velocity + metrics.quality + metrics.reliability) / 3)
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0) {
      console.log('Usage:');
      console.log('  aiox squad-metrics <squad-id>           Show metrics');
      console.log('  aiox squad-metrics --all                Show all squads');
      console.log('  aiox squad-metrics <id> --csv           Export as CSV');
      console.log('  aiox squad-metrics <id> --scorecard     Show scorecard');
      process.exit(0);
    }

    if (args[0] === '--all') {
      const registry = loadRegistry();
      const scorecards = Object.keys(registry.squads)
        .map(squadId => getScorecard(squadId));
      console.log(JSON.stringify(scorecards, null, 2));
      process.exit(0);
    }

    const squadId = args[0];
    const metrics = loadMetrics(squadId);

    if (args.includes('--csv')) {
      console.log(exportCSV(metrics));
      process.exit(0);
    }

    if (args.includes('--scorecard')) {
      const scorecard = getScorecard(squadId);
      console.log(JSON.stringify(scorecard, null, 2));
      process.exit(0);
    }

    // Default: show formatted metrics
    const formatted = formatMetrics(metrics);
    console.log(JSON.stringify(formatted, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  loadRegistry,
  loadMetrics,
  recordMetric,
  calculateVelocity,
  calculateQuality,
  calculateReliability,
  formatMetrics,
  exportCSV,
  getScorecard
};

if (require.main === module) {
  main();
}
