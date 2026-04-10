const { IncidentManager } = require('../.aiox-core/cli/commands/incident/manager');
const path = require('path');
const os = require('os');
const fs = require('fs');

describe('IncidentManager', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `incident-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('should initialize with options', () => {
    const manager = new IncidentManager({ cwd: tempDir });
    expect(manager.options.cwd).toBe(tempDir);
  });

  test('should create incident directory structure', () => {
    new IncidentManager({ cwd: tempDir });
    const incidentsDir = path.join(tempDir, '.aiox/incidents');
    expect(fs.existsSync(incidentsDir)).toBe(true);
  });

  test('should create schema file', () => {
    new IncidentManager({ cwd: tempDir });
    const schemaFile = path.join(tempDir, '.aiox/incidents/schema.json');
    expect(fs.existsSync(schemaFile)).toBe(true);

    const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    expect(schema.version).toBe('1.0.0');
    expect(schema.fields).toBeDefined();
  });

  test('should create incident with valid severity', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const incident = await manager.create({
      severity: 'high',
      description: 'Test incident',
    });

    expect(incident.id).toBeDefined();
    expect(incident.severity).toBe('high');
    expect(incident.description).toBe('Test incident');
    expect(incident.createdAt).toBeDefined();
  });

  test('should reject invalid severity', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    await expect(
      manager.create({
        severity: 'invalid',
        description: 'Test',
      }),
    ).rejects.toThrow('Invalid severity');
  });

  test('should require description', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    await expect(
      manager.create({
        severity: 'high',
        description: '',
      }),
    ).rejects.toThrow('Description required');
  });

  test('should generate unique incident IDs', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc1 = await manager.create({
      severity: 'high',
      description: 'Test 1',
    });

    const inc2 = await manager.create({
      severity: 'high',
      description: 'Test 2',
    });

    expect(inc1.id).not.toBe(inc2.id);
    expect(inc1.id).toMatch(/^INC-\d+-[a-f0-9]+$/);
  });

  test('should store incident to JSONL log', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    await manager.create({
      severity: 'critical',
      description: 'Critical issue',
    });

    const logFile = path.join(tempDir, '.aiox/incidents/log.jsonl');
    const content = fs.readFileSync(logFile, 'utf8');
    expect(content).toContain('Critical issue');
  });

  test('should retrieve incident by ID', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const created = await manager.create({
      severity: 'high',
      description: 'Test incident',
    });

    const retrieved = await manager.get(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.description).toBe('Test incident');
  });

  test('should return null for nonexistent incident', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const incident = await manager.get('INC-invalid-id');
    expect(incident).toBeNull();
  });

  test('should resolve incident', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const created = await manager.create({
      severity: 'high',
      description: 'Test incident',
    });

    const resolved = await manager.resolve(created.id);
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.id).toBe(created.id);
  });

  test('should reject resolving already resolved incident', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const created = await manager.create({
      severity: 'high',
      description: 'Test incident',
    });

    await manager.resolve(created.id);
    await expect(manager.resolve(created.id)).rejects.toThrow('already resolved');
  });

  test('should list all incidents', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    await manager.create({
      severity: 'critical',
      description: 'Critical',
    });

    await manager.create({
      severity: 'low',
      description: 'Low',
    });

    const incidents = await manager.list();
    expect(incidents.length).toBe(2);
  });

  test('should list only open incidents', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc1 = await manager.create({
      severity: 'high',
      description: 'Open incident',
    });

    const inc2 = await manager.create({
      severity: 'medium',
      description: 'Closed incident',
    });

    await manager.resolve(inc2.id);

    const open = await manager.list(true);
    expect(open.length).toBe(1);
    expect(open[0].id).toBe(inc1.id);
  });

  test('should sort incidents by creation date descending', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc1 = await manager.create({
      severity: 'low',
      description: 'First',
    });

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const inc2 = await manager.create({
      severity: 'high',
      description: 'Second',
    });

    const list = await manager.list();
    expect(list[0].id).toBe(inc2.id);
    expect(list[1].id).toBe(inc1.id);
  });

  test('should calculate statistics', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc1 = await manager.create({
      severity: 'critical',
      description: 'Critical 1',
    });

    const inc2 = await manager.create({
      severity: 'high',
      description: 'High 1',
    });

    const inc3 = await manager.create({
      severity: 'medium',
      description: 'Medium 1',
    });

    await manager.resolve(inc1.id);

    const stats = await manager.stats();
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(2);
    expect(stats.closed).toBe(1);
    expect(stats.bySeverity.critical).toBe(1);
    expect(stats.bySeverity.high).toBe(1);
    expect(stats.bySeverity.medium).toBe(1);
  });

  test('should append to JSONL log atomically', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc1 = await manager.create({
      severity: 'high',
      description: 'First',
    });

    const inc2 = await manager.create({
      severity: 'critical',
      description: 'Second',
    });

    const logFile = path.join(tempDir, '.aiox/incidents/log.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');

    expect(lines.length).toBe(2);
    expect(lines[0]).toContain(inc1.id);
    expect(lines[1]).toContain(inc2.id);
  });

  test('should track creation metadata', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const incident = await manager.create({
      severity: 'medium',
      description: 'Test',
    });

    expect(incident.createdBy).toBeDefined();
    expect(incident.createdAt).toBeDefined();
  });

  test('should support resolution metadata', async () => {
    const manager = new IncidentManager({ cwd: tempDir });
    const inc = await manager.create({
      severity: 'high',
      description: 'Test',
    });

    const resolved = await manager.resolve(inc.id, {
      resolution: 'Fixed by deploying patch',
      resolvedBy: 'devops-bot',
    });

    expect(resolved.resolution).toBe('Fixed by deploying patch');
    expect(resolved.resolvedBy).toBe('devops-bot');
  });

  test('should handle missing log file gracefully', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    // Log file doesn't exist yet
    const incidents = await manager.list();
    expect(incidents).toEqual([]);
  });

  test('should support all severity levels', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const severities = ['critical', 'high', 'medium', 'low'];

    for (const severity of severities) {
      const inc = await manager.create({
        severity,
        description: `Test ${severity}`,
      });
      expect(inc.severity).toBe(severity);
    }

    const all = await manager.list();
    expect(all.length).toBe(4);
  });

  test('should format JSONL log correctly', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const incident = await manager.create({
      severity: 'high',
      description: 'Test incident with special characters: "quotes" and \\backslash',
    });

    const logFile = path.join(tempDir, '.aiox/incidents/log.jsonl');
    const line = fs.readFileSync(logFile, 'utf8').trim();
    const parsed = JSON.parse(line);

    expect(parsed.id).toBe(incident.id);
    expect(parsed.description).toContain('special characters');
  });

  test('should keep latest version of incident in list', async () => {
    const manager = new IncidentManager({ cwd: tempDir });

    const inc = await manager.create({
      severity: 'high',
      description: 'Initial',
    });

    // Simulate update by resolving
    await manager.resolve(inc.id);

    const list = await manager.list(false);
    const retrieved = list.find(i => i.id === inc.id);

    expect(retrieved.resolvedAt).toBeDefined();
  });
});
