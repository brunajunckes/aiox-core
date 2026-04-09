/**
 * Tests for Team Notes & Knowledge Base Command Module
 * @story 25.1 — Team Notes & Knowledge Base
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-notes-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/notes/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/notes/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('notes command', () => {
  // ── loadNotes ──────────────────────────────────────────────────────────
  describe('loadNotes', () => {
    it('returns empty array when file is absent', () => {
      expect(mod.loadNotes()).toEqual([]);
    });

    it('returns empty array when file is empty', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'notes.json'), '', 'utf8');
      expect(mod.loadNotes()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'notes.json'), 'bad-json', 'utf8');
      expect(mod.loadNotes()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'notes.json'), '{"a":1}', 'utf8');
      expect(mod.loadNotes()).toEqual([]);
    });

    it('parses valid JSON array', () => {
      const dir = path.join(tmpDir, '.aiox');
      fs.mkdirSync(dir, { recursive: true });
      const data = [{ id: 'abc', title: 'Test' }];
      fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(data), 'utf8');
      expect(mod.loadNotes()).toEqual(data);
    });
  });

  // ── addNote ────────────────────────────────────────────────────────────
  describe('addNote', () => {
    it('adds a note with title and content', () => {
      const note = mod.addNote('My Note', ['--content', 'Some text']);
      expect(note).toBeTruthy();
      expect(note.title).toBe('My Note');
      expect(note.content).toBe('Some text');
      expect(note.id).toBeTruthy();

      const stored = mod.loadNotes();
      expect(stored.length).toBe(1);
      expect(stored[0].title).toBe('My Note');
    });

    it('adds a note with tags', () => {
      const note = mod.addNote('Tagged Note', ['--content', 'text', '--tags', 'bug,feature']);
      expect(note.tags).toEqual(['bug', 'feature']);
    });

    it('returns null when title is missing', () => {
      const result = mod.addNote(undefined, []);
      expect(result).toBeNull();
    });

    it('creates .aiox directory if it does not exist', () => {
      mod.addNote('Test', ['--content', 'x']);
      expect(fs.existsSync(path.join(tmpDir, '.aiox', 'notes.json'))).toBe(true);
    });

    it('adds multiple notes', () => {
      mod.addNote('First', ['--content', 'a']);
      mod.addNote('Second', ['--content', 'b']);
      expect(mod.loadNotes().length).toBe(2);
    });
  });

  // ── getNote ────────────────────────────────────────────────────────────
  describe('getNote', () => {
    it('returns a note by id', () => {
      const note = mod.addNote('Find Me', ['--content', 'data']);
      const found = mod.getNote(note.id);
      expect(found).toBeTruthy();
      expect(found.title).toBe('Find Me');
    });

    it('returns null for unknown id', () => {
      expect(mod.getNote('nonexistent')).toBeNull();
    });

    it('returns null when id is missing', () => {
      expect(mod.getNote(undefined)).toBeNull();
    });
  });

  // ── searchNotes ────────────────────────────────────────────────────────
  describe('searchNotes', () => {
    it('finds notes by title', () => {
      mod.addNote('API Design', ['--content', 'rest endpoints']);
      mod.addNote('Database Plan', ['--content', 'postgres']);
      const results = mod.searchNotes('API');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('API Design');
    });

    it('finds notes by content', () => {
      mod.addNote('Note A', ['--content', 'important meeting']);
      const results = mod.searchNotes('meeting');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      mod.addNote('Note', ['--content', 'text']);
      const results = mod.searchNotes('zzzzz');
      expect(results.length).toBe(0);
    });

    it('returns empty array when term is missing', () => {
      expect(mod.searchNotes(undefined)).toEqual([]);
    });

    it('is case insensitive', () => {
      mod.addNote('UPPER', ['--content', 'x']);
      const results = mod.searchNotes('upper');
      expect(results.length).toBe(1);
    });
  });

  // ── removeNote ─────────────────────────────────────────────────────────
  describe('removeNote', () => {
    it('removes a note by id', () => {
      const note = mod.addNote('Delete Me', ['--content', 'bye']);
      expect(mod.removeNote(note.id)).toBe(true);
      expect(mod.loadNotes().length).toBe(0);
    });

    it('returns false for unknown id', () => {
      expect(mod.removeNote('nonexistent')).toBe(false);
    });

    it('returns false when id is missing', () => {
      expect(mod.removeNote(undefined)).toBe(false);
    });
  });

  // ── listNotes ──────────────────────────────────────────────────────────
  describe('listNotes', () => {
    it('lists all notes', () => {
      mod.addNote('A', ['--content', 'a']);
      mod.addNote('B', ['--content', 'b']);
      const list = mod.listNotes([]);
      expect(list.length).toBe(2);
    });

    it('filters by tags', () => {
      mod.addNote('Bug', ['--content', 'x', '--tags', 'bug']);
      mod.addNote('Feature', ['--content', 'y', '--tags', 'feature']);
      const list = mod.listNotes(['--tags', 'bug']);
      expect(list.length).toBe(1);
      expect(list[0].title).toBe('Bug');
    });

    it('returns empty array when no notes exist', () => {
      expect(mod.listNotes([])).toEqual([]);
    });
  });

  // ── exportNotes ────────────────────────────────────────────────────────
  describe('exportNotes', () => {
    it('exports notes as JSON string', () => {
      mod.addNote('Export Me', ['--content', 'data']);
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const result = mod.exportNotes();
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Export Me');
      spy.mockRestore();
    });
  });

  // ── runNotes ───────────────────────────────────────────────────────────
  describe('runNotes', () => {
    it('shows help for --help', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runNotes(['--help']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows help for no args', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mod.runNotes([]);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ── generateId ─────────────────────────────────────────────────────────
  describe('generateId', () => {
    it('returns 8-char hex string', () => {
      const id = mod.generateId();
      expect(id).toMatch(/^[a-f0-9]{8}$/);
    });

    it('generates unique ids', () => {
      const ids = new Set(Array.from({ length: 20 }, () => mod.generateId()));
      expect(ids.size).toBe(20);
    });
  });
});
