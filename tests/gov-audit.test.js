const { GovernanceAudit } = require('../.aiox-core/cli/commands/gov-audit/audit');
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('GovernanceAudit', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `gov-audit-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('should initialize with options', () => {
    const audit = new GovernanceAudit({ cwd: tempDir, json: true });
    expect(audit.options.json).toBe(true);
    expect(audit.options.cwd).toBe(tempDir);
  });

  test('should run full audit', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results).toHaveProperty('complianceScore');
    expect(results).toHaveProperty('complianceLevel');
    expect(results).toHaveProperty('enforcement');
    expect(results).toHaveProperty('violations');
    expect(results).toHaveProperty('recommendations');
  });

  test('should calculate compliance score (0-100)', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.complianceScore).toBeGreaterThanOrEqual(0);
    expect(results.complianceScore).toBeLessThanOrEqual(100);
  });

  test('should assign compliance levels', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    const validLevels = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
    expect(validLevels).toContain(results.complianceLevel);
  });

  test('should categorize violations by principle', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    const categories = results.violations.byCategory;
    expect(categories).toHaveProperty('CLI First');
    expect(categories).toHaveProperty('Agent Authority');
    expect(categories).toHaveProperty('Story-Driven');
    expect(categories).toHaveProperty('No Invention');
    expect(categories).toHaveProperty('Quality First');
  });

  test('should count violations correctly', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    const totalByPrinciple = Object.values(results.violations.byCategory).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalByPrinciple).toBe(results.violations.total);
  });

  test('should generate recommendations', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(Array.isArray(results.recommendations)).toBe(true);
    results.recommendations.forEach(rec => {
      expect(rec).toHaveProperty('description');
      expect(rec).toHaveProperty('principle');
      expect(rec).toHaveProperty('severity');
    });
  });

  test('should limit recommendations to top 10', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.recommendations.length).toBeLessThanOrEqual(10);
  });

  test('should include timestamp', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.timestamp).toBeDefined();
    expect(new Date(results.timestamp).getTime()).toBeGreaterThan(0);
  });

  test('should include passed checks count', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.passed).toHaveProperty('total');
    expect(results.passed.total).toBeGreaterThanOrEqual(0);
  });

  test('should integrate constitutional enforcer', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.enforcement).toHaveProperty('passed');
    expect(results.enforcement).toHaveProperty('violations');
    expect(Array.isArray(results.enforcement.passed)).toBe(true);
  });

  test('should handle empty violations', async () => {
    // Setup minimal valid structure
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'docs/stories'), { recursive: true });

    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    expect(results.violations.total).toBeGreaterThanOrEqual(0);
  });

  test('should sort recommendations by severity', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    const severityOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < results.recommendations.length; i++) {
      const prevSeverity = severityOrder[results.recommendations[i - 1].severity];
      const currSeverity = severityOrder[results.recommendations[i].severity];
      expect(prevSeverity).toBeLessThanOrEqual(currSeverity);
    }
  });

  test('should work in verbose mode', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir, verbose: true });
    const results = await audit.run();

    expect(results).toBeDefined();
    expect(results.complianceScore).toBeDefined();
  });

  test('should work in JSON mode', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir, json: true });
    const results = await audit.run();

    // Should be serializable to JSON
    const json = JSON.stringify(results);
    expect(json).toBeDefined();
  });

  test('should handle nonexistent directory gracefully', async () => {
    const audit = new GovernanceAudit({ cwd: '/nonexistent/path' });
    const results = await audit.run();

    expect(results).toBeDefined();
    expect(results.complianceScore).toBeDefined();
  });

  test('should track compliance score changes', async () => {
    // First audit
    const audit1 = new GovernanceAudit({ cwd: tempDir });
    const results1 = await audit1.run();

    // Setup one improvement
    fs.mkdirSync(path.join(tempDir, 'tests'), { recursive: true });

    // Second audit
    const audit2 = new GovernanceAudit({ cwd: tempDir });
    const results2 = await audit2.run();

    // Second should have better or equal score
    expect(results2.complianceScore).toBeGreaterThanOrEqual(results1.complianceScore - 5); // Allow small margin
  });

  test('should map compliance levels to scores correctly', async () => {
    const audit = new GovernanceAudit({ cwd: tempDir });
    const results = await audit.run();

    if (results.complianceScore >= 90) {
      expect(results.complianceLevel).toBe('Excellent');
    } else if (results.complianceScore >= 80) {
      expect(results.complianceLevel).toBe('Good');
    } else if (results.complianceScore >= 70) {
      expect(results.complianceLevel).toBe('Fair');
    } else if (results.complianceScore >= 50) {
      expect(results.complianceLevel).toBe('Poor');
    } else {
      expect(results.complianceLevel).toBe('Critical');
    }
  });
});
