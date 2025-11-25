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
  - github-cli
# TODO: Create workflow-validation-checklist.md for validation (follow-up story needed)
# checklists:
#   - workflow-validation-checklist.md
---

# Create Workflow

## Purpose
To create a new workflow definition that orchestrates multiple agents and tasks for complex multi-step processes in AIOS-FULLSTACK.

## Prerequisites
- User authorization verified
- Clear understanding of workflow goals
- Knowledge of participating agents and tasks
- Memory layer client initialized

## Interactive Elicitation Process

### Step 1: Workflow Overview
```
ELICIT: Workflow Basic Information
1. What is the workflow name? (e.g., "feature-development", "bug-fix")
2. What is the primary goal of this workflow?
3. What type of project is this for? (greenfield/brownfield, UI/service/fullstack)
4. What is the expected outcome?
```

### Step 2: Workflow Stages
```
ELICIT: Workflow Stages and Flow
1. What are the main stages/phases? (e.g., "planning", "implementation", "testing")
2. What is the sequence of these stages?
3. Are there any parallel activities?
4. Are there decision points or conditional flows?
5. What are the exit criteria for each stage?
```

### Step 3: Agent Orchestration
```
ELICIT: Agent Participation
For each stage:
1. Which agent(s) are involved?
2. What are their specific responsibilities?
3. How do agents hand off work between stages?
4. Are there any approval requirements?
```

### Step 4: Resource Requirements
```
ELICIT: Resources and Dependencies
1. What templates are needed?
2. What data files are required?
3. Are there external dependencies?
4. What are the input requirements?
5. What outputs are produced?
```

## Implementation Steps

1. **Validate Workflow Design**
   - Check for circular dependencies
   - Validate agent availability
   - Ensure logical flow progression
   - Verify all resources exist

2. **Generate Workflow Structure**
   ```yaml
   workflow:
     id: {workflow-name}
     name: {Workflow Display Name}
     description: {Purpose and overview}
     type: {greenfield|brownfield}
     scope: {ui|service|fullstack}
     
   stages:
     - id: stage-1
       name: {Stage Name}
       agent: {agent-id}
       tasks:
         - {task-name}
       outputs:
         - {output-description}
       next: stage-2
       
   transitions:
     - from: stage-1
       to: stage-2
       condition: {optional condition}
       
   resources:
     templates:
       - {template-name}
     data:
       - {data-file}
       
   validation:
     checkpoints:
       - stage: {stage-id}
         criteria: {validation-criteria}
   ```

3. **Add Security Controls**
   - Stage authorization requirements
   - Data access restrictions
   - Audit logging points
   - Approval workflows

4. **Create Workflow File**
   - Generate path: `.aios-core/workflows/{workflow-name}.yaml`
   - Write structured YAML definition
   - Include comprehensive documentation

5. **Update Memory Layer**
   ```javascript
   await memoryClient.addMemory({
     type: 'workflow_created',
     name: workflowName,
     path: workflowPath,
     creator: currentUser,
     timestamp: new Date().toISOString(),
     metadata: {
       type: workflowType,
       stages: stageList,
       agents: involvedAgents
     }
   });
   ```

6. **Generate Documentation**
   - Create workflow diagram (text-based)
   - Document each stage's purpose
   - List all handoff points
   - Include troubleshooting guide

## Validation Checklist
- [ ] Workflow name is unique and valid
- [ ] All stages have clear purposes
- [ ] Agent assignments are valid
- [ ] No circular dependencies
- [ ] All resources exist
- [ ] Transitions are logical
- [ ] Security controls defined
- [ ] Memory layer updated

## Error Handling
- If workflow exists: Offer versioning or update
- If agents missing: List required agents
- If circular dependency: Show cycle and suggest fix
- If resources missing: List and offer to create

## Success Output
```
✅ Workflow '{workflow-name}' created successfully!
📁 Location: .aios-core/workflows/{workflow-name}.yaml
📊 Workflow Summary:
   - Stages: {stage-count}
   - Agents: {agent-list}
   - Type: {workflow-type}
🚀 To use: Select workflow when starting new project
```

## Workflow Execution Notes
- Workflows are selected during project initialization
- Each stage execution is logged in memory
- Progress tracking available through memory queries
- Agents automatically receive stage-specific context 