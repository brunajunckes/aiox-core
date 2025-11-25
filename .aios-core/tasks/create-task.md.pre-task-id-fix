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
# TODO: Create task-validation-checklist.md for validation (follow-up story needed)
# checklists:
#   - task-validation-checklist.md
---

# Create Task

## Purpose
To create a new task file that defines executable workflows for agents, with proper structure, elicitation steps, and validation.

## Prerequisites
- User authorization verified
- Task purpose clearly defined
- Understanding of task workflow requirements

## Interactive Elicitation Process

### Step 1: Task Definition
```
ELICIT: Task Basic Information

1. What agent(s) will use this task?
   Examples: "ux-design-expert", "db-sage", "dev", "pm, po, sm" (multiple)

   → If SINGLE agent: Task is agent-specific (will apply naming convention)
   → If MULTIPLE agents: Task is shared (no prefix)

2. What is the task name?

   IF agent-specific (single agent):
     → Suggested format: "{agent-id}-{action}"
     → Examples: "ux-user-research", "db-apply-migration", "dev-develop-story"
     → Validation: Must start with "{agent-id}-"

   IF shared (multiple agents):
     → Use descriptive name WITHOUT agent prefix
     → Examples: "create-doc", "execute-checklist", "manage-story-backlog"
     → Validation: Must NOT have agent-specific prefix

3. What is the primary purpose of this task?

4. What are the prerequisites for running this task?
```

**NAMING CONVENTION (CRITICAL):**
- Agent-specific tasks: `{agent-id}-{task-name}.md`
- Shared tasks: `{task-name}.md` (no prefix)
- Use component-generator.applyNamingConvention() to apply automatically

### Step 2: Task Workflow
```
ELICIT: Task Workflow Steps
1. Does this task require user interaction? (yes/no)
2. What are the main steps in this task? (numbered list)
3. What inputs does the task need?
4. What outputs does the task produce?
5. Are there decision points requiring user input?
```

### Step 3: Elicitation Requirements
```
ELICIT: Interactive Elements (if applicable)
1. What information needs to be collected from users?
2. How should prompts be structured?
3. What validation is needed for user inputs?
4. Are there default values or suggestions?
```

### Step 4: Dependencies and Integration
```
ELICIT: Task Dependencies
1. Does this task depend on other tasks?
2. What templates does it use (if any)?
3. Does it need memory layer access?
4. What files/resources does it need to access?
```

## Implementation Steps

1. **Validate Task Name**
   - Check name doesn't already exist
   - Validate format (lowercase, hyphens)
   - Ensure descriptive and clear naming

2. **Structure Task Content**
   ```markdown
   # {Task Title}
   
   ## Purpose
   {Clear description of what the task accomplishes}
   
   ## Prerequisites
   {List of requirements before task execution}
   
   ## Interactive Elicitation Process
   {If elicit=true, define all prompts and user interactions}
   
   ## Implementation Steps
   {Numbered steps for task execution}
   
   ## Validation Checklist
   {Checklist items to verify task completion}
   
   ## Error Handling
   {How to handle common errors}
   
   ## Success Output
   {What user sees on successful completion}
   ```

3. **Add Security Considerations**
   - Input validation rules
   - File access restrictions
   - Safe command execution
   - Output sanitization

4. **Create Task File**
   - Generate path: `.aios-core/tasks/{task-name}.md`
   - Write formatted task definition
   - Ensure proper markdown structure

5. **Update Memory Layer**
   ```javascript
   await memoryClient.addMemory({
     type: 'task_created',
     name: taskName,
     path: taskPath,
     creator: currentUser,
     timestamp: new Date().toISOString(),
     metadata: {
       purpose: taskPurpose,
       agents: associatedAgents,
       interactive: hasElicitation
     }
   });
   ```

6. **Generate Usage Examples**
   - Show how to reference in agent files
   - Provide command examples
   - Document expected outputs

## Validation Checklist
- [ ] Task name is unique and valid
- [ ] Purpose clearly stated
- [ ] Steps are numbered and clear
- [ ] Elicitation prompts well-defined
- [ ] Error handling included
- [ ] Success criteria defined
- [ ] Memory layer updated

## Error Handling
- If task exists: Offer to update or create variant
- If validation fails: Show specific issues
- If dependencies missing: List required files
- If write fails: Check permissions

## Success Output
```
✅ Task '{task-name}' created successfully!
📁 Location: .aios-core/tasks/{task-name}.md
📝 Integration example:
   dependencies:
     tasks:
       - {task-name}.md
🔗 Agents using this task: {agent-list}
``` 