/**
 * Config Profiles & Environment Switching
 *
 * Story 8.1: Config Profiles & Environment Switching
 * Manage named configuration profiles with environment-specific settings.
 *
 * Functions:
 *   getProfilesDir()        — returns path to `.aiox/profiles/`
 *   getActiveProfileFile()  — returns path to `.aiox/active-profile.json`
 *   listProfiles()          — lists all profile JSON files (names without extension)
 *   getActiveProfile()      — reads the currently active profile name (or null)
 *   setActiveProfile(name)  — writes active profile pointer
 *   createProfile(name, data) — creates a new profile file
 *   readProfile(name)       — reads and parses a profile's data
 *   runProfile(argv)        — CLI handler for `aiox profile` subcommands
 *
 * Profile schema: { name, env, created, settings: {} }
 *
 * @module cli/commands/profile
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

// --- Path helpers ---

/**
 * Returns the profiles directory path.
 * @returns {string}
 */
function getProfilesDir() {
  return path.join(process.cwd(), '.aiox', 'profiles');
}

/**
 * Returns the active profile pointer file path.
 * @returns {string}
 */
function getActiveProfileFile() {
  return path.join(process.cwd(), '.aiox', 'active-profile.json');
}

// --- Profile name validation ---

const PROFILE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

/**
 * Validate a profile name.
 * @param {string} name
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateProfileName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, reason: 'Profile name is required' };
  }
  if (name.length > 64) {
    return { valid: false, reason: 'Profile name must be 64 characters or fewer' };
  }
  if (!PROFILE_NAME_RE.test(name)) {
    return { valid: false, reason: 'Profile name must start with alphanumeric and contain only alphanumerics, dots, hyphens, or underscores' };
  }
  return { valid: true };
}

// --- Core functions ---

/**
 * List all profile names (without .json extension).
 * Returns empty array if directory does not exist.
 * @returns {string[]}
 */
function listProfiles() {
  const dir = getProfilesDir();
  if (!fs.existsSync(dir)) {
    return [];
  }
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Get the currently active profile name.
 * @returns {string|null}
 */
function getActiveProfile() {
  const file = getActiveProfileFile();
  try {
    if (!fs.existsSync(file)) {
      return null;
    }
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw || !raw.trim()) {
      return null;
    }
    const data = JSON.parse(raw);
    if (data && typeof data.name === 'string' && data.name.trim()) {
      return data.name.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set the active profile pointer.
 * @param {string} name - Profile name to activate
 * @throws {Error} If profile does not exist or name is invalid
 */
function setActiveProfile(name) {
  const check = validateProfileName(name);
  if (!check.valid) {
    throw new Error(check.reason);
  }

  // Verify profile exists
  const profilePath = path.join(getProfilesDir(), `${name}.json`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile "${name}" does not exist`);
  }

  const activeFile = getActiveProfileFile();
  const dir = path.dirname(activeFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify({ name, activatedAt: new Date().toISOString() }, null, 2);
  const tmpFile = `${activeFile}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, 'utf8');
  fs.renameSync(tmpFile, activeFile);
}

/**
 * Create a new profile.
 * @param {string} name - Profile name
 * @param {object} [data={}] - Additional profile data (env, settings)
 * @returns {object} The created profile object
 * @throws {Error} If name is invalid or profile already exists
 */
function createProfile(name, data = {}) {
  const check = validateProfileName(name);
  if (!check.valid) {
    throw new Error(check.reason);
  }

  const dir = getProfilesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const profilePath = path.join(dir, `${name}.json`);
  if (fs.existsSync(profilePath)) {
    throw new Error(`Profile "${name}" already exists`);
  }

  const profile = {
    name,
    env: data.env || 'development',
    created: new Date().toISOString(),
    settings: data.settings && typeof data.settings === 'object' ? { ...data.settings } : {},
  };

  const content = JSON.stringify(profile, null, 2);
  const tmpFile = `${profilePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, content, 'utf8');
  fs.renameSync(tmpFile, profilePath);

  return profile;
}

/**
 * Read a profile by name.
 * @param {string} name - Profile name
 * @returns {object} Parsed profile data
 * @throws {Error} If profile does not exist or is corrupt
 */
function readProfile(name) {
  const check = validateProfileName(name);
  if (!check.valid) {
    throw new Error(check.reason);
  }

  const profilePath = path.join(getProfilesDir(), `${name}.json`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile "${name}" does not exist`);
  }

  try {
    const raw = fs.readFileSync(profilePath, 'utf8');
    const data = JSON.parse(raw);
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Profile "${name}" contains invalid JSON`);
    }
    throw error;
  }
}

// --- CLI handler ---

/**
 * CLI handler for `aiox profile` subcommands.
 *
 * Subcommands:
 *   list              — List all profiles
 *   use <name>        — Switch active profile
 *   create <name>     — Create a new profile
 *   show [name]       — Show profile details (default: active)
 *   --help / -h       — Show help
 *
 * @param {string[]} argv - Arguments after `profile` command
 */
function runProfile(argv) {
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    printHelp();
    return;
  }

  switch (subcommand) {
    case 'list': {
      const profiles = listProfiles();
      const active = getActiveProfile();

      if (profiles.length === 0) {
        console.log('No profiles found. Create one with: aiox profile create <name>');
        return;
      }

      console.log('Profiles:\n');
      for (const name of profiles) {
        const marker = name === active ? ' (active)' : '';
        console.log(`  ${name}${marker}`);
      }
      console.log(`\n${profiles.length} profile(s) total`);
      break;
    }

    case 'use': {
      const name = argv[1];
      if (!name) {
        console.error('Usage: aiox profile use <name>');
        process.exitCode = 1;
        return;
      }
      try {
        setActiveProfile(name);
        console.log(`Switched to profile "${name}"`);
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'create': {
      const name = argv[1];
      if (!name) {
        console.error('Usage: aiox profile create <name>');
        process.exitCode = 1;
        return;
      }

      // Parse optional flags
      let env = 'development';
      for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--env' && argv[i + 1]) {
          env = argv[i + 1];
          i++;
        }
      }

      try {
        const profile = createProfile(name, { env });
        console.log(`Created profile "${profile.name}" (env: ${profile.env})`);
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
      }
      break;
    }

    case 'show': {
      const name = argv[1] || getActiveProfile();
      if (!name) {
        console.error('No active profile. Specify a name or set one with: aiox profile use <name>');
        process.exitCode = 1;
        return;
      }
      try {
        const profile = readProfile(name);
        const active = getActiveProfile();
        const isActive = name === active;

        console.log(`Profile: ${profile.name}${isActive ? ' (active)' : ''}`);
        console.log(`  Environment: ${profile.env || 'development'}`);
        console.log(`  Created:     ${profile.created || 'unknown'}`);

        const settingsKeys = Object.keys(profile.settings || {});
        if (settingsKeys.length > 0) {
          console.log('  Settings:');
          for (const key of settingsKeys) {
            console.log(`    ${key}: ${JSON.stringify(profile.settings[key])}`);
          }
        } else {
          console.log('  Settings:    (none)');
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
      }
      break;
    }

    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.log('Run "aiox profile --help" for usage');
      process.exitCode = 1;
  }
}

/**
 * Print help text for the profile command.
 */
function printHelp() {
  console.log(`
AIOX Config Profiles

USAGE:
  aiox profile list              List all profiles
  aiox profile use <name>        Switch active profile
  aiox profile create <name>     Create a new profile
  aiox profile show [name]       Show profile details (default: active)
  aiox profile --help            Show this help

OPTIONS:
  --env <env>     Set environment when creating (default: development)

EXAMPLES:
  aiox profile create staging --env staging
  aiox profile use staging
  aiox profile show
  aiox profile list
`.trim());
}

module.exports = {
  getProfilesDir,
  getActiveProfileFile,
  listProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  readProfile,
  runProfile,
  validateProfileName,
};
