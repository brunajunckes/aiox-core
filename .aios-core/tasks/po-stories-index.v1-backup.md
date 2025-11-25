# PO Task: Regenerate Story Index

**Agent:** @po
**Command:** `*stories-index`
**Purpose:** Regenerate story index from docs/stories/ directory
**Created:** 2025-01-16 (Story 6.1.2.6)

---

## Task Flow

### 1. Confirm Regeneration
```yaml
elicit: true
question: "Regenerate story index? This will scan all stories and update docs/stories/index.md"
options:
  - yes: Proceed with regeneration
  - no: Cancel operation
  - preview: Show current stats without writing
```

### 2. Generate Story Index
```javascript
const { generateStoryIndex } = require('.aios-core/scripts/story-index-generator');

console.log('📚 Scanning stories directory...');

const result = await generateStoryIndex('docs/stories');

console.log(`✅ Story index generated`);
console.log(`   Total Stories: ${result.totalStories}`);
console.log(`   Output: ${result.outputPath}`);
```

### 3. Display Summary
```markdown
## 📊 Story Index Updated

**Total Stories:** ${totalStories}
**Output File:** docs/stories/index.md

**Stories by Epic:**
${epics.map(epic => `- ${epic.name}: ${epic.count} stories`).join('\n')}

**Stories by Status:**
${statuses.map(status => `- ${status.emoji} ${status.name}: ${status.count}`).join('\n')}

**Next Steps:**
- Review index: docs/stories/index.md
- Use `*backlog-review` to see backlog items
- Use `*create-story` to add new stories
```

### 4. Preview Mode (if selected)
```javascript
if (mode === 'preview') {
  const stories = await scanStoriesDirectory('docs/stories');

  console.log('\n📊 Story Index Preview');
  console.log(`   Total Stories: ${stories.length}`);

  const grouped = groupStoriesByEpic(stories);
  Object.entries(grouped).forEach(([epic, items]) => {
    console.log(`   ${epic}: ${items.length} stories`);
  });

  console.log('\nRun with "yes" to generate index file.');
  return;
}
```

---

## Example Usage

```bash
# Interactive mode
*stories-index
> yes

# Expected output:
📚 Scanning stories directory...
✅ Found 70 stories
✅ Story index generated: docs/stories/index.md

📊 Story Index Updated
Total Stories: 70
Output File: docs/stories/index.md

Stories by Epic:
- Epic 6.1 AIOS Migration: 45 stories
- Epic 3 Gap Remediation: 20 stories
- Unassigned: 5 stories
```

---

## Error Handling

- **No stories found:** Warn user, create empty index
- **Invalid story metadata:** Log warnings, skip malformed stories
- **Permission denied:** Check file permissions on docs/stories/
- **Write failed:** Verify docs/stories/ directory exists

---

## Testing

```bash
# Test regeneration
*stories-index
> preview  # Check counts without writing

*stories-index
> yes      # Generate full index

# Verify:
cat docs/stories/index.md
# - Total stories count matches directory scan
# - Stories grouped by epic correctly
# - All story links work
# - Status/priority emojis display correctly
```

---

## npm Script Integration

Add to `package.json`:

```json
{
  "scripts": {
    "stories:index": "node .aios-core/scripts/story-index-generator.js docs/stories"
  }
}
```

Usage:
```bash
npm run stories:index
```

---

**Related Tasks:**
- `po-backlog-add.md` - Add backlog items
- `po-create-story.md` - Create new stories
- `story-index-generator.js` - Core generator utility
