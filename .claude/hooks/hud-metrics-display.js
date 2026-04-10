#!/usr/bin/env node
/**
 * AIOX HUD — 2-line adaptive statusline
 * Reads Claude Code stdin JSON for model/tokens/rate-limits
 */

const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Colors
const R = '\x1b[0m', G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[34m';
const D = '\x1b[90m', W = '\x1b[37m', RD = '\x1b[31m', C = '\x1b[36m';
const BG = '\x1b[7m';

// ── stdin JSON from Claude Code ──
function readStdin() {
  try {
    if (process.stdin.isTTY) return null;
    const buf = [];
    const fd = fs.openSync('/dev/stdin', 'r');
    const b = Buffer.alloc(65536);
    let n;
    while ((n = fs.readSync(fd, b, 0, b.length)) > 0) buf.push(b.slice(0, n));
    fs.closeSync(fd);
    const raw = Buffer.concat(buf).toString('utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Data collectors ──
function cpu() {
  try {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (const c of cpus) {
      for (const t of Object.values(c.times)) total += t;
      idle += c.times.idle;
    }
    return Math.round(((total - idle) / total) * 100);
  } catch { return 0; }
}

function git() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf8' }).trim();
    const short = branch.replace(/^story\/(\d+\.\d+).*/, 's/$1').replace(/^feature\//, 'f/');
    return short;
  } catch { return '?'; }
}

function docker() {
  try {
    const r = parseInt(execSync("docker ps -q 2>/dev/null | wc -l", { encoding: 'utf8' }).trim());
    const t = parseInt(execSync("docker ps -a -q 2>/dev/null | wc -l", { encoding: 'utf8' }).trim());
    return { r, t };
  } catch { return { r: 0, t: 0 }; }
}

function stories() {
  try {
    const dir = '/root/docs/stories';
    if (!fs.existsSync(dir)) return { done: 0, wip: 0, total: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.story.md'));
    let done = 0, wip = 0;
    for (const f of files) {
      const c = fs.readFileSync(`${dir}/${f}`, 'utf-8');
      if (/\[x\] Done/i.test(c)) done++;
      else if (/\[x\] InProgress/i.test(c)) wip++;
    }
    return { done, wip, total: files.length };
  } catch { return { done: 0, wip: 0, total: 0 }; }
}

function squadsAndAgents() {
  let squads = 0, agents = 0;
  try {
    const sd = '/root/Aiox/squads';
    if (fs.existsSync(sd)) squads = fs.readdirSync(sd).filter(f => !f.startsWith('.')).length;
  } catch {}
  try {
    const ad = '/root/.aiox-core/development/agents';
    if (fs.existsSync(ad)) agents = fs.readdirSync(ad).filter(f => f.endsWith('.md')).length;
  } catch {}
  return { squads, agents };
}

function taskStats() {
  try {
    const dir = '/root/docs/stories';
    if (!fs.existsSync(dir)) return { done: 0, total: 0 };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.story.md'));
    let done = 0, total = 0;
    for (const f of files) {
      const c = fs.readFileSync(`${dir}/${f}`, 'utf-8');
      const checked = (c.match(/- \[x\]/g) || []).length;
      const unchecked = (c.match(/- \[ \]/g) || []).length;
      done += checked;
      total += checked + unchecked;
    }
    return { done, total };
  } catch { return { done: 0, total: 0 }; }
}

// ── Bar renderer ──
function bar(pct, len = 8) {
  if (pct == null) return D + '░'.repeat(len) + R;
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * len);
  const color = p >= 90 ? RD : p >= 70 ? Y : G;
  return color + '█'.repeat(filled) + D + '░'.repeat(len - filled) + R;
}

// ── Model name shortener ──
function shortModel(stdin) {
  const name = stdin?.model?.display_name || stdin?.model?.id || '';
  return name
    .replace(/\s*\([^)]*context[^)]*\)/i, '')
    .replace(/^Claude\s+/i, '')
    .replace(/claude-/i, '')
    .trim() || '?';
}

// ── Context % ──
function ctxPct(stdin) {
  if (!stdin?.context_window) return null;
  if (typeof stdin.context_window.used_percentage === 'number') {
    return Math.round(stdin.context_window.used_percentage);
  }
  const size = stdin.context_window.context_window_size;
  const u = stdin.context_window.current_usage;
  if (!size || !u) return null;
  const total = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  return Math.min(100, Math.round((total / size) * 100));
}

// ── Rate limits ──
function rateLimits(stdin) {
  const rl = stdin?.rate_limits;
  const h5 = rl?.five_hour?.used_percentage ?? null;
  const d7 = rl?.seven_day?.used_percentage ?? null;
  return {
    h5: typeof h5 === 'number' ? Math.round(h5) : null,
    d7: typeof d7 === 'number' ? Math.round(d7) : null,
  };
}

// ── Cost ──
function cost(stdin) {
  return stdin?.cost?.total_cost_usd ?? null;
}

// ── Session duration ──
function duration(stdin) {
  const ms = stdin?.cost?.total_duration_ms;
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

// ── Main ──
function main() {
  const stdin = readStdin();
  const cols = parseInt(process.env.COLUMNS || '80');

  const cpuPct = cpu();
  const branch = git();
  const dk = docker();
  const st = stories();
  const sa = squadsAndAgents();
  const ts = taskStats();
  const rl = rateLimits(stdin);
  const ctx = ctxPct(stdin);
  const model = shortModel(stdin);
  const usd = cost(stdin);
  const dur = duration(stdin);

  const taskPct = ts.total > 0 ? Math.round((ts.done / ts.total) * 100) : 0;

  // ── LINE 1: System + Model + Tokens ──
  const l1parts = [];

  // CPU
  const cpuColor = cpuPct >= 80 ? RD : cpuPct >= 50 ? Y : G;
  l1parts.push(`🖥${cpuColor}${cpuPct}%${R}`);

  // Model
  l1parts.push(`🧠${C}${model}${R}`);

  // Context window
  if (ctx != null) l1parts.push(`📐${bar(ctx, 6)}${ctx}%`);

  // 5h rate limit
  if (rl.h5 != null) l1parts.push(`⏱${bar(rl.h5, 5)}${rl.h5}%`);

  // 7d rate limit
  if (rl.d7 != null) l1parts.push(`📅${bar(rl.d7, 5)}${rl.d7}%`);

  // Cost
  if (usd != null) l1parts.push(`💰${Y}$${usd.toFixed(2)}${R}`);

  // Duration
  if (dur) l1parts.push(`⏳${D}${dur}${R}`);

  // ── LINE 2: Project + Infra ──
  const l2parts = [];

  // Branch
  l2parts.push(`🔀${B}${branch}${R}`);

  // Docker
  if (dk.t > 0) {
    const dkColor = dk.r === dk.t ? G : dk.r > 0 ? Y : RD;
    l2parts.push(`🐳${dkColor}${dk.r}/${dk.t}${R}`);
  }

  // Stories
  l2parts.push(`📋${G}${st.done}✓${R}${st.wip > 0 ? Y + st.wip + '⟳' + R : ''}${D}/${st.total}${R}`);

  // Tasks progress
  l2parts.push(`✅${bar(taskPct, 5)}${ts.done}/${ts.total}`);

  // Squads
  if (sa.squads > 0) l2parts.push(`🏢${C}${sa.squads}${R}`);

  // Agents
  l2parts.push(`🤖${G}${sa.agents}${R}`);

  // AIOX Master
  l2parts.push(`👑${G}aiox${R}`);

  // Output 2 lines
  console.log(l1parts.join(' '));
  console.log(l2parts.join(' '));
}

main();
