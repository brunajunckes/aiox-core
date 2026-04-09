/**
 * Tests for Sprint Report Generator
 *
 * @module tests/cli/sprint-report
 * @story 14.2 — Sprint Report Generator
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  listStoryFiles,
  parseStoryFilename,
  extractStatus,
  extractTitle,
  parseAllStories,
  detectCurrentSprint,
  filterBySprint,
  calculateVelocity,
  groupStatuses,
  generateSprintReport,
  generateAllSprintsReport,
  formatSprintReport,
  formatAllSprintsReport,
  runSprintReport,
  getHelpText,
} = require('../../.aiox-core/cli/commands/sprint-report/index.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-report-test-'));
}

function writeStory(base, filename, content) {
  const dir = path.join(base, 'docs', 'stories');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content);
}

function makeStoryContent(title, status) {
  return `# ${title}\n\n## Status\n\n${status}\n`;
}

// ── parseStoryFilename ───────────────────────────────────────────────────────

describe('parseStoryFilename', () => {
  test('parses valid story filename', () => {
    expect(parseStoryFilename('14.2.story.md')).toEqual({ sprint: 14, story: 2 });
  });

  test('parses single digit', () => {
    expect(parseStoryFilename('1.1.story.md')).toEqual({ sprint: 1, story: 1 });
  });

  test('returns null for invalid filename', () => {
    expect(parseStoryFilename('readme.md')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseStoryFilename('')).toBeNull();
  });
});

// ── extractStatus ────────────────────────────────────────────────────────────

describe('extractStatus', () => {
  test('extracts status from content', () => {
    expect(extractStatus('# Title\n\n## Status\n\nDone\n')).toBe('Done');
  });

  test('extracts InReview', () => {
    expect(extractStatus('## Status\n\nInReview')).toBe('InReview');
  });

  test('returns Unknown for missing status', () => {
    expect(extractStatus('# Title\nNo status here')).toBe('Unknown');
  });

  test('returns Unknown for null', () => {
    expect(extractStatus(null)).toBe('Unknown');
  });
});

// ── extractTitle ─────────────────────────────────────────────────────────────

describe('extractTitle', () => {
  test('extracts title from content', () => {
    expect(extractTitle('# My Story Title\n\nBody')).toBe('My Story Title');
  });

  test('returns Untitled for missing heading', () => {
    expect(extractTitle('No heading')).toBe('Untitled');
  });

  test('returns Untitled for null', () => {
    expect(extractTitle(null)).toBe('Untitled');
  });
});

// ── listStoryFiles ───────────────────────────────────────────────────────────

describe('listStoryFiles', () => {
  test('lists only story files', () => {
    const tmp = makeTmpDir();
    const dir = path.join(tmp, 'stories');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '1.1.story.md'), '');
    fs.writeFileSync(path.join(dir, '1.2.story.md'), '');
    fs.writeFileSync(path.join(dir, 'README.md'), '');
    expect(listStoryFiles(dir)).toEqual(['1.1.story.md', '1.2.story.md']);
  });

  test('returns empty for nonexistent dir', () => {
    expect(listStoryFiles('/nonexistent')).toEqual([]);
  });
});

// ── parseAllStories ──────────────────────────────────────────────────────────

describe('parseAllStories', () => {
  test('parses stories with status and title', () => {
    const tmp = makeTmpDir();
    writeStory(tmp, '1.1.story.md', makeStoryContent('Init Project', 'Done'));
    writeStory(tmp, '1.2.story.md', makeStoryContent('Add Tests', 'InReview'));
    const stories = parseAllStories(path.join(tmp, 'docs', 'stories'));
    expect(stories.length).toBe(2);
    expect(stories[0].title).toBe('Init Project');
    expect(stories[0].status).toBe('Done');
    expect(stories[1].status).toBe('InReview');
  });
});

// ── detectCurrentSprint ──────────────────────────────────────────────────────

describe('detectCurrentSprint', () => {
  test('detects highest sprint number', () => {
    const stories = [
      { sprint: 1, story: 1 },
      { sprint: 3, story: 2 },
      { sprint: 2, story: 1 },
    ];
    expect(detectCurrentSprint(stories)).toBe(3);
  });

  test('returns 0 for empty', () => {
    expect(detectCurrentSprint([])).toBe(0);
  });
});

// ── filterBySprint ───────────────────────────────────────────────────────────

describe('filterBySprint', () => {
  test('filters stories by sprint number', () => {
    const stories = [
      { sprint: 1, story: 1 },
      { sprint: 2, story: 1 },
      { sprint: 1, story: 2 },
    ];
    expect(filterBySprint(stories, 1).length).toBe(2);
  });
});

// ── calculateVelocity ────────────────────────────────────────────────────────

describe('calculateVelocity', () => {
  test('counts Done and InReview stories', () => {
    const stories = [
      { status: 'Done' },
      { status: 'InReview' },
      { status: 'InProgress' },
    ];
    expect(calculateVelocity(stories)).toBe(2);
  });
});

// ── groupStatuses ────────────────────────────────────────────────────────────

describe('groupStatuses', () => {
  test('groups by status', () => {
    const stories = [
      { status: 'Done' },
      { status: 'Done' },
      { status: 'InProgress' },
    ];
    expect(groupStatuses(stories)).toEqual({ Done: 2, InProgress: 1 });
  });
});

// ── generateSprintReport ─────────────────────────────────────────────────────

describe('generateSprintReport', () => {
  test('generates report for a sprint', () => {
    const stories = [
      { sprint: 1, story: 1, title: 'A', status: 'Done' },
      { sprint: 1, story: 2, title: 'B', status: 'InProgress' },
      { sprint: 2, story: 1, title: 'C', status: 'Done' },
    ];
    const report = generateSprintReport(stories, 1);
    expect(report.sprint).toBe(1);
    expect(report.totalStories).toBe(2);
    expect(report.velocity).toBe(1);
  });
});

// ── generateAllSprintsReport ─────────────────────────────────────────────────

describe('generateAllSprintsReport', () => {
  test('generates summary across all sprints', () => {
    const stories = [
      { sprint: 1, story: 1, title: 'A', status: 'Done' },
      { sprint: 1, story: 2, title: 'B', status: 'Done' },
      { sprint: 2, story: 1, title: 'C', status: 'InProgress' },
    ];
    const report = generateAllSprintsReport(stories);
    expect(report.totalSprints).toBe(2);
    expect(report.totalStories).toBe(3);
    expect(report.totalVelocity).toBe(2);
  });
});

// ── formatSprintReport ───────────────────────────────────────────────────────

describe('formatSprintReport', () => {
  test('formats sprint report', () => {
    const report = {
      sprint: 1,
      totalStories: 2,
      velocity: 1,
      statuses: { Done: 1, InProgress: 1 },
      stories: [
        { id: '1.1', title: 'A', status: 'Done' },
        { id: '1.2', title: 'B', status: 'InProgress' },
      ],
    };
    const output = formatSprintReport(report);
    expect(output).toContain('SPRINT 1 REPORT');
    expect(output).toContain('Done');
  });
});

// ── formatAllSprintsReport ───────────────────────────────────────────────────

describe('formatAllSprintsReport', () => {
  test('formats all sprints summary', () => {
    const report = {
      totalSprints: 2,
      totalStories: 5,
      totalVelocity: 4,
      averageVelocity: 2,
      sprints: [
        { sprint: 1, totalStories: 3, velocity: 2 },
        { sprint: 2, totalStories: 2, velocity: 2 },
      ],
    };
    const output = formatAllSprintsReport(report);
    expect(output).toContain('ALL SPRINTS SUMMARY');
    expect(output).toContain('Sprint 1');
  });
});

// ── runSprintReport ──────────────────────────────────────────────────────────

describe('runSprintReport', () => {
  test('--help shows help', () => {
    const output = [];
    runSprintReport(['--help'], { log: m => output.push(m) });
    expect(output[0]).toContain('SPRINT REPORT GENERATOR');
  });

  test('--format json outputs JSON for sprint', () => {
    const tmp = makeTmpDir();
    writeStory(tmp, '1.1.story.md', makeStoryContent('Story A', 'Done'));
    const output = [];
    runSprintReport(['--format', 'json'], { log: m => output.push(m), projectRoot: tmp });
    const parsed = JSON.parse(output[0]);
    expect(parsed.sprint).toBe(1);
  });

  test('--sprint N selects specific sprint', () => {
    const tmp = makeTmpDir();
    writeStory(tmp, '1.1.story.md', makeStoryContent('A', 'Done'));
    writeStory(tmp, '2.1.story.md', makeStoryContent('B', 'InProgress'));
    const output = [];
    runSprintReport(['--sprint', '2', '--format', 'json'], { log: m => output.push(m), projectRoot: tmp });
    const parsed = JSON.parse(output[0]);
    expect(parsed.sprint).toBe(2);
  });

  test('--all generates all sprints', () => {
    const tmp = makeTmpDir();
    writeStory(tmp, '1.1.story.md', makeStoryContent('A', 'Done'));
    writeStory(tmp, '2.1.story.md', makeStoryContent('B', 'Done'));
    const output = [];
    runSprintReport(['--all', '--format', 'json'], { log: m => output.push(m), projectRoot: tmp });
    const parsed = JSON.parse(output[0]);
    expect(parsed.totalSprints).toBe(2);
  });

  test('shows message for no stories', () => {
    const tmp = makeTmpDir();
    const output = [];
    runSprintReport([], { log: m => output.push(m), projectRoot: tmp });
    expect(output[0]).toContain('No stories found');
  });
});

// ── getHelpText ──────────────────────────────────────────────────────────────

describe('getHelpText', () => {
  test('returns help text', () => {
    expect(getHelpText()).toContain('SPRINT REPORT GENERATOR');
  });
});
