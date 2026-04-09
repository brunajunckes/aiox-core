/**
 * Tests for Changelog Viewer Command Module
 * @story 19.4 — Changelog Viewer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-changes-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/changes/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/changes/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('changes command', () => {
  describe('findChangelog', () => {
    it('returns null when no changelog exists', () => {
      expect(mod.findChangelog({ baseDir: tmpDir })).toBeNull();
    });

    it('finds CHANGELOG.md', () => {
      fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), '# Changelog');
      const result = mod.findChangelog({ baseDir: tmpDir });
      expect(result).toContain('CHANGELOG.md');
    });

    it('finds changelog.md (lowercase)', () => {
      fs.writeFileSync(path.join(tmpDir, 'changelog.md'), '# Changelog');
      const result = mod.findChangelog({ baseDir: tmpDir });
      expect(result).toContain('changelog.md');
    });

    it('finds CHANGES.md variant', () => {
      fs.writeFileSync(path.join(tmpDir, 'CHANGES.md'), '# Changes');
      const result = mod.findChangelog({ baseDir: tmpDir });
      expect(result).toContain('CHANGES.md');
    });
  });

  describe('parseChangelog', () => {
    it('parses standard keep-a-changelog format', () => {
      const content = `# Changelog

## [2.0.0] - 2026-04-01

### Added
- New feature X

## [1.0.0] - 2026-03-01

### Added
- Initial release
`;
      const entries = mod.parseChangelog(content);
      expect(entries).toHaveLength(2);
      expect(entries[0].version).toBe('2.0.0');
      expect(entries[0].date).toBe('2026-04-01');
      expect(entries[1].version).toBe('1.0.0');
    });

    it('detects breaking changes', () => {
      const content = `## [3.0.0] - 2026-04-01

### BREAKING CHANGES
- Removed deprecated API
`;
      const entries = mod.parseChangelog(content);
      expect(entries[0].breaking).toBe(true);
    });

    it('handles entries without dates', () => {
      const content = `## [Unreleased]

### Added
- Something new
`;
      const entries = mod.parseChangelog(content);
      expect(entries[0].version).toBe('Unreleased');
      expect(entries[0].date).toBe('');
    });

    it('returns empty for null/empty input', () => {
      expect(mod.parseChangelog(null)).toEqual([]);
      expect(mod.parseChangelog('')).toEqual([]);
    });

    it('preserves body content', () => {
      const content = `## [1.0.0] - 2026-01-01

### Added
- Feature A
- Feature B
`;
      const entries = mod.parseChangelog(content);
      expect(entries[0].body).toContain('Feature A');
      expect(entries[0].body).toContain('Feature B');
    });
  });

  describe('getGitChanges', () => {
    it('returns entries from git log', () => {
      const mockExec = () => 'abc12345|feat: add thing|2026-04-01 12:00:00\ndef67890|fix: bug|2026-04-02 12:00:00';
      const entries = mod.getGitChanges({ execFn: mockExec });
      expect(entries).toHaveLength(2);
      expect(entries[0].hash).toBe('abc12345');
      expect(entries[0].message).toBe('feat: add thing');
    });

    it('detects breaking changes in git log', () => {
      const mockExec = () => 'abc12345|feat!: BREAKING change|2026-04-01';
      const entries = mod.getGitChanges({ execFn: mockExec });
      expect(entries[0].breaking).toBe(true);
    });

    it('returns empty on git error', () => {
      const mockExec = () => { throw new Error('not a git repo'); };
      const entries = mod.getGitChanges({ execFn: mockExec });
      expect(entries).toEqual([]);
    });

    it('returns empty for empty output', () => {
      const mockExec = () => '';
      const entries = mod.getGitChanges({ execFn: mockExec });
      expect(entries).toEqual([]);
    });
  });

  describe('filterBreaking', () => {
    it('filters to breaking only', () => {
      const entries = [
        { version: '2.0.0', breaking: true },
        { version: '1.1.0', breaking: false },
        { version: '1.0.0', breaking: true },
      ];
      const filtered = mod.filterBreaking(entries);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].version).toBe('2.0.0');
    });

    it('returns empty when no breaking changes', () => {
      const entries = [{ version: '1.0.0', breaking: false }];
      expect(mod.filterBreaking(entries)).toEqual([]);
    });
  });

  describe('filterSince', () => {
    it('filters entries since a version', () => {
      const entries = [
        { version: '3.0.0' },
        { version: '2.0.0' },
        { version: '1.0.0' },
      ];
      const filtered = mod.filterSince(entries, '2.0.0');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].version).toBe('3.0.0');
    });

    it('returns all entries if version not found', () => {
      const entries = [{ version: '2.0.0' }, { version: '1.0.0' }];
      const filtered = mod.filterSince(entries, '0.5.0');
      expect(filtered).toHaveLength(2);
    });

    it('strips v prefix from version', () => {
      const entries = [
        { version: '2.0.0' },
        { version: '1.0.0' },
      ];
      const filtered = mod.filterSince(entries, 'v1.0.0');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('formatText', () => {
    it('formats changelog entries', () => {
      const entries = [{ version: '1.0.0', date: '2026-01-01', body: 'Initial', breaking: false }];
      const text = mod.formatText(entries, 'changelog');
      expect(text).toContain('Changes (source: changelog)');
      expect(text).toContain('1.0.0');
      expect(text).toContain('Total: 1');
    });

    it('formats git entries', () => {
      const entries = [{ hash: 'abc123', message: 'feat: thing', date: '2026-01-01', breaking: false }];
      const text = mod.formatText(entries, 'git');
      expect(text).toContain('abc123');
      expect(text).toContain('feat: thing');
    });

    it('shows no changes message', () => {
      const text = mod.formatText([], 'changelog');
      expect(text).toContain('No changes found');
    });

    it('marks breaking entries', () => {
      const entries = [{ version: '2.0.0', date: '', body: '', breaking: true }];
      const text = mod.formatText(entries, 'changelog');
      expect(text).toContain('[BREAKING]');
    });
  });

  describe('formatJSON', () => {
    it('produces valid JSON', () => {
      const entries = [{ version: '1.0.0', breaking: false }];
      const json = mod.formatJSON(entries, 'changelog');
      const parsed = JSON.parse(json);
      expect(parsed.source).toBe('changelog');
      expect(parsed.total).toBe(1);
      expect(parsed.entries).toHaveLength(1);
    });
  });

  describe('parseFlag', () => {
    it('parses flag value', () => {
      expect(mod.parseFlag(['--since', 'v5.0.0'], '--since')).toBe('v5.0.0');
    });

    it('returns null for missing flag', () => {
      expect(mod.parseFlag([], '--since')).toBeNull();
    });
  });

  describe('runChanges', () => {
    it('shows help with --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChanges(['--help']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      spy.mockRestore();
    });

    it('reads from CHANGELOG.md when present', () => {
      fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), `# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Added\n- Feature\n`);
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChanges([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('changelog'));
      spy.mockRestore();
    });

    it('outputs JSON with --format json', () => {
      fs.writeFileSync(path.join(tmpDir, 'CHANGELOG.md'), `## [1.0.0] - 2026-01-01\n\n- Feature\n`);
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runChanges(['--format', 'json']);
      const output = spy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      spy.mockRestore();
    });

    it('rejects invalid format', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      mod.runChanges(['--format', 'xml']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
      spy.mockRestore();
    });
  });
});
