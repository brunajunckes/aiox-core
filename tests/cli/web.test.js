/**
 * Tests for Web Dashboard Server Command Module
 * @story 26.1 — Web Dashboard Server
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-web-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/web/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/web/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('web dashboard command', () => {
  // ── collectStories ──────────────────────────────────────────────────────
  describe('collectStories', () => {
    it('returns empty array when no stories dir', () => {
      expect(mod.collectStories({ cwd: tmpDir })).toEqual([]);
    });

    it('collects stories with title and status', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.1.story.md'), '# My Story\n\n## Status\n\nDone\n');
      fs.writeFileSync(path.join(dir, '1.2.story.md'), '# Another\n\n## Status\n\nDraft\n');
      const stories = mod.collectStories({ cwd: tmpDir });
      expect(stories).toHaveLength(2);
      expect(stories[0].id).toBe('1.1');
      expect(stories[0].title).toBe('My Story');
      expect(stories[0].status).toBe('Done');
      expect(stories[1].status).toBe('Draft');
    });

    it('handles stories without status', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '2.1.story.md'), '# No Status');
      const stories = mod.collectStories({ cwd: tmpDir });
      expect(stories[0].status).toBe('Unknown');
    });
  });

  // ── collectCommands ─────────────────────────────────────────────────────
  describe('collectCommands', () => {
    it('returns empty array when no aiox.js', () => {
      expect(mod.collectCommands({ cwd: tmpDir })).toEqual([]);
    });

    it('extracts command names from case statements', () => {
      const binDir = path.join(tmpDir, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'aiox.js'), "case 'foo':\ncase 'bar':\ncase 'baz':");
      const cmds = mod.collectCommands({ cwd: tmpDir });
      expect(cmds).toEqual(['foo', 'bar', 'baz']);
    });
  });

  // ── countTestFiles ──────────────────────────────────────────────────────
  describe('countTestFiles', () => {
    it('returns 0 when no tests dir', () => {
      expect(mod.countTestFiles({ cwd: tmpDir })).toBe(0);
    });

    it('counts test files recursively', () => {
      const dir = path.join(tmpDir, 'tests', 'cli');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.test.js'), '');
      fs.writeFileSync(path.join(dir, 'b.spec.js'), '');
      fs.writeFileSync(path.join(dir, 'c.js'), '');
      expect(mod.countTestFiles({ cwd: tmpDir })).toBe(2);
    });
  });

  // ── collectDashboardData ────────────────────────────────────────────────
  describe('collectDashboardData', () => {
    it('returns full dashboard structure', () => {
      const data = mod.collectDashboardData({ cwd: tmpDir });
      expect(data).toHaveProperty('project');
      expect(data).toHaveProperty('stories');
      expect(data).toHaveProperty('commands');
      expect(data).toHaveProperty('tests');
      expect(data.project.name).toBe('AIOX');
      expect(data.stories.stats).toHaveProperty('total');
    });

    it('computes story stats correctly', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '1.1.story.md'), '# S1\n\n## Status\n\nDone\n');
      fs.writeFileSync(path.join(dir, '1.2.story.md'), '# S2\n\n## Status\n\nInReview\n');
      fs.writeFileSync(path.join(dir, '1.3.story.md'), '# S3\n\n## Status\n\nDraft\n');
      const data = mod.collectDashboardData({ cwd: tmpDir });
      expect(data.stories.stats.total).toBe(3);
      expect(data.stories.stats.done).toBe(1);
      expect(data.stories.stats.inReview).toBe(1);
      expect(data.stories.stats.draft).toBe(1);
    });
  });

  // ── generateHTML ────────────────────────────────────────────────────────
  describe('generateHTML', () => {
    it('generates valid HTML with dashboard data', () => {
      const data = mod.collectDashboardData({ cwd: tmpDir });
      const html = mod.generateHTML(data);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('AIOX Dashboard');
      expect(html).toContain('<table>');
    });

    it('includes story rows in the HTML', () => {
      const dir = path.join(tmpDir, 'docs', 'stories');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '5.1.story.md'), '# Test Story\n\n## Status\n\nDone\n');
      const data = mod.collectDashboardData({ cwd: tmpDir });
      const html = mod.generateHTML(data);
      expect(html).toContain('5.1');
      expect(html).toContain('Test Story');
    });
  });

  // ── createServer ────────────────────────────────────────────────────────
  describe('createServer', () => {
    let server;

    afterEach((done) => {
      if (server && server.listening) {
        server.close(done);
      } else {
        done();
      }
    });

    it('creates an HTTP server instance', () => {
      server = mod.createServer({ cwd: tmpDir });
      expect(server).toBeInstanceOf(http.Server);
    });

    it('serves /api/health endpoint', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/api/health`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            const data = JSON.parse(body);
            expect(data.status).toBe('ok');
            expect(data).toHaveProperty('timestamp');
            done();
          });
        });
      });
    });

    it('serves /api/dashboard endpoint', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/api/dashboard`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            const data = JSON.parse(body);
            expect(data).toHaveProperty('project');
            expect(data).toHaveProperty('stories');
            done();
          });
        });
      });
    });

    it('serves /api/stories endpoint', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/api/stories`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            const data = JSON.parse(body);
            expect(Array.isArray(data)).toBe(true);
            done();
          });
        });
      });
    });

    it('serves /api/commands endpoint', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/api/commands`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            const data = JSON.parse(body);
            expect(Array.isArray(data)).toBe(true);
            done();
          });
        });
      });
    });

    it('serves HTML at / by default', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/`, (res) => {
          expect(res.headers['content-type']).toBe('text/html');
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            expect(body).toContain('AIOX Dashboard');
            done();
          });
        });
      });
    });

    it('returns 404 for unknown paths', (done) => {
      server = mod.createServer({ cwd: tmpDir });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/unknown`, (res) => {
          expect(res.statusCode).toBe(404);
          done();
        });
      });
    });

    it('returns 404 for / in api-only mode', (done) => {
      server = mod.createServer({ cwd: tmpDir, apiOnly: true });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/`, (res) => {
          expect(res.statusCode).toBe(404);
          done();
        });
      });
    });

    it('still serves API in api-only mode', (done) => {
      server = mod.createServer({ cwd: tmpDir, apiOnly: true });
      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://localhost:${port}/api/health`, (res) => {
          expect(res.statusCode).toBe(200);
          done();
        });
      });
    });
  });
});
