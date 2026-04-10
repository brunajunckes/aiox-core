/**
 * Logger Module Tests
 *
 * @module core/logger/__tests__/logger.test.js
 */

const { createLogger, LOG_LEVELS } = require('../logger');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Logger', () => {
  let tempDir;
  let logger;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-logger-test-'));
    logger = createLogger('test', { logsDir: tempDir, minLevel: 'debug' });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createLogger()', () => {
    it('should create a logger with default options', () => {
      const log = createLogger('app');
      expect(log).toBeDefined();
      expect(log.getName()).toBe('app');
      expect(log.getLevel()).toBe('info');
    });

    it('should throw if name is empty', () => {
      expect(() => createLogger('')).toThrow('Logger name must be a non-empty string');
      expect(() => createLogger(null)).toThrow('Logger name must be a non-empty string');
    });

    it('should throw if minLevel is invalid', () => {
      expect(() => createLogger('app', { minLevel: 'invalid' })).toThrow('Invalid log level');
    });

    it('should create logs directory if not exists', () => {
      const logsDir = path.join(tempDir, 'my', 'logs');
      createLogger('app', { logsDir });
      expect(fs.existsSync(logsDir)).toBe(true);
    });

    it('should set custom log level', () => {
      const log = createLogger('app', { minLevel: 'warn' });
      expect(log.getLevel()).toBe('warn');
    });
  });

  describe('log levels', () => {
    it('should store log entries for all levels', () => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].level).toBe('debug');
      expect(logs[1].level).toBe('info');
      expect(logs[2].level).toBe('warn');
      expect(logs[3].level).toBe('error');
    });

    it('should respect minimum log level', () => {
      const log = createLogger('test', { logsDir: tempDir, minLevel: 'warn' });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      const logs = log.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
    });

    it('should filter out logs below minimum level', () => {
      const log = createLogger('test', { logsDir: tempDir, minLevel: 'error' });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      const logs = log.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('log methods', () => {
    it('should log with debug method', () => {
      logger.debug('test debug');
      const logs = logger.getLogs();
      expect(logs[0].level).toBe('debug');
      expect(logs[0].message).toBe('test debug');
    });

    it('should log with info method', () => {
      logger.info('test info');
      const logs = logger.getLogs();
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('test info');
    });

    it('should log with warn method', () => {
      logger.warn('test warn');
      const logs = logger.getLogs();
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('test warn');
    });

    it('should log with error method', () => {
      logger.error('test error');
      const logs = logger.getLogs();
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('test error');
    });

    it('should log generic with log method', () => {
      logger.log('info', 'generic log');
      const logs = logger.getLogs();
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('generic log');
    });

    it('should throw on invalid level in log method', () => {
      expect(() => logger.log('invalid', 'message')).toThrow('Invalid log level');
    });
  });

  describe('metadata', () => {
    it('should attach metadata to log entries', () => {
      logger.info('message', { user: 'alice', action: 'login' });
      const logs = logger.getLogs();
      expect(logs[0].meta).toEqual({ user: 'alice', action: 'login' });
    });

    it('should omit meta key if no metadata', () => {
      logger.info('message');
      const logs = logger.getLogs();
      expect(logs[0].meta).toBeUndefined();
    });

    it('should support empty metadata object', () => {
      logger.info('message', {});
      const logs = logger.getLogs();
      expect(logs[0].meta).toBeUndefined();
    });
  });

  describe('setLevel()', () => {
    it('should change the minimum log level', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });

    it('should throw on invalid level', () => {
      expect(() => logger.setLevel('invalid')).toThrow('Invalid log level');
    });
  });

  describe('getLogs()', () => {
    beforeEach(() => {
      logger.debug('debug 1', { id: 1 });
      logger.info('info 1', { id: 2 });
      logger.warn('warn 1', { id: 3 });
      logger.error('error 1', { id: 4 });
    });

    it('should return all logs', () => {
      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
    });

    it('should filter by level', () => {
      const logs = logger.getLogs({ level: 'warn' });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });

    it('should throw on invalid filter level', () => {
      expect(() => logger.getLogs({ level: 'invalid' })).toThrow('Invalid filter level');
    });

    it('should filter by since timestamp', () => {
      const allLogs = logger.getLogs();
      const thirdTimestamp = allLogs[2].timestamp;

      const logs = logger.getLogs({ since: thirdTimestamp });
      // Should include the third log and later (>= comparison in the implementation)
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit results', () => {
      const logs = logger.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
      // limit should return the last N items
      expect(logs[0].message).toBe('warn 1');
      expect(logs[1].message).toBe('error 1');
    });

    it('should combine multiple filters', () => {
      const logs = logger.getLogs({ level: 'warn', limit: 10 });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });
  });

  describe('clearLogs()', () => {
    it('should clear all in-memory logs', () => {
      logger.info('message 1');
      logger.info('message 2');
      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should not affect file logs', () => {
      logger.info('message 1');
      const logFile = logger.getLogFilePath();
      expect(fs.existsSync(logFile)).toBe(true);

      logger.clearLogs();
      expect(fs.existsSync(logFile)).toBe(true);
    });
  });

  describe('file persistence', () => {
    it('should write logs to JSONL file', () => {
      logger.info('test message', { key: 'value' });
      const logFile = logger.getLogFilePath();

      const content = fs.readFileSync(logFile, 'utf-8');
      const parsed = JSON.parse(content.trim());
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.meta.key).toBe('value');
    });

    it('should append multiple entries to file', () => {
      logger.info('message 1');
      logger.info('message 2');
      logger.info('message 3');

      const logFile = logger.getLogFilePath();
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[0]).message).toBe('message 1');
      expect(JSON.parse(lines[1]).message).toBe('message 2');
      expect(JSON.parse(lines[2]).message).toBe('message 3');
    });

    it('should include timestamp in log entry', () => {
      const before = new Date();
      logger.info('message');
      const after = new Date();

      const logs = logger.getLogs();
      const timestamp = new Date(logs[0].timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include logger name in log entry', () => {
      const log = createLogger('myapp', { logsDir: tempDir, minLevel: 'debug' });
      log.info('message');

      const logs = log.getLogs();
      expect(logs[0].logger).toBe('myapp');
    });
  });

  describe('getLogFilePath()', () => {
    it('should return the log file path', () => {
      const logPath = logger.getLogFilePath();
      expect(logPath).toContain('test.log');
    });
  });

  describe('getName()', () => {
    it('should return the logger name', () => {
      const log = createLogger('mylogger', { logsDir: tempDir });
      expect(log.getName()).toBe('mylogger');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in messages', () => {
      logger.info('message with "quotes" and \\ backslash');
      const logs = logger.getLogs();
      expect(logs[0].message).toBe('message with "quotes" and \\ backslash');
    });

    it('should handle unicode in messages', () => {
      logger.info('message with emoji 🚀 and unicode ñ');
      const logs = logger.getLogs();
      expect(logs[0].message).toContain('🚀');
    });

    it('should handle null/undefined in metadata', () => {
      logger.info('message', { nullValue: null, undefinedValue: undefined });
      const logs = logger.getLogs();
      expect(logs[0].meta.nullValue).toBeNull();
      expect(logs[0].meta.undefinedValue).toBeUndefined();
    });

    it('should handle large metadata objects', () => {
      const largeObj = {};
      for (let i = 0; i < 100; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }
      logger.info('message', largeObj);
      const logs = logger.getLogs();
      expect(Object.keys(logs[0].meta)).toHaveLength(100);
    });
  });
});
