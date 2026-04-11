# Phase 1 Retroactive Stories — Constitution Remediation

**Objective:** Create 8 stories for Phase 1 work (15K lines code) to comply with Article III (Story-Driven Development)

**Owner:** @sm (create) + @qa (validate)  
**Target:** docs/stories/active/

---

## Story Creation Checklist

### Story 4.1 — Router Core Implementation
- [ ] Create file: `docs/stories/active/4.1.story.md`
- [ ] Add title: "Router Core — GPU Allocation & LLM Selection"
- [ ] Add AC:
  - [ ] Router supports Ollama → Claude fallback
  - [ ] Complexity scoring integrated (1-15 scale)
  - [ ] Circuit breaker prevents cascade failures
  - [ ] Cost tracking logs all LLM calls
- [ ] Add file list from git history (router.py, config.py, etc.)
- [ ] Mark status: DONE
- [ ] Add checkboxes (all checked ✓)

### Story 4.2 — Validator Engine
- [ ] Create file: `docs/stories/active/4.2.story.md`
- [ ] Add title: "Validator Engine — 3-Tier Safety Checks"
- [ ] Add AC:
  - [ ] Pydantic validation layer (deterministic)
  - [ ] Heuristic validation layer (rule-based)
  - [ ] LLM validation layer (semantic)
  - [ ] 4.9K lines test coverage
- [ ] Add file list (validator.py, test_validator.py)
- [ ] Mark status: DONE

### Story 4.3 — Monitor & Alerting
- [ ] Create file: `docs/stories/active/4.3.story.md`
- [ ] Add title: "Monitor & Alerting — Health & Metrics"
- [ ] Add AC:
  - [ ] RAM/disk/CPU monitoring with auto-eviction
  - [ ] Container health checks
  - [ ] Prometheus metrics collection
  - [ ] Grafana dashboards (read-only observability)
- [ ] Add file list (resource_monitor.py, systemd services)
- [ ] Mark status: DONE

### Story 4.4 — API Gateway
- [ ] Create file: `docs/stories/active/4.4.story.md`
- [ ] Add title: "API Gateway — REST Endpoints"
- [ ] Add AC:
  - [ ] FastAPI endpoints for workflows (research, seo, video)
  - [ ] Request/response validation
  - [ ] Error handling (7-tier taxonomy)
  - [ ] API documentation (OpenAPI)
- [ ] Add file list (server.py, handlers)
- [ ] Mark status: DONE

### Story 4.5 — Caching Layer
- [ ] Create file: `docs/stories/active/4.5.story.md`
- [ ] Add title: "Caching Layer — Multi-Level Cache"
- [ ] Add AC:
  - [ ] Redis cache for LLM responses
  - [ ] PostgreSQL for persistent cache
  - [ ] TTL & invalidation strategy
  - [ ] Cache hit rate > 40%
- [ ] Add file list (caching.py, redis config)
- [ ] Mark status: DONE

### Story 4.6 — Cost Tracking
- [ ] Create file: `docs/stories/active/4.6.story.md`
- [ ] Add title: "Cost Tracking — Billing & Quotas"
- [ ] Add AC:
  - [ ] Per-tenant cost tracking
  - [ ] Model pricing stored in PostgreSQL
  - [ ] Quota enforcement (Paperclip integration)
  - [ ] Monthly billing reports
- [ ] Add file list (cost_tracking.py, billing schemas)
- [ ] Mark status: DONE

### Story 4.7 — Distributed Tracing
- [ ] Create file: `docs/stories/active/4.7.story.md`
- [ ] Add title: "Distributed Tracing — Request Flow"
- [ ] Add AC:
  - [ ] OpenTelemetry instrumentation
  - [ ] Jaeger collection & visualization
  - [ ] Request ID tracking end-to-end
  - [ ] P99 latency < 5s baseline established
- [ ] Add file list (tracing.py, otel config)
- [ ] Mark status: DONE

### Story 4.8 — Multi-Tenancy
- [ ] Create file: `docs/stories/active/4.8.story.md`
- [ ] Add title: "Multi-Tenancy — Isolation & Schema"
- [ ] Add AC:
  - [ ] Tenant isolation via PostgreSQL schemas
  - [ ] Row-level security (RLS) policies
  - [ ] Tenant context in all requests
  - [ ] 100+ concurrent tenants supported
- [ ] Add file list (tenants.py, schema migrations)
- [ ] Mark status: DONE

---

## Post-Creation Validation

- [ ] All 8 stories exist in docs/stories/active/
- [ ] All AC checkboxes marked ✓
- [ ] All file lists populated from git history
- [ ] All status set to DONE
- [ ] @qa validates each story against 10-point checklist
- [ ] No stories have missing sections

---

## Success Criteria

✅ 8 stories created  
✅ 100+ AC items documented  
✅ File lists complete (80+ files tracked)  
✅ Article III (Story-Driven) compliance achieved  
✅ Retroactive documentation done within 2 hours
