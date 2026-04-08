#!/usr/bin/env node

/**
 * AIOX Constitutional Compliance Test Suite
 * Runs all 6 article compliance tests and generates a report.
 *
 * Usage: node --test tests/compliance/suite.js
 * Or:    node tests/compliance/suite.js
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const testFiles = readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log('='.repeat(60));
console.log(' AIOX Constitutional Compliance Report');
console.log(' Date:', new Date().toISOString());
console.log('='.repeat(60));
console.log();

let passed = 0;
let failed = 0;
const results = [];

for (const file of testFiles) {
  const filePath = join(__dirname, file);
  const articleMatch = file.match(/article-(\d)/);
  const articleNum = articleMatch ? articleMatch[1] : '?';

  try {
    execSync(`node --test "${filePath}"`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    passed++;
    results.push({ article: articleNum, file, status: 'PASS' });
    console.log(`  [PASS] Article ${articleNum}: ${file}`);
  } catch (err) {
    failed++;
    const output = err.stdout?.toString() || err.stderr?.toString() || '';
    results.push({ article: articleNum, file, status: 'FAIL', output });
    console.log(`  [FAIL] Article ${articleNum}: ${file}`);
    if (output) {
      const failLines = output.split('\n').filter(l => l.includes('not ok') || l.includes('AssertionError'));
      failLines.slice(0, 3).forEach(l => console.log(`         ${l.trim()}`));
    }
  }
}

console.log();
console.log('-'.repeat(60));
console.log(` Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(` Compliance: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
