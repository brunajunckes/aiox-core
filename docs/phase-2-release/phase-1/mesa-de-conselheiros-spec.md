# Mesa de Conselheiros (Council of Advisors)

## Purpose
Five specialized agents that meet every 30 minutes to collectively deliberate on critical system decisions, preventing single-point-of-failure in orchestration.

## The Five Conselheiros

### 1. **Conselheiro da Razão** (Reasoner)
- **Role:** Fact verification, logic consistency
- **Expertise:** Critical thinking, contradiction detection
- **Voting Weight:** 1.0
- **Decision:** ✅ GO / ❌ NO-GO / 🟡 CONDITIONAL

### 2. **Conselheiro da Experiência** (Veteran)
- **Role:** Pattern recognition from history
- **Expertise:** Prior incidents, lessons learned
- **Voting Weight:** 1.0
- **Decision:** Risk assessment based on precedent

### 3. **Conselheiro da Segurança** (Guardian)
- **Role:** Security and compliance assessment
- **Expertise:** OWASP, compliance gates, threat modeling
- **Voting Weight:** 1.5 (veto power)
- **Decision:** Security-first always

### 4. **Conselheiro da Performance** (Optimizer)
- **Role:** Cost and resource optimization
- **Expertise:** Token budgets, latency, efficiency
- **Voting Weight:** 1.0
- **Decision:** Efficiency vs quality trade-offs

### 5. **Conselheiro da Futuro** (Visionary)
- **Role:** Long-term implications and scalability
- **Expertise:** Architectural sustainability
- **Voting Weight:** 1.0
- **Decision:** Will this scale? Future-proof?

## Deliberation Protocol

### Trigger Events
- Phase changes (Phase 1 → 2, etc.)
- High-complexity tasks (complexity > 20)
- Security decisions
- Every 30 minutes (recurring vote)
- Force-escalation requests

### Voting Mechanism

```
Consensus = (sum(votes × weights) / sum(weights)) >= 4.0
├─ 4.5-5.0: Strong GO ✅
├─ 3.5-4.5: GO with conditions 🟡
├─ 2.5-3.5: Concerns raised, review
└─ <2.5:   NO-GO ❌
```

### Execution
Each conselheiro votes independently based on their expertise.
Meeting time: ~5-10 minutes (via Ollama, zero-cost).
Verdict recorded in PostgreSQL audit log.

## Implementation

```yaml
mesa:
  deliberation:
    interval: 30 minutes
    participants: 5 conselheiros
    timeout: 10 minutes
    recordingDatabase: aiox.council_decisions
  
  voting:
    weights:
      reasoner: 1.0
      veteran: 1.0
      guardian: 1.5  # security veto
      optimizer: 1.0
      visionary: 1.0
    
    thresholds:
      proceed: 4.0
      escalate: 2.5
