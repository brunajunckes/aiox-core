#!/usr/bin/env node

/**
 * AIOX Framework Status Monitor
 * Checks constitution compliance, agent status, and framework integrity.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.AIOX_ROOT || '/root';

function checkConstitution() {
  const path = join(ROOT, '.aiox-core/constitution.md');
  if (!existsSync(path)) return { exists: false, articles: 0 };

  const content = readFileSync(path, 'utf-8');
  const articles = (content.match(/### [IVX]+\./g) || []).length;
  return { exists: true, articles, version: content.match(/Version:\*\* ([\d.]+)/)?.[1] || 'unknown' };
}

function checkAgents() {
  const rulesDir = join(ROOT, 'Aiox/.claude/rules');
  if (!existsSync(rulesDir)) return [];

  const authorityFile = join(rulesDir, 'agent-authority.md');
  if (!existsSync(authorityFile)) return [];

  const content = readFileSync(authorityFile, 'utf-8');
  const agents = content.match(/@\w+/g) || [];
  return [...new Set(agents)];
}

function checkStories() {
  const storiesDir = join(ROOT, 'docs/stories');
  if (!existsSync(storiesDir)) return [];

  return readdirSync(storiesDir)
    .filter(f => f.endsWith('.story.md'))
    .map(f => {
      const content = readFileSync(join(storiesDir, f), 'utf-8');
      const isDone = /\[x\] Done/i.test(content);
      const isInProgress = /\[x\] InProgress/i.test(content);
      return {
        file: f,
        status: isDone ? 'Done' : isInProgress ? 'InProgress' : 'Pending',
      };
    });
}

function checkFrameworkIntegrity() {
  const checks = [
    { name: 'Constitution', path: '.aiox-core/constitution.md' },
    { name: 'Core Config', path: '.aiox-core/core-config.yaml' },
    { name: 'CLAUDE.md', path: 'Aiox/.claude/CLAUDE.md' },
    { name: 'Agent Rules', path: 'Aiox/.claude/rules/agent-authority.md' },
    { name: 'Story Lifecycle', path: 'Aiox/.claude/rules/story-lifecycle.md' },
    { name: 'Package.json', path: '.aiox-core/package.json' },
  ];

  return checks.map(c => ({
    name: c.name,
    exists: existsSync(join(ROOT, c.path)),
  }));
}

function run() {
  console.log('='.repeat(50));
  console.log(' AIOX Framework Status');
  console.log(' Date:', new Date().toISOString());
  console.log('='.repeat(50));

  const constitution = checkConstitution();
  console.log(`\n Constitution: ${constitution.exists ? '✅' : '❌'} v${constitution.version} (${constitution.articles} articles)`);

  const agents = checkAgents();
  console.log(` Agents: ${agents.length} defined — ${agents.join(', ')}`);

  const stories = checkStories();
  console.log('\n Stories:');
  for (const s of stories) {
    const icon = s.status === 'Done' ? '✅' : s.status === 'InProgress' ? '🔄' : '⏳';
    console.log(`  ${icon} ${s.file} — ${s.status}`);
  }

  const integrity = checkFrameworkIntegrity();
  console.log('\n Framework Integrity:');
  for (const i of integrity) {
    console.log(`  ${i.exists ? '✅' : '❌'} ${i.name}`);
  }

  const allIntact = integrity.every(i => i.exists);
  console.log(`\n Overall: ${allIntact ? '✅ INTACT' : '⚠️  MISSING COMPONENTS'}`);
  console.log('='.repeat(50));
}

run();
