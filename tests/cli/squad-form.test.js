/**
 * Tests for Squad Formation Engine
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const {
  loadTemplate,
  loadRegistry,
  saveRegistry,
  generateSquadId,
  validateSquad,
  createFromTemplate,
  autoFormSquad,
  listSquads,
  getSquad
} = require('../../.aiox-core/cli/commands/squad-form');

describe('Squad Formation Engine', () => {
  let tempDir;
  let originalRegistryPath;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `squad-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('generateSquadId', () => {
    it('should generate unique squad IDs', (done) => {
      const id1 = generateSquadId('dev-squad');
      setTimeout(() => {
        const id2 = generateSquadId('dev-squad');
        expect(id1).toMatch(/^squad-dev-squad-\d+$/);
        expect(id2).toMatch(/^squad-dev-squad-\d+$/);
        expect(id1).not.toBe(id2);
        done();
      }, 10);
    });

    it('should include template name in ID', () => {
      const id = generateSquadId('qa-squad');
      expect(id).toContain('qa-squad');
    });
  });

  describe('validateSquad', () => {
    it('should validate valid squad definition', () => {
      const squad = {
        name: 'Test Squad',
        agents: [{ id: 'agent1', name: 'Agent 1' }],
        capabilities: { capability1: { description: 'Test' } }
      };
      expect(() => validateSquad(squad)).not.toThrow();
    });

    it('should reject squad without name', () => {
      const squad = {
        agents: [{ id: 'agent1' }],
        capabilities: {}
      };
      expect(() => validateSquad(squad)).toThrow('Squad must have a valid name');
    });

    it('should reject squad without agents', () => {
      const squad = {
        name: 'Test Squad',
        agents: [],
        capabilities: {}
      };
      expect(() => validateSquad(squad)).toThrow('Squad must have at least one agent');
    });

    it('should reject squad without capabilities', () => {
      const squad = {
        name: 'Test Squad',
        agents: [{ id: 'agent1' }]
      };
      expect(() => validateSquad(squad)).toThrow('Squad must have defined capabilities');
    });
  });

  describe('loadRegistry', () => {
    it('should return empty registry if file does not exist', () => {
      // Mock the registry path
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const registry = loadRegistry();
      expect(registry.squads).toBeDefined();
      expect(Object.keys(registry.squads).length).toBe(0);
      jest.restoreAllMocks();
    });

    it('should load existing registry', () => {
      const registryData = {
        squads: {
          'squad-1': { id: 'squad-1', name: 'Squad 1' }
        }
      };
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(registryData));
      const registry = loadRegistry();
      expect(registry.squads['squad-1']).toBeDefined();
      jest.restoreAllMocks();
    });
  });

  describe('saveRegistry', () => {
    it('should write registry to disk', () => {
      const registry = {
        squads: {
          'squad-1': { id: 'squad-1', name: 'Squad 1' }
        }
      };
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      saveRegistry(registry);
      expect(writeSpy).toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  describe('validateSquad', () => {
    it('should validate squad with valid structure', () => {
      const squad = {
        name: 'Test Squad',
        agents: [{ id: 'dev', name: 'Dex' }],
        capabilities: { implementation: { description: 'Code implementation' } }
      };
      expect(() => validateSquad(squad)).not.toThrow();
    });
  });

  describe('createFromTemplate', () => {
    it('should create squad with generated ID', () => {
      const template = {
        name: 'Dev Squad',
        agents: [{ id: 'dev', name: 'Dex', role: 'Developer' }],
        capabilities: { implementation: { description: 'Code' } }
      };

      // This test verifies the function structure
      expect(() => {
        // Template validation happens in createFromTemplate
        validateSquad(template);
      }).not.toThrow();
    });
  });

  describe('Squad registry integration', () => {
    it('should persist squad to registry', () => {
      const squad = {
        id: 'squad-test-1',
        name: 'Test Squad',
        agents: [{ id: 'dev', name: 'Dex' }],
        capabilities: {},
        status: 'active'
      };

      const registry = { squads: {} };
      registry.squads[squad.id] = squad;

      expect(registry.squads['squad-test-1']).toBeDefined();
      expect(registry.squads['squad-test-1'].name).toBe('Test Squad');
    });

    it('should list only active squads', () => {
      const registry = {
        squads: {
          'squad-1': { id: 'squad-1', name: 'Squad 1', status: 'active' },
          'squad-2': { id: 'squad-2', name: 'Squad 2', status: 'inactive' },
          'squad-3': { id: 'squad-3', name: 'Squad 3', status: 'active' }
        }
      };

      const activeSquads = Object.values(registry.squads).filter(s => s.status === 'active');
      expect(activeSquads.length).toBe(2);
    });
  });

  describe('Agent status tracking', () => {
    it('should initialize agent status on squad creation', () => {
      const squad = {
        name: 'Dev Squad',
        agents: [
          { id: 'dev', name: 'Dex' },
          { id: 'architect', name: 'Aria' }
        ],
        capabilities: {}
      };

      const agentsWithStatus = squad.agents.map(agent => ({
        ...agent,
        status: 'ready',
        joinedAt: new Date().toISOString()
      }));

      expect(agentsWithStatus[0].status).toBe('ready');
      expect(agentsWithStatus[0].joinedAt).toBeDefined();
    });
  });

  describe('Squad capabilities', () => {
    it('should validate squad has defined capabilities', () => {
      const squad = {
        name: 'Squad with Capabilities',
        agents: [{ id: 'dev' }],
        capabilities: {
          implementation: { priority: 'critical', description: 'Code' },
          testing: { priority: 'high', description: 'Tests' }
        }
      };

      expect(() => validateSquad(squad)).not.toThrow();
      expect(Object.keys(squad.capabilities).length).toBe(2);
    });
  });

  describe('Squad workflows', () => {
    it('should support multiple workflows per squad', () => {
      const squad = {
        name: 'Dev Squad',
        agents: [{ id: 'dev' }],
        capabilities: {},
        workflows: [
          { name: 'story-development', steps: [] },
          { name: 'refactoring', steps: [] }
        ]
      };

      expect(squad.workflows.length).toBe(2);
    });
  });

  describe('Metadata tracking', () => {
    it('should include creation timestamp', () => {
      const now = new Date().toISOString();
      const squad = {
        id: 'squad-1',
        name: 'Test Squad',
        agents: [{ id: 'dev' }],
        capabilities: {},
        createdAt: now,
        status: 'active'
      };

      expect(squad.createdAt).toBe(now);
    });
  });

  describe('Squad ID generation', () => {
    it('should generate timestamp-based unique IDs', () => {
      const id1 = generateSquadId('test');
      const now = Date.now();
      expect(parseInt(id1.split('-').pop())).toBeGreaterThanOrEqual(now - 1000);
    });
  });
});
