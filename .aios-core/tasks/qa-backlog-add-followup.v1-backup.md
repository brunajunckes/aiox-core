# QA Task: Add Follow-up to Backlog

**Agent:** @qa
**Command:** `*backlog-add` (when used by @qa, defaults to type F)
**Purpose:** Add follow-up item from QA review to backlog
**Created:** 2025-01-16 (Story 6.1.2.6)

---

## Task Flow

### 1. Elicit Follow-up Details
```yaml
elicit: true
questions:
  - Title (1-line description):
    input: text
    validation: min 10 chars, max 100 chars
    example: "Add edge case tests for user authentication flow"

  - Detailed Description:
    input: textarea
    validation: max 500 chars
    placeholder: "Describe what needs to be followed up on and why"

  - Priority:
    options:
      - Critical (🔴) - Blocking issue or security concern
      - High (🟠) - Important but not blocking
      - Medium (🟡) - Nice to have
      - Low (🟢) - Optional improvement
    default: Medium
    note: "Critical/High follow-ups should be addressed before story completion"

  - Related Story ID:
    input: text
    example: "6.1.2.6"
    note: "Usually the story being reviewed"
    required: true

  - Tags (optional, comma-separated):
    input: text
    example: "testing, edge-case, security"
    suggestions: ["testing", "edge-case", "security", "performance", "documentation"]

  - Estimated Effort (optional):
    input: text
    example: "2 hours", "1 day"
    default: "TBD"
```

### 2. Validate Related Story
```javascript
// QA review items MUST have a related story
if (!relatedStory) {
  throw new Error('QA follow-ups must be linked to a story. Use related story ID.');
}

// Validate story exists
const storyPath = `docs/stories/**/*${relatedStory}*.md`;
const matches = await glob(storyPath);

if (matches.length === 0) {
  throw new Error(`Story not found: ${relatedStory}`);
}

if (matches.length > 1) {
  console.log('⚠️ Multiple stories matched, using first:');
  matches.forEach(m => console.log(`  - ${m}`));
}

const storyFile = matches[0];
```

### 3. Add to Backlog
```javascript
const { BacklogManager } = require('.aios-core/scripts/backlog-manager');

const manager = new BacklogManager('docs/stories/backlog.md');
await manager.load();

// QA always creates Follow-up type (F)
const item = await manager.addItem({
  type: 'F',  // Follow-up
  title: title,
  description: description,
  priority: priority,
  relatedStory: relatedStory,
  createdBy: '@qa',
  tags: tags,
  estimatedEffort: estimatedEffort
});

console.log(`✅ Follow-up added to backlog: ${item.id}`);
```

### 4. Update Story QA Results (Optional)
```yaml
elicit: true
question: "Add reference to QA Results section in story?"
options:
  - yes: Update story file with backlog reference
  - no: Skip story update
default: yes
```

```javascript
if (updateStory) {
  const storyContent = await fs.readFile(storyFile, 'utf8');

  // Find QA Results section
  const qaResultsMatch = storyContent.match(/## QA Results/);

  if (qaResultsMatch) {
    const updatedContent = storyContent.replace(
      /## QA Results/,
      `## QA Results\n\n**Follow-up Created:** [Backlog Item ${item.id}](../backlog.md) - ${title}\n`
    );

    await fs.writeFile(storyFile, updatedContent, 'utf8');
    console.log(`✅ Story updated with backlog reference`);
  } else {
    console.log('⚠️ QA Results section not found in story, skipping update');
  }
}
```

### 5. Regenerate Backlog
```javascript
await manager.generateBacklogFile();

console.log('✅ Backlog updated: docs/stories/backlog.md');
```

### 6. Summary Output
```markdown
## 📌 Follow-up Added to Backlog

**ID:** ${item.id}
**Type:** 📌 Follow-up (from QA review)
**Title:** ${title}
**Priority:** ${priorityEmoji} ${priority}
**Related Story:** ${relatedStory}
**Estimated Effort:** ${estimatedEffort}
**Tags:** ${tags.join(', ') || 'None'}

**Next Steps:**
- Review in backlog: docs/stories/backlog.md
- @po will prioritize with `*backlog-prioritize ${item.id}`
- @dev will address before story completion (if Critical/High)

${priority === 'Critical' || priority === 'High'
  ? '⚠️ **HIGH PRIORITY** - Should be addressed before story completion'
  : ''
}
```

---

## Example Usage

```bash
# During QA review of Story 6.1.2.6
*backlog-add

# Example responses:
Title: Add integration tests for story index generator
Description: Current implementation only has unit tests. Integration tests needed to verify end-to-end story scanning and index generation.
Priority: High
Related Story: 6.1.2.6
Tags: testing, integration, coverage
Effort: 3 hours
Update story? yes

# Output:
✅ Follow-up added to backlog: 1763298742141
✅ Story updated with backlog reference
✅ Backlog updated: docs/stories/backlog.md
```

---

## QA-Specific Rules

1. **Type is always F (Follow-up)** - QA creates follow-ups, not tech debt
2. **Related story is required** - All QA items linked to reviewed story
3. **Priority guidance:**
   - Critical: Security issue, data corruption risk, blocking bug
   - High: Important test gap, significant edge case
   - Medium: Nice-to-have test, minor gap
   - Low: Optional improvement
4. **Story update recommended** - Keep follow-ups visible in story file

---

## Error Handling

- **No related story:** Require story ID, don't allow orphan follow-ups
- **Story not found:** Show similar story names, allow retry
- **QA Results section missing:** Log warning, skip story update
- **Backlog locked:** Retry 3x with 1s delay

---

## Testing

```bash
# Test with sample story
*backlog-add
# Fill in test data
# Verify:
# - Item added to backlog with type=F
# - createdBy = @qa
# - Story file updated (if QA Results section exists)
# - Priority reflected in backlog ordering
```

---

**Related Tasks:**
- `qa-review.md` - Comprehensive story review
- `qa-gate.md` - Quality gate decision
- `po-backlog-review.md` - PO reviews all follow-ups
