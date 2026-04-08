/**
 * Tests for Config Profiles & Environment Switching
 * Story 8.1
 *
 * @module tests/cli/profile
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let profileModule;
let tmpDir;

function makeTmpDir() {
  const dir = path.join(os.tmpdir(), `aiox-profile-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

beforeEach(() => {
  tmpDir = makeTmpDir();
  // Override process.cwd to point to our temp dir
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);

  // Fresh require each test to pick up cwd change
  jest.resetModules();
  profileModule = require('../../.aiox-core/cli/commands/profile/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// --- getProfilesDir ---

describe('getProfilesDir', () => {
  test('returns .aiox/profiles/ under cwd', () => {
    const result = profileModule.getProfilesDir();
    expect(result).toBe(path.join(tmpDir, '.aiox', 'profiles'));
  });
});

// --- getActiveProfileFile ---

describe('getActiveProfileFile', () => {
  test('returns .aiox/active-profile.json under cwd', () => {
    const result = profileModule.getActiveProfileFile();
    expect(result).toBe(path.join(tmpDir, '.aiox', 'active-profile.json'));
  });
});

// --- validateProfileName ---

describe('validateProfileName', () => {
  test('accepts valid alphanumeric name', () => {
    expect(profileModule.validateProfileName('production')).toEqual({ valid: true });
  });

  test('accepts name with dots and hyphens', () => {
    expect(profileModule.validateProfileName('my-app.staging')).toEqual({ valid: true });
  });

  test('accepts name with underscores', () => {
    expect(profileModule.validateProfileName('dev_local')).toEqual({ valid: true });
  });

  test('rejects empty string', () => {
    const result = profileModule.validateProfileName('');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  test('rejects null', () => {
    const result = profileModule.validateProfileName(null);
    expect(result.valid).toBe(false);
  });

  test('rejects name starting with hyphen', () => {
    const result = profileModule.validateProfileName('-invalid');
    expect(result.valid).toBe(false);
  });

  test('rejects name over 64 chars', () => {
    const result = profileModule.validateProfileName('a'.repeat(65));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/64/);
  });

  test('rejects name with spaces', () => {
    const result = profileModule.validateProfileName('has space');
    expect(result.valid).toBe(false);
  });

  test('rejects name with special chars', () => {
    const result = profileModule.validateProfileName('bad@name!');
    expect(result.valid).toBe(false);
  });
});

// --- listProfiles ---

describe('listProfiles', () => {
  test('returns empty array when profiles dir does not exist', () => {
    expect(profileModule.listProfiles()).toEqual([]);
  });

  test('returns empty array when profiles dir is empty', () => {
    fs.mkdirSync(profileModule.getProfilesDir(), { recursive: true });
    expect(profileModule.listProfiles()).toEqual([]);
  });

  test('lists profile names sorted alphabetically', () => {
    const dir = profileModule.getProfilesDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'staging.json'), '{}');
    fs.writeFileSync(path.join(dir, 'dev.json'), '{}');
    fs.writeFileSync(path.join(dir, 'production.json'), '{}');

    const result = profileModule.listProfiles();
    expect(result).toEqual(['dev', 'production', 'staging']);
  });

  test('ignores non-json files', () => {
    const dir = profileModule.getProfilesDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'dev.json'), '{}');
    fs.writeFileSync(path.join(dir, 'README.md'), 'hello');
    fs.writeFileSync(path.join(dir, '.gitkeep'), '');

    expect(profileModule.listProfiles()).toEqual(['dev']);
  });
});

// --- createProfile ---

describe('createProfile', () => {
  test('creates profile with default env', () => {
    const profile = profileModule.createProfile('dev');
    expect(profile.name).toBe('dev');
    expect(profile.env).toBe('development');
    expect(profile.created).toBeDefined();
    expect(profile.settings).toEqual({});

    // Verify file on disk
    const filePath = path.join(profileModule.getProfilesDir(), 'dev.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(onDisk.name).toBe('dev');
  });

  test('creates profile with custom env', () => {
    const profile = profileModule.createProfile('staging', { env: 'staging' });
    expect(profile.env).toBe('staging');
  });

  test('creates profile with settings', () => {
    const profile = profileModule.createProfile('custom', {
      env: 'production',
      settings: { debug: false, port: 8080 },
    });
    expect(profile.settings).toEqual({ debug: false, port: 8080 });
  });

  test('throws on duplicate name', () => {
    profileModule.createProfile('dev');
    expect(() => profileModule.createProfile('dev')).toThrow(/already exists/);
  });

  test('throws on invalid name', () => {
    expect(() => profileModule.createProfile('')).toThrow(/required/i);
    expect(() => profileModule.createProfile('-bad')).toThrow(/alphanumeric/i);
  });

  test('auto-creates profiles directory', () => {
    const dir = profileModule.getProfilesDir();
    expect(fs.existsSync(dir)).toBe(false);
    profileModule.createProfile('first');
    expect(fs.existsSync(dir)).toBe(true);
  });
});

// --- readProfile ---

describe('readProfile', () => {
  test('reads existing profile', () => {
    profileModule.createProfile('myprofile', { env: 'test', settings: { key: 'val' } });
    const data = profileModule.readProfile('myprofile');
    expect(data.name).toBe('myprofile');
    expect(data.env).toBe('test');
    expect(data.settings.key).toBe('val');
  });

  test('throws on non-existent profile', () => {
    expect(() => profileModule.readProfile('nope')).toThrow(/does not exist/);
  });

  test('throws on corrupt JSON', () => {
    const dir = profileModule.getProfilesDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'bad.json'), '{not valid json');
    expect(() => profileModule.readProfile('bad')).toThrow(/invalid JSON/);
  });

  test('throws on invalid name', () => {
    expect(() => profileModule.readProfile('')).toThrow(/required/i);
  });
});

// --- getActiveProfile / setActiveProfile ---

describe('getActiveProfile', () => {
  test('returns null when no active profile file', () => {
    expect(profileModule.getActiveProfile()).toBeNull();
  });

  test('returns null when file is empty', () => {
    const file = profileModule.getActiveProfileFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '', 'utf8');
    expect(profileModule.getActiveProfile()).toBeNull();
  });

  test('returns null when file has invalid JSON', () => {
    const file = profileModule.getActiveProfileFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'not json', 'utf8');
    expect(profileModule.getActiveProfile()).toBeNull();
  });

  test('returns null when JSON has no name field', () => {
    const file = profileModule.getActiveProfileFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"foo":"bar"}', 'utf8');
    expect(profileModule.getActiveProfile()).toBeNull();
  });
});

describe('setActiveProfile', () => {
  test('sets active profile successfully', () => {
    profileModule.createProfile('staging');
    profileModule.setActiveProfile('staging');
    expect(profileModule.getActiveProfile()).toBe('staging');
  });

  test('switches active profile', () => {
    profileModule.createProfile('dev');
    profileModule.createProfile('prod');
    profileModule.setActiveProfile('dev');
    expect(profileModule.getActiveProfile()).toBe('dev');
    profileModule.setActiveProfile('prod');
    expect(profileModule.getActiveProfile()).toBe('prod');
  });

  test('throws on non-existent profile', () => {
    expect(() => profileModule.setActiveProfile('ghost')).toThrow(/does not exist/);
  });

  test('throws on invalid name', () => {
    expect(() => profileModule.setActiveProfile('')).toThrow(/required/i);
  });
});

// --- runProfile CLI handler ---

describe('runProfile', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  test('--help prints usage', () => {
    profileModule.runProfile(['--help']);
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/USAGE/i);
  });

  test('-h prints usage', () => {
    profileModule.runProfile(['-h']);
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('no args prints help', () => {
    profileModule.runProfile([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('list shows no profiles message', () => {
    profileModule.runProfile(['list']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/No profiles found/);
  });

  test('list shows profiles with active marker', () => {
    profileModule.createProfile('dev');
    profileModule.createProfile('staging');
    profileModule.setActiveProfile('dev');

    consoleSpy.mockClear();
    profileModule.runProfile(['list']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/dev \(active\)/);
    expect(output).toMatch(/staging/);
    expect(output).toMatch(/2 profile\(s\)/);
  });

  test('create creates and confirms', () => {
    profileModule.runProfile(['create', 'myprofile']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/Created profile "myprofile"/);
  });

  test('create with --env flag', () => {
    profileModule.runProfile(['create', 'prod', '--env', 'production']);
    const profile = profileModule.readProfile('prod');
    expect(profile.env).toBe('production');
  });

  test('create without name shows error', () => {
    profileModule.runProfile(['create']);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test('use switches and confirms', () => {
    profileModule.createProfile('staging');
    consoleSpy.mockClear();
    profileModule.runProfile(['use', 'staging']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/Switched to profile "staging"/);
  });

  test('use without name shows error', () => {
    profileModule.runProfile(['use']);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test('use non-existent profile shows error', () => {
    profileModule.runProfile(['use', 'ghost']);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test('show displays active profile', () => {
    profileModule.createProfile('dev', { env: 'development', settings: { debug: true } });
    profileModule.setActiveProfile('dev');
    consoleSpy.mockClear();
    profileModule.runProfile(['show']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/Profile: dev/);
    expect(output).toMatch(/active/);
    expect(output).toMatch(/debug/);
  });

  test('show with explicit name', () => {
    profileModule.createProfile('staging', { env: 'staging' });
    consoleSpy.mockClear();
    profileModule.runProfile(['show', 'staging']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/Profile: staging/);
    expect(output).toMatch(/staging/);
  });

  test('show without active profile shows error', () => {
    profileModule.runProfile(['show']);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test('show profile with no settings shows (none)', () => {
    profileModule.createProfile('empty');
    consoleSpy.mockClear();
    profileModule.runProfile(['show', 'empty']);
    const output = consoleSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toMatch(/\(none\)/);
  });

  test('unknown subcommand shows error', () => {
    profileModule.runProfile(['foobar']);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
