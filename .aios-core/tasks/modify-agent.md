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

checklists:
  - change-checklist.md
---

# Modify Agent Task

## Purpose

To safely modify existing agent definitions while preserving their structure, maintaining compatibility, and providing rollback capabilities. This task enables the meta-agent to evolve agent capabilities through targeted modifications with comprehensive validation.

## Prerequisites

- Target agent must exist in `aios-core/agents/`
- User must provide modification intent or specific changes
- Backup system must be available for rollback
- Git must be initialized for version tracking

## Task Execution

### 1. Agent Analysis and Backup

- Load target agent from `aios-core/agents/{agent-name}.md`
- Parse YAML header and markdown content separately
- Create timestamped backup: `aios-core/agents/.backups/{agent-name}.md.{timestamp}`
- Extract current structure:
  - Agent metadata (name, id, title, icon, whenToUse)
  - Dependencies (tasks, templates, checklists, data)
  - Commands and their descriptions
  - Persona configuration
  - Customization rules

### 2. Modification Intent Processing

If user provides high-level intent (e.g., "add memory integration capability"):
- Analyze current agent capabilities
- Determine required changes:
  - New dependencies to add
  - Commands to introduce
  - Persona adjustments needed
  - Documentation updates

If user provides specific changes:
- Validate change format and targets
- Check for conflicts with existing structure
- Ensure changes maintain agent consistency

### 3. Dependency Resolution

For new dependencies being added:
- Verify files exist in respective directories
- Check for circular dependencies
- Validate dependency compatibility
- Add dependencies in correct sections:
  - tasks → `dependencies.tasks`
  - templates → `dependencies.templates`
  - checklists → `dependencies.checklists`
  - data → `dependencies.data`
  - tools → `dependencies.tools`

### 4. Generate Modification Diff

Create a visual diff showing:
```diff
@@ Agent: {agent-name} @@
--- Current Version
+++ Modified Version

@@ Dependencies @@
  tasks:
    - existing-task.md
+   - new-capability-task.md
    
@@ Commands @@
  - help: Show available commands
+ - new-command: Description of new capability

@@ Persona @@
  role: Current role description
- focus: Old focus area
+ focus: Updated focus area with new capabilities
```

### 5. Validation Pipeline

Run comprehensive validation checks:
- YAML syntax validation
- Markdown structure integrity
- Dependency existence verification
- Command format validation
- No breaking changes to existing commands
- Customization rules compatibility

### 6. User Approval Flow

Present to user:
1. Summary of changes
2. Visual diff
3. Impact analysis:
   - New capabilities added
   - Potential conflicts
   - Dependencies introduced
4. Rollback instructions

Request explicit approval before applying changes.

### 7. Apply Modifications

Upon approval:
1. Write modified content to agent file
2. Update component metadata registry
3. Create git commit with descriptive message
4. Log modification in history
5. Update any dependent components

### 8. Post-Modification Validation

- Test agent loading
- Verify all dependencies resolve
- Check command accessibility
- Validate persona consistency
- Run basic agent interaction test

### 9. Rollback Capability

If issues detected or user requests rollback:
1. Restore from timestamped backup
2. Revert git commit
3. Update metadata registry
4. Log rollback action

## Safety Measures

1. **Backup Before Modify**: Always create backup before changes
2. **Validation First**: Never apply unvalidated modifications
3. **User Approval**: Require explicit approval for all changes
4. **Atomic Operations**: All-or-nothing modification approach
5. **Git Integration**: Every change tracked in version control

## Output Format

```
=== Agent Modification Report ===
Agent: {agent-name}
Timestamp: {ISO-8601 timestamp}
Backup: {backup-file-path}

Changes Applied:
✓ Added {n} new dependencies
✓ Modified {n} commands
✓ Updated persona configuration
✓ Enhanced capabilities for {feature}

Validation Results:
✓ YAML syntax valid
✓ All dependencies exist
✓ No breaking changes
✓ Git commit created: {commit-hash}

New Capabilities:
- {capability-1}
- {capability-2}

Agent ready for use with enhanced capabilities.
```

## Error Handling

- File not found → Check agent name and path
- Invalid YAML → Show syntax error location
- Missing dependencies → List unavailable files
- Git errors → Provide manual recovery steps
- Validation failures → Show specific issues

## Integration Points

- Uses `component-metadata.js` for registry updates
- Integrates with `git-wrapper.js` for version control
- Leverages `yaml-validator.js` for syntax checking
- Coordinates with `rollback-handler.js` for recovery 