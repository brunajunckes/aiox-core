/**
 * Logger Module - Barrel Export
 *
 * @module core/logger
 */

const { createLogger, LOG_LEVELS, LEVEL_NAMES, MAX_LOG_FILE_SIZE } = require('./logger');

module.exports = {
  createLogger,
  LOG_LEVELS,
  LEVEL_NAMES,
  MAX_LOG_FILE_SIZE,
};
