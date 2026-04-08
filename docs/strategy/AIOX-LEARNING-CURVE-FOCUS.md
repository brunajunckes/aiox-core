# AIOX Learning Curve Focus — Q2 2026

## Executive Summary
AIOX must reduce time-to-first-value from estimated 30+ minutes to under 10 minutes.
Primary blocker: users need to learn agent system, story workflow, and CLI commands before producing value.

## Current Onboarding Pain Points

| Pain Point | Severity | Impact |
|-----------|----------|--------|
| No single start-here path | HIGH | Users lost after install |
| Agent activation requires knowledge of @ syntax | MEDIUM | Barrier for new users |
| Story creation requires understanding of workflow | HIGH | First productive action delayed |
| No IDE-specific guidance | MEDIUM | Confusion across IDEs |
| Command discovery is implicit | HIGH | Users dont know what is available |

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to first value | ~30min | <10min | From npx install to first story |
| Onboarding completion | Unknown | >80% | Users who complete quickstart |
| Command discovery rate | Low | >60% | Users who find 3+ commands |
| First PR time | ~2hrs | <30min | From install to first PR |

## P0 Gate (Must ship Q2 Week 2)
- [ ] Single start-here flow (aiox quickstart)
- [ ] IDE compatibility matrix published
- [ ] Getting-started guide rewritten
- [ ] Onboarding smoke test in CI

## P1 Gate (Must ship Q2 Week 4)
- [ ] State-driven next-action suggestions
- [ ] Agent discovery via help menu
- [ ] Session state persistence

## P2 Gate (Q2 end)
- [ ] Metrics collection (opt-in)
- [ ] Onboarding A/B testing framework
- [ ] Community onboarding feedback loop

## Implementation Strategy

### Week 1-2: Foundation (P0)
1. Create aiox quickstart — guided interactive CLI flow
2. Build IDE compatibility matrix with activation instructions
3. Rewrite getting-started.md with 5-step journey
4. Add smoke test to CI for onboarding flow

### Week 3-4: Intelligence (P1)
1. Implement state tracking across sessions
2. Build what-is-next suggestion engine
3. Add inline hints during agent activation
4. Create command palette with fuzzy search

## Competitor Analysis

| Platform | TTF Value | Strength | AIOX Advantage |
|----------|-----------|----------|---------------|
| Cursor | ~5min | Inline AI, zero config | Multi-agent team, story-driven |
| GitHub Copilot | ~2min | VS Code native | Full lifecycle, not just code |
| Cody (Sourcegraph) | ~10min | Codebase context | Agent personas, quality gates |
| Windsurf | ~5min | Fast indexing | Constitutional compliance, agile |

## Key Differentiators to Emphasize
1. **Multi-agent team collaboration** — not just coding, full SDLC
2. **Constitutional compliance** — automated quality gates
3. **Story-driven development** — structured, trackable progress
4. **IDE agnostic** — works across Claude Code, Cursor, Gemini, Copilot
5. **Squads** — reusable agent team configurations

---
*Document created: 2026-04-08 by @analyst (Alex)*