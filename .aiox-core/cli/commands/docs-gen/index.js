/**
 * Docs Gen Command
 *
 * Multi-language documentation generator for AIOX.
 * Generates translation placeholders from English source docs.
 *
 * @module cli/commands/docs-gen
 * @version 1.0.0
 * @story 5.4 - Multi-language Documentation Generator
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Supported target languages with display names.
 */
const SUPPORTED_LANGUAGES = {
  pt: 'Portuguese',
  es: 'Spanish',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  it: 'Italian',
};

/**
 * Recursively list all .md files under a directory.
 * Returns paths relative to the given sourceDir.
 *
 * @param {string} sourceDir - Absolute path to source directory
 * @returns {string[]} Array of relative .md file paths
 */
function listSourceDocs(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(path.relative(sourceDir, fullPath));
      }
    }
  }

  walk(sourceDir);
  return results.sort();
}

/**
 * Check if a line is inside or starts a fenced code block.
 *
 * @param {string} line - The line to check
 * @param {boolean} inCodeBlock - Whether we are currently inside a code block
 * @returns {{ isCodeFence: boolean, inCodeBlock: boolean }}
 */
function checkCodeBlock(line, inCodeBlock) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('```')) {
    return { isCodeFence: true, inCodeBlock: !inCodeBlock };
  }
  return { isCodeFence: false, inCodeBlock };
}

/**
 * Generate translation placeholders for markdown content.
 * Wraps translatable text in [TRANSLATE:lang: ...] markers.
 * Preserves code blocks, empty lines, and markdown structure.
 *
 * @param {string} content - Original markdown content
 * @param {string} lang - Target language code (e.g., 'pt', 'es')
 * @returns {string} Content with translation placeholders
 */
function generateTranslationPlaceholder(content, lang) {
  const lines = content.split('\n');
  const outputLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for code block boundaries
    const codeCheck = checkCodeBlock(line, inCodeBlock);
    if (codeCheck.isCodeFence) {
      inCodeBlock = codeCheck.inCodeBlock;
      outputLines.push(line);
      continue;
    }

    // Inside code block: preserve as-is
    if (inCodeBlock) {
      outputLines.push(line);
      continue;
    }

    // Empty or whitespace-only lines: preserve
    if (line.trim() === '') {
      outputLines.push(line);
      continue;
    }

    // HTML comments: preserve as-is
    if (line.trim().startsWith('<!--')) {
      outputLines.push(line);
      continue;
    }

    // Headings: wrap the text portion only
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const prefix = headingMatch[1];
      const text = headingMatch[2];
      outputLines.push(`${prefix} [TRANSLATE:${lang}: ${text}]`);
      continue;
    }

    // List items: wrap the text portion, preserve the bullet/number prefix
    const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/);
    if (listMatch) {
      const prefix = listMatch[1];
      const text = listMatch[2];
      outputLines.push(`${prefix}[TRANSLATE:${lang}: ${text}]`);
      continue;
    }

    // Blockquotes: wrap inner text
    const blockquoteMatch = line.match(/^(>\s*)(.+)$/);
    if (blockquoteMatch) {
      const prefix = blockquoteMatch[1];
      const text = blockquoteMatch[2];
      outputLines.push(`${prefix}[TRANSLATE:${lang}: ${text}]`);
      continue;
    }

    // Table separator rows (|---|---| etc): preserve as-is
    if (/^\|[\s:|-]+\|$/.test(line.trim())) {
      outputLines.push(line);
      continue;
    }

    // Table rows: wrap cell contents
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|');
      const wrapped = cells.map((cell, idx) => {
        // First and last are empty from split
        if (idx === 0 || idx === cells.length - 1) return cell;
        const trimmedCell = cell.trim();
        if (trimmedCell === '') return cell;
        return ` [TRANSLATE:${lang}: ${trimmedCell}] `;
      });
      outputLines.push(wrapped.join('|'));
      continue;
    }

    // Regular paragraph text: wrap the whole line
    outputLines.push(`[TRANSLATE:${lang}: ${line}]`);
  }

  return outputLines.join('\n');
}

/**
 * Generate translated docs by copying structure from source to target with placeholders.
 *
 * @param {string} sourceLang - Source language code (default: 'en')
 * @param {string} targetLang - Target language code
 * @param {Object} [options={}] - Options
 * @param {string} [options.docsDir] - Base docs directory (default: docs/ in project root)
 * @param {boolean} [options.force] - Overwrite existing files (default: false)
 * @param {boolean} [options.quiet] - Suppress output (default: false)
 * @returns {{ created: string[], skipped: string[], errors: string[] }}
 */
function generateDocs(sourceLang, targetLang, options = {}) {
  const docsDir = options.docsDir || path.join(process.cwd(), 'docs');
  const sourceDir = path.join(docsDir, sourceLang);
  const targetDir = path.join(docsDir, targetLang);
  const force = options.force || false;
  const quiet = options.quiet || false;

  const result = { created: [], skipped: [], errors: [] };

  // Validate source directory exists
  if (!fs.existsSync(sourceDir)) {
    if (!quiet) {
      console.error(`Source directory not found: ${sourceDir}`);
    }
    result.errors.push(`Source directory not found: ${sourceDir}`);
    return result;
  }

  // Validate target language
  if (!SUPPORTED_LANGUAGES[targetLang]) {
    if (!quiet) {
      console.error(`Unsupported language: ${targetLang}`);
      console.log(`Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`);
    }
    result.errors.push(`Unsupported language: ${targetLang}`);
    return result;
  }

  // List source docs
  const sourceDocs = listSourceDocs(sourceDir);

  if (sourceDocs.length === 0) {
    if (!quiet) {
      console.log('No source documents found.');
    }
    return result;
  }

  for (const relPath of sourceDocs) {
    const sourcePath = path.join(sourceDir, relPath);
    const targetPath = path.join(targetDir, relPath);

    // Skip existing files unless force
    if (fs.existsSync(targetPath) && !force) {
      if (!quiet) {
        console.log(`  SKIP  ${relPath} (already exists)`);
      }
      result.skipped.push(relPath);
      continue;
    }

    try {
      // Read source content
      const content = fs.readFileSync(sourcePath, 'utf8');

      // Generate placeholders
      const translated = generateTranslationPlaceholder(content, targetLang);

      // Ensure target directory exists
      const targetSubDir = path.dirname(targetPath);
      if (!fs.existsSync(targetSubDir)) {
        fs.mkdirSync(targetSubDir, { recursive: true });
      }

      // Write target file
      fs.writeFileSync(targetPath, translated, 'utf8');

      if (!quiet) {
        console.log(`  CREATE  ${relPath}`);
      }
      result.created.push(relPath);
    } catch (error) {
      if (!quiet) {
        console.error(`  ERROR  ${relPath}: ${error.message}`);
      }
      result.errors.push(`${relPath}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Show help text for the docs command.
 */
function showDocsHelp() {
  console.log(`
AIOX Docs Generator - Multi-language documentation tool

USAGE:
  aiox docs generate --lang <code>   Generate translation placeholders
  aiox docs list                      List source docs and translations
  aiox docs --help                    Show this help

OPTIONS:
  --lang <code>    Target language code (pt, es, zh, ja, ko, fr, de, it)
  --source <code>  Source language (default: en)
  --force          Overwrite existing translation files
  --quiet          Suppress output

EXAMPLES:
  aiox docs generate --lang pt        Generate Portuguese placeholders
  aiox docs generate --lang es        Generate Spanish placeholders
  aiox docs generate --lang zh        Generate Chinese placeholders
  aiox docs list                      Show all docs and translations

SUPPORTED LANGUAGES:
  pt  Portuguese    es  Spanish    zh  Chinese
  ja  Japanese      ko  Korean     fr  French
  de  German        it  Italian
`);
}

/**
 * List command: show available source docs and existing translations.
 *
 * @param {Object} [options={}] - Options
 * @param {string} [options.docsDir] - Base docs directory
 * @param {boolean} [options.quiet] - Suppress styled output
 * @returns {{ source: string[], translations: Object<string, string[]> }}
 */
function listTranslations(options = {}) {
  const docsDir = options.docsDir || path.join(process.cwd(), 'docs');
  const sourceDir = path.join(docsDir, 'en');
  const sourceDocs = listSourceDocs(sourceDir);

  const translations = {};
  for (const langCode of Object.keys(SUPPORTED_LANGUAGES)) {
    const langDir = path.join(docsDir, langCode);
    if (fs.existsSync(langDir)) {
      translations[langCode] = listSourceDocs(langDir);
    }
  }

  if (!options.quiet) {
    console.log('\nSource docs (en):');
    if (sourceDocs.length === 0) {
      console.log('  No source documents found in docs/en/');
    } else {
      for (const doc of sourceDocs) {
        console.log(`  ${doc}`);
      }
    }

    console.log(`\nTranslations:`);
    const langCodes = Object.keys(translations);
    if (langCodes.length === 0) {
      console.log('  No translations found.');
    } else {
      for (const langCode of langCodes) {
        const docs = translations[langCode];
        console.log(`  ${langCode} (${SUPPORTED_LANGUAGES[langCode]}): ${docs.length} files`);
      }
    }
    console.log('');
  }

  return { source: sourceDocs, translations };
}

/**
 * Parse argv and extract options.
 *
 * @param {string[]} argv - Command arguments (after 'docs')
 * @returns {{ subcommand: string, lang: string, source: string, force: boolean, quiet: boolean }}
 */
function parseArgs(argv) {
  const result = {
    subcommand: null,
    lang: null,
    source: 'en',
    force: false,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === 'generate' || arg === 'list' || arg === 'help') {
      result.subcommand = arg;
    } else if (arg === '--lang' && i + 1 < argv.length) {
      result.lang = argv[++i];
    } else if (arg === '--source' && i + 1 < argv.length) {
      result.source = argv[++i];
    } else if (arg === '--force') {
      result.force = true;
    } else if (arg === '--quiet') {
      result.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      result.subcommand = 'help';
    }
  }

  return result;
}

/**
 * CLI handler for the docs command.
 *
 * @param {string[]} argv - Command arguments (after 'docs')
 * @returns {Promise<void>}
 */
async function runDocsGen(argv) {
  const opts = parseArgs(argv);

  switch (opts.subcommand) {
    case 'generate': {
      if (!opts.lang) {
        console.error('Missing required --lang option.');
        console.log('Usage: aiox docs generate --lang <code>');
        process.exitCode = 1;
        return;
      }

      if (!SUPPORTED_LANGUAGES[opts.lang]) {
        console.error(`Unsupported language: ${opts.lang}`);
        console.log(`Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      console.log(`\nGenerating ${SUPPORTED_LANGUAGES[opts.lang]} docs from ${opts.source}...\n`);

      const result = generateDocs(opts.source, opts.lang, {
        force: opts.force,
        quiet: opts.quiet,
      });

      if (!opts.quiet) {
        console.log(`\nDone: ${result.created.length} created, ${result.skipped.length} skipped, ${result.errors.length} errors`);
      }

      if (result.errors.length > 0) {
        process.exitCode = 1;
      }
      break;
    }

    case 'list': {
      listTranslations({ quiet: opts.quiet });
      break;
    }

    case 'help': {
      showDocsHelp();
      break;
    }

    default: {
      showDocsHelp();
      break;
    }
  }
}

module.exports = {
  listSourceDocs,
  generateTranslationPlaceholder,
  generateDocs,
  runDocsGen,
  listTranslations,
  parseArgs,
  showDocsHelp,
  SUPPORTED_LANGUAGES,
};
