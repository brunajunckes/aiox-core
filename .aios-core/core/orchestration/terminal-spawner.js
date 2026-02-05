/**
 * Terminal Spawner - Node.js wrapper for pm.sh
 *
 * Provides async API for spawning AIOS agents in separate terminals
 * to maintain clean context isolation during orchestration.
 *
 * Story 11.2: Bob Terminal Spawning
 *
 * @module core/orchestration/terminal-spawner
 * @version 1.0.0
 */

'use strict';

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Constants
const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Default spawn options
 * @type {Object}
 */
const DEFAULT_OPTIONS = {
  params: '',
  context: null,
  timeout: DEFAULT_TIMEOUT_MS,
  outputDir: os.tmpdir(),
  retries: MAX_RETRIES,
  debug: false,
};

/**
 * Context schema for agent execution
 * @typedef {Object} AgentContext
 * @property {string} story - Story file path or content
 * @property {string[]} files - Array of relevant file paths
 * @property {string} instructions - Additional instructions for the agent
 * @property {Object} metadata - Additional metadata
 */

/**
 * Spawn result object
 * @typedef {Object} SpawnResult
 * @property {boolean} success - Whether spawn was successful
 * @property {string} output - Agent output content
 * @property {string} outputFile - Path to output file
 * @property {number} duration - Execution duration in ms
 * @property {string} [error] - Error message if failed
 */

/**
 * Gets the path to the pm.sh script
 * @returns {string} Absolute path to pm.sh
 */
function getScriptPath() {
  return path.join(__dirname, '../../scripts/pm.sh');
}

/**
 * Validates spawn arguments
 * @param {string} agent - Agent ID
 * @param {string} task - Task to execute
 * @throws {Error} If arguments are invalid
 */
function validateArgs(agent, task) {
  if (!agent || typeof agent !== 'string') {
    throw new Error('Agent ID is required and must be a string');
  }

  if (!task || typeof task !== 'string') {
    throw new Error('Task is required and must be a string');
  }

  // Validate agent format (should be alphanumeric with optional hyphen)
  const agentPattern = /^[a-zA-Z][a-zA-Z0-9-]*$/;
  if (!agentPattern.test(agent)) {
    throw new Error(`Invalid agent ID format: ${agent}`);
  }

  // Validate task format
  const taskPattern = /^[a-zA-Z][a-zA-Z0-9-]*$/;
  if (!taskPattern.test(task)) {
    throw new Error(`Invalid task format: ${task}`);
  }
}

/**
 * Creates a temporary context file for the agent (Task 2.2)
 *
 * @param {AgentContext} context - Context data to pass to agent
 * @param {string} outputDir - Directory for temp files
 * @returns {Promise<string>} Path to created context file
 */
async function createContextFile(context, outputDir = os.tmpdir()) {
  if (!context) {
    return '';
  }

  // Validate context structure
  const validatedContext = {
    story: context.story || '',
    files: Array.isArray(context.files) ? context.files : [],
    instructions: context.instructions || '',
    metadata: context.metadata || {},
    createdAt: new Date().toISOString(),
  };

  const contextPath = path.join(outputDir, `aios-context-${Date.now()}.json`);
  await fs.writeFile(contextPath, JSON.stringify(validatedContext, null, 2));

  return contextPath;
}

/**
 * Polls for agent output completion (Task 3.2, 3.3)
 *
 * @param {string} outputFile - Path to output file
 * @param {number} timeout - Timeout in milliseconds
 * @param {boolean} debug - Enable debug logging
 * @returns {Promise<string>} Output content
 * @throws {Error} If timeout exceeded
 */
async function pollForOutput(outputFile, timeout = DEFAULT_TIMEOUT_MS, debug = false) {
  const startTime = Date.now();
  const lockFile = outputFile.replace('output', 'lock');

  if (debug) {
    console.log(`[TerminalSpawner] Polling for output: ${outputFile}`);
    console.log(`[TerminalSpawner] Lock file: ${lockFile}`);
  }

  while (Date.now() - startTime < timeout) {
    // Check if lock file is gone (agent finished)
    try {
      await fs.access(lockFile);
      // Lock still exists, wait and retry
      if (debug) {
        console.log(`[TerminalSpawner] Lock exists, waiting ${POLL_INTERVAL_MS}ms...`);
      }
      await sleep(POLL_INTERVAL_MS);
    } catch {
      // Lock gone, agent finished - read output
      if (debug) {
        console.log('[TerminalSpawner] Lock removed, reading output...');
      }

      try {
        const output = await fs.readFile(outputFile, 'utf8');
        return output;
      } catch (readError) {
        if (debug) {
          console.log(`[TerminalSpawner] Output file not found: ${readError.message}`);
        }
        return 'No output captured';
      }
    }
  }

  // Timeout - cleanup lock file if still exists
  try {
    await fs.unlink(lockFile);
  } catch {
    // Ignore cleanup errors
  }

  throw new Error(`Timeout waiting for agent output after ${timeout}ms`);
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Spawns an agent in a separate terminal (Task 4.1)
 *
 * Opens a new terminal window with the specified agent and task,
 * passing context if provided. Returns the agent's output after completion.
 *
 * @param {string} agent - Agent ID (e.g., 'dev', 'architect', 'qa')
 * @param {string} task - Task to execute (e.g., 'develop', 'review')
 * @param {Object} options - Spawn options
 * @param {string} [options.params=''] - Additional parameters
 * @param {AgentContext} [options.context=null] - Context data for agent
 * @param {number} [options.timeout=300000] - Timeout in ms (default: 5 min)
 * @param {string} [options.outputDir] - Directory for output files
 * @param {number} [options.retries=3] - Number of retry attempts
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Promise<SpawnResult>} Result with output and status
 *
 * @example
 * const result = await spawnAgent('dev', 'develop', {
 *   params: 'story-11.2',
 *   context: {
 *     story: 'docs/stories/active/11.2.story.md',
 *     files: ['src/index.js'],
 *     instructions: 'Focus on terminal spawning'
 *   },
 *   timeout: 600000 // 10 minutes
 * });
 */
async function spawnAgent(agent, task, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Validate arguments
  validateArgs(agent, task);

  // Create context file if needed (Task 2.2)
  let contextPath = '';
  if (opts.context) {
    contextPath = await createContextFile(opts.context, opts.outputDir);
    if (opts.debug) {
      console.log(`[TerminalSpawner] Created context file: ${contextPath}`);
    }
  }

  // Build command arguments
  const args = [agent, task];
  if (opts.params) {
    args.push(opts.params);
  }
  if (contextPath) {
    args.push('--context', contextPath);
  }

  // Get script path
  const scriptPath = getScriptPath();

  // Verify script exists
  if (!fsSync.existsSync(scriptPath)) {
    throw new Error(`pm.sh script not found at: ${scriptPath}`);
  }

  // Execute with retry logic (Task 4.2)
  let lastError;
  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      if (opts.debug) {
        console.log(`[TerminalSpawner] Attempt ${attempt}/${opts.retries}`);
        console.log(`[TerminalSpawner] Executing: bash ${scriptPath} ${args.join(' ')}`);
      }

      // Execute pm.sh
      const env = {
        ...process.env,
        AIOS_DEBUG: opts.debug ? 'true' : 'false',
        AIOS_OUTPUT_DIR: opts.outputDir,
      };

      const result = execSync(`bash "${scriptPath}" ${args.join(' ')}`, {
        encoding: 'utf8',
        timeout: opts.timeout,
        env,
      });

      // Get output file path from script output
      const outputFile = result.trim();

      if (opts.debug) {
        console.log(`[TerminalSpawner] Output file: ${outputFile}`);
      }

      // Poll for completion (Task 3.2, 3.3)
      const output = await pollForOutput(outputFile, opts.timeout, opts.debug);

      // Cleanup context file (Task 2.4)
      if (contextPath) {
        await fs.unlink(contextPath).catch(() => {});
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        output,
        outputFile,
        duration,
      };
    } catch (error) {
      lastError = error;
      if (opts.debug) {
        console.log(`[TerminalSpawner] Attempt ${attempt} failed: ${error.message}`);
      }

      if (attempt < opts.retries) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // Cleanup context file on failure
  if (contextPath) {
    await fs.unlink(contextPath).catch(() => {});
  }

  const duration = Date.now() - startTime;

  return {
    success: false,
    output: '',
    outputFile: '',
    duration,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Checks if the terminal spawner is available on this platform
 * @returns {boolean} True if spawning is supported
 */
function isSpawnerAvailable() {
  const platform = process.platform;
  return ['darwin', 'linux', 'win32'].includes(platform);
}

/**
 * Gets the current platform name
 * @returns {string} Platform name (macos, linux, windows, or unknown)
 */
function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      return 'unknown';
  }
}

/**
 * Cleans up old output and lock files (Task 2.4)
 *
 * @param {string} outputDir - Directory to clean
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns {Promise<number>} Number of files cleaned
 */
async function cleanupOldFiles(outputDir = os.tmpdir(), maxAgeMs = 3600000) {
  const now = Date.now();
  let cleaned = 0;

  try {
    const files = await fs.readdir(outputDir);
    const aiosFiles = files.filter(
      (f) => f.startsWith('aios-output-') || f.startsWith('aios-lock-') || f.startsWith('aios-context-'),
    );

    for (const file of aiosFiles) {
      const filePath = path.join(outputDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return cleaned;
}

module.exports = {
  // Main API
  spawnAgent,
  createContextFile,
  pollForOutput,

  // Utilities
  isSpawnerAvailable,
  getPlatform,
  cleanupOldFiles,
  getScriptPath,

  // Constants
  DEFAULT_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  MAX_RETRIES,
};
