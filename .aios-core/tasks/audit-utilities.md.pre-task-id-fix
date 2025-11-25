---

## Execution Modes

**Choose your execution mode:**

### 1. YOLO Mode - Fast, Autonomous (0-1 prompts)
- Autonomous decision making with logging
- Minimal user interaction
- **Best for:** Simple, deterministic tasks

### 2. Interactive Mode - Balanced, Educational (5-10 prompts) **[DEFAULT]**
- Explicit decision checkpoints
- Educational explanations
- **Best for:** Learning, complex decisions

### 3. Pre-Flight Planning - Comprehensive Upfront Planning
- Task analysis phase (identify all ambiguities)
- Zero ambiguity execution
- **Best for:** Ambiguous requirements, critical work

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition (AIOS Task Format V1.0)

```yaml
task: {TODO: task identifier}
responsável: {TODO: Agent Name}
responsavel_type: Agente
atomic_layer: {TODO: Atom|Molecule|Organism}

**Entrada:**
- campo: {TODO: fieldName}
  tipo: {TODO: string|number|boolean}
  origem: {TODO: User Input | config | Step X}
  obrigatório: true
  validação: {TODO: validation rule}

**Saída:**
- campo: {TODO: fieldName}
  tipo: {TODO: type}
  destino: {TODO: output | state | Step Y}
  persistido: true
```

---

## Pre-Conditions

**Purpose:** Validate prerequisites BEFORE task execution (blocking)

**Checklist:**

```yaml
pre-conditions:
  - [ ] {TODO: condition description}
    tipo: pre-condition
    blocker: true
    validação: |
      {TODO: validation logic}
    error_message: "{TODO: error message}"
```

---

## Post-Conditions

**Purpose:** Validate execution success AFTER task completes

**Checklist:**

```yaml
post-conditions:
  - [ ] {TODO: verification step}
    tipo: post-condition
    blocker: true
    validação: |
      {TODO: validation logic}
    error_message: "{TODO: error message}"
```

---

## Acceptance Criteria

**Purpose:** Definitive pass/fail criteria for task completion

**Checklist:**

```yaml
acceptance-criteria:
  - [ ] {TODO: acceptance criterion}
    tipo: acceptance-criterion
    blocker: true
    validação: |
      {TODO: validation logic}
    error_message: "{TODO: error message}"
```

---

## Tools

**External/shared resources used by this task:**

- **Tool:** N/A
  - **Purpose:** {TODO: what this tool does}
  - **Source:** {TODO: where to find it}

---

## Scripts

**Agent-specific code for this task:**

- **Script:** N/A
  - **Purpose:** {TODO: what this script does}
  - **Language:** {TODO: JavaScript | Python | Bash}
  - **Location:** {TODO: file path}

---

## Error Handling

**Strategy:** {TODO: Fail-fast | Graceful degradation | Retry with backoff}

**Common Errors:**

1. **Error:** {TODO: error type}
   - **Cause:** {TODO: why it happens}
   - **Resolution:** {TODO: how to fix}
   - **Recovery:** {TODO: automated recovery steps}

---

## Performance

**Expected Metrics:**

```yaml
duration_expected: {TODO: X minutes}
cost_estimated: {TODO: $X}
token_usage: {TODO: ~X tokens}
```

**Optimization Notes:**
- {TODO: performance tips}

---

## Metadata

```yaml
story: {TODO: Story ID or N/A}
version: 1.0.0
dependencies:
  - {TODO: dependency file or N/A}
tags:
  - {TODO: tag1}
  - {TODO: tag2}
updated_at: 2025-11-17
```

---

tools:
  - github-cli        # File system operations
---

# Audit Utilities Task


## Configuration Dependencies

This task requires the following configuration keys from `core-config.yaml`:

- **`devStoryLocation`**: Location of story files (typically docs/stories)

- **`qaLocation`**: QA output directory (typically docs/qa) - Required to write quality reports and gate files

**Loading Config:**
```javascript
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../.aios-core/core-config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

const dev_story_location = config.devStoryLocation;
const qaLocation = config.qaLocation || 'docs/qa'; // qaLocation
```

## Purpose

Systematically audit all utilities in `.aios-core/scripts/` to determine their functional status, classify them as WORKING/FIXABLE/DEPRECATED, and generate actionable recommendations for maintenance and cleanup.

## Classification Criteria

### ✅ WORKING
- Executes without errors
- Dependencies installed
- Integrated with at least one agent/task
- Documentation exists (inline or external)

### 🔧 FIXABLE
- Executes with minor errors (missing deps, syntax fixes)
- Core logic sound, needs integration
- Fix effort estimated <4 hours
- Concept valuable enough to justify fix

### 🗑️ DEPRECATED
- Non-functional, major rewrites needed
- Obsolete concept (replaced by better approach)
- Fix effort >8 hours
- Low value relative to effort

## Execution Steps

### Step 1: Run Automated Testing

Execute the test-utilities.js script to test all utilities:

```bash
node .aios-core/scripts/test-utilities.js
```

This will:
- Attempt to require() each utility
- Check for missing dependencies
- Test exported functions
- Classify as WORKING/FIXABLE/DEPRECATED based on errors

### Step 2: Verify Integration Status

Run integration scan to find utility usage:

```bash
# For each utility, count references in agents and tasks
for util in .aios-core/scripts/*.js; do
  name=$(basename $util .js)
  count=$(grep -r "$name" .aios-core/agents .aios-core/tasks expansion-packs 2>/dev/null | wc -l)
  echo "$name: $count references"
done
```

### Step 3: Manual Classification Review

For utilities with ambiguous status:
- Review source code quality
- Estimate completion percentage
- Assess concept value
- Calculate fix effort estimate

### Step 4: Generate Priority Scoring

For FIXABLE utilities, calculate priority score:

```
Priority Score = (Integration Count × 10) + (Completion % × 5) - (Fix Hours)
```

Higher scores = higher priority for fixing

### Step 5: Make Story 3.19 Decision

Determine if memory-layer capabilities exist:
- Search for memory-related utilities
- IF found AND classified FIXABLE:
  - Estimate fix effort vs 20h threshold
  - Assess core functionality completion (>60%?)
  - Recommend GO/NO-GO/DEFER

### Step 6: Generate Audit Report

Create comprehensive report with:
- Summary statistics (X WORKING, Y FIXABLE, Z DEPRECATED)
- Per-utility details (status, errors, integration count, recommendation)
- Fix priority list (ranked FIXABLE utilities)
- Cleanup list (DEPRECATED utilities to remove)
- Story 3.19 activation recommendation

## Output

**Primary**: `UTILITIES-AUDIT-REPORT.md` in project root or docs/

**Format**:
```markdown
# Framework Utilities Audit Report

## Executive Summary
- Total Utilities: X
- ✅ WORKING: Y (Z%)
- 🔧 FIXABLE: A (B%)
- 🗑️ DEPRECATED: C (D%)

## Detailed Findings

### WORKING Utilities
...

### FIXABLE Utilities (Priority Ranked)
...

### DEPRECATED Utilities (Cleanup Candidates)
...

## Story 3.19 Decision
...
```

## Success Criteria

- All 81 utilities audited without crashes
- Classification is consistent and reproducible
- Integration counts accurate
- Report is actionable for Story 3.18 (cleanup)
- Story 3.19 decision has clear rationale

## Notes

- Run from project root directory
- Requires Node.js environment
- May take 5-10 minutes for full audit
- Some utilities may have circular dependencies - handle gracefully
