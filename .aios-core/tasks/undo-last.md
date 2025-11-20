---
# No checklists needed - rollback operation with built-in transaction validation
---

# Task: Undo Last Component Operation

**Task ID:** undo-last  
**Agent:** aios-developer  
**Version:** 1.0

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


## Description

Rollback the last component creation or modification operation. This task allows undoing recent changes made by the aios-developer agent, including single component creation, batch creation, or component updates.

## Context Required
- Access to transaction history
- File system permissions for affected files
- Manifest write permissions

## Prerequisites
- Transaction logging enabled
- Backup files available
- No conflicting operations since last transaction

## Input Requirements
- Optional: Transaction ID to rollback (defaults to last transaction)
- Optional: Selective rollback options

## Process Flow

### Step 1: Identify Transaction
Locate the most recent transaction or use provided transaction ID.

**Actions:**
- Query transaction history
- Display transaction details
- Confirm rollback intent

**Validation:**
- Transaction exists and is rollbackable
- User confirms the operation

### Step 2: Analyze Changes
Review all changes made in the transaction.

**Actions:**
- List all file operations
- Show manifest changes
- Display component metadata updates

**Output Format:**
```
Transaction: txn-1234567890-abcd
Type: component_creation
Date: 2025-01-31T10:30:00Z
Operations:
  - Created: /aios-core/agents/data-analyst.md
  - Updated: /aios-core/team-manifest.yaml
  - Created: /aios-core/tasks/analyze-data.md
```

### Step 3: Execute Rollback
Perform the rollback operation with proper error handling.

**Actions:**
- Restore file backups
- Revert manifest changes
- Update component metadata
- Clean up orphaned files

**Error Handling:**
- Handle missing backup files
- Manage partial rollback scenarios
- Report rollback failures

### Step 4: Verify Rollback
Ensure all changes have been properly reverted.

**Actions:**
- Verify file states
- Check manifest integrity
- Validate component consistency

**Success Criteria:**
- All files restored to previous state
- Manifest accurately reflects changes
- No orphaned references remain

## Output

### Success Response
```
✅ Rollback completed successfully!

Transaction: txn-1234567890-abcd
Rolled back:
  - ✓ Removed: data-analyst.md
  - ✓ Restored: team-manifest.yaml
  - ✓ Removed: analyze-data.md
  
Total operations: 3
Successful: 3
Failed: 0
```

### Failure Response
```
❌ Rollback partially failed

Transaction: txn-1234567890-abcd
Results:
  - ✓ Removed: data-analyst.md
  - ✗ Failed to restore: team-manifest.yaml (backup not found)
  - ✓ Removed: analyze-data.md

Please manually review and fix failed operations.
```

## Error Handling

### Common Errors
1. **Transaction Not Found**
   - Display available transactions
   - Suggest checking transaction ID

2. **Backup Files Missing**
   - Warn about incomplete rollback
   - Provide manual recovery steps

3. **Concurrent Modifications**
   - Detect file changes since transaction
   - Prompt for force rollback option

## Security Considerations
- Verify user has permission to rollback
- Prevent rollback of system transactions
- Maintain audit trail of rollback operations
- Validate file paths to prevent traversal

## Performance Notes
- Load only necessary transaction data
- Stream large backup files
- Batch file operations for efficiency

## Dependencies
- TransactionManager utility
- File system access
- Backup storage system

## Notes
- Rollback is only available for recent transactions (within retention period)
- Some operations may not be fully reversible
- Always creates a new transaction for the rollback itself
- Supports selective rollback for batch operations

## Related Tasks
- create-agent
- create-task
- create-workflow
- create-suite
- update-manifest 