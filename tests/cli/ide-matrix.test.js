'use strict';

const {
  runIDEMatrix,
  getIDEList,
  getIDE,
  formatMatrix,
  formatIDEDetail,
  buildJSON,
  IDE_LIST,
  FEATURE_LABELS,
} = require('../../.aiox-core/cli/commands/ide-matrix/index.js');

describe('IDE Compatibility Matrix — Story 32.2', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // --- IDE_LIST ---

  describe('IDE_LIST', () => {
    it('should contain 6 IDEs', () => {
      expect(IDE_LIST).toHaveLength(6);
    });

    it('each IDE should have id, name, tier, features, setup', () => {
      for (const ide of IDE_LIST) {
        expect(typeof ide.id).toBe('string');
        expect(typeof ide.name).toBe('string');
        expect(typeof ide.tier).toBe('string');
        expect(typeof ide.features).toBe('object');
        expect(Array.isArray(ide.setup)).toBe(true);
      }
    });

    it('should include Claude Code as first IDE', () => {
      expect(IDE_LIST[0].id).toBe('claude-code');
    });

    it('each IDE should have all feature keys', () => {
      const featureKeys = Object.keys(FEATURE_LABELS);
      for (const ide of IDE_LIST) {
        for (const key of featureKeys) {
          expect(ide.features).toHaveProperty(key);
          expect(ide.features[key]).toHaveProperty('supported');
          expect(ide.features[key]).toHaveProperty('notes');
        }
      }
    });

    it('Claude Code should support all features', () => {
      const cc = IDE_LIST.find((i) => i.id === 'claude-code');
      const featureKeys = Object.keys(FEATURE_LABELS);
      for (const key of featureKeys) {
        expect(cc.features[key].supported).toBe(true);
      }
    });
  });

  // --- FEATURE_LABELS ---

  describe('FEATURE_LABELS', () => {
    it('should define 5 feature labels', () => {
      expect(Object.keys(FEATURE_LABELS)).toHaveLength(5);
    });

    it('should include agentActivation, storyWorkflow, qualityGates, squads, mcp', () => {
      expect(FEATURE_LABELS).toHaveProperty('agentActivation');
      expect(FEATURE_LABELS).toHaveProperty('storyWorkflow');
      expect(FEATURE_LABELS).toHaveProperty('qualityGates');
      expect(FEATURE_LABELS).toHaveProperty('squads');
      expect(FEATURE_LABELS).toHaveProperty('mcp');
    });
  });

  // --- getIDEList ---

  describe('getIDEList', () => {
    it('should return the full IDE list', () => {
      const list = getIDEList();
      expect(list).toBe(IDE_LIST);
    });
  });

  // --- getIDE ---

  describe('getIDE', () => {
    it('should find IDE by exact id', () => {
      const ide = getIDE('cursor');
      expect(ide).toBeTruthy();
      expect(ide.name).toBe('Cursor');
    });

    it('should find IDE by name with case-insensitive match', () => {
      const ide = getIDE('Claude Code');
      expect(ide).toBeTruthy();
      expect(ide.id).toBe('claude-code');
    });

    it('should return null for unknown IDE', () => {
      const ide = getIDE('sublime-text');
      expect(ide).toBeNull();
    });

    it('should handle spaces in IDE name', () => {
      const ide = getIDE('vs-code-+-copilot');
      expect(ide).toBeTruthy();
      expect(ide.id).toBe('vscode-copilot');
    });
  });

  // --- formatMatrix ---

  describe('formatMatrix', () => {
    it('should include header row', () => {
      const output = formatMatrix();
      expect(output).toContain('IDE Compatibility Matrix');
    });

    it('should include all IDE names', () => {
      const output = formatMatrix();
      for (const ide of IDE_LIST) {
        expect(output).toContain(ide.name);
      }
    });

    it('should include legend', () => {
      const output = formatMatrix();
      expect(output).toContain('Legend');
    });
  });

  // --- formatIDEDetail ---

  describe('formatIDEDetail', () => {
    it('should include IDE name and tier', () => {
      const ide = IDE_LIST[0];
      const output = formatIDEDetail(ide);
      expect(output).toContain(ide.name);
      expect(output).toContain(ide.tier);
    });

    it('should list features with [OK]/[--] markers', () => {
      const ide = IDE_LIST[0];
      const output = formatIDEDetail(ide);
      expect(output).toContain('[OK]');
    });

    it('should list setup instructions', () => {
      const ide = IDE_LIST[0];
      const output = formatIDEDetail(ide);
      expect(output).toContain('Setup Instructions');
      expect(output).toContain('1.');
    });
  });

  // --- buildJSON ---

  describe('buildJSON', () => {
    it('should return all IDEs when no filter', () => {
      const json = buildJSON(null);
      expect(json).toHaveProperty('ides');
      expect(json.ides).toHaveLength(6);
    });

    it('should return single IDE when filtered', () => {
      const json = buildJSON('cursor');
      expect(json.id).toBe('cursor');
      expect(json.name).toBe('Cursor');
    });

    it('should return error for unknown IDE', () => {
      const json = buildJSON('unknown-ide');
      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('available');
    });
  });

  // --- runIDEMatrix ---

  describe('runIDEMatrix', () => {
    it('should display matrix by default', () => {
      const result = runIDEMatrix([], { silent: true });
      expect(result.output).toContain('IDE Compatibility Matrix');
    });

    it('should display specific IDE with --ide flag', () => {
      const result = runIDEMatrix(['--ide', 'cursor'], { silent: true });
      expect(result.output).toContain('Cursor');
      expect(result.output).toContain('Tier 2');
    });

    it('should output JSON with --json flag', () => {
      const result = runIDEMatrix(['--json'], { silent: true });
      expect(result.json).toBeTruthy();
      expect(result.json.ides).toHaveLength(6);
    });

    it('should output JSON for specific IDE', () => {
      const result = runIDEMatrix(['--json', '--ide', 'claude-code'], { silent: true });
      expect(result.json.id).toBe('claude-code');
    });

    it('should show error for unknown IDE', () => {
      const result = runIDEMatrix(['--ide', 'notepad'], { silent: true });
      expect(result.error).toBe(true);
      expect(result.output).toContain('not found');
    });

    it('should print to console when not silent', () => {
      runIDEMatrix([]);
      expect(console.log).toHaveBeenCalled();
    });
  });
});
