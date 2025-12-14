---

## Execution Modes

**Choose your execution mode:**

### 1. YOLO Mode - Fast, Autonomous (0-1 prompts)
- Autonomous decision making with logging
- Minimal user interaction
- **Best for:** Greenfield projects, quick setup

### 2. Interactive Mode - Balanced, Educational (5-10 prompts) **[DEFAULT]**
- Explicit decision checkpoints
- Educational explanations
- **Best for:** Brownfield projects, complex configurations

### 3. Pre-Flight Planning - Comprehensive Upfront Planning
- Task analysis phase (identify all ambiguities)
- Zero ambiguity execution
- **Best for:** Critical projects, enterprise setups

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition (AIOS Task Format V1.0)

```yaml
task: setupProjectDocs()
responsável: dev (Developer)
responsavel_type: Agente
atomic_layer: Documentation

**Entrada:**
- campo: targetDir
  tipo: string
  origem: User Input or cwd
  obrigatório: false
  validação: Valid directory path

- campo: projectName
  tipo: string
  origem: User Input or package.json
  obrigatório: false
  validação: Non-empty string

- campo: mode
  tipo: string
  origem: User Input
  obrigatório: false
  validação: greenfield|brownfield|framework-dev

- campo: executionMode
  tipo: string
  origem: User Input
  obrigatório: false
  validação: yolo|interactive|pre-flight

**Saída:**
- campo: docs_generated
  tipo: array
  destino: .aios-core/docs/
  persistido: true

- campo: core_config
  tipo: file
  destino: .aios-core/core-config.yaml
  persistido: true

- campo: gitignore
  tipo: file
  destino: .gitignore
  persistido: true
```

---

## Pre-Conditions

**Purpose:** Validate prerequisites BEFORE task execution (blocking)

**Checklist:**

```yaml
pre-conditions:
  - [ ] Target directory exists and is writable
    tipo: pre-condition
    blocker: true
    validação: |
      Check target directory exists and has write permissions
    error_message: "Pre-condition failed: Target directory not accessible"

  - [ ] Documentation Integrity module is available
    tipo: pre-condition
    blocker: true
    validação: |
      Verify .aios-core/infrastructure/scripts/documentation-integrity/index.js exists
    error_message: "Pre-condition failed: Documentation Integrity module not found"
```

---

## Post-Conditions

**Purpose:** Validate execution success AFTER task completes

**Checklist:**

```yaml
post-conditions:
  - [ ] Project docs created in .aios-core/docs/
    tipo: post-condition
    blocker: true
    validação: |
      Verify source-tree.md, coding-standards.md, tech-stack.md exist
    error_message: "Post-condition failed: Documentation files not created"

  - [ ] core-config.yaml created with valid deployment section
    tipo: post-condition
    blocker: true
    validação: |
      Verify .aios-core/core-config.yaml exists and has deployment configuration
    error_message: "Post-condition failed: core-config.yaml not properly configured"
```

---

## Acceptance Criteria

**Purpose:** Definitive pass/fail criteria for task completion

**Checklist:**

```yaml
acceptance-criteria:
  - [ ] All documentation files generated from templates
    tipo: acceptance-criterion
    blocker: true
    validação: |
      Assert docs contain project-specific content, not placeholders
    error_message: "Acceptance criterion not met: Docs contain unresolved placeholders"

  - [ ] .gitignore properly configured for project
    tipo: acceptance-criterion
    blocker: true
    validação: |
      Assert .gitignore includes AIOS ignores and tech stack ignores
    error_message: "Acceptance criterion not met: .gitignore incomplete"

  - [ ] Configuration-Driven Architecture pattern applied
    tipo: acceptance-criterion
    blocker: true
    validação: |
      Assert core-config.yaml contains project-specific values
    error_message: "Acceptance criterion not met: core-config.yaml not configuration-driven"
```

---

## Tools

**External/shared resources used by this task:**

- **Tool:** documentation-integrity
  - **Purpose:** Mode detection, doc generation, config generation
  - **Source:** .aios-core/infrastructure/scripts/documentation-integrity/index.js

- **Tool:** deployment-config-loader
  - **Purpose:** Load and validate deployment configuration
  - **Source:** .aios-core/infrastructure/scripts/documentation-integrity/deployment-config-loader.js

---

## Scripts

**Agent-specific code for this task:**

- **Script:** mode-detector.js
  - **Purpose:** Detect installation mode from project markers
  - **Language:** JavaScript
  - **Location:** .aios-core/infrastructure/scripts/documentation-integrity/mode-detector.js

- **Script:** doc-generator.js
  - **Purpose:** Generate project documentation from templates
  - **Language:** JavaScript
  - **Location:** .aios-core/infrastructure/scripts/documentation-integrity/doc-generator.js

- **Script:** config-generator.js
  - **Purpose:** Generate core-config.yaml
  - **Language:** JavaScript
  - **Location:** .aios-core/infrastructure/scripts/documentation-integrity/config-generator.js

- **Script:** gitignore-generator.js
  - **Purpose:** Generate or merge .gitignore
  - **Language:** JavaScript
  - **Location:** .aios-core/infrastructure/scripts/documentation-integrity/gitignore-generator.js

---

## Error Handling

**Strategy:** fallback-defaults

**Common Errors:**

1. **Error:** Mode Detection Failed
   - **Cause:** Unable to determine project type from markers
   - **Resolution:** Use default mode (greenfield) or prompt user
   - **Recovery:** Provide mode selection options

2. **Error:** Template Not Found
   - **Cause:** Template file missing from templates directory
   - **Resolution:** Check template paths in templates/project-docs/
   - **Recovery:** Use inline fallback templates

3. **Error:** Config Write Failed
   - **Cause:** Permission denied or disk full
   - **Resolution:** Check directory permissions
   - **Recovery:** Output config to console for manual creation

---

## Performance

**Expected Metrics:**

```yaml
duration_expected: 1-3 min (estimated)
cost_estimated: $0.001-0.003
token_usage: ~500-2,000 tokens
```

**Optimization Notes:**
- Uses template-based generation for fast execution
- Minimal file I/O with batched writes
- Configuration-Driven Architecture reduces runtime decisions

---

## Metadata

```yaml
story: 6.9
version: 1.0.0
dependencies:
  - documentation-integrity module
tags:
  - documentation
  - setup
  - configuration
updated_at: 2025-12-14
```

---

tools:
  - filesystem        # Read/write project files
  - documentation-integrity  # Core module for this task
---

# Setup Project Documentation

## Purpose

Generate project-specific documentation and configuration using the Documentation Integrity System. This task creates the foundational docs that enable AI agents to understand project structure, coding standards, and deployment configuration.

## Task Instructions

### 1. Detect Installation Mode

First, determine the installation mode based on project markers:

```javascript
const { detectInstallationMode, collectMarkers } = require('./.aios-core/infrastructure/scripts/documentation-integrity');

const targetDir = process.cwd(); // or specified directory
const detected = detectInstallationMode(targetDir);
const markers = collectMarkers(targetDir);

console.log(`Detected Mode: ${detected.mode}`);
console.log(`Confidence: ${detected.confidence}`);
console.log(`Reason: ${detected.reason}`);
```

**Mode Descriptions:**

| Mode | Description | Actions |
|------|-------------|---------|
| `framework-dev` | Contributing to aios-core itself | Skip project setup, use existing config |
| `greenfield` | New empty project | Full scaffolding, deployment config wizard |
| `brownfield` | Existing project | Analyze and adapt, merge configurations |

### 2. Elicit Deployment Configuration (Greenfield/Brownfield)

For greenfield and brownfield projects, gather deployment preferences:

**Key Questions:**

1. **Deployment Workflow:**
   - `staging-first`: All changes go to staging before production
   - `direct-to-main`: Feature branches merge directly to main

2. **Deployment Platform:**
   - `vercel`: Vercel deployment
   - `netlify`: Netlify deployment
   - `aws`: AWS (S3/CloudFront, ECS, Lambda)
   - `gcp`: Google Cloud Platform
   - `azure`: Microsoft Azure
   - `railway`: Railway.app
   - `custom`: Custom deployment scripts

3. **Branch Configuration:**
   - Staging branch name (default: `staging`)
   - Production branch name (default: `main`)

4. **Quality Gates:**
   - Enable lint check? (default: yes)
   - Enable typecheck? (default: yes for TypeScript projects)
   - Enable tests? (default: yes)
   - Enable security scan? (default: no)

### 3. Generate Documentation

Using the gathered context, generate project documentation:

```javascript
const { buildDocContext, generateDocs } = require('./.aios-core/infrastructure/scripts/documentation-integrity');

const context = buildDocContext(projectName, mode, markers, {
  // Custom overrides if needed
});

const result = generateDocs(targetDir, context, {
  dryRun: false,  // Set true to preview
});

console.log(`Generated ${result.filesCreated.length} documentation files`);
```

**Files Generated:**

| File | Purpose |
|------|---------|
| `.aios-core/docs/source-tree.md` | Project structure documentation |
| `.aios-core/docs/coding-standards.md` | Coding conventions and patterns |
| `.aios-core/docs/tech-stack.md` | Technology stack reference |

### 4. Generate Core Configuration

Create the core-config.yaml with deployment settings:

```javascript
const { buildConfigContext, generateConfig, DeploymentWorkflow, DeploymentPlatform } = require('./.aios-core/infrastructure/scripts/documentation-integrity');

const configContext = buildConfigContext(projectName, mode, {
  workflow: DeploymentWorkflow.STAGING_FIRST,
  platform: DeploymentPlatform.VERCEL,
  branches: {
    staging: 'staging',
    production: 'main',
  },
  quality_gates: {
    lint: true,
    typecheck: true,
    tests: true,
    security_scan: false,
  },
});

const configResult = generateConfig(targetDir, mode, configContext);
```

### 5. Generate/Merge .gitignore

Handle .gitignore based on project state:

```javascript
const { generateGitignoreFile, hasAiosIntegration } = require('./.aios-core/infrastructure/scripts/documentation-integrity');

const gitignoreResult = generateGitignoreFile(targetDir, markers, {
  projectName,
  merge: mode === 'brownfield',  // Merge with existing for brownfield
});

console.log(`Gitignore ${gitignoreResult.mode}: ${gitignoreResult.path}`);
```

### 6. Verify Configuration-Driven Architecture

Confirm the deployment config can be loaded by other tasks:

```javascript
const { loadDeploymentConfig, validateDeploymentConfig } = require('./.aios-core/infrastructure/scripts/documentation-integrity');

const deployConfig = loadDeploymentConfig(targetDir);
const validation = validateDeploymentConfig(deployConfig);

if (validation.valid) {
  console.log('Configuration-Driven Architecture ready');
  console.log(`Workflow: ${deployConfig.workflow}`);
  console.log(`Platform: ${deployConfig.platform}`);
} else {
  console.error('Configuration validation failed:', validation.errors);
}
```

## Success Criteria

- [ ] Installation mode correctly detected
- [ ] Project documentation generated in `.aios-core/docs/`
- [ ] `core-config.yaml` created with deployment section
- [ ] `.gitignore` properly configured (created or merged)
- [ ] Configuration passes validation
- [ ] No unresolved template placeholders in generated files

## Output

After successful execution:

```
Project Documentation Setup Complete
=====================================
Mode: greenfield
Project: my-awesome-app

Generated Files:
  ✓ .aios-core/docs/source-tree.md
  ✓ .aios-core/docs/coding-standards.md
  ✓ .aios-core/docs/tech-stack.md
  ✓ .aios-core/core-config.yaml
  ✓ .gitignore (created)

Deployment Configuration:
  Workflow: staging-first
  Platform: vercel
  Quality Gates: lint, typecheck, tests
```

## Notes

- This task implements the Configuration-Driven Architecture pattern
- Tasks read project-specific values from `core-config.yaml`
- For brownfield projects, existing configurations are preserved
- Use `*analyze-brownfield` task first for complex existing projects
