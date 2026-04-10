/**
 * Squad Health Monitor
 * Continuous monitoring of squad health metrics
 */

const { execSync } = require('child_process');

/**
 * Monitor agent responsiveness
 */
function monitorAgentResponsiveness(agents) {
  const results = agents.map(agent => {
    // In real system, would ping agent
    return {
      agentId: agent.id,
      responsive: agent.status === 'ready',
      lastCheck: new Date().toISOString()
    };
  });

  const responsiveCount = results.filter(r => r.responsive).length;
  const healthScore = (responsiveCount / agents.length) * 100;

  return {
    healthy: healthScore >= 50,
    healthScore: Math.round(healthScore),
    responsiveAgents: responsiveCount,
    totalAgents: agents.length,
    details: results
  };
}

/**
 * Monitor task completion rate
 */
function monitorTaskCompletion() {
  try {
    // In real system, would query task registry
    // For now, analyze recent git commits as proxy
    const commitLog = execSync('git log --oneline -20', { encoding: 'utf8' });
    const commits = commitLog.split('\n').filter(l => l).length;

    return {
      healthy: commits >= 5,
      commitCount: commits,
      threshold: 5,
      trend: commits > 10 ? 'accelerating' : 'normal'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      commitCount: 0
    };
  }
}

/**
 * Monitor error rates
 */
function monitorErrorRates() {
  try {
    // In real system, would parse error logs
    // For now, return mock data
    return {
      healthy: true,
      errorCount: 0,
      threshold: 10,
      errorTypes: {
        runtime: 0,
        timeout: 0,
        network: 0
      }
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      errorCount: 0
    };
  }
}

/**
 * Monitor resource usage
 */
function monitorResourceUsage() {
  try {
    // In real system, would check CPU/memory
    return {
      healthy: true,
      cpu: 45,
      memory: 60,
      thresholds: { cpu: 80, memory: 85 }
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Comprehensive health check
 */
function checkOverallHealth(squad) {
  const agentHealth = monitorAgentResponsiveness(squad.agents || []);
  const taskHealth = monitorTaskCompletion();
  const errorHealth = monitorErrorRates();
  const resourceHealth = monitorResourceUsage();

  const allHealthy = [agentHealth, taskHealth, errorHealth, resourceHealth]
    .every(h => h.healthy);

  const healthScore = Math.round(
    (agentHealth.healthScore || 0 + (taskHealth.healthy ? 100 : 0) +
    (errorHealth.healthy ? 100 : 0) + (resourceHealth.healthy ? 100 : 0)) / 4
  );

  return {
    timestamp: new Date().toISOString(),
    squadId: squad.id,
    overall: {
      healthy: allHealthy,
      healthScore,
      status: healthScore >= 75 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'critical'
    },
    components: {
      agents: agentHealth,
      tasks: taskHealth,
      errors: errorHealth,
      resources: resourceHealth
    },
    requiresRecovery: !allHealthy
  };
}

module.exports = {
  monitorAgentResponsiveness,
  monitorTaskCompletion,
  monitorErrorRates,
  monitorResourceUsage,
  checkOverallHealth
};
