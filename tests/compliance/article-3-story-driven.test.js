const { readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe('Article III: Story-Driven Development (MUST)', () => {
  const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');

  it('constitution declares Story-Driven Development', () => {
    expect(constitution).toMatch(/Story-Driven Development.*MUST/i);
  });

  it('stories directory exists', () => {
    const storiesPath = join(ROOT, 'docs/stories');
    expect(existsSync(storiesPath)).toBe(true);
  });

  it('all stories have acceptance criteria', () => {
    const storiesPath = join(ROOT, 'docs/stories');
    if (!existsSync(storiesPath)) return;

    const stories = readdirSync(storiesPath).filter(f => f.endsWith('.story.md'));
    for (const story of stories) {
      const content = readFileSync(join(storiesPath, story), 'utf-8');
      expect(content).toMatch(/Acceptance Criteria/i);
    }
  });

  it('all stories have status tracking', () => {
    const storiesPath = join(ROOT, 'docs/stories');
    if (!existsSync(storiesPath)) return;

    const stories = readdirSync(storiesPath).filter(f => f.endsWith('.story.md'));
    for (const story of stories) {
      const content = readFileSync(join(storiesPath, story), 'utf-8');
      expect(content).toMatch(/## Status/i);
    }
  });

  it('all stories have file lists', () => {
    const storiesPath = join(ROOT, 'docs/stories');
    if (!existsSync(storiesPath)) return;

    const stories = readdirSync(storiesPath).filter(f => f.endsWith('.story.md'));
    for (const story of stories) {
      const content = readFileSync(join(storiesPath, story), 'utf-8');
      expect(content).toMatch(/File List/i);
    }
  });

  it('story lifecycle rules file exists', () => {
    const rulesPath = join(ROOT, '.claude/rules/story-lifecycle.md');
    expect(existsSync(rulesPath)).toBe(true);
  });
});
