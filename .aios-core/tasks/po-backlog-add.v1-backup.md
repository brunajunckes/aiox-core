# PO Task: Add Backlog Item

**Agent:** @po
**Command:** `*backlog-add`
**Purpose:** Add item to story backlog (follow-up, technical debt, or enhancement)
**Created:** 2025-01-16 (Story 6.1.2.6)

---

## Task Flow

### 1. Elicit Item Details
```yaml
elicit: true
questions:
  - Type of item?
    options:
      - F: Follow-up (📌) - Post-story action item
      - T: Technical Debt (🔧) - Code quality or architecture improvement
      - E: Enhancement (✨) - Feature improvement or optimization

  - Title (1-line description):
    input: text
    validation: min 10 chars, max 100 chars

  - Detailed Description (optional):
    input: textarea
    validation: max 500 chars

  - Priority:
    options:
      - Critical (🔴)
      - High (🟠)
      - Medium (🟡)
      - Low (🟢)
    default: Medium

  - Related Story ID (optional):
    input: text
    example: "6.1.2.6"
    validation: story file must exist if provided

  - Tags (optional, comma-separated):
    input: text
    example: "testing, performance, security"

  - Estimated Effort (optional):
    input: text
    example: "2 hours", "1 day", "1 week"
    default: "TBD"
```

### 2. Validate Input
```javascript
// Validate story exists if relatedStory provided
if (relatedStory) {
  const storyPath = `docs/stories/**/*${relatedStory}*.md`;
  const matches = await glob(storyPath);

  if (matches.length === 0) {
    throw new Error(`Story not found: ${relatedStory}`);
  }

  if (matches.length > 1) {
    console.log('⚠️ Multiple stories matched, using first:');
    matches.forEach(m => console.log(`  - ${m}`));
  }
}

// Parse tags
const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];
```

### 3. Add Item to Backlog
```javascript
const { BacklogManager } = require('.aios-core/scripts/backlog-manager');

const manager = new BacklogManager('docs/stories/backlog.md');
await manager.load();

const item = await manager.addItem({
  type: itemType,
  title: title,
  description: description || '',
  priority: priority,
  relatedStory: relatedStory || null,
  createdBy: '@po',
  tags: tags,
  estimatedEffort: estimatedEffort
});

console.log(`✅ Backlog item added: ${item.id}`);
console.log(`   Type: ${itemType} | Priority: ${priority}`);
console.log(`   ${title}`);
```

### 4. Regenerate Backlog File
```javascript
await manager.generateBacklogFile();

console.log('✅ Backlog updated: docs/stories/backlog.md');
```

### 5. Summary Output
```markdown
## 🎯 Backlog Item Added

**ID:** ${item.id}
**Type:** ${itemTypeEmoji} ${itemTypeName}
**Title:** ${title}
**Priority:** ${priorityEmoji} ${priority}
**Related Story:** ${relatedStory || 'None'}
**Estimated Effort:** ${estimatedEffort}
**Tags:** ${tags.join(', ') || 'None'}

**Next Steps:**
- Review in backlog: docs/stories/backlog.md
- Prioritize with `*backlog-prioritize ${item.id}`
- Schedule with `*backlog-schedule ${item.id}`
```

---

## Example Usage

```bash
# Interactive mode (recommended)
*backlog-add

# Example responses:
Type: F
Title: Add integration tests for story index generator
Description: Story 6.1.2.6 implementation needs integration tests
Priority: High
Related Story: 6.1.2.6
Tags: testing, integration, story-6.1.2.6
Effort: 3 hours
```

---

## Error Handling

- **Story not found:** Warn user, allow to proceed without related story
- **Invalid type:** Show valid options (F, T, E)
- **Invalid priority:** Default to Medium
- **Backlog file locked:** Retry 3x with 1s delay

---

## Testing

```bash
# Test with sample data
*backlog-add
# Fill in sample data and verify:
# - Item added to docs/stories/backlog.json
# - Backlog file regenerated at docs/stories/backlog.md
# - Item appears in correct section by type
# - Priority sorting works
```

---

**Related Tasks:**
- `po-stories-index.md` - Regenerate story index
- `po-backlog-review.md` - Review and prioritize backlog
- `po-backlog-schedule.md` - Schedule backlog items
