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
# TODO: Create agent-creation-checklist.md for validation (follow-up story needed)
# checklists:
#   - agent-creation-checklist.md
---

# Create Agent Task

## Purpose
To create a new agent definition file following AIOS-FULLSTACK standards using the template system with progressive disclosure elicitation.

## Prerequisites
- User authorization verified
- Template system initialized
- Component generator available
- Memory layer client initialized

## Implementation Method
This task now uses the enhanced template system with progressive disclosure:

```javascript
const ComponentGenerator = require('../scripts/component-generator');
const generator = new ComponentGenerator({
  rootPath: process.cwd()
});

// Generate agent using elicitation workflow
const result = await generator.generateComponent('agent', {
  saveSession: true,  // Save progress
  force: false        // Don't overwrite existing
});
```

## Interactive Elicitation Process
The elicitation workflow is now handled by `aios-core/elicitation/agent-elicitation.js` with:

1. **Basic Agent Information** - Name, title, icon, usage
2. **Agent Persona & Style** - Role, communication, identity, focus
3. **Agent Commands** - Standard and custom commands
4. **Dependencies & Resources** - Tasks, templates, checklists, tools
5. **Security & Access Control** - Permissions and logging
6. **Advanced Options** - Memory layer, principles, activation

### Progressive Disclosure Features:
- **Smart Defaults**: Auto-generates values based on previous answers
- **Contextual Help**: Shows help text for complex steps
- **Conditional Steps**: Shows/hides steps based on choices
- **Session Saving**: Can pause and resume creation
- **Validation**: Real-time input validation with security checks

## Implementation Steps

1. **Validate Inputs**
   - Check agent name doesn't already exist
   - Validate name format (lowercase, hyphens only)
   - Ensure no path traversal in name

2. **Generate Agent File**
   - Use standard agent template structure
   - Include all elicited information
   - Add security controls if specified
   - Include memory layer integration if needed

3. **Security Validation**
   - No eval() or dynamic code execution
   - Validate all YAML syntax
   - Check for malicious patterns
   - Sanitize all user inputs

4. **Create File**
   - Generate path: `.aios-core/agents/{agent-name}.md`
   - Write agent definition with proper formatting
   - Set appropriate file permissions

5. **Update Memory Layer**
   ```javascript
   await memoryClient.addMemory({
     type: 'agent_created',
     name: agentName,
     path: agentPath,
     creator: currentUser,
     timestamp: new Date().toISOString(),
     metadata: {
       role: agentRole,
       commands: agentCommands
     }
   });
   ```

6. **Post-Creation Tasks**
   - Prompt user to update team manifest
   - Suggest creating related task files
   - Document in project changelog

## Validation Checklist
- [ ] Agent name is unique and valid
- [ ] All required sections included
- [ ] YAML syntax is valid
- [ ] Security controls implemented
- [ ] No malicious patterns detected
- [ ] Memory layer updated
- [ ] File created successfully

## Error Handling
- If agent already exists: Prompt for different name or update existing
- If validation fails: Show specific errors and allow correction
- If file write fails: Check permissions and path
- If memory update fails: Log error but continue (non-blocking)

## Success Output
```
✅ Agent '{agent-name}' created successfully!
📁 Location: .aios-core/agents/{agent-name}.md
📝 Next steps:
   1. Run *update-manifest to add agent to team
   2. Test agent with /{agent-name} command
   3. Create any needed task dependencies
``` 