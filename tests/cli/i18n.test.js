/**
 * Tests for i18n Command Module
 *
 * @module tests/cli/i18n
 * @story 34.4 - i18n Support (PT-BR Priority)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const originalCwd = process.cwd;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-i18n-test-'));
  process.cwd = () => tmpDir;
});

afterEach(() => {
  process.cwd = originalCwd;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) { /* ignore */ }
});

const mod = require('../../.aiox-core/cli/commands/i18n/index.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeTranslation(lang, data) {
  const dir = path.join(tmpDir, '.aiox-core', 'data', 'i18n');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${lang}.json`),
    JSON.stringify(data),
    'utf8'
  );
}

function writeConfig(config) {
  const dir = path.join(tmpDir, '.aiox');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify(config),
    'utf8'
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('DEFAULT_LANG is en', () => {
    expect(mod.DEFAULT_LANG).toBe('en');
  });

  test('SUPPORTED_LANGS includes en, pt-br, es', () => {
    expect(mod.SUPPORTED_LANGS).toContain('en');
    expect(mod.SUPPORTED_LANGS).toContain('pt-br');
    expect(mod.SUPPORTED_LANGS).toContain('es');
  });
});

// ── Path Helpers ──────────────────────────────────────────────────────────────

describe('getI18nDir', () => {
  test('returns i18n dir path', () => {
    expect(mod.getI18nDir()).toContain(path.join('.aiox-core', 'data', 'i18n'));
  });
});

describe('getTranslationFile', () => {
  test('returns lang.json path', () => {
    expect(mod.getTranslationFile('en')).toContain('en.json');
    expect(mod.getTranslationFile('pt-br')).toContain('pt-br.json');
  });
});

// ── getCurrentLang ────────────────────────────────────────────────────────────

describe('getCurrentLang', () => {
  test('returns default when no config', () => {
    expect(mod.getCurrentLang()).toBe('en');
  });

  test('returns configured language', () => {
    writeConfig({ language: 'pt-br' });
    expect(mod.getCurrentLang()).toBe('pt-br');
  });

  test('returns default on corrupt config', () => {
    const dir = path.join(tmpDir, '.aiox');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), 'BAD', 'utf8');
    expect(mod.getCurrentLang()).toBe('en');
  });
});

// ── setLang ───────────────────────────────────────────────────────────────────

describe('setLang', () => {
  test('sets valid language', () => {
    const result = mod.setLang('pt-br');
    expect(result.success).toBe(true);
    expect(mod.getCurrentLang()).toBe('pt-br');
  });

  test('rejects unsupported language', () => {
    const result = mod.setLang('fr');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported');
  });

  test('rejects empty input', () => {
    const result = mod.setLang('');
    expect(result.success).toBe(false);
  });

  test('normalizes to lowercase', () => {
    const result = mod.setLang('PT-BR');
    expect(result.success).toBe(true);
    expect(mod.getCurrentLang()).toBe('pt-br');
  });

  test('preserves existing config keys', () => {
    writeConfig({ metrics: { enabled: true } });
    mod.setLang('es');
    const raw = fs.readFileSync(path.join(tmpDir, '.aiox', 'config.json'), 'utf8');
    const config = JSON.parse(raw);
    expect(config.language).toBe('es');
    expect(config.metrics.enabled).toBe(true);
  });
});

// ── loadTranslations ──────────────────────────────────────────────────────────

describe('loadTranslations', () => {
  test('loads translation file', () => {
    writeTranslation('en', { common: { yes: 'Yes' } });
    const t = mod.loadTranslations('en');
    expect(t.common.yes).toBe('Yes');
  });

  test('falls back to English when language file missing', () => {
    writeTranslation('en', { common: { yes: 'Yes' } });
    const t = mod.loadTranslations('pt-br');
    expect(t.common.yes).toBe('Yes');
  });

  test('returns empty object when no files exist', () => {
    const t = mod.loadTranslations('en');
    expect(t).toEqual({});
  });
});

// ── t (translate) ─────────────────────────────────────────────────────────────

describe('t', () => {
  beforeEach(() => {
    writeTranslation('en', {
      common: { yes: 'Yes', no: 'No' },
      errors: { not_found: 'Not found' },
    });
    writeTranslation('pt-br', {
      common: { yes: 'Sim', no: 'Nao' },
      errors: { not_found: 'Nao encontrado' },
    });
  });

  test('translates dot-notation key in English', () => {
    expect(mod.t('common.yes', 'en')).toBe('Yes');
  });

  test('translates dot-notation key in Portuguese', () => {
    expect(mod.t('common.yes', 'pt-br')).toBe('Sim');
  });

  test('translates nested key', () => {
    expect(mod.t('errors.not_found', 'pt-br')).toBe('Nao encontrado');
  });

  test('returns key itself when not found', () => {
    expect(mod.t('nonexistent.key', 'en')).toBe('nonexistent.key');
  });

  test('uses current lang when not specified', () => {
    writeConfig({ language: 'pt-br' });
    expect(mod.t('common.no')).toBe('Nao');
  });
});

// ── countKeys ─────────────────────────────────────────────────────────────────

describe('countKeys', () => {
  test('counts flat keys', () => {
    expect(mod.countKeys({ a: '1', b: '2', c: '3' })).toBe(3);
  });

  test('counts nested keys', () => {
    expect(mod.countKeys({ a: { b: '1', c: '2' }, d: '3' })).toBe(3);
  });

  test('returns 0 for empty object', () => {
    expect(mod.countKeys({})).toBe(0);
  });
});

// ── listLanguages ─────────────────────────────────────────────────────────────

describe('listLanguages', () => {
  test('lists all supported languages', () => {
    const langs = mod.listLanguages();
    expect(langs).toHaveLength(3);
    expect(langs.map(l => l.code)).toEqual(['en', 'pt-br', 'es']);
  });

  test('marks available languages', () => {
    writeTranslation('en', { a: '1', b: '2' });
    const langs = mod.listLanguages();
    const en = langs.find(l => l.code === 'en');
    expect(en.available).toBe(true);
    expect(en.keys).toBe(2);

    const ptbr = langs.find(l => l.code === 'pt-br');
    expect(ptbr.available).toBe(false);
    expect(ptbr.keys).toBe(0);
  });
});

// ── exportTranslations ────────────────────────────────────────────────────────

describe('exportTranslations', () => {
  test('exports current translations', () => {
    writeTranslation('en', { common: { yes: 'Yes' } });
    const exp = mod.exportTranslations('en');
    expect(exp.language).toBe('en');
    expect(exp.translations.common.yes).toBe('Yes');
    expect(exp.keyCount).toBe(1);
    expect(exp.exportedAt).toBeDefined();
  });

  test('exports empty when no translations', () => {
    const exp = mod.exportTranslations('en');
    expect(exp.keyCount).toBe(0);
  });
});

// ── runI18n ───────────────────────────────────────────────────────────────────

describe('runI18n', () => {
  let logSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('no args shows current config', () => {
    mod.runI18n([]);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('i18n Configuration');
    expect(output).toContain('en');
  });

  test('set changes language', () => {
    mod.runI18n(['set', 'pt-br']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('pt-br');
  });

  test('set rejects invalid language', () => {
    mod.runI18n(['set', 'klingon']);
    expect(errSpy).toHaveBeenCalled();
  });

  test('set without lang shows error', () => {
    mod.runI18n(['set']);
    expect(errSpy).toHaveBeenCalled();
  });

  test('list shows available languages', () => {
    mod.runI18n(['list']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Available Languages');
    expect(output).toContain('en');
    expect(output).toContain('pt-br');
    expect(output).toContain('es');
  });

  test('export outputs JSON', () => {
    writeTranslation('en', { test: 'value' });
    mod.runI18n(['export']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('language');
    expect(output).toContain('keyCount');
  });

  test('help shows usage', () => {
    mod.runI18n(['help']);
    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Usage');
  });
});
