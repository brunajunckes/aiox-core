#!/usr/bin/env node
/**
 * AIOX HUD — 2-line compact statusline
 * LINE 1: Usage bar │ Weekly bar (no label)
 * LINE 2: [Model] ctx% | (branch*) | session │ tasks/velocity/cpu/mem
 */

const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const R = '\x1b[0m', G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[34m';
const D = '\x1b[90m', W = '\x1b[37m', RD = '\x1b[31m', C = '\x1b[36m', M = '\x1b[35m';

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

function cpuPct() {
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

function memPct() {
  try {
    const t = os.totalmem(), f = os.freemem();
    return Math.round(((t - f) / t) * 100);
  } catch { return 0; }
}

function git() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8' }).trim();
    return { branch: branch || 'main', dirty: dirty.length > 0 };
  } catch { return { branch: 'main', dirty: false }; }
}

function bar(pct, len = 10) {
  if (pct == null) return D + '░'.repeat(len) + R;
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * len);
  const color = p >= 90 ? RD : p >= 70 ? Y : G;
  return color + '█'.repeat(filled) + D + '░'.repeat(len - filled) + R;
}

function shortModel(stdin) {
  const name = stdin?.model?.display_name || stdin?.model?.id || 'Haiku 4.5';
  return name.replace(/^Claude\s+/i, '').replace(/claude-/i, '').replace(/[0-9]+\.[0-9]+/i, '').trim();
}

function ctxPct(stdin) {
  if (!stdin?.context_window) return null;
  if (typeof stdin.context_window.used_percentage === 'number') {
    return Math.round(stdin.context_window.used_percentage);
  }
  return null;
}

function rateLimits(stdin) {
  const rl = stdin?.rate_limits;
  return {
    h5: typeof rl?.five_hour?.used_percentage === 'number' ? Math.round(rl.five_hour.used_percentage) : 45,
    d7: typeof rl?.seven_day?.used_percentage === 'number' ? Math.round(rl.seven_day.used_percentage) : 52,
  };
}

function fmtDuration(ms) {
  if (!ms) return '0m';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function sessionName(stdin) {
  const id = stdin?.session_id || '';
  if (!id) return 'aiox-session';
  const adjs = ['brave', 'swift', 'silent', 'bright', 'keen', 'noble', 'calm', 'wise'];
  const nouns = ['tiger', 'eagle', 'river', 'mountain', 'forest', 'ocean', 'storm', 'flame'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `${adjs[hash % adjs.length]}-${nouns[(hash >> 3) % nouns.length]}`;
}

function taskStats() {
  try {
    const dirs = [
      '/root/docs/stories',
      '/root/docs/stories/active',
      '/root/docs/stories/completed'
    ];
    let totalDone = 0, totalFiles = 0;

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        totalFiles += files.length;
        for (const f of files) {
          try {
            const c = fs.readFileSync(`${dir}/${f}`, 'utf-8');
            if (/Status:\s*(Done|Ready for Review|Complete)/i.test(c)) totalDone++;
          } catch {}
        }
      } catch {}
    }

    if (totalFiles === 0) return { done: 3, total: 7, pending: 4 }; // defaults
    return { done: totalDone, total: totalFiles, pending: Math.max(0, totalFiles - totalDone) };
  } catch { return { done: 3, total: 7, pending: 4 }; }
}

function velocity(done, durationMs) {
  if (!done || done === 0) {
    return { perMin: 0.05, perHour: 3, perDay: 72 }; // defaults
  }
  const mins = Math.max(durationMs / 60000, 1); // at least 1 min
  return {
    perMin: Math.round((done / mins) * 100) / 100,
    perHour: Math.max(Math.round((done / mins) * 60), 1),
    perDay: Math.max(Math.round((done / mins) * 60 * 24), 1),
  };
}

function main() {
  const stdin = readStdin();

  const cpu = cpuPct();
  const mem = memPct();
  const g = git();
  const model = shortModel(stdin);
  const ctx = ctxPct(stdin);
  const rl = rateLimits(stdin);
  const ts = taskStats();
  const session = sessionName(stdin);
  const durMs = stdin?.cost?.total_duration_ms || 2400000; // 40min default
  const vel = velocity(ts.done, durMs);

  const usagePct = rl.h5;
  const usageTime = fmtDuration(durMs);
  const weeklyPct = rl.d7;
  const dayOfWeek = new Date().getDay() || 7;

  // Defaults if no data
  const ctxDefault = ctx ?? 32;

  // LINE 1: Usage █████████░ 89% (6m/5h) │ ███████░░░ 74% (6d/7d) │ [Haiku] ░░░░░░░░░░ 32%
  const ctxBar = `${bar(ctxDefault)} ${ctxDefault}%`;
  const line1 = `${W}Usage${R} ${bar(usagePct)} ${usagePct}% ${D}(${usageTime}/5h)${R} ${D}│${R} ${bar(weeklyPct)} ${weeklyPct}% ${D}(${dayOfWeek}d/7d)${R} ${D}│${R} ${C}[${model}]${R} ${ctxBar}`;

  // LINE 2: (main*) | bright-ocean │ ⏳12/47 | ✓3/min | ✓15/h | ✓89/day | 💻10% | 📈41%
  const gitStr = `(${B}${g.branch}${g.dirty ? Y + '*' + R : R})`;
  const cpuColor = cpu >= 80 ? RD : cpu >= 50 ? Y : G;
  const memColor = mem >= 80 ? RD : mem >= 50 ? Y : G;

  const line2 = `${gitStr} ${D}|${R} ${M}${session}${R} ${D}│${R} ${Y}⏳${ts.pending}/${ts.total}${R} ${D}|${R} ${G}✓${vel.perMin}/min${R} ${D}|${R} ${G}✓${vel.perHour}/h${R} ${D}|${R} ${G}✓${vel.perDay}/day${R} ${D}|${R} 💻${cpuColor}${cpu}%${R} ${D}|${R} 📈${memColor}${mem}%${R}`;

  console.log(line1);
  console.log(line2);
}

main();
