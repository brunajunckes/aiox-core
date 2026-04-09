/**
 * DNS Lookup Command Module
 *
 * Resolve DNS records for a domain.
 *
 * Usage:
 *   aiox dns-lookup <domain>             — shows A, AAAA, MX, NS, TXT records
 *   aiox dns-lookup <domain> --type A    — specific record type
 *   aiox dns-lookup <domain> --format json — output as JSON
 *   aiox dns-lookup <domain> --all       — all record types
 *
 * @module cli/commands/dns-lookup
 * @version 1.0.0
 * @story 30.4 — DNS Lookup
 */

'use strict';

const dns = require('dns');
const dnsPromises = dns.promises;

// ── Constants ───────────────────────────────────────────────────────────────

const ALL_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'SRV'];
const DEFAULT_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT'];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments for dns-lookup command.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const result = { domain: null, type: null, format: 'text', all: false };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) {
      result.type = argv[++i].toUpperCase();
    } else if (arg === '--format' && argv[i + 1]) {
      result.format = argv[++i];
    } else if (arg === '--all') {
      result.all = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) result.domain = positional[0];
  return result;
}

/**
 * Resolve a single DNS record type.
 * @param {string} domain
 * @param {string} type
 * @returns {Promise<{type: string, records: any[], error: string|null}>}
 */
async function resolveType(domain, type) {
  try {
    let records;
    switch (type) {
      case 'A':
        records = await dnsPromises.resolve4(domain);
        break;
      case 'AAAA':
        records = await dnsPromises.resolve6(domain);
        break;
      case 'MX':
        records = await dnsPromises.resolveMx(domain);
        break;
      case 'NS':
        records = await dnsPromises.resolveNs(domain);
        break;
      case 'TXT':
        records = await dnsPromises.resolveTxt(domain);
        break;
      case 'CNAME':
        records = await dnsPromises.resolveCname(domain);
        break;
      case 'SOA':
        records = [await dnsPromises.resolveSoa(domain)];
        break;
      case 'SRV':
        records = await dnsPromises.resolveSrv(domain);
        break;
      default:
        return { type, records: [], error: `Unsupported type: ${type}` };
    }
    return { type, records: records || [], error: null };
  } catch (err) {
    return { type, records: [], error: err.code || err.message };
  }
}

/**
 * Resolve multiple DNS record types for a domain.
 * @param {string} domain
 * @param {string[]} types
 * @returns {Promise<object>}
 */
async function dnsLookup(domain, types) {
  const start = Date.now();
  const results = await Promise.all(
    types.map(type => resolveType(domain, type))
  );
  const elapsed = Date.now() - start;

  const withRecords = results.filter(r => r.records.length > 0);
  const withErrors = results.filter(r => r.error !== null);

  return {
    domain,
    types,
    elapsed,
    totalRecords: withRecords.reduce((sum, r) => sum + r.records.length, 0),
    results,
    resolved: withRecords.length,
    errors: withErrors.length,
  };
}

/**
 * Format DNS results as text.
 * @param {object} data
 * @returns {string}
 */
function formatText(data) {
  const lines = [];
  lines.push(`DNS LOOKUP ${data.domain}`);
  lines.push(`Queried ${data.types.length} record types in ${data.elapsed}ms`);
  lines.push('');

  for (const r of data.results) {
    if (r.error && r.records.length === 0) {
      lines.push(`  ${r.type.padEnd(6)} (${r.error})`);
      continue;
    }

    for (const record of r.records) {
      if (typeof record === 'string') {
        lines.push(`  ${r.type.padEnd(6)} ${record}`);
      } else if (Array.isArray(record)) {
        // TXT records are arrays of strings
        lines.push(`  ${r.type.padEnd(6)} ${record.join('')}`);
      } else if (record.exchange) {
        // MX record
        lines.push(`  ${r.type.padEnd(6)} ${record.priority} ${record.exchange}`);
      } else if (record.nsname) {
        // SOA record
        lines.push(`  ${r.type.padEnd(6)} ${record.nsname} ${record.hostmaster}`);
      } else if (record.name && record.port) {
        // SRV record
        lines.push(`  ${r.type.padEnd(6)} ${record.priority} ${record.weight} ${record.port} ${record.name}`);
      } else {
        lines.push(`  ${r.type.padEnd(6)} ${JSON.stringify(record)}`);
      }
    }
  }

  lines.push('');
  lines.push(`${data.totalRecords} records found`);

  return lines.join('\n');
}

/**
 * Format DNS results as JSON.
 * @param {object} data
 * @returns {string}
 */
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Main entry point for dns-lookup command.
 * @param {string[]} argv
 */
async function runDnsLookup(argv) {
  const opts = parseArgs(argv || []);

  if (!opts.domain) {
    console.error('Usage: aiox dns-lookup <domain> [--type A] [--all] [--format json]');
    process.exitCode = 1;
    return { error: 'No domain specified' };
  }

  let types;
  if (opts.type) {
    if (!ALL_TYPES.includes(opts.type)) {
      console.error(`Unsupported record type: ${opts.type}. Supported: ${ALL_TYPES.join(', ')}`);
      process.exitCode = 1;
      return { error: 'Unsupported type' };
    }
    types = [opts.type];
  } else if (opts.all) {
    types = ALL_TYPES;
  } else {
    types = DEFAULT_TYPES;
  }

  const data = await dnsLookup(opts.domain, types);

  if (opts.format === 'json') {
    console.log(formatJson(data));
  } else {
    console.log(formatText(data));
  }

  return data;
}

module.exports = {
  runDnsLookup,
  parseArgs,
  resolveType,
  dnsLookup,
  formatText,
  formatJson,
  ALL_TYPES,
  DEFAULT_TYPES,
};
