/**
 * Tests for ASCII Chart Generator Command Module
 * @story 26.2 — ASCII Chart Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-chart-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/chart/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/chart/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('chart command', () => {
  // ── parseKeyValueData ─────────────────────────────────────────────────
  describe('parseKeyValueData', () => {
    it('parses valid key:value pairs', () => {
      const data = mod.parseKeyValueData('Mon:5,Tue:8,Wed:3');
      expect(data).toEqual([
        { label: 'Mon', value: 5 },
        { label: 'Tue', value: 8 },
        { label: 'Wed', value: 3 },
      ]);
    });

    it('returns empty array for null/undefined', () => {
      expect(mod.parseKeyValueData(null)).toEqual([]);
      expect(mod.parseKeyValueData(undefined)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(mod.parseKeyValueData('')).toEqual([]);
    });

    it('filters out invalid entries', () => {
      const data = mod.parseKeyValueData('Mon:5,bad,Tue:8');
      expect(data).toHaveLength(2);
    });

    it('handles whitespace in data', () => {
      const data = mod.parseKeyValueData(' Mon : 5 , Tue : 8 ');
      expect(data).toHaveLength(2);
      expect(data[0].label).toBe('Mon');
    });
  });

  // ── parseNumericData ──────────────────────────────────────────────────
  describe('parseNumericData', () => {
    it('parses comma-separated numbers', () => {
      const data = mod.parseNumericData('1,3,2,5,4');
      expect(data).toEqual([1, 3, 2, 5, 4]);
    });

    it('returns empty for null/undefined', () => {
      expect(mod.parseNumericData(null)).toEqual([]);
    });

    it('returns empty for empty string', () => {
      expect(mod.parseNumericData('')).toEqual([]);
    });

    it('filters NaN values', () => {
      const data = mod.parseNumericData('1,abc,3');
      expect(data).toEqual([1, 3]);
    });

    it('handles float values', () => {
      const data = mod.parseNumericData('1.5,2.7,3.14');
      expect(data).toEqual([1.5, 2.7, 3.14]);
    });
  });

  // ── renderBarChart ────────────────────────────────────────────────────
  describe('renderBarChart', () => {
    it('renders bars with labels', () => {
      const result = mod.renderBarChart([
        { label: 'Mon', value: 5 },
        { label: 'Tue', value: 10 },
      ], { width: 20 });
      expect(result).toContain('Mon');
      expect(result).toContain('Tue');
      expect(result).toContain('5');
      expect(result).toContain('10');
    });

    it('returns no data message for empty array', () => {
      expect(mod.renderBarChart([])).toBe('No data to display.');
    });

    it('returns no data message for null', () => {
      expect(mod.renderBarChart(null)).toBe('No data to display.');
    });

    it('includes title when provided', () => {
      const result = mod.renderBarChart([{ label: 'A', value: 5 }], { title: 'My Chart' });
      expect(result).toContain('My Chart');
    });

    it('handles zero values', () => {
      const result = mod.renderBarChart([
        { label: 'Zero', value: 0 },
        { label: 'One', value: 1 },
      ]);
      expect(result).toContain('Zero');
      expect(result).toContain('0');
    });
  });

  // ── renderLineChart ───────────────────────────────────────────────────
  describe('renderLineChart', () => {
    it('renders a grid with asterisks', () => {
      const result = mod.renderLineChart([1, 5, 3, 8, 2]);
      expect(result).toContain('*');
      expect(result).toContain('|');
    });

    it('returns no data for empty array', () => {
      expect(mod.renderLineChart([])).toBe('No data to display.');
    });

    it('returns no data for null', () => {
      expect(mod.renderLineChart(null)).toBe('No data to display.');
    });

    it('includes title when provided', () => {
      const result = mod.renderLineChart([1, 2, 3], { title: 'Trend' });
      expect(result).toContain('Trend');
    });

    it('handles single data point', () => {
      const result = mod.renderLineChart([5]);
      expect(result).toContain('*');
    });

    it('handles equal values', () => {
      const result = mod.renderLineChart([5, 5, 5]);
      expect(result).toContain('*');
    });
  });

  // ── renderPieChart ────────────────────────────────────────────────────
  describe('renderPieChart', () => {
    it('renders percentage bars', () => {
      const result = mod.renderPieChart([
        { label: 'JS', value: 60 },
        { label: 'TS', value: 25 },
        { label: 'MD', value: 15 },
      ]);
      expect(result).toContain('JS');
      expect(result).toContain('%');
    });

    it('returns no data for empty array', () => {
      expect(mod.renderPieChart([])).toBe('No data to display.');
    });

    it('calculates correct percentages', () => {
      const result = mod.renderPieChart([
        { label: 'A', value: 50 },
        { label: 'B', value: 50 },
      ]);
      expect(result).toContain('50.0%');
    });

    it('includes title when provided', () => {
      const result = mod.renderPieChart([{ label: 'X', value: 100 }], { title: 'Distribution' });
      expect(result).toContain('Distribution');
    });

    it('handles all-zero values', () => {
      const result = mod.renderPieChart([
        { label: 'A', value: 0 },
        { label: 'B', value: 0 },
      ]);
      expect(result).toBe('No data to display.');
    });
  });

  // ── runChart (CLI) ────────────────────────────────────────────────────
  describe('runChart', () => {
    it('shows help with no subcommand', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart([]);
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls[0][0];
      expect(output).toContain('Usage');
      spy.mockRestore();
    });

    it('renders bar chart via CLI', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['bar', '--data', 'A:5,B:10']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('renders line chart via CLI', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['line', '--data', '1,3,5,2']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('renders pie chart via CLI', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['pie', '--data', 'JS:60,TS:40']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('outputs JSON format', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['bar', '--data', 'A:5', '--format', 'json']);
      const output = spy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.type).toBe('bar');
      expect(parsed.data).toHaveLength(1);
      spy.mockRestore();
    });

    it('respects --title option', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      const result = mod.runChart(['bar', '--data', 'A:5', '--title', 'My Title']);
      expect(result).toContain('My Title');
      spy.mockRestore();
    });

    it('respects --width option', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['bar', '--data', 'A:5,B:10', '--width', '20']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for invalid subcommand', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChart(['unknown']);
      const output = spy.mock.calls[0][0];
      expect(output).toContain('Usage');
      spy.mockRestore();
    });
  });
});
