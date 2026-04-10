/**
 * Tests for Enhanced Agent Collaboration Protocol
 * @story 35.2 - Enhanced Agent Collaboration Protocol
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let mod;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiox-collab-test-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  const modulePath = require.resolve('../../.aiox-core/cli/commands/collab/index.js');
  delete require.cache[modulePath];
  mod = require('../../.aiox-core/cli/commands/collab/index.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('collab command', () => {
  // -- AGENT_CAPABILITIES -----------------------------------------------------

  describe('AGENT_CAPABILITIES', () => {
    it('defines all 10 agents', () => {
      const agents = Object.keys(mod.AGENT_CAPABILITIES);
      expect(agents.length).toBe(10);
      expect(agents).toContain('dev');
      expect(agents).toContain('qa');
      expect(agents).toContain('devops');
    });

    it('devops has git-push capability', () => {
      expect(mod.AGENT_CAPABILITIES.devops.capabilities).toContain('git-push');
    });

    it('dev is blocked from git-push', () => {
      expect(mod.AGENT_CAPABILITIES.dev.blocked).toContain('git-push');
    });

    it('each agent has name, role, capabilities, blocked', () => {
      for (const [id, agent] of Object.entries(mod.AGENT_CAPABILITIES)) {
        expect(agent.name).toBeDefined();
        expect(agent.role).toBeDefined();
        expect(Array.isArray(agent.capabilities)).toBe(true);
        expect(Array.isArray(agent.blocked)).toBe(true);
      }
    });
  });

  // -- DEFAULT_CHAINS ---------------------------------------------------------

  describe('DEFAULT_CHAINS', () => {
    it('defines story-development chain', () => {
      const chain = mod.DEFAULT_CHAINS['story-development'];
      expect(chain).toBeDefined();
      expect(chain.chain).toContain('dev');
      expect(chain.chain).toContain('qa');
    });

    it('defines qa-loop chain', () => {
      expect(mod.DEFAULT_CHAINS['qa-loop']).toBeDefined();
    });

    it('defines spec-pipeline chain', () => {
      expect(mod.DEFAULT_CHAINS['spec-pipeline']).toBeDefined();
    });

    it('defines brownfield chain', () => {
      expect(mod.DEFAULT_CHAINS['brownfield']).toBeDefined();
    });
  });

  // -- parseSimpleYaml --------------------------------------------------------

  describe('parseSimpleYaml', () => {
    it('parses key-value pairs', () => {
      const yaml = 'from_agent: dev\nto_agent: qa\n';
      const result = mod.parseSimpleYaml(yaml);
      expect(result.from_agent).toBe('dev');
      expect(result.to_agent).toBe('qa');
    });

    it('skips comments and empty lines', () => {
      const yaml = '# comment\n\nkey: value\n';
      const result = mod.parseSimpleYaml(yaml);
      expect(result.key).toBe('value');
    });

    it('handles list items', () => {
      const yaml = 'items:\n- first\n- second\n';
      const result = mod.parseSimpleYaml(yaml);
      expect(result.items).toEqual(['first', 'second']);
    });
  });

  // -- Handoff operations -----------------------------------------------------

  describe('createHandoff', () => {
    it('creates handoff artifact file', () => {
      const filename = mod.createHandoff('dev', 'qa', { story: 'S1' });
      expect(filename).toContain('handoff-dev-to-qa');
      const dir = mod.getHandoffDir();
      expect(fs.existsSync(path.join(dir, filename))).toBe(true);
    });

    it('stores context in artifact', () => {
      const filename = mod.createHandoff('sm', 'po', { task: 'validate' });
      const dir = mod.getHandoffDir();
      const data = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
      expect(data.from_agent).toBe('sm');
      expect(data.to_agent).toBe('po');
      expect(data.context.task).toBe('validate');
      expect(data.consumed).toBe(false);
    });
  });

  describe('listHandoffs', () => {
    it('returns empty when no handoffs', () => {
      expect(mod.listHandoffs()).toEqual([]);
    });

    it('lists all handoff artifacts', () => {
      mod.createHandoff('a', 'b', {});
      mod.createHandoff('c', 'd', {});
      const list = mod.listHandoffs();
      expect(list.length).toBe(2);
    });
  });

  describe('getActiveHandoff', () => {
    it('returns null when no handoffs', () => {
      expect(mod.getActiveHandoff()).toBeNull();
    });

    it('returns most recent unconsumed handoff', () => {
      mod.createHandoff('dev', 'qa', { story: 'active' });
      const active = mod.getActiveHandoff();
      expect(active).not.toBeNull();
      expect(active.from_agent).toBe('dev');
      expect(active.consumed).toBe(false);
    });
  });

  // -- getChains --------------------------------------------------------------

  describe('getChains', () => {
    it('returns default chains when no file exists', () => {
      const chains = mod.getChains();
      expect(chains['story-development']).toBeDefined();
    });
  });

  // -- ensureHandoffDir -------------------------------------------------------

  describe('ensureHandoffDir', () => {
    it('creates handoff directory', () => {
      const dir = mod.ensureHandoffDir();
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  // -- runCollab CLI ----------------------------------------------------------

  describe('runCollab', () => {
    it('shows no active collaboration when empty', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runCollab([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No active'));
      spy.mockRestore();
    });

    it('shows active handoff when exists', () => {
      mod.createHandoff('dev', 'qa', {});
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runCollab([]);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Active Handoff'));
      spy.mockRestore();
    });

    it('lists chains without workflow arg', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runCollab(['chain']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Available'));
      spy.mockRestore();
    });

    it('shows matrix', () => {
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runCollab(['matrix']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Capability Matrix'));
      spy.mockRestore();
    });

    it('shows history', () => {
      mod.createHandoff('a', 'b', {});
      const spy = jest.spyOn(console, 'log').mockImplementation();
      mod.runCollab(['history']);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Handoff History'));
      spy.mockRestore();
    });
  });
});
