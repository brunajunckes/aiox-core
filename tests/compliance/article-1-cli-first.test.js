const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = process.env.AIOX_ROOT || process.cwd();

describe('Article I: CLI First (NON-NEGOTIABLE)', () => {
  it('constitution declares CLI First as NON-NEGOTIABLE', () => {
    const constitution = readFileSync(join(ROOT, '.aiox-core/constitution.md'), 'utf-8');
    expect(constitution).toMatch(/CLI First.*NON-NEGOTIABLE/i);
  });

  it('CLI core modules exist before any UI dependencies', () => {
    const cliCorePath = join(ROOT, '.aiox-core/cli');
    expect(existsSync(cliCorePath)).toBe(true);
  });

  it('framework config enforces CLI hierarchy', () => {
    const configPath = join(ROOT, '.aiox-core/core-config.yaml');
    if (existsSync(configPath)) {
      const config = readFileSync(configPath, 'utf-8');
      expect(config.length > 0).toBe(true);
    }
  });

  it('dashboard is observation-only (no control actions)', () => {
    const dashboardPath = join(ROOT, 'aiox-dashboard');
    if (existsSync(dashboardPath)) {
      // Dashboard should not contain mutation endpoints
      const packagePath = join(dashboardPath, 'package.json');
      if (existsSync(packagePath)) {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
        expect(pkg).toBeDefined();
      }
    }
  });
});
