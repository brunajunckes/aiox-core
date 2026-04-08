const { readFileSync } = require('fs');
const { join } = require('path');

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe('Article IV: No Invention (MUST)', () => {
  const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');

  it('constitution declares No Invention principle', () => {
    expect(constitution).toMatch(/No Invention.*MUST/i);
  });

  it('specs must trace to requirements (FR, NFR, CON)', () => {
    expect(constitution).toMatch(/requisito funcional.*FR/i);
    expect(constitution).toMatch(/requisito não-funcional.*NFR/i);
    expect(constitution).toMatch(/constraint.*CON/i);
  });

  it('prohibits adding features not in requirements', () => {
    expect(constitution).toMatch(/MUST NOT.*features não presentes/i);
  });

  it('prohibits assuming unresearched implementation details', () => {
    expect(constitution).toMatch(/MUST NOT.*detalhes de implementação não pesquisados/i);
  });

  it('prohibits specifying unvalidated technologies', () => {
    expect(constitution).toMatch(/MUST NOT.*tecnologias não validadas/i);
  });
});
