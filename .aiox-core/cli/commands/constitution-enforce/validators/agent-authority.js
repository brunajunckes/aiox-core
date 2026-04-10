const fs = require('fs');
const path = require('path');

/**
 * Agent Authority Validator (Article II)
 * Checks: @devops exclusive git push, agent boundaries respected
 */

async function validate(cwd) {
  const results = [];

  // Check 1: .claude/rules/agent-authority.md exists
  const rulesPath = path.join(cwd, '.claude/rules/agent-authority.md');
  if (fs.existsSync(rulesPath)) {
    const content = fs.readFileSync(rulesPath, 'utf8');
    if (content.includes('git push')) {
      results.push({
        type: 'pass',
        message: 'Agent authority rules documented',
      });
    }
  } else {
    results.push({
      type: 'violation',
      severity: 'high',
      message: 'Agent authority rules not found',
      suggestion: 'Create .claude/rules/agent-authority.md',
    });
  }

  // Check 2: @devops exclusive for git push is enforced in dev agent
  const devMdPath = path.join(cwd, '.claude/commands/AIOX/agents/dev.md');
  if (fs.existsSync(devMdPath)) {
    const content = fs.readFileSync(devMdPath, 'utf8');
    if (content.includes('git push') && content.includes('BLOCKED')) {
      results.push({
        type: 'pass',
        message: '@dev agent respects git push boundary',
      });
    }
  }

  // Check 3: Agent command files exist
  const agentsPath = path.join(cwd, '.claude/commands/AIOX/agents');
  if (fs.existsSync(agentsPath)) {
    const agentFiles = fs.readdirSync(agentsPath);
    const expectedAgents = ['dev.md', 'qa.md', 'architect.md', 'pm.md', 'po.md', 'sm.md', 'analyst.md'];
    const found = expectedAgents.filter(a => agentFiles.includes(a));
    if (found.length >= 5) {
      results.push({
        type: 'pass',
        message: `Core agents defined (${found.length}/${expectedAgents.length})`,
      });
    }
  }

  // Check 4: Story workflow respects agent order
  const smFile = path.join(cwd, '.claude/commands/AIOX/agents/sm.md');
  const devFile = path.join(cwd, '.claude/commands/AIOX/agents/dev.md');
  if (fs.existsSync(smFile) && fs.existsSync(devFile)) {
    results.push({
      type: 'pass',
      message: 'Story creation and development agents defined',
    });
  }

  return results;
}

module.exports = { validate };
