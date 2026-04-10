/**
 * Squad Metrics Aggregator
 * Real-time analysis and aggregation of squad metrics
 */

/**
 * Calculate velocity from story metrics
 */
function aggregateVelocity(metrics) {
  if (!metrics.stories) return 0;
  return metrics.stories.completed || 0;
}

/**
 * Calculate quality score from test and lint metrics
 */
function aggregateQuality(metrics) {
  let scores = [];

  if (metrics.tests) {
    const testScore = metrics.tests.failedTests === 0 ? 100 :
      Math.round((metrics.tests.passedTests / (metrics.tests.totalTests || 1)) * 100);
    scores.push(testScore);
  }

  if (metrics.lint) {
    const lintScore = metrics.lint.total_issues === 0 ? 100 :
      Math.max(0, 100 - (metrics.lint.total_issues * 5));
    scores.push(lintScore);
  }

  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((a, b) => a + b) / scores.length);
}

/**
 * Calculate reliability from git and test metrics
 */
function aggregateReliability(metrics) {
  let scores = [];

  if (metrics.git) {
    // Commits indicate active development
    const gitScore = (metrics.git.commits_last_10 || 0) > 0 ? 95 : 50;
    scores.push(gitScore);
  }

  if (metrics.tests) {
    const testScore = metrics.tests.status === 'passed' ? 100 : 30;
    scores.push(testScore);
  }

  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((a, b) => a + b) / scores.length);
}

/**
 * Aggregate all metrics into summary
 */
function aggregate(collectedMetrics) {
  return {
    timestamp: collectedMetrics.timestamp,
    velocity: aggregateVelocity(collectedMetrics.metrics),
    quality: aggregateQuality(collectedMetrics.metrics),
    reliability: aggregateReliability(collectedMetrics.metrics),
    details: collectedMetrics.metrics
  };
}

/**
 * Generate trend analysis from historical data
 */
function analyzeTrend(historicalMetrics) {
  if (historicalMetrics.length < 2) {
    return { trend: 'insufficient_data', direction: null };
  }

  const recent = historicalMetrics.slice(-5);
  const older = historicalMetrics.slice(-10, -5);

  const recentAvg = recent.reduce((a, m) => a + (m.quality || 0), 0) / recent.length;
  const olderAvg = older.reduce((a, m) => a + (m.quality || 0), 0) / older.length;

  if (recentAvg > olderAvg) {
    return { trend: 'improving', direction: 'up', delta: Math.round(recentAvg - olderAvg) };
  } else if (recentAvg < olderAvg) {
    return { trend: 'declining', direction: 'down', delta: Math.round(olderAvg - recentAvg) };
  } else {
    return { trend: 'stable', direction: 'flat', delta: 0 };
  }
}

/**
 * Compare metrics between squads
 */
function compare(metrics1, metrics2) {
  return {
    squad1: {
      velocity: metrics1.velocity,
      quality: metrics1.quality,
      reliability: metrics1.reliability
    },
    squad2: {
      velocity: metrics2.velocity,
      quality: metrics2.quality,
      reliability: metrics2.reliability
    },
    differences: {
      velocity: metrics1.velocity - metrics2.velocity,
      quality: metrics1.quality - metrics2.quality,
      reliability: metrics1.reliability - metrics2.reliability
    }
  };
}

module.exports = {
  aggregateVelocity,
  aggregateQuality,
  aggregateReliability,
  aggregate,
  analyzeTrend,
  compare
};
