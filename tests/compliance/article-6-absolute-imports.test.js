const { readFileSync, readdirSync, existsSync, statSync } = require('fs');
const { join, extname } = require('path');

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe('Article VI: Absolute Imports (SHOULD)', () => {
  const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');

  it('constitution declares Absolute Imports principle', () => {
    expect(constitution).toMatch(/Absolute Imports.*SHOULD/i);
  });

  it('recommends @ alias imports', () => {
    expect(constitution).toMatch(/@\//);
  });

  it('discourages deep relative imports in source files', () => {
    const srcDirs = [
      join(ROOT, 'llm-router-aiox/src'),
      join(ROOT, 'aiox-dashboard/src'),
    ];

    let deepRelativeCount = 0;
    const MAX_ALLOWED = 50; // SHOULD, not MUST — tolerance for existing codebase

    for (const srcDir of srcDirs) {
      if (!existsSync(srcDir)) continue;
      const files = collectFiles(srcDir, ['.ts', '.js', '.vue', '.tsx', '.jsx']);
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(/from ['"]\.\.\/\.\.\/\.\.\//g);
        if (matches) deepRelativeCount += matches.length;
      }
    }

    expect(deepRelativeCount <= MAX_ALLOWED).toBe(true);
  });
});

function collectFiles(dir, extensions, files = []) {
  if (!existsSync(dir)) return files;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath, extensions, files);
      } else if (extensions.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}
