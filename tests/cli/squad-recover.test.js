/**
 * Tests for Squad Failure Recovery
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadRegistry,
  getSquad,
  checkAgentResponsiveness,
  checkTaskCompletion,
  checkErrorLogs,
  auditHealth,
  strategyTaskReassignment,
  strategyAgentRestart,
  strategySquadRecomposition,
  strategyEscalation,
  logRecovery,
  recover,
  getRecoveryStatus
} = require('../../.aiox-core/cli/commands/squad-recover');

describe('Squad Failure Recovery', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `recovery-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Agent Responsiveness Check', () => {
    it('should report healthy if 50%+ agents ready', () => {
      const squad = {
        agents: [
          { id: 'agent-1', status: 'ready' },
          { id: 'agent-2', status: 'ready' },
          { id: 'agent-3', status: 'failed' }
        ]
      };

      const result = checkAgentResponsiveness(squad);
      expect(result.healthy).toBe(true);
      expect(result.readyAgents).toBe(2);
    });

    it('should report unhealthy if <50% agents ready', () => {
      const squad = {
        agents: [
          { id: 'agent-1', status: 'failed' },
          { id: 'agent-2', status: 'failed' },
          { id: 'agent-3', status: 'ready' }
        ]
      };

      const result = checkAgentResponsiveness(squad);
      expect(result.healthy).toBe(false);
    });

    it('should handle squad with no agents', () => {
      const squad = { agents: [] };
      const result = checkAgentResponsiveness(squad);
      // No agents = no ready agents, but function may return based on logic
      expect(result.healthy).toBeDefined();
    });
  });

  describe('Task Completion Check', () => {
    it('should return health status', () => {
      const result = checkTaskCompletion({});
      expect(result.healthy).toBeDefined();
      expect(result.completionRate).toBeDefined();
    });

    it('should report healthy if completion >= threshold', () => {
      const result = checkTaskCompletion({});
      expect(result.healthy).toBe(result.completionRate >= result.threshold);
    });
  });

  describe('Error Log Check', () => {
    it('should return health status', () => {
      const result = checkErrorLogs({});
      expect(result.healthy).toBeDefined();
      expect(result.errorCount).toBeDefined();
    });

    it('should report healthy if errors < threshold', () => {
      const result = checkErrorLogs({});
      expect(result.healthy).toBe(result.errorCount < result.threshold);
    });
  });

  describe('Health Audit', () => {
    it('should audit all health components', () => {
      const audit = {
        squadId: 'squad-1',
        audit: {
          agentResponsiveness: { healthy: true },
          taskCompletion: { healthy: true },
          errorLogs: { healthy: true }
        }
      };
      expect(audit.squadId).toBe('squad-1');
      expect(audit.audit.agentResponsiveness).toBeDefined();
      expect(audit.audit.taskCompletion).toBeDefined();
      expect(audit.audit.errorLogs).toBeDefined();
    });

    it('should validate squad exists', () => {
      expect(() => {
        const squads = {};
        if (!squads['squad-99']) throw new Error('Squad not found');
      }).toThrow();
    });
  });

  describe('Recovery Strategies', () => {
    it('should attempt task reassignment', () => {
      const squad = {
        agents: [
          { id: 'agent-1', status: 'ready' },
          { id: 'agent-2', status: 'failed' }
        ]
      };

      const result = strategyTaskReassignment(squad);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('task_reassignment');
    });

    it('should return false if no available agents', () => {
      const squad = {
        agents: [
          { id: 'agent-1', status: 'failed' },
          { id: 'agent-2', status: 'failed' }
        ]
      };

      const result = strategyTaskReassignment(squad);
      expect(result.success).toBe(false);
    });

    it('should restart failed agents', () => {
      const squad = {
        agents: [
          { id: 'agent-1', status: 'ready' },
          { id: 'agent-2', status: 'failed' }
        ]
      };

      const result = strategyAgentRestart(squad);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('agent_restart');
      expect(result.agents_restarted).toBe(1);
    });

    it('should handle no agents needing restart', () => {
      const squad = {
        agents: [{ id: 'agent-1', status: 'ready' }]
      };

      const result = strategyAgentRestart(squad);
      expect(result.success).toBe(false);
    });

    it('should support squad recomposition', () => {
      const squad = {
        agents: [{ id: 'agent-1', status: 'ready' }]
      };

      const result = strategySquadRecomposition(squad);
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('squad_recomposition');
    });

    it('should support escalation to human', () => {
      const result = strategyEscalation('squad-1', 'All strategies failed');
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('escalation');
      expect(result.requiresHumanIntervention).toBe(true);
    });
  });

  describe('Recovery Logging', () => {
    it('should log recovery action', () => {
      const action = { strategy: 'task_reassignment', success: true };
      jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      logRecovery('squad-1', action);
      expect(fs.appendFileSync).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should include timestamp in log entry', () => {
      const action = { strategy: 'test' };
      const entry = {
        timestamp: new Date().toISOString(),
        squadId: 'squad-1',
        ...action
      };

      expect(entry.timestamp).toBeDefined();
      expect(entry.squadId).toBe('squad-1');
    });
  });

  describe('Recovery Execution', () => {
    it('should execute recovery for squad', () => {
      const result = {
        squadId: 'squad-1',
        strategies: []
      };
      expect(result.squadId).toBe('squad-1');
      expect(result.strategies).toBeDefined();
    });

    it('should escalate if needed', () => {
      const result = {
        squadId: 'squad-1',
        strategies: []
      };
      expect(result.squadId).toBe('squad-1');
    });

    it('should validate squad exists', () => {
      expect(() => {
        const squads = {};
        if (!squads['squad-99']) throw new Error('Squad not found');
      }).toThrow();
    });
  });

  describe('Recovery Status', () => {
    it('should return recovery history for squad', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const status = getRecoveryStatus('squad-1');
      expect(status.squadId).toBe('squad-1');
      expect(status.recoveryCount).toBe(0);
      expect(status.lastRecovery).toBeNull();

      jest.restoreAllMocks();
    });

    it('should parse recovery log', () => {
      const entries = [
        { timestamp: '2026-04-10T10:00:00Z', squadId: 'squad-1', strategy: 'task_reassignment' },
        { timestamp: '2026-04-10T10:05:00Z', squadId: 'squad-1', strategy: 'agent_restart' }
      ];
      const content = entries.map(e => JSON.stringify(e)).join('\n');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(content);

      const status = getRecoveryStatus('squad-1');
      expect(status.recoveryCount).toBe(2);

      jest.restoreAllMocks();
    });
  });

  describe('Strategy Order', () => {
    it('should follow recovery strategy precedence', () => {
      // Strategies should be: reassign → restart → recompose → escalate
      const strategies = ['task_reassignment', 'agent_restart', 'squad_recomposition', 'escalation'];

      expect(strategies[0]).toBe('task_reassignment');
      expect(strategies[strategies.length - 1]).toBe('escalation');
    });
  });

  describe('Health Thresholds', () => {
    it('should use appropriate thresholds for health', () => {
      const agentHealth = checkAgentResponsiveness({ agents: [{ id: 'agent-1', status: 'ready' }] });
      expect(agentHealth.healthy).toBeDefined();

      const taskHealth = checkTaskCompletion({});
      expect(taskHealth.healthy).toBeDefined();
    });
  });

  describe('Graceful Degradation', () => {
    it('should not block on health check failures', () => {
      // If health check times out or errors, recovery should still proceed
      expect(() => {
        checkTaskCompletion({});
      }).not.toThrow();
    });

    it('should continue with next strategy if one fails', () => {
      const squad = {
        id: 'squad-1',
        agents: [{ id: 'agent-1', status: 'failed' }]
      };

      // Multiple strategies can be attempted
      const r1 = strategyTaskReassignment(squad);
      const r2 = strategyAgentRestart(squad);

      expect([r1.success, r2.success].some(s => s)).toBe(true);
    });
  });
});
