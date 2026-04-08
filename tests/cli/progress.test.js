/**
 * Tests for Story Progress Tracker & Burndown (Story 6.2)
 *
 * @module tests/cli/progress
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  readAllStories,
  groupBySprint,
  calculateProgress,
  renderASCIIChart,
  renderBar,
  formatProgress,
  extractStatus,
  extractTitle,
  parseFilename,
  parseArgs,
  runProgress,
  VALID_STATUSES,
  BAR_WIDTH,
  FILLED_CHAR,
  EMPTY_CHAR,
} = require('../../.aiox-core/cli/commands/progress/index.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'progress-test-'));
}

function writeStory(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
}

function storyWithCheckboxStatus(title, checkedStatus) {
  const statuses = ['Ready', 'InProgress', 'Draft', 'Done'];
  const lines = statuses
    .map((s) => `- [${s === checkedStatus ? 'x' : ' '}] ${s}`)
    .join('\n');
  return `# ${title}\n\n## Status\n${lines}\n\n## Story\nSome content.\n`;
}

function storyWithPlainStatus(title, status) {
  return `# ${title}\n\n## Status\n\n${status}\n\n## Story\nSome content.\n`;
}

// ── extractStatus ────────────────────────────────────────────────────────────

describe('extractStatus', () => {
  test('detects Done from checkbox format', () => {
    const content = storyWithCheckboxStatus('Test', 'Done');
    expect(extractStatus(content)).toBe('Done');
  });

  test('detects InProgress from checkbox format', () => {
    const content = storyWithCheckboxStatus('Test', 'InProgress');
    expect(extractStatus(content)).toBe('InProgress');
  });

  test('detects Draft from checkbox format', () => {
    const content = storyWithCheckboxStatus('Test', 'Draft');
    expect(extractStatus(content)).toBe('Draft');
  });

  test('detects Ready from checkbox format', () => {
    const content = storyWithCheckboxStatus('Test', 'Ready');
    expect(extractStatus(content)).toBe('Ready');
  });

  test('detects Draft from plain text format', () => {
    const content = storyWithPlainStatus('Test', 'Draft');
    expect(extractStatus(content)).toBe('Draft');
  });

  test('detects InProgress from plain text format', () => {
    const content = storyWithPlainStatus('Test', 'InProgress');
    expect(extractStatus(content)).toBe('InProgress');
  });

  test('detects Done from plain text format', () => {
    const content = storyWithPlainStatus('Test', 'Done');
    expect(extractStatus(content)).toBe('Done');
  });

  test('returns Unknown when no Status section', () => {
    expect(extractStatus('# Title\n\nNo status here.')).toBe('Unknown');
  });

  test('returns Unknown when Status section is empty', () => {
    const content = '# Title\n\n## Status\n\n## Next Section\n';
    expect(extractStatus(content)).toBe('Unknown');
  });

  test('handles checkbox with all checked (takes first checked)', () => {
    const content = `# Title\n\n## Status\n- [x] Ready\n- [x] InProgress\n- [x] Draft\n- [x] Done\n`;
    // First checked wins
    expect(extractStatus(content)).toBe('Ready');
  });
});

// ── extractTitle ─────────────────────────────────────────────────────────────

describe('extractTitle', () => {
  test('extracts title from H1', () => {
    expect(extractTitle('# My Story Title\n\nContent')).toBe('My Story Title');
  });

  test('returns Untitled when no H1', () => {
    expect(extractTitle('No heading here')).toBe('Untitled');
  });

  test('trims whitespace from title', () => {
    expect(extractTitle('#   Spaced Title  \n')).toBe('Spaced Title');
  });
});

// ── parseFilename ────────────────────────────────────────────────────────────

describe('parseFilename', () => {
  test('parses valid story filename', () => {
    expect(parseFilename('3.2.story.md')).toEqual({ sprint: 3, story: 2 });
  });

  test('parses single digit sprint and story', () => {
    expect(parseFilename('1.1.story.md')).toEqual({ sprint: 1, story: 1 });
  });

  test('parses double digit sprint', () => {
    expect(parseFilename('12.4.story.md')).toEqual({ sprint: 12, story: 4 });
  });

  test('returns null for non-story files', () => {
    expect(parseFilename('readme.md')).toBeNull();
  });

  test('returns null for malformed names', () => {
    expect(parseFilename('story.md')).toBeNull();
  });
});

// ── readAllStories ───────────────────────────────────────────────────────────

describe('readAllStories', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('reads stories from directory', () => {
    writeStory(tmpDir, '1.1.story.md', storyWithCheckboxStatus('Init', 'Done'));
    writeStory(tmpDir, '1.2.story.md', storyWithPlainStatus('Setup', 'Draft'));

    const stories = readAllStories(tmpDir);
    expect(stories).toHaveLength(2);
    expect(stories[0].sprint).toBe(1);
    expect(stories[0].story).toBe(1);
    expect(stories[0].status).toBe('Done');
    expect(stories[0].title).toBe('Init');
    expect(stories[1].status).toBe('Draft');
  });

  test('returns empty array for non-existent directory', () => {
    expect(readAllStories('/nonexistent/path')).toEqual([]);
  });

  test('ignores non-story files', () => {
    writeStory(tmpDir, '1.1.story.md', storyWithPlainStatus('Real', 'Done'));
    writeStory(tmpDir, 'readme.md', '# Not a story');
    writeStory(tmpDir, 'notes.txt', 'Just notes');

    const stories = readAllStories(tmpDir);
    expect(stories).toHaveLength(1);
  });

  test('sorts stories by sprint then story number', () => {
    writeStory(tmpDir, '2.1.story.md', storyWithPlainStatus('B', 'Done'));
    writeStory(tmpDir, '1.2.story.md', storyWithPlainStatus('A2', 'Draft'));
    writeStory(tmpDir, '1.1.story.md', storyWithPlainStatus('A1', 'Done'));

    const stories = readAllStories(tmpDir);
    expect(stories.map((s) => `${s.sprint}.${s.story}`)).toEqual([
      '1.1', '1.2', '2.1',
    ]);
  });
});

// ── groupBySprint ────────────────────────────────────────────────────────────

describe('groupBySprint', () => {
  test('groups stories by sprint number', () => {
    const stories = [
      { sprint: 1, story: 1, status: 'Done', title: 'A' },
      { sprint: 1, story: 2, status: 'Draft', title: 'B' },
      { sprint: 2, story: 1, status: 'InProgress', title: 'C' },
    ];

    const groups = groupBySprint(stories);
    expect(Object.keys(groups)).toEqual(['1', '2']);
    expect(groups[1]).toHaveLength(2);
    expect(groups[2]).toHaveLength(1);
  });

  test('returns empty object for empty input', () => {
    expect(groupBySprint([])).toEqual({});
  });
});

// ── calculateProgress ────────────────────────────────────────────────────────

describe('calculateProgress', () => {
  test('calculates progress for mixed statuses', () => {
    const stories = [
      { status: 'Done' },
      { status: 'Done' },
      { status: 'InProgress' },
      { status: 'Draft' },
    ];

    const result = calculateProgress(stories);
    expect(result.total).toBe(4);
    expect(result.done).toBe(2);
    expect(result.inProgress).toBe(1);
    expect(result.draft).toBe(1);
    expect(result.percent).toBe(50);
  });

  test('returns 100% when all done', () => {
    const stories = [{ status: 'Done' }, { status: 'Done' }];
    expect(calculateProgress(stories).percent).toBe(100);
  });

  test('returns 0% when none done', () => {
    const stories = [{ status: 'Draft' }, { status: 'InProgress' }];
    expect(calculateProgress(stories).percent).toBe(0);
  });

  test('handles empty input', () => {
    const result = calculateProgress([]);
    expect(result.total).toBe(0);
    expect(result.percent).toBe(0);
  });

  test('counts InReview status', () => {
    const stories = [{ status: 'InReview' }];
    const result = calculateProgress(stories);
    expect(result.inReview).toBe(1);
  });

  test('counts Ready status', () => {
    const stories = [{ status: 'Ready' }];
    const result = calculateProgress(stories);
    expect(result.ready).toBe(1);
  });

  test('counts Unknown status', () => {
    const stories = [{ status: 'Unknown' }];
    const result = calculateProgress(stories);
    expect(result.unknown).toBe(1);
  });

  test('rounds percent correctly', () => {
    const stories = [
      { status: 'Done' },
      { status: 'Draft' },
      { status: 'Draft' },
    ];
    // 1/3 = 33.33...% -> rounds to 33
    expect(calculateProgress(stories).percent).toBe(33);
  });
});

// ── renderBar ────────────────────────────────────────────────────────────────

describe('renderBar', () => {
  test('renders full bar at 100%', () => {
    const bar = renderBar(100, 10);
    expect(bar).toBe(FILLED_CHAR.repeat(10));
  });

  test('renders empty bar at 0%', () => {
    const bar = renderBar(0, 10);
    expect(bar).toBe(EMPTY_CHAR.repeat(10));
  });

  test('renders half bar at 50%', () => {
    const bar = renderBar(50, 10);
    expect(bar).toBe(FILLED_CHAR.repeat(5) + EMPTY_CHAR.repeat(5));
  });

  test('uses default BAR_WIDTH', () => {
    const bar = renderBar(100);
    expect(bar.length).toBe(BAR_WIDTH);
  });
});

// ── renderASCIIChart ─────────────────────────────────────────────────────────

describe('renderASCIIChart', () => {
  test('renders chart for multiple sprints', () => {
    const groups = {
      1: [{ status: 'Done' }, { status: 'Done' }],
      2: [{ status: 'Done' }, { status: 'Draft' }],
    };

    const chart = renderASCIIChart(groups);
    expect(chart).toContain('Sprint 1');
    expect(chart).toContain('Sprint 2');
    expect(chart).toContain('100%');
    expect(chart).toContain('50%');
    expect(chart).toContain('(2/2 done)');
    expect(chart).toContain('(1/2 done)');
  });

  test('sorts sprints numerically', () => {
    const groups = {
      3: [{ status: 'Draft' }],
      1: [{ status: 'Done' }],
      2: [{ status: 'InProgress' }],
    };

    const lines = renderASCIIChart(groups).split('\n');
    expect(lines[0]).toContain('Sprint 1');
    expect(lines[1]).toContain('Sprint 2');
    expect(lines[2]).toContain('Sprint 3');
  });
});

// ── formatProgress ───────────────────────────────────────────────────────────

describe('formatProgress', () => {
  const makeData = () => {
    const stories = [
      { sprint: 1, story: 1, status: 'Done', title: 'A' },
      { sprint: 1, story: 2, status: 'Done', title: 'B' },
      { sprint: 2, story: 1, status: 'Draft', title: 'C' },
    ];
    const groups = groupBySprint(stories);
    const overallProgress = calculateProgress(stories);
    return { stories, groups, overallProgress };
  };

  test('renders text report with header', () => {
    const output = formatProgress(makeData());
    expect(output).toContain('AIOX Sprint Progress');
    expect(output).toContain('Overall:');
  });

  test('renders JSON when json option set', () => {
    const output = formatProgress(makeData(), { json: true });
    const parsed = JSON.parse(output);
    expect(parsed.sprints).toBeDefined();
    expect(parsed.overall).toBeDefined();
    expect(parsed.sprints['1'].done).toBe(2);
    expect(parsed.sprints['2'].draft).toBe(1);
  });

  test('JSON includes story details', () => {
    const output = formatProgress(makeData(), { json: true });
    const parsed = JSON.parse(output);
    expect(parsed.sprints['1'].stories).toHaveLength(2);
    expect(parsed.sprints['1'].stories[0].id).toBe('1.1');
    expect(parsed.sprints['1'].stories[0].title).toBe('A');
  });

  test('text report shows overall percentage', () => {
    const output = formatProgress(makeData());
    // 2/3 done = 67%
    expect(output).toContain('2/3 stories complete (67%)');
  });
});

// ── parseArgs ────────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('parses --help flag', () => {
    expect(parseArgs(['--help']).help).toBe(true);
  });

  test('parses -h flag', () => {
    expect(parseArgs(['-h']).help).toBe(true);
  });

  test('parses --json flag', () => {
    expect(parseArgs(['--json']).json).toBe(true);
  });

  test('parses --sprint with value', () => {
    expect(parseArgs(['--sprint', '3']).sprint).toBe(3);
  });

  test('defaults to no filters', () => {
    const opts = parseArgs([]);
    expect(opts.help).toBe(false);
    expect(opts.json).toBe(false);
    expect(opts.sprint).toBeNull();
  });

  test('combines multiple flags', () => {
    const opts = parseArgs(['--sprint', '2', '--json']);
    expect(opts.sprint).toBe(2);
    expect(opts.json).toBe(true);
  });
});

// ── runProgress (integration) ────────────────────────────────────────────────

describe('runProgress', () => {
  let tmpDir;
  let originalCwd;
  let logSpy;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    const storiesDir = path.join(tmpDir, 'docs', 'stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    writeStory(storiesDir, '1.1.story.md', storyWithCheckboxStatus('Init', 'Done'));
    writeStory(storiesDir, '1.2.story.md', storyWithPlainStatus('Setup', 'Done'));
    writeStory(storiesDir, '2.1.story.md', storyWithPlainStatus('Feature', 'InProgress'));
    writeStory(storiesDir, '2.2.story.md', storyWithPlainStatus('Other', 'Draft'));

    originalCwd = process.cwd();
    process.chdir(tmpDir);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    logSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('outputs progress report for all sprints', () => {
    runProgress([]);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Sprint 1');
    expect(output).toContain('Sprint 2');
    expect(output).toContain('100%');
  });

  test('filters by sprint', () => {
    runProgress(['--sprint', '2']);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Sprint 2');
    expect(output).not.toContain('Sprint 1');
  });

  test('outputs JSON', () => {
    runProgress(['--json']);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    const parsed = JSON.parse(output);
    expect(parsed.sprints['1'].done).toBe(2);
  });

  test('shows help', () => {
    runProgress(['--help']);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('USAGE');
  });

  test('handles no stories gracefully', () => {
    const emptyDir = makeTmpDir();
    fs.mkdirSync(path.join(emptyDir, 'docs', 'stories'), { recursive: true });
    process.chdir(emptyDir);

    runProgress([]);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No stories found');

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  test('handles missing sprint filter gracefully', () => {
    runProgress(['--sprint', '99']);
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No stories found for Sprint 99');
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('VALID_STATUSES contains expected values', () => {
    expect(VALID_STATUSES).toContain('Done');
    expect(VALID_STATUSES).toContain('InProgress');
    expect(VALID_STATUSES).toContain('Draft');
    expect(VALID_STATUSES).toContain('Ready');
    expect(VALID_STATUSES).toContain('InReview');
  });

  test('BAR_WIDTH is 20', () => {
    expect(BAR_WIDTH).toBe(20);
  });
});

// ── Real stories integration ─────────────────────────────────────────────────

describe('real stories (integration)', () => {
  const realStoriesDir = path.join(__dirname, '..', '..', 'docs', 'stories');

  test('reads actual project stories if available', () => {
    if (!fs.existsSync(realStoriesDir)) return;

    const stories = readAllStories(realStoriesDir);
    expect(stories.length).toBeGreaterThan(0);

    // Every story should have a valid sprint/story number
    for (const story of stories) {
      expect(story.sprint).toBeGreaterThan(0);
      expect(story.story).toBeGreaterThan(0);
      expect(story.title).not.toBe('Untitled');
    }
  });
});
