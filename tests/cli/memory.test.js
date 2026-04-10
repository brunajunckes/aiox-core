/**
 * Tests for Memory Layer Command Module
 * @story 35.1 - Memory Layer for Agent Context Persistence
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-memory-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/memory/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/memory/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('memory command', () => {
  // -- keyToFilename / filenameToKey ------------------------------------------

  describe('keyToFilename', () => {
    it('converts simple key to filename', () => {
      expect(mod.keyToFilename('mykey')).toBe('mykey.json');
    });

    it('converts namespaced key to filename', () => {
      expect(mod.keyToFilename('agent:dev:lastStory')).toBe('agent__dev__lastStory.json');
    });
  });

  describe('filenameToKey', () => {
    it('recovers simple key from filename', () => {
      expect(mod.filenameToKey('mykey.json')).toBe('mykey');
    });

    it('recovers namespaced key from filename', () => {
      expect(mod.filenameToKey('agent__dev__lastStory.json')).toBe('agent:dev:lastStory');
    });
  });

  // -- extractNamespace -------------------------------------------------------

  describe('extractNamespace', () => {
    it('extracts namespace from namespaced key', () => {
      expect(mod.extractNamespace('agent:dev:lastStory')).toBe('agent');
    });

    it('returns null for non-namespaced key', () => {
      expect(mod.extractNamespace('simpleKey')).toBeNull();
    });
  });

  // -- CRUD operations --------------------------------------------------------

  describe('writeEntry / readEntry', () => {
    it('writes and reads a string entry', () => {
      mod.writeEntry('testKey', 'testValue');
      const entry = mod.readEntry('testKey');
      expect(entry).not.toBeNull();
      expect(entry.key).toBe('testKey');
      expect(entry.value).toBe('testValue');
    });

    it('writes and reads an object entry', () => {
      mod.writeEntry('obj', { foo: 'bar', num: 42 });
      const entry = mod.readEntry('obj');
      expect(entry.value).toEqual({ foo: 'bar', num: 42 });
    });

    it('preserves createdAt on update', () => {
      mod.writeEntry('preserve', 'v1');
      const first = mod.readEntry('preserve');
      mod.writeEntry('preserve', 'v2');
      const second = mod.readEntry('preserve');
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.value).toBe('v2');
    });

    it('returns null for non-existent key', () => {
      expect(mod.readEntry('nonexistent')).toBeNull();
    });

    it('sets namespace correctly', () => {
      mod.writeEntry('agent:dev:story', 'ACT-1');
      const entry = mod.readEntry('agent:dev:story');
      expect(entry.namespace).toBe('agent');
    });
  });

  describe('deleteEntry', () => {
    it('deletes an existing entry', () => {
      mod.writeEntry('toDelete', 'value');
      expect(mod.deleteEntry('toDelete')).toBe(true);
      expect(mod.readEntry('toDelete')).toBeNull();
    });

    it('returns false for non-existent entry', () => {
      expect(mod.deleteEntry('ghost')).toBe(false);
    });
  });

  // -- List and search --------------------------------------------------------

  describe('readAllEntries', () => {
    it('returns empty array when no entries', () => {
      expect(mod.readAllEntries()).toEqual([]);
    });

    it('returns all stored entries', () => {
      mod.writeEntry('a', '1');
      mod.writeEntry('b', '2');
      mod.writeEntry('c', '3');
      const all = mod.readAllEntries();
      expect(all.length).toBe(3);
    });
  });

  describe('searchEntries', () => {
    it('finds entries by key match', () => {
      mod.writeEntry('project:version', '5.0.3');
      mod.writeEntry('agent:dev:task', 'implement');
      const results = mod.searchEntries('version');
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('project:version');
    });

    it('finds entries by value match', () => {
      mod.writeEntry('greeting', 'hello world');
      mod.writeEntry('farewell', 'goodbye');
      const results = mod.searchEntries('hello');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.writeEntry('a', 'b');
      expect(mod.searchEntries('zzz')).toEqual([]);
    });
  });

  describe('getAgentEntries', () => {
    it('returns entries for specific agent', () => {
      mod.writeEntry('agent:dev:story', 'S1');
      mod.writeEntry('agent:dev:branch', 'feat/x');
      mod.writeEntry('agent:qa:review', 'pending');
      mod.writeEntry('project:version', '1.0');
      const devEntries = mod.getAgentEntries('dev');
      expect(devEntries.length).toBe(2);
    });

    it('returns empty for unknown agent', () => {
      mod.writeEntry('agent:dev:x', 'y');
      expect(mod.getAgentEntries('unknown')).toEqual([]);
    });
  });

  // -- Export / Import --------------------------------------------------------

  describe('exportAll', () => {
    it('exports all entries with metadata', () => {
      mod.writeEntry('k1', 'v1');
      mod.writeEntry('k2', 'v2');
      const exported = mod.exportAll();
      expect(exported.version).toBe('1.0.0');
      expect(exported.count).toBe(2);
      expect(exported.entries.length).toBe(2);
      expect(exported.exportedAt).toBeDefined();
    });
  });

  describe('importEntries', () => {
    it('imports entries from export format', () => {
      const data = {
        entries: [
          { key: 'imp1', value: 'val1' },
          { key: 'imp2', value: 'val2' },
        ],
      };
      const result = mod.importEntries(data);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mod.readEntry('imp1').value).toBe('val1');
    });

    it('skips entries without key', () => {
      const data = {
        entries: [
          { key: 'good', value: 'ok' },
          { value: 'no-key' },
        ],
      };
      const result = mod.importEntries(data);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('throws on invalid format', () => {
      expect(() => mod.importEntries({})).toThrow('Invalid import format');
      expect(() => mod.importEntries(null)).toThrow('Invalid import format');
    });
  });

  // -- ensureMemoryDir --------------------------------------------------------

  describe('ensureMemoryDir', () => {
    it('creates memory directory if not exists', () => {
      const dir = mod.ensureMemoryDir();
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  // -- runMemory CLI ----------------------------------------------------------

  describe('runMemory', () => {
    it('handles empty memory list', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMemory([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No memory entries'));
      spy.mockRestore();
    });

    it('lists entries when they exist', () => {
      mod.writeEntry('test', 'value');
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runMemory([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Memory Entries'));
      spy.mockRestore();
    });
  });
});
