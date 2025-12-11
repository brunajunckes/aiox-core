# Creating Squads for AIOS

This guide explains how to create and publish Squads for AIOS.

> **AIOS Squads:** Equipes de AI agents trabalhando com você 🤖

## What is a Squad?

Squads are modular teams of AI agents that extend AIOS functionality with:
- New agents with specialized capabilities
- Custom workflows for specific domains
- Task libraries for common operations
- Templates for document generation

## Quick Start

### Prerequisites
- Node.js 18+
- Familiarity with AIOS architecture
- Git for version control

### Create Your First Squad

```bash
# Clone the template
npx create-aios-squad my-squad

# Navigate to directory
cd my-squad

# Install dependencies
npm install

# Start development
npm run dev
```

## Squad Structure

```
my-squad/
├── squad.yaml             # Squad manifest
├── README.md              # Documentation
├── LICENSE                # License file
├── package.json           # npm configuration
├── agents/                # Agent definitions
│   └── my-agent.yaml
├── tasks/                 # Task workflows
│   └── my-task.yaml
├── workflows/             # Multi-step workflows
│   └── my-workflow.yaml
├── templates/             # Templates
│   └── my-template.md
└── tests/                 # Test files
    └── my-agent.test.js
```

## Squad Manifest

The `squad.yaml` defines your Squad:

```yaml
name: my-squad
version: 1.0.0
description: Description of what this Squad does
author: Your Name
license: MIT

aios:
  minVersion: "2.1.0"
  type: squad

components:
  agents:
    - agents/*.yaml
  tasks:
    - tasks/*.yaml
  workflows:
    - workflows/*.yaml
  templates:
    - templates/*.md

dependencies: []

keywords:
  - aios
  - squad
  - your-domain
```

## Creating Agents

### Agent YAML Structure

```yaml
# agents/my-agent.yaml
name: my-agent
version: 1.0.0
description: What this agent does

persona:
  name: Agent Name
  role: Agent Role
  expertise:
    - Skill 1
    - Skill 2

capabilities:
  - capability-1
  - capability-2

commands:
  - name: my-command
    description: What this command does
    workflow: my-workflow

system_prompt: |
  You are [Agent Name], specialized in...

  Your responsibilities:
  - Responsibility 1
  - Responsibility 2
```

### Agent Best Practices
- Keep agents focused on specific domains
- Define clear boundaries and capabilities
- Include helpful error messages
- Document all commands
- Follow AIOS Squad naming conventions

## Creating Tasks

### Task YAML Structure

```yaml
# tasks/my-task.yaml
name: my-task
version: 1.0.0
description: What this task does

inputs:
  - name: input1
    type: string
    required: true
    description: Description of input

outputs:
  - name: result
    type: object
    description: What the task returns

steps:
  - id: step-1
    action: validate-inputs
    description: Validate provided inputs

  - id: step-2
    action: process-data
    description: Process the data
    depends_on: [step-1]

  - id: step-3
    action: return-result
    description: Return the processed result
    depends_on: [step-2]
```

## Creating Workflows

### Workflow YAML Structure

```yaml
# workflows/my-workflow.yaml
name: my-workflow
version: 1.0.0
description: Multi-step workflow description

trigger:
  command: "*my-command"
  agent: my-agent

elicitation:
  enabled: true
  questions:
    - id: q1
      prompt: "What would you like to do?"
      type: choice
      options:
        - Option A
        - Option B

steps:
  - task: my-task
    inputs:
      input1: "{{elicitation.q1}}"
    on_success: next
    on_error: handle-error

error_handling:
  - id: handle-error
    action: notify
    message: "An error occurred"
```

## Testing Your Squad

### Unit Tests

```javascript
// tests/my-agent.test.js
import { loadAgent, executeCommand } from '@aios/testing';

describe('my-agent', () => {
  let agent;

  beforeAll(async () => {
    agent = await loadAgent('./agents/my-agent.yaml');
  });

  test('should execute my-command', async () => {
    const result = await executeCommand(agent, '*my-command', {
      input1: 'test'
    });
    expect(result.success).toBe(true);
  });
});
```

### Running Tests

```bash
npm test
```

## Publishing Your Squad

### To npm (Public)

```bash
# Login to npm
npm login

# Publish
npm publish
```

### To GitHub (Alternative)

1. Create repository in `aios-squads` org or your own
2. Add topics: `aios`, `aios-squad`
3. Create release with semantic version

## Integration Guidelines

### Compatibility
- Test with minimum supported AIOS version
- Document any special requirements
- Handle missing dependencies gracefully

### Performance
- Keep agent definitions lightweight
- Optimize workflows for speed
- Cache when appropriate

### Security
- Never store credentials in code
- Use environment variables
- Validate all inputs

## Example Squads

### Official Squads (Reference)
- [ETL Squad](https://github.com/SynkraAI/aios-squads/tree/main/etl) - Data collection and transformation
- [Creator Squad](https://github.com/SynkraAI/aios-squads/tree/main/creator) - Content generation

## Getting Help

- [GitHub Discussions](https://github.com/SynkraAI/aios-core/discussions/categories/ideas)
- [Issue Tracker](https://github.com/SynkraAI/aios-core/issues)

## Contributing Back

Found an issue or have an improvement?
- Submit bug reports
- Propose enhancements
- Share your Squad with the community!

---

*AIOS Squads: Equipes de AI agents trabalhando com você* 🤖
