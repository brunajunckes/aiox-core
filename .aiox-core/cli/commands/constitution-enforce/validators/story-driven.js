const fs = require('fs');
const path = require('path');

/**
 * Story-Driven Development Validator (Article III)
 * Checks: Development follows stories, stories have all necessary structure
 */

async function validate(cwd) {
  const results = [];

  // Check 1: Stories directory exists
  const storiesPath = path.join(cwd, 'docs/stories');
  if (!fs.existsSync(storiesPath)) {
    results.push({
      type: 'violation',
      severity: 'high',
      message: 'Stories directory missing',
      suggestion: 'Create docs/stories/ directory',
    });
    return results;
  }

  results.push({
    type: 'pass',
    message: 'Stories directory exists',
  });

  // Check 2: Story files have proper structure
  const storyFiles = fs.readdirSync(storiesPath).filter(f => f.endsWith('.md'));
  if (storyFiles.length === 0) {
    results.push({
      type: 'violation',
      severity: 'medium',
      message: 'No stories found in docs/stories/',
      suggestion: 'Create at least one story file',
    });
  } else {
    const validStories = storyFiles.filter(f => {
      const content = fs.readFileSync(path.join(storiesPath, f), 'utf8');
      return (
        content.includes('## Summary') &&
        content.includes('## Acceptance Criteria') &&
        content.includes('## Tasks')
      );
    });

    if (validStories.length / storyFiles.length >= 0.8) {
      results.push({
        type: 'pass',
        message: `${validStories.length}/${storyFiles.length} stories follow proper structure`,
      });
    } else {
      results.push({
        type: 'violation',
        severity: 'medium',
        message: `Only ${validStories.length}/${storyFiles.length} stories have proper structure`,
        suggestion: 'Ensure all story files have Summary, Acceptance Criteria, and Tasks sections',
      });
    }
  }

  // Check 3: .aiox-core/core-config.yaml documents story location
  const configPath = path.join(cwd, '.aiox-core/core-config.yaml');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    if (content.includes('devStoryLocation:')) {
      results.push({
        type: 'pass',
        message: 'Story location configured in core-config.yaml',
      });
    }
  }

  return results;
}

module.exports = { validate };
