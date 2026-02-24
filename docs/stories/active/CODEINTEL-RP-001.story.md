# Story: CODEINTEL-RP-001 — Code-Intel RegistryProvider

---

## Community Origin

- **Source:** Backlog item 1740200000001
- **Created By:** @architect (Aria)
- **Promoted By:** @po (Pax) — GO com condicoes (2026-02-23)

---

## Status

**Current:** Draft
**Sprint:** TBD (standalone, next available)

---

## Executor Assignment

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Executor** | @dev (Dex) | Implementation |
| **Quality Gate** | @architect (Aria) | Architecture review, provider contract validation |
| **QA** | @qa (Quinn) | Test coverage, regression validation |

---

## Story

**As a** AIOS framework user,
**I want** a native RegistryProvider for code-intel that uses Entity Registry as data source,
**So that** all 15+ tasks invoking code-intel helpers get real data (instead of `null`) without requiring an MCP server, enabling zero-latency code intelligence for ~70% of use cases.

### Context

- Code-intel has 6 helpers (dev, qa, planning, story, creation, devops) invoked by 15+ tasks
- ALL calls currently return `null` because no MCP provider is configured for most users
- System has graceful fallback (circuit breaker, session cache) — works without provider, but with zero data
- Entity Registry (`.aios-core/data/entity-registry.yaml`) has 737 entities across 14 categories with path, layer, type, purpose, keywords, usedBy, dependencies
- Epic TOK established 3-Tier Tool Mesh: T1 Always (native), T2 Deferred, T3 External (MCP)
- RegistryProvider is T1 (always loaded, PTC-eligible per ADR-3)
- Code Graph MCP remains T3 premium provider for AST-deep analysis

### Architecture Reference

- **Provider Interface:** `.aios-core/core/code-intel/providers/provider-interface.js` — 8 abstract primitives
- **Client:** `.aios-core/core/code-intel/code-intel-client.js` — circuit breaker, session cache, provider registry
- **Existing Provider:** `.aios-core/core/code-intel/providers/code-graph-provider.js` — MCP adapter pattern
- **Entity Registry:** `.aios-core/data/entity-registry.yaml` — 737 entities, 14 categories
- **Index:** `.aios-core/core/code-intel/index.js` — singleton client, enricher, convenience functions

---

## Acceptance Criteria

### AC1: RegistryProvider Class
- [ ] `RegistryProvider` extends `CodeIntelProvider` from `provider-interface.js`
- [ ] Constructor loads entity-registry.yaml and builds in-memory index
- [ ] Provider name is `'registry'`
- [ ] Lazy-loads registry on first call (not constructor) to avoid startup overhead

### AC2: Implement 5 Core Primitives
- [ ] `findDefinition(symbol)` — Matches entity by name/path/keywords, returns `{file, line, column, context}`
- [ ] `findReferences(symbol)` — Searches `usedBy` and `dependencies` fields across all entities, returns array of `{file, line, context}`
- [ ] `analyzeDependencies(path)` — Resolves dependency graph from entity `dependencies` field, returns `{nodes, edges}`
- [ ] `analyzeCodebase(path)` — Returns structural overview from entity categories/layers, returns `{files, structure, patterns}`
- [ ] `getProjectStats(options)` — Aggregates entity counts by category/layer, returns `{files, lines, languages}`

### AC3: Non-Implemented Primitives Return Null
- [ ] `findCallers(symbol)` returns `null` (requires AST — MCP only)
- [ ] `findCallees(symbol)` returns `null` (requires AST — MCP only)
- [ ] `analyzeComplexity(path)` returns `null` (requires AST — MCP only)

### AC4: Client Registration
- [ ] `CodeIntelClient._registerDefaultProviders()` registers RegistryProvider as first provider
- [ ] RegistryProvider has higher priority than CodeGraphProvider (fallback chain: Registry first, MCP second)
- [ ] `isCodeIntelAvailable()` returns `true` when RegistryProvider is registered (even without MCP)

### AC5: Pattern-Based Matching
- [ ] Symbol lookup uses fuzzy matching: exact name > path contains > keywords contains
- [ ] Case-insensitive matching for symbol names
- [ ] Results sorted by match quality (exact > partial > keyword)

### AC6: Cache Integration
- [ ] RegistryProvider results go through existing session cache (TTL 5min) in CodeIntelClient
- [ ] Entity registry file is loaded once and cached in-memory (not re-parsed per call)
- [ ] Cache invalidation: registry reloaded if file mtime changes (stat check, not watcher)

### AC7: PTC Eligibility
- [ ] RegistryProvider marked as `ptc_eligible: true` in tool-registry.yaml
- [ ] Tier classification: T1 (Always loaded)
- [ ] No MCP dependency — fully native JavaScript

### AC8: Helper Functions Work
- [ ] `dev-helper.js` `checkBeforeWriting()` returns real data with RegistryProvider
- [ ] `dev-helper.js` `suggestReuse()` returns real data with RegistryProvider
- [ ] `qa-helper.js` `getBlastRadius()` returns real data with RegistryProvider
- [ ] `qa-helper.js` `getReferenceImpact()` returns real data with RegistryProvider
- [ ] `planning-helper.js` `getDependencyGraph()` returns real data with RegistryProvider
- [ ] `planning-helper.js` `getCodebaseOverview()` returns real data with RegistryProvider
- [ ] `story-helper.js` `suggestRelevantFiles()` returns real data with RegistryProvider

### AC9: Graceful Degradation
- [ ] If entity-registry.yaml is missing or malformed, RegistryProvider returns `null` for all calls (no crash)
- [ ] If entity-registry.yaml is empty, returns empty results (not errors)
- [ ] Circuit breaker in CodeIntelClient still works with RegistryProvider

### AC10: Zero Regression
- [ ] All existing code-intel tests pass without modification
- [ ] Existing helpers work identically when MCP is unavailable (now with registry data instead of null)
- [ ] No changes to provider-interface.js contract

---

## CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Code/Features/Logic (new provider implementation)
- **Complexity:** Medium-High (extends existing architecture, 5 primitives, integration with client)
- **Secondary Types:** Testing (unit + integration), Configuration (tool-registry update)

### Specialized Agent Assignment

| Agent | Role | Justification |
|-------|------|---------------|
| @dev (Dex) | Primary executor | Code implementation + tests |
| @architect (Aria) | Quality gate | Provider contract compliance, architecture pattern |
| @qa (Quinn) | QA review | Test coverage, regression validation |

### Predicted CodeRabbit Findings

| Category | Expected | Severity | Pre-Action |
|----------|----------|----------|------------|
| Error handling | Missing try/catch on YAML parse | MEDIUM | Use safe yaml parser with try/catch |
| Performance | Registry loaded synchronously | HIGH | Use lazy async loading |
| Security | YAML parse allows arbitrary types | MEDIUM | Use `js-yaml` with `JSON_SCHEMA` (safe) |
| Security | Path traversal in entity paths | LOW | Validate no `..` segments in paths |

### Quality Gate Configuration

```yaml
self_healing:
  enabled: true
  type: light
  max_iterations: 2
  severity_filter: [CRITICAL]
  behavior:
    CRITICAL: auto_fix
    HIGH: document_only
    MEDIUM: ignore
    LOW: ignore
```

### Focus Areas

- Provider contract compliance (all 8 primitives handled — 5 implemented, 3 return null)
- YAML parsing security (safe schema, no arbitrary types)
- Cache invalidation correctness (mtime-based reload)
- Graceful degradation (missing/malformed registry)
- Zero regression on existing tests

---

## Tasks / Subtasks

### Task 1: Create RegistryProvider Class
- [ ] 1.1 Create `registry-provider.js` in `.aios-core/core/code-intel/providers/`
- [ ] 1.2 Extend `CodeIntelProvider` with `name: 'registry'`
- [ ] 1.3 Implement lazy registry loading (load on first primitive call)
- [ ] 1.4 Parse entity-registry.yaml using `js-yaml` (already a project dependency)
- [ ] 1.5 Build in-memory index: byName Map, byPath Map, byCategory Map, byKeyword inverted index

### Task 2: Implement 5 Primitives
- [ ] 2.1 `findDefinition(symbol)` — fuzzy match: exact name > path > keywords, return first match
- [ ] 2.2 `findReferences(symbol)` — scan `usedBy` + `dependencies` fields, aggregate all referencing entities
- [ ] 2.3 `analyzeDependencies(path)` — build directed graph from entity dependencies field
- [ ] 2.4 `analyzeCodebase(path)` — aggregate entities by category/layer, produce structure overview
- [ ] 2.5 `getProjectStats(options)` — count entities, unique paths, categorize by layer (L1-L4)
- [ ] 2.6 Return `null` for `findCallers`, `findCallees`, `analyzeComplexity` (AST-only primitives)

### Task 3: Register in Client
- [ ] 3.1 Update `CodeIntelClient._registerDefaultProviders()` to register RegistryProvider first
- [ ] 3.2 Implement provider priority: RegistryProvider > CodeGraphProvider
- [ ] 3.3 Update `_detectProvider()` to prefer RegistryProvider when available
- [ ] 3.4 Ensure `isCodeIntelAvailable()` returns `true` with RegistryProvider alone

### Task 4: Update Module Index
- [ ] 4.1 Export `RegistryProvider` from `index.js`
- [ ] 4.2 Add to module documentation

### Task 5: Update Tool Registry
- [ ] 5.1 Add RegistryProvider entry to `.aios-core/data/tool-registry.yaml`
- [ ] 5.2 Set `tier: 1`, `ptc_eligible: true`, `mcp_required: false`

### Task 6: Write Tests
- [ ] 6.1 Unit tests for RegistryProvider — all 5 implemented primitives
- [ ] 6.2 Unit tests for null return on 3 AST-only primitives
- [ ] 6.3 Unit tests for fuzzy matching (exact, partial, keyword)
- [ ] 6.4 Unit tests for graceful degradation (missing file, malformed YAML, empty registry)
- [ ] 6.5 Integration tests — verify helpers return real data with RegistryProvider
- [ ] 6.6 Integration test — verify existing tests pass (no regression)
- [ ] 6.7 Test cache behavior — registry loaded once, reloaded on mtime change

### Task 7: Validation
- [ ] 7.1 Run full test suite (existing + new)
- [ ] 7.2 Verify `isCodeIntelAvailable()` returns `true` in fresh session
- [ ] 7.3 Manual smoke test: invoke helper functions, confirm non-null results
- [ ] 7.4 Measure token impact: compare session overhead before/after

---

## Dev Notes

### Architecture Pattern
Follow the same adapter pattern as `code-graph-provider.js`:
- Extend `CodeIntelProvider`
- Implement primitives that map to data source
- Use normalization helpers for consistent response format
- Non-implemented primitives inherit `null` from base class

### Entity Registry Schema (per entity)
```yaml
entityName:
  path: relative/path/to/file.js
  layer: L1|L2|L3|L4
  type: task|agent|template|checklist|script|config|...
  purpose: "One-line description"
  keywords: [keyword1, keyword2]
  usedBy: [entity1, entity2]
  dependencies: [dep1, dep2]
  checksum: sha256hash
```

### Key Implementation Details
1. **Fuzzy matching order:** exact entity name → path.includes(symbol) → keywords.includes(symbol)
2. **usedBy/dependencies are entity names** — resolve to paths via the byName index
3. **Registry path:** resolve from `core-config.yaml` → `dataLocation` → `entity-registry.yaml`
4. **Mtime check:** use `fs.statSync()` on registry file, compare to cached mtime
5. **Provider priority in client:** Array order matters — first provider that returns non-null wins
6. **YAML safe parsing:** Use `js-yaml` with `JSON_SCHEMA` (or `FAILSAFE_SCHEMA`) to prevent arbitrary object instantiation. Never use `DEFAULT_SCHEMA` which allows `!!js/function` and similar unsafe types
7. **Path validation:** Reject entity paths containing `..` segments — registry paths must be relative and within project root (defense-in-depth)

### Files to Create
| File | Purpose |
|------|---------|
| `.aios-core/core/code-intel/providers/registry-provider.js` | RegistryProvider class |
| `tests/unit/code-intel/registry-provider.test.js` | Unit tests |
| `tests/integration/code-intel/registry-provider-integration.test.js` | Integration tests |

### Files to Modify
| File | Change |
|------|--------|
| `.aios-core/core/code-intel/code-intel-client.js` | Register RegistryProvider first in `_registerDefaultProviders()` |
| `.aios-core/core/code-intel/index.js` | Export RegistryProvider |
| `.aios-core/data/tool-registry.yaml` | Add RegistryProvider entry (T1, ptc_eligible) |

### Boundary Impact
- All files are in L3 (data) or L1 with allow exceptions — no boundary violations
- `providers/registry-provider.js` is NEW file in L1 path but part of code-intel module (framework contributor mode required since `boundary.frameworkProtection: false` is already set)

### ADR References
- **ADR-3:** PTC native ONLY — RegistryProvider is native, so PTC-eligible
- **ADR-5:** Search for discovery, Examples for accuracy — RegistryProvider enhances discovery
- **ADR-7:** Capability gate per runtime — RegistryProvider always available (no capability gate needed)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-23 | @sm (River) | Story created from backlog item 1740200000001. Full architecture context gathered from 12 code-intel files + entity-registry. |
| 1.1 | 2026-02-23 | @sm (River) | Applied PO validation SF-1 (YAML safe schema + path validation in Dev Notes) and SF-2 (expanded CodeRabbit section with Story Type Analysis, Specialized Agents, Focus Areas, severity behavior). |

---

## Dev Agent Record

### Agent Model Used
- TBD

### Debug Log References
- N/A

### Completion Notes
- [ ] Story implementation started
- [ ] All tasks completed
- [ ] All tests passing
- [ ] Story marked Ready for Review

### File List
*Updated during implementation*

---

## QA Results

*Populated by @qa during review*

---
