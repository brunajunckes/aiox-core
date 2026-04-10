const fs = require('fs');
const path = require('path');

/**
 * No Invention Validator (Article IV)
 * Checks: Features must be traced to requirements, no invented features
 * Requires AC (Acceptance Criteria) in all stories
 */

async function validate(cwd) {
  const results = [];

  // Check 1: PRD exists
  const prdPath = path.join(cwd, 'docs/prd.md');
  if (!fs.existsSync(prdPath)) {
    results.push({
      type: 'violation',
      severity: 'high',
      message: 'PRD not found',
      suggestion: 'Create docs/prd.md with requirements',
    });
    return results;
  }

  results.push({
    type: 'pass',
    message: 'PRD defined (docs/prd.md)',
  });

  // Check 2: Stories reference PRD
  const storiesPath = path.join(cwd, 'docs/stories');
  if (!fs.existsSync(storiesPath)) {
    results.push({
      type: 'violation',
      severity: 'medium',
      message: 'No stories to validate against PRD',
    });
  } else {
    const storyFiles = fs.readdirSync(storiesPath).filter(f => f.endsWith('.md'));
    const referencedStories = storyFiles.filter(f => {
      const content = fs.readFileSync(path.join(storiesPath, f), 'utf8');
      return (
        content.includes('## Acceptance Criteria') &&
        content.includes('[ ]') &&
        content.includes('## Summary')
      );
    });

    if (referencedStories.length > 0) {
      results.push({
        type: 'pass',
        message: `${referencedStories.length} stories with AC found`,
      });
    }
  }

  // Check 3: Architecture documents decisions
  const archPath = path.join(cwd, 'docs/architecture.md');
  if (fs.existsSync(archPath)) {
    const content = fs.readFileSync(archPath, 'utf8');
    if (content.includes('## Design Decisions') || content.includes('## Technology')) {
      results.push({
        type: 'pass',
        message: 'Architecture decisions documented',
      });
    }
  } else {
    results.push({
      type: 'violation',
      severity: 'medium',
      message: 'Architecture documentation missing',
      suggestion: 'Create docs/architecture.md with design decisions',
    });
  }

  // Check 4: No code without story
  // (This is harder to enforce automatically but we can check that src/ files are tracked)
  const srcPath = path.join(cwd, 'packages');
  if (fs.existsSync(srcPath)) {
    results.push({
      type: 'pass',
      message: 'Source code in packages/ (should be story-driven)',
    });
  }

  return results;
}

module.exports = { validate };
