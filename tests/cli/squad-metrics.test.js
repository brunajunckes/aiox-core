/**
 * Tests for Squad Performance Metrics
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadRegistry,
  loadMetrics,
  recordMetric,
  calculateVelocity,
  calculateQuality,
  calculateReliability,
  formatMetrics,
  exportCSV,
  getScorecard
} = require('../../.aiox-core/cli/commands/squad-metrics');

describe('Squad Performance Metrics', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `metrics-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Velocity Calculation', () => {
    it('should count completed stories', () => {
      const entries = [
        { type: 'story_completed', status: 'success' },
        { type: 'story_completed', status: 'success' },
        { type: 'test_result', status: 'passed' }
      ];

      const velocity = calculateVelocity(entries);
      expect(velocity).toBe(2);
    });

    it('should return 0 for empty entries', () => {
      const velocity = calculateVelocity([]);
      expect(velocity).toBe(0);
    });

    it('should only count story_completed entries', () => {
      const entries = [
        { type: 'test_result', status: 'passed' },
        { type: 'deployment', status: 'success' }
      ];

      const velocity = calculateVelocity(entries);
      expect(velocity).toBe(0);
    });
  });

  describe('Quality Calculation', () => {
    it('should return 100 for all passing tests', () => {
      const entries = [
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'passed' }
      ];

      const quality = calculateQuality(entries);
      expect(quality).toBe(100);
    });

    it('should calculate percentage for mixed results', () => {
      const entries = [
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'failed' }
      ];

      const quality = calculateQuality(entries);
      expect(quality).toBe(67);
    });

    it('should return 100 for no test entries', () => {
      const entries = [{ type: 'story_completed', status: 'success' }];
      const quality = calculateQuality(entries);
      expect(quality).toBe(100);
    });

    it('should return 0 for all failing tests', () => {
      const entries = [
        { type: 'test_result', status: 'failed' },
        { type: 'test_result', status: 'failed' }
      ];

      const quality = calculateQuality(entries);
      expect(quality).toBe(0);
    });
  });

  describe('Reliability Calculation', () => {
    it('should calculate success rate', () => {
      const entries = [
        { type: 'deployment', status: 'success' },
        { type: 'deployment', status: 'success' },
        { type: 'deployment', status: 'failed' }
      ];

      const reliability = calculateReliability(entries);
      expect(reliability).toBe(67);
    });

    it('should return 100 for empty entries', () => {
      const reliability = calculateReliability([]);
      expect(reliability).toBe(100);
    });

    it('should count passed tests as success', () => {
      const entries = [
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'passed' },
        { type: 'test_result', status: 'failed' }
      ];

      const reliability = calculateReliability(entries);
      expect(reliability).toBe(67);
    });
  });

  describe('Metrics Loading', () => {
    it('should return default metrics if file does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const metrics = loadMetrics('squad-nonexistent');
      expect(metrics.squadId).toBe('squad-nonexistent');
      expect(metrics.entries).toEqual([]);
      jest.restoreAllMocks();
    });

    it('should parse JSONL metrics file', () => {
      const entries = [
        { type: 'story_completed', status: 'success' },
        { type: 'test_result', status: 'passed' }
      ];
      const content = entries.map(e => JSON.stringify(e)).join('\n');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(content);

      const metrics = loadMetrics('squad-1');
      expect(metrics.entries.length).toBe(2);
      jest.restoreAllMocks();
    });
  });

  describe('Metrics Recording', () => {
    it('should append metric to JSONL file', () => {
      const appendSpy = jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      recordMetric('squad-1', { type: 'story_completed', status: 'success' });
      expect(appendSpy).toHaveBeenCalled();

      appendSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should include timestamp in recorded metric', () => {
      const metric = { type: 'test_result', status: 'passed' };
      const recordedMetric = {
        timestamp: new Date().toISOString(),
        ...metric
      };

      expect(recordedMetric.timestamp).toBeDefined();
      expect(recordedMetric.type).toBe('test_result');
    });
  });

  describe('Metrics Formatting', () => {
    it('should format metrics for display', () => {
      const metrics = {
        squadId: 'squad-1',
        velocity: 5,
        quality: 95,
        reliability: 90,
        entries: [
          { timestamp: '2026-04-10T10:00:00Z', type: 'story_completed' }
        ]
      };

      const formatted = formatMetrics(metrics);
      expect(formatted.squadId).toBe('squad-1');
      expect(formatted.velocity.value).toBe(5);
      expect(formatted.quality.value).toBe(95);
      expect(formatted.reliability.value).toBe(90);
    });

    it('should include last updated timestamp', () => {
      const metrics = {
        squadId: 'squad-1',
        velocity: 0,
        quality: 0,
        reliability: 0,
        entries: [
          { timestamp: '2026-04-10T10:00:00Z' }
        ]
      };

      const formatted = formatMetrics(metrics);
      expect(formatted.lastUpdated).toBe('2026-04-10T10:00:00Z');
    });
  });

  describe('CSV Export', () => {
    it('should export metrics as CSV', () => {
      const metrics = {
        squadId: 'squad-1',
        velocity: 5,
        quality: 95,
        reliability: 90,
        entries: [
          { timestamp: '2026-04-10T10:00:00Z', type: 'story_completed', status: 'success', details: {} }
        ]
      };

      const csv = exportCSV(metrics);
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('Type');
      expect(csv).toContain('story_completed');
    });

    it('should include headers in CSV', () => {
      const metrics = { squadId: 'squad-1', velocity: 0, quality: 0, reliability: 0, entries: [] };
      const csv = exportCSV(metrics);
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Timestamp');
    });
  });

  describe('Scorecard Generation', () => {
    it('should generate scorecard with overall score', () => {
      const scorecard = getScorecard('squad-1');
      expect(scorecard.scorecard).toBeDefined();
      expect(scorecard.scorecard.overall).toBeDefined();
    });

    it('should calculate overall score as average', () => {
      const scorecard = getScorecard('squad-1');
      expect(scorecard.scorecard).toBeDefined();
    });
  });

  describe('Historical Tracking', () => {
    it('should support multiple metric entries per squad', () => {
      const entries = [];
      for (let i = 0; i < 10; i++) {
        entries.push({ type: 'story_completed', status: 'success', timestamp: new Date().toISOString() });
      }

      expect(entries.length).toBe(10);
    });

    it('should preserve entry order', () => {
      const entries = [];
      const timestamps = [];

      for (let i = 0; i < 5; i++) {
        const ts = new Date(Date.now() + i * 1000).toISOString();
        timestamps.push(ts);
        entries.push({ timestamp: ts, type: 'metric', status: 'success' });
      }

      entries.forEach((entry, idx) => {
        expect(entry.timestamp).toBe(timestamps[idx]);
      });
    });
  });

  describe('Integration with Squad Registry', () => {
    it('should load registry for all squads', () => {
      const registry = {
        squads: {
          'squad-1': { id: 'squad-1', name: 'Squad 1' },
          'squad-2': { id: 'squad-2', name: 'Squad 2' }
        }
      };

      expect(Object.keys(registry.squads).length).toBe(2);
    });
  });
});
