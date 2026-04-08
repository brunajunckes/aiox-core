/**
 * Tests for docs-gen CLI command
 * @story 5.4 - Multi-language Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  listSourceDocs,
  generateTranslationPlaceholder,
  generateDocs,
  runDocsGen,
  listTranslations,
  parseArgs,
  SUPPORTED_LANGUAGES,
} = require('../../.aiox-core/cli/commands/docs-gen/index.js');

// Helper: create a temp docs directory
function createTempDocsDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-docs-gen-'));
  return tmpDir;
}

// Helper: cleanup temp dir
function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper: write file with directory creation
function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('docs-gen', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDocsDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  // ============================================================
  // listSourceDocs
  // ============================================================
  describe('listSourceDocs', () => {
    it('returns empty array for non-existent directory', () => {
      const result = listSourceDocs(path.join(tmpDir, 'nonexistent'));
      expect(result).toEqual([]);
    });

    it('returns empty array for empty directory', () => {
      const sourceDir = path.join(tmpDir, 'en');
      fs.mkdirSync(sourceDir, { recursive: true });
      const result = listSourceDocs(sourceDir);
      expect(result).toEqual([]);
    });

    it('lists .md files in flat directory', () => {
      const sourceDir = path.join(tmpDir, 'en');
      writeFile(path.join(sourceDir, 'getting-started.md'), '# Getting Started');
      writeFile(path.join(sourceDir, 'installation.md'), '# Installation');
      writeFile(path.join(sourceDir, 'config.json'), '{}'); // should be ignored

      const result = listSourceDocs(sourceDir);
      expect(result).toEqual(['getting-started.md', 'installation.md']);
    });

    it('lists .md files in nested directories', () => {
      const sourceDir = path.join(tmpDir, 'en');
      writeFile(path.join(sourceDir, 'README.md'), '# Root');
      writeFile(path.join(sourceDir, 'guides', 'setup.md'), '# Setup');
      writeFile(path.join(sourceDir, 'guides', 'advanced', 'config.md'), '# Config');

      const result = listSourceDocs(sourceDir);
      expect(result).toEqual([
        'README.md',
        path.join('guides', 'advanced', 'config.md'),
        path.join('guides', 'setup.md'),
      ]);
    });

    it('returns sorted results', () => {
      const sourceDir = path.join(tmpDir, 'en');
      writeFile(path.join(sourceDir, 'z-file.md'), '# Z');
      writeFile(path.join(sourceDir, 'a-file.md'), '# A');
      writeFile(path.join(sourceDir, 'm-file.md'), '# M');

      const result = listSourceDocs(sourceDir);
      expect(result).toEqual(['a-file.md', 'm-file.md', 'z-file.md']);
    });
  });

  // ============================================================
  // generateTranslationPlaceholder
  // ============================================================
  describe('generateTranslationPlaceholder', () => {
    it('wraps headings with TRANSLATE marker', () => {
      const input = '# Getting Started\n\n## Installation';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('# [TRANSLATE:pt: Getting Started]');
      expect(result).toContain('## [TRANSLATE:pt: Installation]');
    });

    it('wraps regular paragraphs', () => {
      const input = 'AIOX is an AI-orchestrated system.';
      const result = generateTranslationPlaceholder(input, 'es');
      expect(result).toBe('[TRANSLATE:es: AIOX is an AI-orchestrated system.]');
    });

    it('preserves code blocks as-is', () => {
      const input = '# Title\n\n```bash\nnpm install\necho "hello"\n```\n\nMore text.';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('```bash');
      expect(result).toContain('npm install');
      expect(result).toContain('echo "hello"');
      expect(result).toContain('```');
      expect(result).not.toContain('[TRANSLATE:pt: npm install]');
      expect(result).not.toContain('[TRANSLATE:pt: echo "hello"]');
    });

    it('preserves empty lines', () => {
      const input = 'Line 1\n\nLine 2';
      const result = generateTranslationPlaceholder(input, 'pt');
      const lines = result.split('\n');
      expect(lines[1]).toBe('');
    });

    it('wraps list items preserving bullet prefix', () => {
      const input = '- First item\n- Second item\n* Third item';
      const result = generateTranslationPlaceholder(input, 'zh');
      expect(result).toContain('- [TRANSLATE:zh: First item]');
      expect(result).toContain('- [TRANSLATE:zh: Second item]');
      expect(result).toContain('* [TRANSLATE:zh: Third item]');
    });

    it('wraps numbered list items preserving number prefix', () => {
      const input = '1. First\n2. Second';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('1. [TRANSLATE:pt: First]');
      expect(result).toContain('2. [TRANSLATE:pt: Second]');
    });

    it('wraps blockquotes preserving > prefix', () => {
      const input = '> This is a quote';
      const result = generateTranslationPlaceholder(input, 'fr');
      expect(result).toBe('> [TRANSLATE:fr: This is a quote]');
    });

    it('preserves HTML comments as-is', () => {
      const input = '<!-- This is a comment -->';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toBe('<!-- This is a comment -->');
    });

    it('preserves table separator rows', () => {
      const input = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('|----------|----------|');
    });

    it('wraps table cell contents', () => {
      const input = '| Name | Description |\n|------|-------------|\n| AIOX | Framework |';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('[TRANSLATE:pt: Name]');
      expect(result).toContain('[TRANSLATE:pt: Description]');
      expect(result).toContain('[TRANSLATE:pt: AIOX]');
      expect(result).toContain('[TRANSLATE:pt: Framework]');
    });

    it('handles multiple code blocks correctly', () => {
      const input = 'Intro\n\n```js\nconst x = 1;\n```\n\nMiddle text\n\n```python\nprint("hi")\n```\n\nEnd text';
      const result = generateTranslationPlaceholder(input, 'pt');
      expect(result).toContain('[TRANSLATE:pt: Intro]');
      expect(result).toContain('const x = 1;');
      expect(result).toContain('[TRANSLATE:pt: Middle text]');
      expect(result).toContain('print("hi")');
      expect(result).toContain('[TRANSLATE:pt: End text]');
      // Code lines should NOT be wrapped
      expect(result).not.toContain('[TRANSLATE:pt: const x = 1;]');
      expect(result).not.toContain('[TRANSLATE:pt: print("hi")]');
    });

    it('handles indented list items', () => {
      const input = '  - Nested item';
      const result = generateTranslationPlaceholder(input, 'de');
      expect(result).toBe('  - [TRANSLATE:de: Nested item]');
    });
  });

  // ============================================================
  // generateDocs
  // ============================================================
  describe('generateDocs', () => {
    it('creates target directory and files', () => {
      const docsDir = tmpDir;
      const sourceDir = path.join(docsDir, 'en');
      writeFile(path.join(sourceDir, 'README.md'), '# Hello World');

      const result = generateDocs('en', 'pt', { docsDir, quiet: true });

      expect(result.created).toEqual(['README.md']);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);

      const targetFile = path.join(docsDir, 'pt', 'README.md');
      expect(fs.existsSync(targetFile)).toBe(true);

      const content = fs.readFileSync(targetFile, 'utf8');
      expect(content).toContain('[TRANSLATE:pt: Hello World]');
    });

    it('skips existing files by default', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'README.md'), '# Hello');
      writeFile(path.join(docsDir, 'pt', 'README.md'), '# Existing translation');

      const result = generateDocs('en', 'pt', { docsDir, quiet: true });

      expect(result.skipped).toEqual(['README.md']);
      expect(result.created).toEqual([]);

      // Original file should be preserved
      const content = fs.readFileSync(path.join(docsDir, 'pt', 'README.md'), 'utf8');
      expect(content).toBe('# Existing translation');
    });

    it('overwrites existing files when force=true', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'README.md'), '# New Content');
      writeFile(path.join(docsDir, 'pt', 'README.md'), '# Old translation');

      const result = generateDocs('en', 'pt', { docsDir, force: true, quiet: true });

      expect(result.created).toEqual(['README.md']);
      expect(result.skipped).toEqual([]);

      const content = fs.readFileSync(path.join(docsDir, 'pt', 'README.md'), 'utf8');
      expect(content).toContain('[TRANSLATE:pt: New Content]');
    });

    it('returns error for non-existent source directory', () => {
      const result = generateDocs('en', 'pt', { docsDir: tmpDir, quiet: true });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Source directory not found');
    });

    it('returns error for unsupported language', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'test.md'), '# Test');

      const result = generateDocs('en', 'xx', { docsDir, quiet: true });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unsupported language');
    });

    it('handles nested directory structure', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'guides', 'setup.md'), '# Setup Guide');
      writeFile(path.join(docsDir, 'en', 'api', 'rest.md'), '# REST API');

      const result = generateDocs('en', 'es', { docsDir, quiet: true });

      expect(result.created.length).toBe(2);
      expect(fs.existsSync(path.join(docsDir, 'es', 'guides', 'setup.md'))).toBe(true);
      expect(fs.existsSync(path.join(docsDir, 'es', 'api', 'rest.md'))).toBe(true);
    });

    it('returns empty result for source dir with no .md files', () => {
      const docsDir = tmpDir;
      const sourceDir = path.join(docsDir, 'en');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'data.json'), '{}', 'utf8');

      const result = generateDocs('en', 'pt', { docsDir, quiet: true });
      expect(result.created).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  // ============================================================
  // listTranslations
  // ============================================================
  describe('listTranslations', () => {
    it('lists source and translation docs', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'README.md'), '# Hello');
      writeFile(path.join(docsDir, 'pt', 'README.md'), '# Ola');

      const result = listTranslations({ docsDir, quiet: true });
      expect(result.source).toEqual(['README.md']);
      expect(result.translations.pt).toEqual(['README.md']);
    });

    it('returns empty when no translations exist', () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'README.md'), '# Hello');

      const result = listTranslations({ docsDir, quiet: true });
      expect(result.source).toEqual(['README.md']);
      expect(Object.keys(result.translations).length).toBe(0);
    });
  });

  // ============================================================
  // parseArgs
  // ============================================================
  describe('parseArgs', () => {
    it('parses generate subcommand with --lang', () => {
      const result = parseArgs(['generate', '--lang', 'pt']);
      expect(result.subcommand).toBe('generate');
      expect(result.lang).toBe('pt');
    });

    it('parses list subcommand', () => {
      const result = parseArgs(['list']);
      expect(result.subcommand).toBe('list');
    });

    it('parses --help flag', () => {
      const result = parseArgs(['--help']);
      expect(result.subcommand).toBe('help');
    });

    it('parses -h flag', () => {
      const result = parseArgs(['-h']);
      expect(result.subcommand).toBe('help');
    });

    it('parses --force and --quiet flags', () => {
      const result = parseArgs(['generate', '--lang', 'es', '--force', '--quiet']);
      expect(result.subcommand).toBe('generate');
      expect(result.lang).toBe('es');
      expect(result.force).toBe(true);
      expect(result.quiet).toBe(true);
    });

    it('parses --source flag', () => {
      const result = parseArgs(['generate', '--source', 'fr', '--lang', 'de']);
      expect(result.source).toBe('fr');
      expect(result.lang).toBe('de');
    });

    it('defaults to null subcommand with no args', () => {
      const result = parseArgs([]);
      expect(result.subcommand).toBeNull();
      expect(result.lang).toBeNull();
      expect(result.source).toBe('en');
      expect(result.force).toBe(false);
      expect(result.quiet).toBe(false);
    });
  });

  // ============================================================
  // runDocsGen (integration)
  // ============================================================
  describe('runDocsGen', () => {
    let originalCwd;
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
      originalCwd = process.cwd();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      process.exitCode = undefined;
    });

    afterEach(() => {
      process.chdir(originalCwd);
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      process.exitCode = undefined;
    });

    it('shows help with no arguments', async () => {
      await runDocsGen([]);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('AIOX Docs Generator');
    });

    it('shows help with --help flag', async () => {
      await runDocsGen(['--help']);
      const output = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('AIOX Docs Generator');
    });

    it('shows help with help subcommand', async () => {
      await runDocsGen(['help']);
      const output = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('USAGE');
    });

    it('errors when generate called without --lang', async () => {
      await runDocsGen(['generate']);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Missing required --lang option.');
      expect(process.exitCode).toBe(1);
    });

    it('errors for unsupported language in generate', async () => {
      await runDocsGen(['generate', '--lang', 'xx']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported language'));
      expect(process.exitCode).toBe(1);
    });

    it('runs generate for valid language', async () => {
      const docsDir = tmpDir;
      writeFile(path.join(docsDir, 'en', 'test.md'), '# Test Doc');
      process.chdir(docsDir);

      // Create a fake docs/ directory structure in cwd
      const cwdDocs = path.join(docsDir, 'docs', 'en');
      writeFile(path.join(cwdDocs, 'test.md'), '# Test Doc');

      await runDocsGen(['generate', '--lang', 'pt']);

      const output = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Portuguese');
    });

    it('runs list subcommand', async () => {
      const docsDir = path.join(tmpDir, 'docs');
      writeFile(path.join(docsDir, 'en', 'README.md'), '# Hello');
      process.chdir(tmpDir);

      await runDocsGen(['list']);

      const output = consoleLogSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Source docs');
    });
  });

  // ============================================================
  // SUPPORTED_LANGUAGES
  // ============================================================
  describe('SUPPORTED_LANGUAGES', () => {
    it('contains pt, es, zh', () => {
      expect(SUPPORTED_LANGUAGES).toHaveProperty('pt');
      expect(SUPPORTED_LANGUAGES).toHaveProperty('es');
      expect(SUPPORTED_LANGUAGES).toHaveProperty('zh');
    });

    it('has string display names', () => {
      for (const [, name] of Object.entries(SUPPORTED_LANGUAGES)) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });
});
