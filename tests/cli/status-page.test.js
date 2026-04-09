/**
 * Tests for Status Page Generator Command Module
 * @story 26.3 — Status Page Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-status-page-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/status-page/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/status-page/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('status-page command', () => {
  // ── collectServices ───────────────────────────────────────────────────
  describe('collectServices', () => {
    it('returns array of service objects', () => {
      const execFn = () => 'v1.0.0';
      const services = mod.collectServices({ execFn });
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    it('each service has name, status, detail', () => {
      const execFn = () => 'v1.0.0';
      const services = mod.collectServices({ execFn });
      for (const svc of services) {
        expect(svc).toHaveProperty('name');
        expect(svc).toHaveProperty('status');
        expect(svc).toHaveProperty('detail');
      }
    });

    it('marks services as operational when commands succeed', () => {
      const execFn = () => 'v18.0.0';
      const services = mod.collectServices({ execFn });
      expect(services.every(s => s.status === 'operational')).toBe(true);
    });

    it('marks services as down when commands fail', () => {
      const execFn = () => null;
      const services = mod.collectServices({ execFn });
      expect(services.every(s => s.status === 'down')).toBe(true);
    });

    it('includes Node.js service', () => {
      const execFn = () => 'v18.0.0';
      const services = mod.collectServices({ execFn });
      expect(services.find(s => s.name === 'Node.js')).toBeTruthy();
    });

    it('includes Git service', () => {
      const execFn = () => 'git version 2.39.0';
      const services = mod.collectServices({ execFn });
      expect(services.find(s => s.name === 'Git')).toBeTruthy();
    });

    it('includes npm service', () => {
      const execFn = () => '9.0.0';
      const services = mod.collectServices({ execFn });
      expect(services.find(s => s.name === 'npm')).toBeTruthy();
    });

    it('includes Ollama service', () => {
      const execFn = () => null;
      const services = mod.collectServices({ execFn });
      expect(services.find(s => s.name === 'Ollama')).toBeTruthy();
    });
  });

  // ── collectTestStatus ─────────────────────────────────────────────────
  describe('collectTestStatus', () => {
    it('returns unknown when no coverage dir', () => {
      const result = mod.collectTestStatus({ cwd: tmpDir });
      expect(result.lastRun).toBe('unknown');
      expect(result.passing).toBe(false);
    });

    it('returns timestamp when coverage dir exists', () => {
      fs.mkdirSync(path.join(tmpDir, 'coverage'), { recursive: true });
      const result = mod.collectTestStatus({ cwd: tmpDir });
      expect(result.lastRun).not.toBe('unknown');
      expect(result.passing).toBe(true);
    });
  });

  // ── collectStatusData ─────────────────────────────────────────────────
  describe('collectStatusData', () => {
    it('returns full status structure', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      expect(data).toHaveProperty('generatedAt');
      expect(data).toHaveProperty('overall');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('tests');
      expect(data).toHaveProperty('system');
    });

    it('reports all operational when all services up', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      expect(data.overall).toBe('All Systems Operational');
    });

    it('reports degraded when some services down', () => {
      const execFn = () => null;
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      expect(data.overall).toBe('Degraded');
    });

    it('includes system uptime', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      expect(data.system.uptime).toMatch(/\d+h \d+m/);
    });
  });

  // ── generateStatusHTML ────────────────────────────────────────────────
  describe('generateStatusHTML', () => {
    it('generates valid HTML', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      const html = mod.generateStatusHTML(data);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('AIOX Status Page');
    });

    it('includes service rows', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      const html = mod.generateStatusHTML(data);
      expect(html).toContain('Node.js');
      expect(html).toContain('Git');
    });

    it('shows operational status with green color', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      const html = mod.generateStatusHTML(data);
      expect(html).toContain('#4ade80');
      expect(html).toContain('operational');
    });

    it('shows All Systems Operational banner', () => {
      const execFn = () => 'v1.0.0';
      const data = mod.collectStatusData({ cwd: tmpDir, execFn });
      const html = mod.generateStatusHTML(data);
      expect(html).toContain('All Systems Operational');
    });
  });

  // ── runStatusPage (CLI) ───────────────────────────────────────────────
  describe('runStatusPage', () => {
    it('outputs HTML by default', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runStatusPage([]);
      expect(result).toContain('<!DOCTYPE html>');
      spy.mockRestore();
    });

    it('outputs JSON with --json flag', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runStatusPage(['--json']);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('services');
      expect(parsed).toHaveProperty('overall');
      spy.mockRestore();
    });

    it('writes to file with --output', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const outFile = path.join(tmpDir, 'status.html');
      mod.runStatusPage(['--output', outFile]);
      expect(fs.existsSync(outFile)).toBe(true);
      const content = fs.readFileSync(outFile, 'utf8');
      expect(content).toContain('AIOX Status Page');
      spy.mockRestore();
    });
  });
});
