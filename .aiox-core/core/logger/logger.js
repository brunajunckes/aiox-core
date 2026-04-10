/**
 * Logger Module
 *
 * Provides leveled logging with file persistence (JSONL format).
 * Supports configurable log levels, metadata, and automatic file rotation.
 *
 * @module core/logger
 * @version 1.0.0
 * @story 16.3 - Logger with Levels
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Log levels: debug (0), info (1), warn (2), error (3)
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_NAMES = ['debug', 'info', 'warn', 'error'];

// Maximum log file size before rotation (10MB)
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Create a logger instance
 * @param {string} name - Logger name (used in log files and entries)
 * @param {object} options - Configuration options
 * @param {string} options.minLevel - Minimum log level (debug, info, warn, error) - default: info
 * @param {string} options.logsDir - Directory for log files - default: .aiox/logs
 * @returns {object} Logger instance with methods: debug, info, warn, error, log, setLevel, getLogs, clearLogs
 */
function createLogger(name, options = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('Logger name must be a non-empty string');
  }

  const minLevel = options.minLevel || 'info';
  if (!LOG_LEVELS.hasOwnProperty(minLevel)) {
    throw new Error(`Invalid log level: ${minLevel}. Must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`);
  }

  const logsDir = options.logsDir || path.join(process.cwd(), '.aiox', 'logs');
  const logFilePath = path.join(logsDir, `${name}.log`);

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  let currentMinLevel = LOG_LEVELS[minLevel];
  const logs = [];

  /**
   * Ensure log file doesn't exceed max size (rotate if needed)
   */
  function checkRotation() {
    if (!fs.existsSync(logFilePath)) {
      return;
    }

    try {
      const stats = fs.statSync(logFilePath);
      if (stats.size > MAX_LOG_FILE_SIZE) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${logFilePath}.${timestamp}`;
        fs.renameSync(logFilePath, backupPath);
      }
    } catch (err) {
      // Silently ignore rotation errors
    }
  }

  /**
   * Write log entry to file (JSONL format)
   */
  function writeToFile(entry) {
    try {
      checkRotation();
      fs.appendFileSync(logFilePath, JSON.stringify(entry) + '\n');
    } catch (err) {
      // Silently fail - don't throw on file write errors
    }
  }

  /**
   * Log a message at the specified level
   */
  function log(level, message, meta = {}) {
    if (typeof level !== 'string' || !LOG_LEVELS.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }

    const levelValue = LOG_LEVELS[level];

    // Skip if below minimum level
    if (levelValue < currentMinLevel) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      logger: name,
      message,
      ...(Object.keys(meta).length > 0 && { meta }),
    };

    logs.push(entry);
    writeToFile(entry);
  }

  // Convenience methods
  const logger = {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    log,

    /**
     * Set minimum log level
     * @param {string} level - New log level
     */
    setLevel(level) {
      if (!LOG_LEVELS.hasOwnProperty(level)) {
        throw new Error(`Invalid log level: ${level}`);
      }
      currentMinLevel = LOG_LEVELS[level];
    },

    /**
     * Get current minimum log level
     * @returns {string} Current log level
     */
    getLevel() {
      return LEVEL_NAMES[currentMinLevel];
    },

    /**
     * Get all logs (optionally filtered)
     * @param {object} filter - Filter options
     * @param {string} filter.level - Filter by level
     * @param {string} filter.since - Filter by timestamp (ISO string)
     * @param {number} filter.limit - Limit results to N entries
     * @returns {array} Array of log entries
     */
    getLogs(filter = {}) {
      let results = [...logs];

      if (filter.level) {
        if (!LOG_LEVELS.hasOwnProperty(filter.level)) {
          throw new Error(`Invalid filter level: ${filter.level}`);
        }
        results = results.filter(entry => entry.level === filter.level);
      }

      if (filter.since) {
        const sinceTime = new Date(filter.since).getTime();
        results = results.filter(entry => new Date(entry.timestamp).getTime() >= sinceTime);
      }

      if (filter.limit) {
        results = results.slice(-filter.limit);
      }

      return results;
    },

    /**
     * Clear all in-memory logs
     */
    clearLogs() {
      logs.length = 0;
    },

    /**
     * Get logger name
     * @returns {string} Logger name
     */
    getName() {
      return name;
    },

    /**
     * Get log file path
     * @returns {string} Full path to log file
     */
    getLogFilePath() {
      return logFilePath;
    },
  };

  return logger;
}

module.exports = {
  createLogger,
  LOG_LEVELS,
  LEVEL_NAMES,
  MAX_LOG_FILE_SIZE,
};
