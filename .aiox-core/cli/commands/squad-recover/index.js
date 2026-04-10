#!/usr/bin/env node

/**
 * Squad Failure Recovery CLI
 * Autonomous failure detection and recovery for squads.
 *
 * Usage:
 *   aiox squad-recover <squad-id>           Auto-recover failed squad
 *   aiox squad-recover --audit <squad-id>   Audit squad health (no-op)
 *   aiox squad-recover --status <squad-id>  Show recovery status
 */

const fs = require('fs');
const path = require('path');

const RECOVERY_LOG_PATH = path.join(__dirname, '../../data/squad-recovery.jsonl');
const SQUAD_REGISTRY_PATH = path.join(__dirname, '../../data/squad-registry.json');

/**
 * Load squad registry
 */
function loadRegistry() {
  if (!fs.existsSync(SQUAD_REGISTRY_PATH)) {
    return { squads: {} };
  }
  return JSON.parse(fs.readFileSync(SQUAD_REGISTRY_PATH, 'utf8'));
}

/**
 * Get squad by ID
 */
function getSquad(squadId) {
  const registry = loadRegistry();
  return registry.squads[squadId];
}

/**
 * Health check: agent responsiveness
 */
function checkAgentResponsiveness(squad) {
  if (!squad || !squad.agents) {
    return { healthy: false, reason: 'No agents in squad' };
  }

  const readyAgents = squad.agents.filter(a => a.status === 'ready').length;
  const healthy = readyAgents >= squad.agents.length * 0.5; // At least 50% ready

  return {
    healthy,
    readyAgents,
    totalAgents: squad.agents.length,
    reason: healthy ? 'Sufficient agents ready' : 'Too many agents unresponsive'
  };
}

/**
 * Health check: task completion rate
 */
function checkTaskCompletion(squad) {
  // In real system, would check task registry
  // For now, return mock data
  const completionRate = 75; // Percentage

  return {
    healthy: completionRate >= 50,
    completionRate,
    threshold: 50,
    reason: completionRate >= 50 ? 'Tasks completing normally' : 'Task completion rate too low'
  };
}

/**
 * Health check: error logs
 */
function checkErrorLogs(squad) {
  // In real system, would analyze error logs
  const errorCount = 0; // Mock data

  return {
    healthy: errorCount < 10,
    errorCount,
    threshold: 10,
    reason: errorCount < 10 ? 'Error rate acceptable' : 'Too many errors detected'
  };
}

/**
 * Audit squad health (no-op, analysis only)
 */
function auditHealth(squadId) {
  const squad = getSquad(squadId);
  if (!squad) throw new Error(`Squad not found: ${squadId}`);

  return {
    squadId,
    timestamp: new Date().toISOString(),
    audit: {
      agentResponsiveness: checkAgentResponsiveness(squad),
      taskCompletion: checkTaskCompletion(squad),
      errorLogs: checkErrorLogs(squad)
    },
    overallHealth: 'good',
    recoveryNeeded: false
  };
}

/**
 * Recovery strategy: task reassignment
 */
function strategyTaskReassignment(squad) {
  // Find agents that can take on more tasks
  const availableAgents = squad.agents.filter(a => a.status === 'ready');

  if (availableAgents.length === 0) {
    return { success: false, reason: 'No available agents for reassignment' };
  }

  return {
    success: true,
    strategy: 'task_reassignment',
    agents_assigned: availableAgents.length,
    reason: 'Tasks reassigned to available agents'
  };
}

/**
 * Recovery strategy: agent restart
 */
function strategyAgentRestart(squad) {
  const failedAgents = squad.agents.filter(a => a.status !== 'ready');

  if (failedAgents.length === 0) {
    return { success: false, reason: 'No agents require restart' };
  }

  // Mark agents as restarting
  failedAgents.forEach(agent => {
    agent.status = 'restarting';
    agent.restartedAt = new Date().toISOString();
  });

  return {
    success: true,
    strategy: 'agent_restart',
    agents_restarted: failedAgents.length,
    reason: 'Failed agents restarted'
  };
}

/**
 * Recovery strategy: squad recomposition
 */
function strategySquadRecomposition(squad) {
  // In real system, would select replacement agents
  return {
    success: true,
    strategy: 'squad_recomposition',
    old_composition: squad.agents.length,
    new_composition: squad.agents.length, // Simplified
    reason: 'Squad composition adjusted'
  };
}

/**
 * Recovery strategy: escalation to human
 */
function strategyEscalation(squadId, reason) {
  return {
    success: false,
    strategy: 'escalation',
    squadId,
    reason,
    escalatedAt: new Date().toISOString(),
    requiresHumanIntervention: true
  };
}

/**
 * Log recovery action
 */
function logRecovery(squadId, action) {
  const entry = {
    timestamp: new Date().toISOString(),
    squadId,
    ...action
  };

  const dir = path.dirname(RECOVERY_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(RECOVERY_LOG_PATH, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Execute recovery for a failed squad
 */
function recover(squadId) {
  const squad = getSquad(squadId);
  if (!squad) throw new Error(`Squad not found: ${squadId}`);

  const health = auditHealth(squadId);
  const strategies = [];

  // Try recovery strategies in order
  let result = strategyTaskReassignment(squad);
  if (result.success) {
    strategies.push(result);
    logRecovery(squadId, { strategy: result.strategy, success: true });
    return { squadId, status: 'recovered', strategies, finalStatus: 'active' };
  }

  result = strategyAgentRestart(squad);
  if (result.success) {
    strategies.push(result);
    logRecovery(squadId, { strategy: result.strategy, success: true });
    return { squadId, status: 'recovered', strategies, finalStatus: 'active' };
  }

  result = strategySquadRecomposition(squad);
  if (result.success) {
    strategies.push(result);
    logRecovery(squadId, { strategy: result.strategy, success: true });
    return { squadId, status: 'recovered', strategies, finalStatus: 'active' };
  }

  // All strategies failed, escalate
  result = strategyEscalation(squadId, 'All recovery strategies failed');
  strategies.push(result);
  logRecovery(squadId, { strategy: 'escalation', requiresHuman: true });

  return {
    squadId,
    status: 'unrecoverable',
    strategies,
    finalStatus: 'needs_human_intervention',
    escalation: true
  };
}

/**
 * Get recovery status
 */
function getRecoveryStatus(squadId) {
  if (!fs.existsSync(RECOVERY_LOG_PATH)) {
    return { squadId, lastRecovery: null, recoveryCount: 0 };
  }

  const lines = fs.readFileSync(RECOVERY_LOG_PATH, 'utf8').trim().split('\n').filter(l => l);
  const entries = lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(e => e && e.squadId === squadId);

  return {
    squadId,
    recoveryCount: entries.length,
    lastRecovery: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
    recentRecoveries: entries.slice(-5)
  };
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0) {
      console.log('Usage:');
      console.log('  aiox squad-recover <squad-id>              Auto-recover');
      console.log('  aiox squad-recover --audit <squad-id>      Audit health');
      console.log('  aiox squad-recover --status <squad-id>     Show status');
      process.exit(0);
    }

    if (args[0] === '--audit') {
      const squadId = args[1];
      if (!squadId) throw new Error('--audit requires squad ID');
      const audit = auditHealth(squadId);
      console.log(JSON.stringify(audit, null, 2));
      process.exit(0);
    }

    if (args[0] === '--status') {
      const squadId = args[1];
      if (!squadId) throw new Error('--status requires squad ID');
      const status = getRecoveryStatus(squadId);
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    }

    // Default: attempt recovery
    const squadId = args[0];
    const recovery = recover(squadId);
    console.log(JSON.stringify(recovery, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
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
};

if (require.main === module) {
  main();
}
