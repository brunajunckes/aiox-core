/**
 * ASCII Chart Generator Command Module
 *
 * Renders ASCII bar, line, and pie charts from CLI data.
 *
 * Subcommands:
 *   aiox chart bar  --data "Mon:5,Tue:8,Wed:3"  — ASCII bar chart
 *   aiox chart line --data "1,3,2,5,4"           — ASCII line chart
 *   aiox chart pie  --data "JS:60,TS:25,MD:15"   — ASCII pie chart
 *   aiox chart --title "Build Times"              — Add title
 *   aiox chart --width 60                         — Chart width
 *   aiox chart --format json                      — Output as JSON
 *
 * @module cli/commands/chart
 * @version 1.0.0
 * @story 26.2 — ASCII Chart Generator
 */

'use strict';

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 40;
const BAR_CHAR = '\u2588';
const LINE_CHARS = { up: '/', down: '\\', flat: '-', point: '*' };

// ── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse key:value data string.
 * @param {string} str - "Mon:5,Tue:8,Wed:3"
 * @returns {Array<{label: string, value: number}>}
 */
function parseKeyValueData(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(item => {
    const parts = item.trim().split(':');
    if (parts.length < 2) return null;
    const label = parts[0].trim();
    const value = parseFloat(parts[1].trim());
    if (!label || isNaN(value)) return null;
    return { label, value };
  }).filter(Boolean);
}

/**
 * Parse numeric data string.
 * @param {string} str - "1,3,2,5,4"
 * @returns {number[]}
 */
function parseNumericData(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
}

// ── Chart Renderers ─────────────────────────────────────────────────────────

/**
 * Render an ASCII bar chart.
 * @param {Array<{label: string, value: number}>} data
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {string} [options.title]
 * @returns {string}
 */
function renderBarChart(data, options = {}) {
  if (!data || data.length === 0) return 'No data to display.';
  const width = options.width || DEFAULT_WIDTH;
  const maxVal = Math.max(...data.map(d => d.value));
  const maxLabel = Math.max(...data.map(d => d.label.length));
  const lines = [];

  if (options.title) {
    lines.push(options.title);
    lines.push('='.repeat(options.title.length));
    lines.push('');
  }

  for (const item of data) {
    const barLen = maxVal > 0 ? Math.round((item.value / maxVal) * width) : 0;
    const label = item.label.padEnd(maxLabel);
    lines.push(`${label} | ${BAR_CHAR.repeat(barLen)} ${item.value}`);
  }

  return lines.join('\n');
}

/**
 * Render an ASCII line chart.
 * @param {number[]} data
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {string} [options.title]
 * @returns {string}
 */
function renderLineChart(data, options = {}) {
  if (!data || data.length === 0) return 'No data to display.';
  const height = 10;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  const lines = [];

  if (options.title) {
    lines.push(options.title);
    lines.push('='.repeat(options.title.length));
    lines.push('');
  }

  // Build grid
  const grid = [];
  for (let row = 0; row < height; row++) {
    grid.push(new Array(data.length).fill(' '));
  }

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - minVal) / range;
    const row = height - 1 - Math.round(normalized * (height - 1));
    grid[row][i] = '*';
  }

  const maxLabel = String(maxVal).length;
  for (let row = 0; row < height; row++) {
    const val = maxVal - (row / (height - 1)) * range;
    const label = String(Math.round(val)).padStart(maxLabel);
    lines.push(`${label} | ${grid[row].join(' ')}`);
  }

  lines.push(' '.repeat(maxLabel) + ' +' + '-'.repeat(data.length * 2));
  return lines.join('\n');
}

/**
 * Render an ASCII pie chart (percentage bars).
 * @param {Array<{label: string, value: number}>} data
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {string} [options.title]
 * @returns {string}
 */
function renderPieChart(data, options = {}) {
  if (!data || data.length === 0) return 'No data to display.';
  const width = options.width || DEFAULT_WIDTH;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return 'No data to display.';
  const maxLabel = Math.max(...data.map(d => d.label.length));
  const lines = [];

  if (options.title) {
    lines.push(options.title);
    lines.push('='.repeat(options.title.length));
    lines.push('');
  }

  const chars = ['#', '=', '-', '+', '*', '.', '~', '^'];
  for (let i = 0; i < data.length; i++) {
    const pct = (data[i].value / total) * 100;
    const barLen = Math.round((data[i].value / total) * width);
    const label = data[i].label.padEnd(maxLabel);
    const ch = chars[i % chars.length];
    lines.push(`${label} | ${ch.repeat(barLen)} ${pct.toFixed(1)}%`);
  }

  return lines.join('\n');
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse args and run chart generation.
 * @param {string[]} argv
 * @returns {string} output
 */
function runChart(argv = []) {
  const subcommand = argv[0];
  let dataStr = '';
  let title = '';
  let width = DEFAULT_WIDTH;
  let format = 'text';

  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--data' && argv[i + 1]) { dataStr = argv[++i]; continue; }
    if (argv[i] === '--title' && argv[i + 1]) { title = argv[++i]; continue; }
    if (argv[i] === '--width' && argv[i + 1]) { width = parseInt(argv[++i], 10) || DEFAULT_WIDTH; continue; }
    if (argv[i] === '--format' && argv[i + 1]) { format = argv[++i]; continue; }
  }

  // Also check top-level flags (before subcommand)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data' && argv[i + 1] && !dataStr) { dataStr = argv[++i]; continue; }
    if (argv[i] === '--title' && argv[i + 1] && !title) { title = argv[++i]; continue; }
    if (argv[i] === '--width' && argv[i + 1] && width === DEFAULT_WIDTH) { width = parseInt(argv[++i], 10) || DEFAULT_WIDTH; continue; }
    if (argv[i] === '--format' && argv[i + 1] && format === 'text') { format = argv[++i]; continue; }
  }

  if (!subcommand || !['bar', 'line', 'pie'].includes(subcommand)) {
    const help = [
      'AIOX ASCII Chart Generator',
      '',
      'Usage:',
      '  aiox chart bar  --data "Mon:5,Tue:8,Wed:3"',
      '  aiox chart line --data "1,3,2,5,4"',
      '  aiox chart pie  --data "JS:60,TS:25,MD:15"',
      '',
      'Options:',
      '  --title <title>  Chart title',
      '  --width <n>      Chart width (default: 40)',
      '  --format json    Output as JSON',
    ].join('\n');
    console.log(help);
    return help;
  }

  const opts = { width, title };

  if (format === 'json') {
    let parsed;
    if (subcommand === 'line') {
      parsed = parseNumericData(dataStr);
    } else {
      parsed = parseKeyValueData(dataStr);
    }
    const output = JSON.stringify({ type: subcommand, data: parsed, title, width }, null, 2);
    console.log(output);
    return output;
  }

  let output;
  switch (subcommand) {
    case 'bar':
      output = renderBarChart(parseKeyValueData(dataStr), opts);
      break;
    case 'line':
      output = renderLineChart(parseNumericData(dataStr), opts);
      break;
    case 'pie':
      output = renderPieChart(parseKeyValueData(dataStr), opts);
      break;
    default:
      output = 'Unknown chart type.';
  }

  console.log(output);
  return output;
}

module.exports = {
  runChart,
  parseKeyValueData,
  parseNumericData,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  DEFAULT_WIDTH,
};
