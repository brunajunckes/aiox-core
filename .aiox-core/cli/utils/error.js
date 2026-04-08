'use strict';

/**
 * Error Catalog & Diagnostic Messages — Story 9.3
 *
 * Provides standardized error codes with formatted messages,
 * recovery suggestions, and a lookup API for the entire catalog.
 *
 * @module cli/utils/error
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ─── Catalog path ────────────────────────────────────────────────────────────

const CATALOG_PATH = path.resolve(__dirname, '..', '..', 'data', 'error-catalog.yaml');

// ─── Cache ───────────────────────────────────────────────────────────────────

let _catalogCache = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Loads and parses the error catalog YAML.
 * Results are cached after the first call.
 * @returns {Array<{code: string, message: string, suggestion: string, severity: string, category: string}>}
 */
function loadErrorCatalog() {
  if (_catalogCache) {
    return _catalogCache;
  }
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  const parsed = yaml.load(raw);
  _catalogCache = parsed.errors || [];
  return _catalogCache;
}

/**
 * Returns a single error entry by its code (e.g. "AIOX-E001").
 * @param {string} code
 * @returns {{code: string, message: string, suggestion: string, severity: string, category: string} | null}
 */
function getErrorInfo(code) {
  const catalog = loadErrorCatalog();
  return catalog.find((e) => e.code === code) || null;
}

/**
 * Returns the full list of error entries.
 * @returns {Array<{code: string, message: string, suggestion: string, severity: string, category: string}>}
 */
function listAllErrors() {
  return loadErrorCatalog();
}

/**
 * Throws an Error with a formatted diagnostic message.
 *
 * Output format:
 *   [AIOX-E001] Configuration file not found
 *     → Run 'aiox doctor' to diagnose or 'npx aiox-core install' to reinstall
 *     Run 'aiox explain AIOX-E001' for more details.
 *
 * @param {string} code  Error code from the catalog
 * @param {Record<string, unknown>} [context]  Optional context merged into the message
 * @throws {Error} Always throws
 */
function throwAioxError(code, context) {
  const entry = getErrorInfo(code);
  if (!entry) {
    throw new Error(`[${code}] Unknown error code`);
  }
  const contextStr = context ? `\n  Context: ${JSON.stringify(context)}` : '';
  const msg =
    `[${entry.code}] ${entry.message}${contextStr}\n` +
    `  → ${entry.suggestion}\n` +
    `  Run 'aiox explain ${entry.code}' for more details.`;
  throw new Error(msg);
}

/**
 * Formats an error entry for CLI display (without throwing).
 * @param {{code: string, message: string, suggestion: string, severity: string, category: string}} entry
 * @returns {string}
 */
function formatError(entry) {
  return (
    `[${entry.code}] ${entry.message}\n` +
    `  → ${entry.suggestion}\n` +
    `  Run 'aiox explain ${entry.code}' for more details.`
  );
}

/**
 * Resets the internal cache (useful for testing).
 */
function _resetCache() {
  _catalogCache = null;
}

module.exports = {
  loadErrorCatalog,
  getErrorInfo,
  listAllErrors,
  throwAioxError,
  formatError,
  _resetCache,
  CATALOG_PATH,
};
