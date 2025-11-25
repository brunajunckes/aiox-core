<!--
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

 Powered by AIOS™ Core -->

---
# No checklists needed - interactive KB mode facilitation task, no validation workflow required
---

# KB Mode Interaction Task

## Purpose

Provide a user-friendly interface to the AIOS knowledge base without overwhelming users with information upfront.

## Instructions

When entering KB mode (*kb-mode), follow these steps:

### 1. Welcome and Guide

Announce entering KB mode with a brief, friendly introduction.

### 2. Present Topic Areas

Offer a concise list of main topic areas the user might want to explore:

**What would you like to know more about?**

1. **Setup & Installation** - Getting started with AIOS
2. **Workflows** - Choosing the right workflow for your project
3. **Web vs IDE** - When to use each environment
4. **Agents** - Understanding specialized agents and their roles
5. **Documents** - PRDs, Architecture, Stories, and more
6. **Agile Process** - How AIOS implements Agile methodologies
7. **Configuration** - Customizing AIOS for your needs
8. **Best Practices** - Tips for effective AIOS usage

Or ask me about anything else related to aios-fullstack!

### 3. Respond Contextually

- Wait for user's specific question or topic selection
- Provide focused, relevant information from the knowledge base
- Offer to dive deeper or explore related topics
- Keep responses concise unless user asks for detailed explanations

### 4. Interactive Exploration

- After answering, suggest related topics they might find helpful
- Maintain conversational flow rather than data dumping
- Use examples when appropriate
- Reference specific documentation sections when relevant

### 5. Exit Gracefully

When user is done or wants to exit KB mode:

- Summarize key points discussed if helpful
- Remind them they can return to KB mode anytime with *kb-mode
- Suggest next steps based on what was discussed

## Example Interaction

**User**: *kb-mode

**Assistant**: I've entered KB mode and have access to the full AIOS knowledge base. I can help you with detailed information about any aspect of aios-fullstack.

**What would you like to know more about?**

1. **Setup & Installation** - Getting started with AIOS
2. **Workflows** - Choosing the right workflow for your project
3. **Web vs IDE** - When to use each environment
4. **Agents** - Understanding specialized agents and their roles
5. **Documents** - PRDs, Architecture, Stories, and more
6. **Agile Process** - How AIOS implements Agile methodologies
7. **Configuration** - Customizing AIOS for your needs
8. **Best Practices** - Tips for effective AIOS usage

Or ask me about anything else related to aios-fullstack!

**User**: Tell me about workflows

**Assistant**: [Provides focused information about workflows from the KB, then offers to explore specific workflow types or related topics]
 