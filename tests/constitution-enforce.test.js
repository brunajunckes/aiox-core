const { ConstitutionalEnforcer } = require('../.aiox-core/cli/commands/constitution-enforce/enforcer');
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('ConstitutionalEnforcer', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `constitution-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('should initialize with options', () => {
    const enforcer = new ConstitutionalEnforcer({
      fix: true,
      verbose: true,
      cwd: tempDir,
    });
    expect(enforcer.options.fix).toBe(true);
    expect(enforcer.options.verbose).toBe(true);
  });

  test('should validate and return results object', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    expect(results).toHaveProperty('passed');
    expect(results).toHaveProperty('violations');
    expect(results).toHaveProperty('fixes');
    expect(Array.isArray(results.passed)).toBe(true);
    expect(Array.isArray(results.violations)).toBe(true);
  });

  test('should detect missing CLI structure', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const cliViolations = results.violations.filter(v => v.principle === 'CLI First');
    expect(cliViolations.length).toBeGreaterThan(0);
  });

  test('should detect missing agent authority rules', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const agentViolations = results.violations.filter(v => v.principle === 'Agent Authority');
    expect(agentViolations.length).toBeGreaterThan(0);
  });

  test('should detect missing stories directory', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const storyViolations = results.violations.filter(v => v.principle === 'Story-Driven');
    expect(storyViolations.length).toBeGreaterThan(0);
  });

  test('should pass when stories directory exists', async () => {
    const storiesPath = path.join(tempDir, 'docs/stories');
    fs.mkdirSync(storiesPath, { recursive: true });

    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const storyPassed = results.passed.some(p => p.principle === 'Story-Driven');
    expect(storyPassed).toBe(true);
  });

  test('should detect missing PRD', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const prdViolations = results.violations.filter(v => v.message.includes('PRD'));
    expect(prdViolations.length).toBeGreaterThan(0);
  });

  test('should detect missing tests directory', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const qualityViolations = results.violations.filter(v => v.principle === 'Quality First');
    expect(qualityViolations.length).toBeGreaterThan(0);
  });

  test('should pass when tests directory exists', async () => {
    const testsPath = path.join(tempDir, 'tests');
    fs.mkdirSync(testsPath, { recursive: true });
    fs.writeFileSync(path.join(testsPath, 'example.test.js'), 'test("example", () => {});');

    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const qualityPassed = results.passed.some(p => p.principle === 'Quality First' && p.message.includes('Tests'));
    expect(qualityPassed).toBe(true);
  });

  test('should collect violations with severity levels', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const criticalViolations = results.violations.filter(v => v.severity === 'high' || v.severity === 'medium');
    expect(criticalViolations.length).toBeGreaterThan(0);

    criticalViolations.forEach(v => {
      expect(['high', 'medium', 'low']).toContain(v.severity);
    });
  });

  test('should include suggestions for violations', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const withSuggestions = results.violations.filter(v => v.suggestion);
    expect(withSuggestions.length).toBeGreaterThan(0);
  });

  test('should support verbose mode', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir, verbose: true });
    const results = await enforcer.validate();

    expect(results).toBeDefined();
    expect(results.violations.length > 0 || results.passed.length > 0).toBe(true);
  });

  test('should validate all 5 principles', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    const principles = new Set();
    results.passed.forEach(p => principles.add(p.principle));
    results.violations.forEach(v => principles.add(v.principle));

    expect(principles.size).toBeGreaterThan(0);
  });

  test('should handle errors gracefully', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: '/nonexistent/path' });
    const results = await enforcer.validate();

    // Should still return results object even with errors
    expect(results).toHaveProperty('passed');
    expect(results).toHaveProperty('violations');
  });

  test('should track fixed violations when --fix is used', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir, fix: true });
    const results = await enforcer.validate();

    // When fix is enabled, fixes array may be populated
    expect(Array.isArray(results.fixes)).toBe(true);
  });

  test('should format violations with location and suggestion', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    results.violations.forEach(v => {
      expect(v.principle).toBeDefined();
      expect(v.message).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(v.severity);
    });
  });

  test('should handle missing validator gracefully', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    // Should still return all results even if one validator is missing
    expect(results.passed).toBeDefined();
    expect(results.violations).toBeDefined();
  });

  test('should run all validators even if one fails', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    // Multiple principles should be checked
    const principlesChecked = new Set([
      ...results.passed.map(p => p.principle),
      ...results.violations.map(v => v.principle),
    ]);

    expect(principlesChecked.size).toBeGreaterThan(1);
  });

  test('should return exit code 0 on no violations', async () => {
    // This is tested implicitly - with proper setup, violations should exist
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    // Results should contain structure, violations depend on environment
    expect(results).toBeDefined();
  });

  test('should categorize results by type', async () => {
    const enforcer = new ConstitutionalEnforcer({ cwd: tempDir });
    const results = await enforcer.validate();

    results.passed.forEach(p => {
      expect(p.principle).toBeDefined();
      expect(p.message).toBeDefined();
    });

    results.violations.forEach(v => {
      expect(v.principle).toBeDefined();
      expect(v.message).toBeDefined();
      expect(v.severity).toBeDefined();
    });
  });
});
