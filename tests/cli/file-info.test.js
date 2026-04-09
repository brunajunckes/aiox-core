/**
 * Tests for File Info Inspector Command Module
 * @story 29.4 — File Info Inspector
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-file-info-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/file-info/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/file-info/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('file-info command', () => {
  describe('parseArgs', () => {
    it('returns defaults with no args', () => {
      const opts = mod.parseArgs([]);
      expect(opts.path).toBeNull();
      expect(opts.format).toBe('text');
      expect(opts.checksum).toBe(false);
      expect(opts.summary).toBe(false);
    });

    it('parses positional path', () => {
      const opts = mod.parseArgs(['/some/file.txt']);
      expect(opts.path).toBe('/some/file.txt');
    });

    it('parses --format json', () => {
      const opts = mod.parseArgs(['file.txt', '--format', 'json']);
      expect(opts.format).toBe('json');
    });

    it('parses --checksum', () => {
      const opts = mod.parseArgs(['file.txt', '--checksum']);
      expect(opts.checksum).toBe(true);
    });

    it('parses --summary', () => {
      const opts = mod.parseArgs(['dir/', '--summary']);
      expect(opts.summary).toBe(true);
    });
  });

  describe('guessEncoding', () => {
    it('detects utf-8 for text files', () => {
      const f = path.join(tmpDir, 'text.txt');
      fs.writeFileSync(f, 'Hello world');
      expect(mod.guessEncoding(f)).toBe('utf-8');
    });

    it('detects empty file', () => {
      const f = path.join(tmpDir, 'empty.txt');
      fs.writeFileSync(f, '');
      expect(mod.guessEncoding(f)).toBe('empty');
    });

    it('detects binary files', () => {
      const f = path.join(tmpDir, 'binary.dat');
      const buf = Buffer.alloc(100);
      buf[50] = 0; // null byte
      fs.writeFileSync(f, buf);
      expect(mod.guessEncoding(f)).toBe('binary');
    });

    it('detects utf-8-bom', () => {
      const f = path.join(tmpDir, 'bom.txt');
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      fs.writeFileSync(f, Buffer.concat([bom, Buffer.from('hello')]));
      expect(mod.guessEncoding(f)).toBe('utf-8-bom');
    });

    it('detects utf-16le', () => {
      const f = path.join(tmpDir, 'utf16le.txt');
      const bom = Buffer.from([0xFF, 0xFE]);
      fs.writeFileSync(f, Buffer.concat([bom, Buffer.from('hi')]));
      expect(mod.guessEncoding(f)).toBe('utf-16le');
    });
  });

  describe('countLines', () => {
    it('counts lines in file', () => {
      const f = path.join(tmpDir, 'lines.txt');
      fs.writeFileSync(f, 'a\nb\nc');
      expect(mod.countLines(f)).toBe(3);
    });

    it('returns 1 for single line', () => {
      const f = path.join(tmpDir, 'single.txt');
      fs.writeFileSync(f, 'one');
      expect(mod.countLines(f)).toBe(1);
    });

    it('returns 0 for empty file', () => {
      const f = path.join(tmpDir, 'empty.txt');
      fs.writeFileSync(f, '');
      expect(mod.countLines(f)).toBe(0);
    });
  });

  describe('computeChecksum', () => {
    it('returns sha256 hex string', () => {
      const f = path.join(tmpDir, 'cs.txt');
      fs.writeFileSync(f, 'test content');
      const checksum = mod.computeChecksum(f);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
      // Verify independently
      const expected = crypto.createHash('sha256').update('test content').digest('hex');
      expect(checksum).toBe(expected);
    });
  });

  describe('formatPermissions', () => {
    it('formats 0o644 as rw-r--r-- (644)', () => {
      const result = mod.formatPermissions(0o100644);
      expect(result).toContain('rw-r--r--');
      expect(result).toContain('644');
    });

    it('formats 0o755 as rwxr-xr-x (755)', () => {
      const result = mod.formatPermissions(0o100755);
      expect(result).toContain('rwxr-xr-x');
      expect(result).toContain('755');
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(mod.formatBytes(0)).toBe('0 B');
    });

    it('formats KB', () => {
      expect(mod.formatBytes(2048)).toBe('2 KB');
    });
  });

  describe('getFileInfo', () => {
    it('returns info for a text file', () => {
      const f = path.join(tmpDir, 'test.js');
      fs.writeFileSync(f, 'console.log("hi");\n');
      const info = mod.getFileInfo(f);
      expect(info.name).toBe('test.js');
      expect(info.size).toBeGreaterThan(0);
      expect(info.type).toContain('text');
      expect(info.encoding).toBe('utf-8');
      expect(info.lines).toBe(2);
      expect(info.created).toBeDefined();
      expect(info.modified).toBeDefined();
      expect(info.permissions).toBeDefined();
    });

    it('includes checksum when requested', () => {
      const f = path.join(tmpDir, 'cs.txt');
      fs.writeFileSync(f, 'data');
      const info = mod.getFileInfo(f, { checksum: true });
      expect(info.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns info for a directory', () => {
      const d = path.join(tmpDir, 'subdir');
      fs.mkdirSync(d);
      const info = mod.getFileInfo(d);
      expect(info.isDirectory).toBe(true);
    });

    it('handles symlink info', () => {
      const target = path.join(tmpDir, 'real.txt');
      const link = path.join(tmpDir, 'link.txt');
      fs.writeFileSync(target, 'data');
      fs.symlinkSync(target, link);
      const info = mod.getFileInfo(link);
      expect(info.isSymlink).toBe(true);
      expect(info.symlinkTarget).toBeDefined();
    });
  });

  describe('getDirSummary', () => {
    it('summarizes empty directory', () => {
      const summary = mod.getDirSummary(tmpDir);
      expect(summary.files).toBe(0);
      expect(summary.dirs).toBe(0);
      expect(summary.totalSize).toBe(0);
    });

    it('counts files and directories', () => {
      fs.mkdirSync(path.join(tmpDir, 'sub'));
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'code');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'more');
      fs.writeFileSync(path.join(tmpDir, 'sub', 'c.txt'), 'deep');
      const summary = mod.getDirSummary(tmpDir);
      expect(summary.files).toBe(3);
      expect(summary.dirs).toBe(1);
      expect(summary.totalSize).toBeGreaterThan(0);
    });

    it('reports top extensions', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'a');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'b');
      fs.writeFileSync(path.join(tmpDir, 'c.txt'), 'c');
      const summary = mod.getDirSummary(tmpDir);
      expect(summary.topExtensions.length).toBeGreaterThan(0);
      expect(summary.topExtensions[0].ext).toBe('.js');
      expect(summary.topExtensions[0].count).toBe(2);
    });

    it('ignores node_modules', () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.js'), 'x');
      fs.writeFileSync(path.join(tmpDir, 'app.js'), 'y');
      const summary = mod.getDirSummary(tmpDir);
      expect(summary.files).toBe(1);
    });
  });

  describe('formatInfo', () => {
    it('formats file info as text', () => {
      const info = {
        name: 'test.txt',
        path: '/tmp/test.txt',
        type: 'text (txt)',
        size: 100,
        sizeHuman: '100 B',
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-02T00:00:00.000Z',
        permissions: 'rw-r--r-- (644)',
        encoding: 'utf-8',
        lines: 5,
      };
      const output = mod.formatInfo(info);
      expect(output).toContain('test.txt');
      expect(output).toContain('100 B');
      expect(output).toContain('utf-8');
      expect(output).toContain('Lines: 5');
    });

    it('includes checksum when present', () => {
      const info = {
        name: 'f.txt', path: '/f.txt', type: 'file', size: 1, sizeHuman: '1 B',
        created: '', modified: '', permissions: '', checksum: 'abc123',
      };
      const output = mod.formatInfo(info);
      expect(output).toContain('SHA256: abc123');
    });
  });
});
