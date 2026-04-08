#!/usr/bin/env node

/**
 * AIOX Story Progress Tracker
 * Visualizes story progress across all active stories.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.AIOX_ROOT || '/root';

function parseStory(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const title = content.match(/^# (.+)/m)?.[1] || 'Untitled';
  const isDone = /[x] Done/i.test(content);
  const isInProgress = /[x] InProgress/i.test(content);
  const isDraft = /[x] Draft/i.test(content);
  const isReady = /[x] Ready/i.test(content);

  const status = isDone ? 'Done' : isInProgress ? 'InProgress' : isReady ? 'Ready' : isDraft ? 'Draft' : 'Unknown';

  // Count checkboxes
  const checked = (content.match(/- [x]/g) || []).length;
  const unchecked = (content.match(/- [ ]/g) || []).length;
  const total = checked + unchecked;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  // Extract agent
  const agent = content.match(/## Agent
(.+)/)?.[1]?.trim() || 'unassigned';

  // Extract story points
  const points = content.match(/Story Points:** (d+)/)?.[1] || '?';

  return { title, status, checked, unchecked, total, progress, agent, points };
}

function renderBar(progress, width = 20) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + '] ' + progress + '%';
}

function run() {
  const storiesDir = join(ROOT, 'docs/stories');
  if (!existsSync(storiesDir)) {
    console.log('No stories directory found');
    return;
  }

  const files = readdirSync(storiesDir).filter(f => f.endsWith('.story.md')).sort();

  console.log('═'.repeat(70));
  console.log(' AIOX Story Progress Tracker');
  console.log(' Date:', new Date().toISOString());
  console.log('═'.repeat(70));

  let totalDone = 0;
  let totalInProgress = 0;
  let totalPending = 0;

  for (const file of files) {
    const story = parseStory(join(storiesDir, file));
    const statusIcon = story.status === 'Done' ? '✅' :
                       story.status === 'InProgress' ? '🔄' :
                       story.status === 'Ready' ? '📋' : '⏳';

    console.log();
    console.log(`  ${statusIcon} ${file}`);
    console.log(`     ${story.title}`);
    console.log(`     Status: ${story.status} | Agent: ${story.agent} | Points: ${story.points}`);
    console.log(`     Progress: ${renderBar(story.progress)} (${story.checked}/${story.total} tasks)`);

    if (story.status === 'Done') totalDone++;
    else if (story.status === 'InProgress') totalInProgress++;
    else totalPending++;
  }

  console.log();
  console.log('─'.repeat(70));
  console.log(`  Summary: ${totalDone} done | ${totalInProgress} in progress | ${totalPending} pending`);
  console.log(`  Total stories: ${files.length}`);
  console.log('═'.repeat(70));

  return { stories: files.length, done: totalDone, inProgress: totalInProgress, pending: totalPending };
}

run();
