const { PolicyManager } = require('../.aiox-core/cli/commands/policies/manager');
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('PolicyManager', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `policies-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('should initialize with options', () => {
    const manager = new PolicyManager({ cwd: tempDir });
    expect(manager.options.cwd).toBe(tempDir);
  });

  test('should create policies directory if missing', () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policiesDir = path.join(tempDir, '.aiox/policies');
    expect(fs.existsSync(policiesDir)).toBe(true);
  });

  test('should create default policies', () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policiesDir = path.join(tempDir, '.aiox/policies');
    const files = fs.readdirSync(policiesDir);
    expect(files.length).toBeGreaterThan(0);
  });

  test('should list all policies', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    expect(Array.isArray(policies)).toBe(true);
    expect(policies.length).toBeGreaterThan(0);

    policies.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('enabled');
    });
  });

  test('should return sorted policy list', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    const sorted = [...policies].sort((a, b) => a.name.localeCompare(b.name));
    expect(policies.map(p => p.name)).toEqual(sorted.map(p => p.name));
  });

  test('should enforce existing policy', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const result = await manager.enforce('import-absolute');

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('violations');
    expect(Array.isArray(result.violations)).toBe(true);
  });

  test('should throw error for unknown policy', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    await expect(manager.enforce('unknown-policy')).rejects.toThrow();
  });

  test('should handle disabled policies', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    await manager.disablePolicy('import-absolute');

    const policies = await manager.list();
    const policy = policies.find(p => p.id === 'import-absolute');
    expect(policy.enabled).toBe(false);
  });

  test('should enable disabled policy', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    await manager.disablePolicy('import-absolute');
    await manager.enablePolicy('import-absolute');

    const policies = await manager.list();
    const policy = policies.find(p => p.id === 'import-absolute');
    expect(policy.enabled).toBe(true);
  });

  test('should load policies from directory', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    const expectedPolicies = ['import-absolute', 'no-git-push', 'const-naming'];
    const loadedIds = policies.map(p => p.id);

    expectedPolicies.forEach(id => {
      expect(loadedIds).toContain(id);
    });
  });

  test('should handle policy enforcement errors gracefully', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const result = await manager.enforce('import-absolute');

    expect(result.passed !== undefined).toBe(true);
    expect(Array.isArray(result.violations)).toBe(true);
  });

  test('should provide policy descriptions', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    policies.forEach(p => {
      expect(typeof p.name).toBe('string');
      if (p.description) {
        expect(typeof p.description).toBe('string');
      }
    });
  });

  test('should support JSON output', async () => {
    const manager = new PolicyManager({ cwd: tempDir, json: true });
    const policies = await manager.list();

    expect(Array.isArray(policies)).toBe(true);
    const json = JSON.stringify(policies);
    expect(json).toBeDefined();
  });

  test('should persist policy enable/disable state', async () => {
    const manager = new PolicyManager({ cwd: tempDir });

    // Disable policy
    await manager.disablePolicy('no-git-push');

    // Create new manager instance
    const manager2 = new PolicyManager({ cwd: tempDir });
    const policies = await manager2.list();
    const policy = policies.find(p => p.id === 'no-git-push');

    expect(policy.enabled).toBe(false);
  });

  test('should load custom policies from YAML files', () => {
    // First initialize manager to create directory
    new PolicyManager({ cwd: tempDir });

    const policiesDir = path.join(tempDir, '.aiox/policies');

    // Add custom policy
    const customPolicy = {
      id: 'custom-test',
      name: 'Custom Test Policy',
      description: 'Test custom policy loading',
      enabled: true,
    };

    const yaml = require('js-yaml');
    fs.writeFileSync(
      path.join(policiesDir, 'custom-test.yaml'),
      yaml.dump(customPolicy),
      'utf8',
    );

    const manager = new PolicyManager({ cwd: tempDir });
    const policies = manager.policies;

    expect(policies.has('custom-test')).toBe(true);
  });

  test('should handle malformed YAML gracefully', () => {
    // First initialize to create directory
    new PolicyManager({ cwd: tempDir });

    const policiesDir = path.join(tempDir, '.aiox/policies');

    // Add malformed YAML
    fs.writeFileSync(path.join(policiesDir, 'broken.yaml'), 'invalid: yaml: content: [', 'utf8');

    // Should not throw
    expect(() => {
      new PolicyManager({ cwd: tempDir });
    }).not.toThrow();
  });

  test('should count total policies', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    expect(policies.length).toBeGreaterThan(0);
  });

  test('should support policy enforcement with results', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const result = await manager.enforce('const-naming');

    expect(result.passed).toBeDefined();
    expect(Array.isArray(result.violations)).toBe(true);
    result.violations.forEach(v => {
      expect(v).toHaveProperty('message');
    });
  });

  test('should identify critical policies', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    expect(policies.length).toBeGreaterThan(0);

    const gitPolicy = policies.find(p => p.id === 'no-git-push');
    expect(gitPolicy).toBeDefined();
  });

  test('should provide policy metadata', async () => {
    const manager = new PolicyManager({ cwd: tempDir });
    const policies = await manager.list();

    const policy = policies[0];
    expect(policy.id).toBeDefined();
    expect(policy.name).toBeDefined();
    expect(typeof policy.enabled).toBe('boolean');
  });
});
