/**
 * Resource Monitor Command Module
 *
 * Shows CPU, memory, disk usage in a formatted table.
 *
 * Subcommands:
 *   aiox resources              — Show CPU, memory, disk usage
 *   aiox resources --watch      — Live refresh every 2 seconds
 *   aiox resources --format json — Output as JSON
 *   aiox resources --alert      — Show warnings when usage >80%
 *   aiox resources --help       — Show help
 *
 * @module cli/commands/resources
 * @version 1.0.0
 * @story 24.1 — Resource Monitor
 */

'use strict';

const os = require('os');
const { execSync } = require('child_process');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get CPU usage percentage from os.cpus().
 * Calculates average across all cores based on idle vs total time.
 * @returns {{ usagePercent: number, cores: number, model: string }}
 */
function getCpuInfo() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;
    totalTick += user + nice + sys + idle + irq;
    totalIdle += idle;
  }

  const usagePercent = cpus.length > 0
    ? Math.round(((totalTick - totalIdle) / totalTick) * 100)
    : 0;

  return {
    usagePercent,
    cores: cpus.length,
    model: cpus.length > 0 ? cpus[0].model : 'Unknown',
  };
}

/**
 * Get memory usage from os.freemem/totalmem.
 * @returns {{ totalMB: number, usedMB: number, freeMB: number, usagePercent: number }}
 */
function getMemoryInfo() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  return {
    totalMB: Math.round(totalBytes / (1024 * 1024)),
    usedMB: Math.round(usedBytes / (1024 * 1024)),
    freeMB: Math.round(freeBytes / (1024 * 1024)),
    usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
  };
}

/**
 * Get disk usage via df command.
 * @returns {{ totalGB: number, usedGB: number, freeGB: number, usagePercent: number, mount: string }}
 */
function getDiskInfo() {
  try {
    const output = execSync('df -B1 / 2>/dev/null || df -k / 2>/dev/null', {
      encoding: 'utf8',
      timeout: 5000,
    });
    const lines = output.trim().split('\n');
    if (lines.length < 2) return null;

    const parts = lines[1].split(/\s+/);
    // df -B1 gives bytes; df -k gives kilobytes
    const multiplier = output.includes('-B1') || parseInt(parts[1], 10) > 1e9 ? 1 : 1024;
    const totalBytes = parseInt(parts[1], 10) * multiplier;
    const usedBytes = parseInt(parts[2], 10) * multiplier;
    const freeBytes = parseInt(parts[3], 10) * multiplier;

    return {
      totalGB: Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10,
      usedGB: Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10,
      freeGB: Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10,
      usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
      mount: parts[5] || '/',
    };
  } catch {
    return null;
  }
}

/**
 * Collect all resource metrics.
 * @returns {{ cpu: object, memory: object, disk: object|null, timestamp: string }}
 */
function collectMetrics() {
  return {
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format a usage bar [████████░░] style.
 * @param {number} percent
 * @param {number} width
 * @returns {string}
 */
function formatBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

/**
 * Check if a percentage triggers alert threshold.
 * @param {number} percent
 * @param {number} threshold
 * @returns {boolean}
 */
function isAlert(percent, threshold = 80) {
  return percent >= threshold;
}

/**
 * Format metrics as a table string.
 * @param {object} metrics
 * @param {{ alert: boolean }} options
 * @returns {string}
 */
function formatTable(metrics, options = {}) {
  const lines = [];
  const { alert } = options;

  lines.push('╔══════════════════════════════════════════════════════╗');
  lines.push('║              AIOX Resource Monitor                  ║');
  lines.push('╠══════════════════════════════════════════════════════╣');

  // CPU
  const cpu = metrics.cpu;
  const cpuBar = formatBar(cpu.usagePercent);
  const cpuWarn = alert && isAlert(cpu.usagePercent) ? ' ⚠ HIGH' : '';
  lines.push(`║ CPU:    ${cpuBar} ${String(cpu.usagePercent).padStart(3)}%${cpuWarn}`);
  lines.push(`║         ${cpu.cores} cores — ${cpu.model}`);

  // Memory
  const mem = metrics.memory;
  const memBar = formatBar(mem.usagePercent);
  const memWarn = alert && isAlert(mem.usagePercent) ? ' ⚠ HIGH' : '';
  lines.push(`║ Memory: ${memBar} ${String(mem.usagePercent).padStart(3)}%${memWarn}`);
  lines.push(`║         ${mem.usedMB}MB / ${mem.totalMB}MB (${mem.freeMB}MB free)`);

  // Disk
  const disk = metrics.disk;
  if (disk) {
    const diskBar = formatBar(disk.usagePercent);
    const diskWarn = alert && isAlert(disk.usagePercent) ? ' ⚠ HIGH' : '';
    lines.push(`║ Disk:   ${diskBar} ${String(disk.usagePercent).padStart(3)}%${diskWarn}`);
    lines.push(`║         ${disk.usedGB}GB / ${disk.totalGB}GB (${disk.freeGB}GB free) [${disk.mount}]`);
  } else {
    lines.push('║ Disk:   (unavailable)');
  }

  lines.push('╠══════════════════════════════════════════════════════╣');
  lines.push(`║ Timestamp: ${metrics.timestamp}`);
  lines.push('╚══════════════════════════════════════════════════════╝');

  // Alert summary
  if (alert) {
    const alerts = [];
    if (isAlert(cpu.usagePercent)) alerts.push(`CPU at ${cpu.usagePercent}%`);
    if (isAlert(mem.usagePercent)) alerts.push(`Memory at ${mem.usagePercent}%`);
    if (disk && isAlert(disk.usagePercent)) alerts.push(`Disk at ${disk.usagePercent}%`);
    if (alerts.length > 0) {
      lines.push('');
      lines.push('⚠  ALERTS:');
      for (const a of alerts) {
        lines.push(`   • ${a} (threshold: 80%)`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Run the resources command.
 * @param {string[]} argv
 */
function runResources(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
AIOX Resource Monitor

USAGE:
  aiox resources              Show CPU, memory, disk usage
  aiox resources --watch      Live refresh every 2 seconds
  aiox resources --format json  Output as JSON
  aiox resources --alert      Show warnings when usage >80%
  aiox resources --help       Show this help
`);
    return;
  }

  const formatIdx = argv.indexOf('--format');
  const format = formatIdx !== -1 ? argv[formatIdx + 1] : 'table';
  const watch = argv.includes('--watch');
  const alert = argv.includes('--alert');

  if (watch) {
    const render = () => {
      const metrics = collectMetrics();
      // Clear screen
      process.stdout.write('\x1B[2J\x1B[0f');
      if (format === 'json') {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log(formatTable(metrics, { alert }));
      }
    };
    render();
    const interval = setInterval(render, 2000);
    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
    return;
  }

  const metrics = collectMetrics();
  if (format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log(formatTable(metrics, { alert }));
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runResources,
  getCpuInfo,
  getMemoryInfo,
  getDiskInfo,
  collectMetrics,
  formatBar,
  formatTable,
  isAlert,
};
