# Hermes Orchestration Framework — Phase 2

## Overview
Hermes is the AIOX supervisor and executor layer that orchestrates multi-agent workflows at scale.

## Architecture

### Supervisor Pattern
```
Hermes Supervisor (Main Process)
  ├─ Task Queue Manager
  │  ├─ Priority routing
  │  ├─ Dependency tracking
  │  └─ State persistence
  │
  ├─ Agent Dispatcher
  │  ├─ Route by complexity (Haiku/Sonnet/Opus)
  │  ├─ Model fallback (Ollama → Sonnet → Haiku)
  │  └─ Cost optimization
  │
  ├─ Executor Engine
  │  ├─ Parallel squad execution
  │  ├─ Failure recovery
  │  └─ Auto-remediation
  │
  └─ Health Monitor
     ├─ System metrics
     ├─ Agent performance
     └─ Auto-escalation
```

### Model Routing (Tier-Based)

```javascript
const modelRouter = {
  'simple': { primary: 'ollama.ampcast.site:qwen2.5:7b', fallback: 'haiku-4.5' },
  'medium': { primary: 'sonnet-4.6', fallback: 'haiku-4.5' },
  'complex': { primary: 'opus-4.6', fallback: 'sonnet-4.6' },
  'research': { primary: 'opus-4.6', fallback: 'sonnet-4.6' }
}
```

### Execution Flow

1. **Task Intake** → Classify by complexity
2. **Dependency Resolution** → Check blockers
3. **Route Assignment** → Pick model tier
4. **Parallel Execute** → Squad dispatch
5. **Result Aggregation** → Consolidate outputs
6. **Auto-Fix** → If failures detected
7. **Escalation** → If unrecoverable

## Implementation

### Core Modules

**hermes-supervisor.js:**
- Task queue management
- Model routing decisions
- Health monitoring
- Escalation triggers

**hermes-executor.js:**
- Parallel squad execution
- Dependency tracking
- Failure recovery
- Auto-remediation logic

**hermes-router.js:**
- Complexity classification
- Model tier assignment
- Cost optimization
- Fallback mechanisms

### Configuration

```yaml
hermes:
  supervisor:
    maxParallelSquads: 4
    taskTimeout: 3600
    healthCheckInterval: 300
    escalationThreshold: 3
  
  routing:
    simpleThreshold: 5  # Haiku if < 5K tokens
    mediumThreshold: 20 # Sonnet if < 20K
    complexThreshold: 50 # Opus if < 50K
    
  executor:
    maxRetries: 3
    backoffMultiplier: 2
    parallelWorkers: 4
```

## Integration Points

- **PostgreSQL:** Task state, audit logs
- **Supabase:** Memory sync, RLS isolation
- **MCP:** Tool invocation
- **Mesa de Conselheiros:** Decision voting on escalations
