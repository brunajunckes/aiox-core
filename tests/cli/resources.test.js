/**
 * Tests for Resource Monitor Command Module
 * @story 24.1 — Resource Monitor
 */

'use strict';

const os = require('os');

let mod;

beforeEach(() => {
  const modulePath = require.resolve('../../.aiox-core/cli/commands/resources/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/resources/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resources command', () => {
  // ── getCpuInfo ──────────────────────────────────────────────────────────
  describe('getCpuInfo', () => {
    it('returns usagePercent as a number', () => {
      const info = mod.getCpuInfo();
      expect(typeof info.usagePercent).toBe('number');
      expect(info.usagePercent).toBeGreaterThanOrEqual(0);
      expect(info.usagePercent).toBeLessThanOrEqual(100);
    });

    it('returns cores count', () => {
      const info = mod.getCpuInfo();
      expect(info.cores).toBe(os.cpus().length);
    });

    it('returns model string', () => {
      const info = mod.getCpuInfo();
      expect(typeof info.model).toBe('string');
      expect(info.model.length).toBeGreaterThan(0);
    });
  });

  // ── getMemoryInfo ───────────────────────────────────────────────────────
  describe('getMemoryInfo', () => {
    it('returns totalMB as a positive number', () => {
      const info = mod.getMemoryInfo();
      expect(info.totalMB).toBeGreaterThan(0);
    });

    it('returns usedMB + freeMB approximately equal to totalMB', () => {
      const info = mod.getMemoryInfo();
      // Allow 1MB tolerance for rounding
      expect(Math.abs(info.usedMB + info.freeMB - info.totalMB)).toBeLessThanOrEqual(1);
    });

    it('returns usagePercent between 0 and 100', () => {
      const info = mod.getMemoryInfo();
      expect(info.usagePercent).toBeGreaterThanOrEqual(0);
      expect(info.usagePercent).toBeLessThanOrEqual(100);
    });

    it('returns all expected keys', () => {
      const info = mod.getMemoryInfo();
      expect(info).toHaveProperty('totalMB');
      expect(info).toHaveProperty('usedMB');
      expect(info).toHaveProperty('freeMB');
      expect(info).toHaveProperty('usagePercent');
    });
  });

  // ── getDiskInfo ─────────────────────────────────────────────────────────
  describe('getDiskInfo', () => {
    it('returns disk info object or null', () => {
      const info = mod.getDiskInfo();
      if (info !== null) {
        expect(info).toHaveProperty('totalGB');
        expect(info).toHaveProperty('usedGB');
        expect(info).toHaveProperty('freeGB');
        expect(info).toHaveProperty('usagePercent');
        expect(info).toHaveProperty('mount');
      }
    });

    it('returns usagePercent between 0 and 100 when available', () => {
      const info = mod.getDiskInfo();
      if (info) {
        expect(info.usagePercent).toBeGreaterThanOrEqual(0);
        expect(info.usagePercent).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── collectMetrics ──────────────────────────────────────────────────────
  describe('collectMetrics', () => {
    it('returns cpu, memory, disk and timestamp', () => {
      const metrics = mod.collectMetrics();
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('timestamp is a valid ISO string', () => {
      const metrics = mod.collectMetrics();
      expect(() => new Date(metrics.timestamp)).not.toThrow();
      expect(new Date(metrics.timestamp).toISOString()).toBe(metrics.timestamp);
    });
  });

  // ── formatBar ───────────────────────────────────────────────────────────
  describe('formatBar', () => {
    it('renders empty bar for 0%', () => {
      const bar = mod.formatBar(0);
      expect(bar).toBe('[' + '░'.repeat(20) + ']');
    });

    it('renders full bar for 100%', () => {
      const bar = mod.formatBar(100);
      expect(bar).toBe('[' + '█'.repeat(20) + ']');
    });

    it('renders half bar for 50%', () => {
      const bar = mod.formatBar(50);
      expect(bar).toBe('[' + '█'.repeat(10) + '░'.repeat(10) + ']');
    });

    it('respects custom width', () => {
      const bar = mod.formatBar(50, 10);
      expect(bar).toBe('[' + '█'.repeat(5) + '░'.repeat(5) + ']');
    });
  });

  // ── isAlert ─────────────────────────────────────────────────────────────
  describe('isAlert', () => {
    it('returns true for 80%', () => {
      expect(mod.isAlert(80)).toBe(true);
    });

    it('returns true for >80%', () => {
      expect(mod.isAlert(95)).toBe(true);
    });

    it('returns false for <80%', () => {
      expect(mod.isAlert(50)).toBe(false);
    });

    it('supports custom threshold', () => {
      expect(mod.isAlert(50, 50)).toBe(true);
      expect(mod.isAlert(49, 50)).toBe(false);
    });
  });

  // ── formatTable ─────────────────────────────────────────────────────────
  describe('formatTable', () => {
    it('includes CPU section', () => {
      const metrics = mod.collectMetrics();
      const output = mod.formatTable(metrics);
      expect(output).toContain('CPU:');
    });

    it('includes Memory section', () => {
      const metrics = mod.collectMetrics();
      const output = mod.formatTable(metrics);
      expect(output).toContain('Memory:');
    });

    it('includes alert warnings when enabled and threshold exceeded', () => {
      const metrics = {
        cpu: { usagePercent: 90, cores: 4, model: 'Test CPU' },
        memory: { usagePercent: 85, usedMB: 8500, totalMB: 10000, freeMB: 1500 },
        disk: { usagePercent: 50, usedGB: 50, totalGB: 100, freeGB: 50, mount: '/' },
        timestamp: new Date().toISOString(),
      };
      const output = mod.formatTable(metrics, { alert: true });
      expect(output).toContain('ALERTS');
      expect(output).toContain('CPU at 90%');
      expect(output).toContain('Memory at 85%');
    });

    it('does not show alerts when alert option is false', () => {
      const metrics = {
        cpu: { usagePercent: 90, cores: 4, model: 'Test CPU' },
        memory: { usagePercent: 85, usedMB: 8500, totalMB: 10000, freeMB: 1500 },
        disk: null,
        timestamp: new Date().toISOString(),
      };
      const output = mod.formatTable(metrics, { alert: false });
      expect(output).not.toContain('ALERTS');
    });
  });

  // ── runResources ────────────────────────────────────────────────────────
  describe('runResources', () => {
    it('prints help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runResources(['--help']);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('AIOX Resource Monitor');
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runResources(['--format', 'json']);
      expect(spy).toHaveBeenCalled();
      const parsed = JSON.parse(spy.mock.calls[0][0]);
      expect(parsed).toHaveProperty('cpu');
      expect(parsed).toHaveProperty('memory');
      spy.mockRestore();
    });

    it('outputs table by default', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runResources([]);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toContain('Resource Monitor');
      spy.mockRestore();
    });
  });
});
