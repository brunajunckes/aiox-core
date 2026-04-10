/**
 * Squad Metrics Collector
 * Gathers raw metrics from CI/CD, tests, and git history
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Collect test results from jest output
 */
function collectTestMetrics() {
  try {
    const output = execSync('npm test -- --json 2>/dev/null || echo "{}"', { encoding: 'utf8' });
    const data = JSON.parse(output);
    return {
      type: 'test_result',
      totalTests: data.numTotalTests || 0,
      passedTests: data.numPassedTests || 0,
      failedTests: data.numFailedTests || 0,
      skipped: data.numPendingTests || 0,
      status: (data.numFailedTests || 0) === 0 ? 'passed' : 'failed'
    };
  } catch (error) {
    return {
      type: 'test_result',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Collect commit metrics from git history
 */
function collectGitMetrics() {
  try {
    const commits = execSync('git log --oneline -10', { encoding: 'utf8' });
    const commitsPerDay = commits.split('\n').filter(l => l).length;

    return {
      type: 'git_metric',
      commits_last_10: commitsPerDay,
      status: 'success'
    };
  } catch (error) {
    return {
      type: 'git_metric',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Collect story completion metrics
 */
function collectStoryMetrics() {
  try {
    const storiesDir = path.join(process.cwd(), 'docs/stories');
    if (!fs.existsSync(storiesDir)) {
      return {
        type: 'story_metric',
        completed: 0,
        inProgress: 0,
        status: 'success'
      };
    }

    const stories = fs.readdirSync(storiesDir)
      .filter(f => f.endsWith('.story.md'))
      .map(f => {
        const content = fs.readFileSync(path.join(storiesDir, f), 'utf8');
        return {
          file: f,
          isDone: content.includes('Status: Done') || content.includes('Status: InReview')
        };
      });

    const completed = stories.filter(s => s.isDone).length;
    const inProgress = stories.length - completed;

    return {
      type: 'story_metric',
      completed,
      inProgress,
      total: stories.length,
      status: 'success'
    };
  } catch (error) {
    return {
      type: 'story_metric',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Collect linting metrics
 */
function collectLintMetrics() {
  try {
    const output = execSync('npm run lint -- --format json 2>/dev/null || echo "[]"', { encoding: 'utf8' });
    const results = JSON.parse(output);
    const totalIssues = results.reduce((sum, r) => sum + (r.messages || []).length, 0);

    return {
      type: 'lint_metric',
      total_issues: totalIssues,
      status: totalIssues === 0 ? 'passed' : 'failed'
    };
  } catch (error) {
    return {
      type: 'lint_metric',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Collect all available metrics
 */
function collectAll() {
  return {
    timestamp: new Date().toISOString(),
    metrics: {
      tests: collectTestMetrics(),
      git: collectGitMetrics(),
      stories: collectStoryMetrics(),
      lint: collectLintMetrics()
    }
  };
}

module.exports = {
  collectTestMetrics,
  collectGitMetrics,
  collectStoryMetrics,
  collectLintMetrics,
  collectAll
};
