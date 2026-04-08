const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe('Article II: Agent Authority (NON-NEGOTIABLE)', () => {
  const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');

  it('constitution declares Agent Authority as NON-NEGOTIABLE', () => {
    expect(constitution).toMatch(/Agent Authority.*NON-NEGOTIABLE/i);
  });

  it('git push is exclusive to @devops', () => {
    expect(constitution).toMatch(/git push.*@devops/i);
  });

  it('PR creation is exclusive to @devops', () => {
    expect(constitution).toMatch(/PR creation.*@devops/i);
  });

  it('release/tag is exclusive to @devops', () => {
    expect(constitution).toMatch(/Release.*Tag.*@devops/i);
  });

  it('story creation is exclusive to @sm and @po', () => {
    expect(constitution).toMatch(/Story creation.*@sm.*@po/i);
  });

  it('architecture decisions are exclusive to @architect', () => {
    expect(constitution).toMatch(/Architecture decisions.*@architect/i);
  });

  it('quality verdicts are exclusive to @qa', () => {
    expect(constitution).toMatch(/Quality verdicts.*@qa/i);
  });

  it('agent authority rules file exists', () => {
    const rulesPath = join(ROOT, '.claude/rules/agent-authority.md');
    expect(existsSync(rulesPath)).toBe(true);
  });
});
