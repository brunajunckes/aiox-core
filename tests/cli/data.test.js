/**
 * Tests for CLI Data Export/Import Command
 * @story 17.3 — Data Export/Import
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let dataModule;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-data-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/data/index.js');
  delete require.cache[modulePath];
  dataModule = require('../../.aiox-core/cli/commands/data/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('data command', () => {
  describe('collectData', () => {
    it('returns meta with empty sources when .aiox/ missing', () => {
      const data = dataModule.collectData();
      expect(data._meta).toBeDefined();
      expect(data._meta.sources).toEqual([]);
    });

    it('collects existing config file', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '{"x":"1"}', 'utf8');
      const data = dataModule.collectData();
      expect(data._meta.sources).toContain('kv-store');
      expect(data['kv-store']).toEqual({ x: '1' });
    });

    it('stores non-JSON files as raw strings', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.yaml'), 'key: value\n', 'utf8');
      const data = dataModule.collectData();
      expect(data._meta.sources).toContain('config');
      expect(typeof data.config).toBe('string');
    });

    it('skips empty files', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'history.json'), '', 'utf8');
      const data = dataModule.collectData();
      expect(data._meta.sources).not.toContain('history');
    });

    it('includes exportedAt timestamp', () => {
      const data = dataModule.collectData();
      expect(data._meta.exportedAt).toBeDefined();
      expect(new Date(data._meta.exportedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('dataExport', () => {
    it('returns valid JSON string', () => {
      const json = dataModule.dataExport();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes meta in export', () => {
      const parsed = JSON.parse(dataModule.dataExport());
      expect(parsed._meta).toBeDefined();
      expect(parsed._meta.version).toBe('1.0.0');
    });
  });

  describe('dataImport', () => {
    it('imports data sources into .aiox/', () => {
      const backup = { 'kv-store': { a: '1' }, history: [1, 2] };
      const result = dataModule.dataImport(backup);
      expect(result.restored).toContain('kv-store');
      expect(result.restored).toContain('history');
      expect(result.errors).toHaveLength(0);
    });

    it('skips sources not in backup', () => {
      const backup = { 'kv-store': { a: '1' } };
      const result = dataModule.dataImport(backup);
      expect(result.skipped.length).toBeGreaterThan(0);
    });

    it('dry run does not write files', () => {
      const backup = { 'kv-store': { a: '1' } };
      dataModule.dataImport(backup, { dryRun: true });
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'kv-store.json'))).toBe(false);
    });

    it('returns error for non-object input', () => {
      const result = dataModule.dataImport('not-object');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for array input', () => {
      const result = dataModule.dataImport([1, 2]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('writes string values directly', () => {
      const backup = { config: 'raw: yaml\n' };
      dataModule.dataImport(backup);
      const content = fs.readFileSync(path.join(tmpDir, '.aiox', 'config.yaml'), 'utf8');
      expect(content).toBe('raw: yaml\n');
    });
  });

  describe('dataDiff', () => {
    it('returns both-missing for absent sources', () => {
      const diffs = dataModule.dataDiff({});
      expect(diffs.some(d => d.status === 'both-missing')).toBe(true);
    });

    it('detects only-in-backup entries', () => {
      const backup = { 'kv-store': { x: '1' } };
      const diffs = dataModule.dataDiff(backup);
      const kvDiff = diffs.find(d => d.key === 'kv-store');
      expect(kvDiff.status).toBe('only-in-backup');
    });

    it('detects identical entries', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '{"x":"1"}', 'utf8');
      const backup = { 'kv-store': { x: '1' } };
      const diffs = dataModule.dataDiff(backup);
      const kvDiff = diffs.find(d => d.key === 'kv-store');
      expect(kvDiff.status).toBe('identical');
    });

    it('detects different entries', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'kv-store.json'), '{"x":"1"}', 'utf8');
      const backup = { 'kv-store': { x: '2' } };
      const diffs = dataModule.dataDiff(backup);
      const kvDiff = diffs.find(d => d.key === 'kv-store');
      expect(kvDiff.status).toBe('different');
    });

    it('returns error for invalid backup format', () => {
      const diffs = dataModule.dataDiff('not-object');
      expect(diffs[0].status).toBe('error');
    });
  });

  describe('runData', () => {
    it('shows help with no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      dataModule.runData([]);
      expect(spy.mock.calls[0][0]).toContain('DATA EXPORT/IMPORT');
      spy.mockRestore();
    });

    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      dataModule.runData(['--help']);
      expect(spy.mock.calls[0][0]).toContain('DATA EXPORT/IMPORT');
      spy.mockRestore();
    });

    it('handles unknown subcommand', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation();
      dataModule.runData(['unknown']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown data subcommand'));
      spy.mockRestore();
    });
  });
});
