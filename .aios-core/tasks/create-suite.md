---
tools:
  - github-cli
# TODO: Create test-suite-checklist.md for validation (follow-up story needed)
# checklists:
#   - test-suite-checklist.md
---

# Task: Create Component Suite

**Agent:** aios-developer  
**Version:** 1.0  
**Command:** *create-suite

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
Creates multiple related components in a single batch operation with dependency resolution and transaction support.

## Context Required
- Project structure understanding
- Component relationships
- Existing components for dependency resolution

## Prerequisites
- aios-developer agent is active
- Template system is configured
- team-manifest.yaml exists

## Interactive Elicitation
1. Suite type selection (agent package, workflow suite, task collection, custom)
2. Component configuration based on suite type
3. Dependency validation
4. Preview of all components to be created
5. Confirmation before batch creation

## Workflow Steps

### 1. Suite Type Selection
- **Action:** Choose from predefined suite types or custom
- **Validation:** Ensure suite type is supported

### 2. Configure Components
- **Action:** Gather configuration for each component in suite
- **Validation:** Validate naming conventions and dependencies

### 3. Analyze Dependencies
- **Action:** Build dependency graph between components
- **Validation:** Check for circular dependencies

### 4. Preview Suite
- **Action:** Show preview of all components to be created
- **Validation:** User confirmation required

### 5. Create Components
- **Action:** Create components in dependency order
- **Validation:** Each component must be created successfully

### 6. Update Manifest
- **Action:** Update team-manifest.yaml with all new components
- **Validation:** Manifest must remain valid YAML

## Error Handling
- **Missing Dependencies:** Prompt to create or select existing
- **Name Conflicts:** Show existing components and suggest alternatives
- **Creation Failures:** Offer rollback of entire transaction
- **Manifest Errors:** Show diff and allow manual correction

## Output
- Success/failure status for each component
- Transaction ID for potential rollback
- Updated manifest with all new components
- Summary of created files and locations

## Security Considerations
- All generated code is validated by SecurityChecker
- File paths are sanitized to prevent traversal
- Transaction log is write-protected

## Notes
- Supports atomic creation (all or nothing)
- Transaction log enables rollback functionality
- Dependency resolution ensures correct creation order
- Preview functionality helps prevent mistakes 