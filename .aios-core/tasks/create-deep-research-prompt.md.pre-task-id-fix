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

# No checklists needed - this task creates research prompts, validation is built into the research methodology
tools:
  - exa               # Conduct deep research on markets and technologies
  - context7          # Look up technical documentation and patterns
---

# Create Deep Research Prompt Task

This task helps create comprehensive research prompts for various types of deep analysis. It can process inputs from brainstorming sessions, project briefs, market research, or specific research questions to generate targeted prompts for deeper investigation.

## Purpose

Generate well-structured research prompts that:

- Define clear research objectives and scope
- Specify appropriate research methodologies
- Outline expected deliverables and formats
- Guide systematic investigation of complex topics
- Ensure actionable insights are captured

## Research Type Selection

CRITICAL: First, help the user select the most appropriate research focus based on their needs and any input documents they've provided.

### 1. Research Focus Options

Present these numbered options to the user:

1. **Product Validation Research**

   - Validate product hypotheses and market fit
   - Test assumptions about user needs and solutions
   - Assess technical and business feasibility
   - Identify risks and mitigation strategies

2. **Market Opportunity Research**

   - Analyze market size and growth potential
   - Identify market segments and dynamics
   - Assess market entry strategies
   - Evaluate timing and market readiness

3. **User & Customer Research**

   - Deep dive into user personas and behaviors
   - Understand jobs-to-be-done and pain points
   - Map customer journeys and touchpoints
   - Analyze willingness to pay and value perception

4. **Competitive Intelligence Research**

   - Detailed competitor analysis and positioning
   - Feature and capability comparisons
   - Business model and strategy analysis
   - Identify competitive advantages and gaps

5. **Technology & Innovation Research**

   - Assess technology trends and possibilities
   - Evaluate technical approaches and architectures
   - Identify emerging technologies and disruptions
   - Analyze build vs. buy vs. partner options

6. **Industry & Ecosystem Research**

   - Map industry value chains and dynamics
   - Identify key players and relationships
   - Analyze regulatory and compliance factors
   - Understand partnership opportunities

7. **Strategic Options Research**

   - Evaluate different strategic directions
   - Assess business model alternatives
   - Analyze go-to-market strategies
   - Consider expansion and scaling paths

8. **Risk & Feasibility Research**

   - Identify and assess various risk factors
   - Evaluate implementation challenges
   - Analyze resource requirements
   - Consider regulatory and legal implications

9. **Custom Research Focus**

   - User-defined research objectives
   - Specialized domain investigation
   - Cross-functional research needs

### 2. Input Processing

**If Project Brief provided:**

- Extract key product concepts and goals
- Identify target users and use cases
- Note technical constraints and preferences
- Highlight uncertainties and assumptions

**If Brainstorming Results provided:**

- Synthesize main ideas and themes
- Identify areas needing validation
- Extract hypotheses to test
- Note creative directions to explore

**If Market Research provided:**

- Build on identified opportunities
- Deepen specific market insights
- Validate initial findings
- Explore adjacent possibilities

**If Starting Fresh:**

- Gather essential context through questions
- Define the problem space
- Clarify research objectives
- Establish success criteria

## Process

### 3. Research Prompt Structure

CRITICAL: collaboratively develop a comprehensive research prompt with these components.

#### A. Research Objectives

CRITICAL: collaborate with the user to articulate clear, specific objectives for the research.

- Primary research goal and purpose
- Key decisions the research will inform
- Success criteria for the research
- Constraints and boundaries

#### B. Research Questions

CRITICAL: collaborate with the user to develop specific, actionable research questions organized by theme.

**Core Questions:**

- Central questions that must be answered
- Priority ranking of questions
- Dependencies between questions

**Supporting Questions:**

- Additional context-building questions
- Nice-to-have insights
- Future-looking considerations

#### C. Research Methodology

**Data Collection Methods:**

- Secondary research sources
- Primary research approaches (if applicable)
- Data quality requirements
- Source credibility criteria

**Analysis Frameworks:**

- Specific frameworks to apply
- Comparison criteria
- Evaluation methodologies
- Synthesis approaches

#### D. Output Requirements

**Format Specifications:**

- Executive summary requirements
- Detailed findings structure
- Visual/tabular presentations
- Supporting documentation

**Key Deliverables:**

- Must-have sections and insights
- Decision-support elements
- Action-oriented recommendations
- Risk and uncertainty documentation

### 4. Prompt Generation

**Research Prompt Template:**

```markdown
## Research Objective

[Clear statement of what this research aims to achieve]

## Background Context

[Relevant information from project brief, brainstorming, or other inputs]

## Research Questions

### Primary Questions (Must Answer)

1. [Specific, actionable question]
2. [Specific, actionable question]
   ...

### Secondary Questions (Nice to Have)

1. [Supporting question]
2. [Supporting question]
   ...

## Research Methodology

### Information Sources

- [Specific source types and priorities]

### Analysis Frameworks

- [Specific frameworks to apply]

### Data Requirements

- [Quality, recency, credibility needs]

## Expected Deliverables

### Executive Summary

- Key findings and insights
- Critical implications
- Recommended actions

### Detailed Analysis

[Specific sections needed based on research type]

### Supporting Materials

- Data tables
- Comparison matrices
- Source documentation

## Success Criteria

[How to evaluate if research achieved its objectives]

## Timeline and Priority

[If applicable, any time constraints or phasing]
```

### 5. Review and Refinement

1. **Present Complete Prompt**

   - Show the full research prompt
   - Explain key elements and rationale
   - Highlight any assumptions made

2. **Gather Feedback**

   - Are the objectives clear and correct?
   - Do the questions address all concerns?
   - Is the scope appropriate?
   - Are output requirements sufficient?

3. **Refine as Needed**
   - Incorporate user feedback
   - Adjust scope or focus
   - Add missing elements
   - Clarify ambiguities

### 6. Next Steps Guidance

**Execution Options:**

1. **Use with AI Research Assistant**: Provide this prompt to an AI model with research capabilities
2. **Guide Human Research**: Use as a framework for manual research efforts
3. **Hybrid Approach**: Combine AI and human research using this structure

**Integration Points:**

- How findings will feed into next phases
- Which team members should review results
- How to validate findings
- When to revisit or expand research

## Important Notes

- The quality of the research prompt directly impacts the quality of insights gathered
- Be specific rather than general in research questions
- Consider both current state and future implications
- Balance comprehensiveness with focus
- Document assumptions and limitations clearly
- Plan for iterative refinement based on initial findings
 