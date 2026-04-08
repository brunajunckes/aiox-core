const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = process.env.AIOX_ROOT || '/root';

describe('Article V: Quality First (MUST)', () => {
  const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');

  it('constitution declares Quality First', () => {
    expect(constitution).toMatch(/Quality First.*MUST/i);
  });

  it('requires lint check', () => {
    expect(constitution).toMatch(/npm run lint/i);
  });

  it('requires typecheck', () => {
    expect(constitution).toMatch(/npm run typecheck/i);
  });

  it('requires test pass', () => {
    expect(constitution).toMatch(/npm test/i);
  });

  it('requires build success', () => {
    expect(constitution).toMatch(/npm run build/i);
  });

  it('package.json has quality scripts', () => {
    const pkgPath = join(ROOT, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts) {
        // At least some quality scripts should exist
        const qualityScripts = ['lint', 'test', 'build', 'typecheck'];
        const found = qualityScripts.filter(s => pkg.scripts[s]);
        expect(found.length > 0).toBe(true);
      }
    }
  });

  it('quality gate checklist exists', () => {
    const checklistDir = join(ROOT, '.aiox-core/development/checklists');
    expect(existsSync(checklistDir)).toBe(true);
  });
});
