# AIOX Unified — Complete File Inventory

**Generated:** 2026-04-12  
**Location:** /root/aiox-unified/  
**Total Components:** 723  
**Total Files:** 222,609  
**Storage:** ~3.9 GB (unified) / ~45 GB (with projects)

---

## Master Registries (7)

### JSON Registries
- `registry.json` (1.2 KB) — Master index linking all 7 layers
- `agents-master-registry.json` (2.2 KB) — 207 agents indexed
- `squads-master-registry.json` (2.8 KB) — 33 squads mapped
- `tools-master-registry.json` (2.2 KB) — 374 tools catalogued
- `workflows-master-registry.json` (2.1 KB) — 57 workflows documented
- `infrastructure-inventory.json` (4.7 KB) — 18 services mapped

### Markdown Registries
- `mcp-servers-guide.md` — 14 MCP servers documented

---

## Documentation Files (10+)

### Comprehensive Guides
- `COMPLETE-CONSOLIDATED-MAP.md` — 8+ page full navigation guide
- `QUICK-REFERENCE.md` — Quick lookup card
- `PHASE2_CONSOLIDATION_REPORT.md` — Detailed consolidation report
- `PHASE2_EXECUTIVE_SUMMARY.txt` — Executive summary

### Navigation Maps
- `ACCESS-MAP.md` — Quick access reference
- `README.md` — General overview

### Phase Reports
- `DISCOVERY_REPORT_PHASE_1.md` — Phase 1 discovery results
- `PHASE1_CONSOLIDATION_SUMMARY.md` — Phase 1 summary
- `PHASE1_INDEX.md` — Phase 1 index
- `PHASE4-FINAL-VERIFICATION-REPORT.md` — Phase 4 verification
- `PHASE4-VERIFICATION-REPORT.json` — Verification JSON

---

## Consolidated Directories (7)

### 1. Projects/ (20 total)
```
projects/
├── aiox-main/                  (AIOX main monorepo)
├── aiox-core-framework/        (AIOX core framework)
├── autoflow/                   (AutoFlow workflow engine)
├── paperclip/                  (Task coordination)
├── llm-router/                 (LLM load balancing)
├── llm-router-aiox/            (LLM router variant)
├── aiox-dashboard/             (Observability dashboard)
├── recovered/                  (Legacy recovered code)
├── packages/                   (Shared libraries)
├── squads/                     (Squad definitions)
├── pro/                        (Proprietary features)
└── [9 more in VPS backup]
```

**Total Size:** ~45 GB (includes node_modules)

### 2. Agents/ (207 total)

#### Local Agents (10)
```
agents/local-agents/
├── dev/                        (Developer - Dex)
├── qa/                         (QA - Quinn)
├── architect/                  (Architect - Aria)
├── pm/                         (Product Manager - Morgan)
├── po/                         (Product Owner - Pax)
├── sm/                         (Scrum Master - River)
├── data-engineer/              (Data Engineer - Dara)
├── ux/                         (UX Designer - Uma)
├── analyst/                    (Analyst - Alex)
└── devops/                     (DevOps - Gage)
```

Each agent includes:
- Agent manifest (.md file)
- Memory directory (MEMORY.md)
- Command definitions
- Profile configuration

#### VPS Backup Agents (48)
```
agents/vps-backup-agents/
└── [48 agents via rclone access]
```

Access with: `rclone lsf gdrive:vps/extracted_backup/agents/`

#### Distributed Agents (149)
Located in: `squads/*/agents/`

### 3. Squads/ (33 total)

#### Active Squads (15)
```
squads/active-squads/
├── apex/                       (Multi-agent squad)
├── brand/                      (Brand/design squad)
├── curator/                    (Content management)
├── deep-research/              (Analysis squad)
├── dispatch/                   (Automation squad)
├── education/                  (Learning squad)
├── kaizen/                     (Continuous improvement)
├── kaizen-v2/                  (Enhanced CI)
├── legal-analyst/              (Legal research)
├── minimal-web-agent/          (Web automation)
├── seo/                        (SEO optimization)
├── squad-creator/              (Squad templating)
├── squad-creator-pro/          (Advanced templating)
├── claude-code-mastery/        (CLI expertise)
└── _example/                   (Squad template)
```

Each squad contains:
- agents/ — Squad-specific agents
- workflows/ — Squad workflows
- data/ — Configuration and data
- tools/ — Custom tools/skills
- webapp/ — Optional UI
- README.md — Squad documentation

#### Sprint Squads (9)
```
squads/sprint-squads/
└── [9 sprint-specific squads]
```

#### Legacy Squads (8)
```
squads/legacy-squads/
└── [8 archived squads]
```

### 4. Tools-Skills/ (374 total)

#### AIOX Tools (205)
```
tools-skills/aiox-tools/
├── development/                (linting, testing, formatting)
├── automation/                 (scheduling, orchestration)
├── integration/                (API clients, webhooks)
├── research/                   (web-search, docs)
├── devops/                     (deployment, monitoring)
└── ai/                         (model selection, evaluation)
```

#### AutoFlow Tools (125)
```
tools-skills/autoflow-tools/
├── data-processing/
├── automation/
├── integration/
└── reporting/
```

#### Workflow Tools (14)
```
tools-skills/workflow-tools/
├── orchestration/
├── triggering/
└── execution/
```

#### Other Tools (30)
```
tools-skills/other-tools/
├── utilities/
├── integrations/
└── experimental/
```

### 5. Workflows/ (57 total)

#### Core Workflows (15)
```
workflows/core-workflows/
├── story-development-cycle/    (Full 4-phase workflow)
├── qa-gate/                    (QA validation)
├── qa-loop/                    (Iterative QA)
├── spec-pipeline/              (Specification generation)
├── brownfield-discovery/       (Legacy assessment)
├── deployment/                 (CI/CD)
├── monitoring/                 (Observability)
├── agent-coordination/         (Multi-agent)
├── squad-orchestration/        (Squad-level)
└── [6 more core workflows]
```

#### Squad Workflows (42)
```
workflows/squad-workflows/
├── apex/                       (Apex squad workflows)
├── brand/                      (Brand workflows)
├── curator/                    (Curator workflows)
└── [39 more squad workflows]
```

### 6. Infrastructure/ (18 services)

```
infrastructure/
├── infrastructure-inventory.json  (All 18 services)
├── ports-mapping.json            (Port allocation)
└── deployment-config.yaml        (Deployment config)
```

**Services Documented:**
1. Ollama (LLM inference)
2. PostgreSQL (Database)
3. Docker (Containers)
4. GitHub (Version control)
5. Paperclip (Task coordination)
6. AutoFlow (Workflow engine)
7. LLM Router (Load balancing)
8. Supabase (Backend as service)
9. Redis (Caching)
10. BullMQ (Job queue)
11. Hardhat (Blockchain dev)
12. Solidity (Smart contracts)
13. Node.js/npm (Runtime)
14. Git (Repository)
15. Docker Compose (Orchestration)
16. Traefik (Reverse proxy)
17. Claude API (LLM integration)
18. OpenRouter (LLM aggregation)

### 7. MCP-Servers/ (14 MCPs)

```
mcp-servers/
├── mcp-servers-guide.md         (Complete MCP documentation)
└── mcp-capabilities.json        (MCP capabilities)
```

**MCPs Documented:**
1. Playwright (Browser automation)
2. Desktop Commander (Docker operations)
3. EXA (Web search)
4. Context7 (Library docs)
5. Apify (Web scraping)
6. nogic (Code intelligence)
7. code-graph (Dependency analysis)
8-14. AutoFlow-integrated MCPs (7 additional)

---

## Memory Files (Session Persistence)

Location: `/root/.claude/projects/-root/memory/`

- `PHASE2_CONSOLIDATION_COMPLETE.md` — Phase 2 completion summary
- `MEGA_CONSOLIDATION_PLAN.md` — Original consolidation plan

---

## Additional Reference Registries

### Legacy/Duplicate Registries (Phase 1 artifacts)
- `agents-core-registry.json` — Legacy agent registry
- `agents-registry.json` — Phase 1 agent registry
- `squads-active-registry.json` — Phase 1 squads registry
- `squads-registry.json` — Phase 1 squads registry
- `skills-registry.json` — Phase 1 skills registry
- `tools-registry-expanded.json` — Phase 1 tools registry
- `workflows-registry.json` — Phase 1 workflows registry
- `master-registry.json` — Phase 1 master registry
- `master-registry-CORRECTED.json` — Phase 1 corrected registry
- `phase1-discovery-results.json` — Phase 1 discovery results

**Note:** These are from Phase 1. Use the `*-master-registry.json` files (Phase 2) for current information.

---

## Storage Breakdown

| Directory | Size | Files | Purpose |
|-----------|------|-------|---------|
| projects/ | ~45 GB | ~150K | 20 consolidated projects |
| agents/ | ~500 MB | ~3K | 207 agents |
| squads/ | ~800 MB | ~10K | 33 squads |
| tools-skills/ | ~100 MB | ~500 | 374 tools |
| workflows/ | ~50 MB | ~200 | 57 workflows |
| infrastructure/ | <1 MB | 3 | Service docs |
| mcp-servers/ | <1 MB | 1 | MCP docs |
| Root docs | ~10 MB | 30 | Navigation/reference |
| **TOTAL** | **~46.5 GB** | **222,609** | **All unified** |

---

## Quick File Lookup Guide

### "I need to find..."

| Item | File |
|------|------|
| Master index | `registry.json` |
| All agents | `agents-master-registry.json` |
| All squads | `squads-master-registry.json` |
| All tools | `tools-master-registry.json` |
| All workflows | `workflows-master-registry.json` |
| All services | `infrastructure-inventory.json` |
| All MCPs | `mcp-servers-guide.md` |
| Full navigation | `COMPLETE-CONSOLIDATED-MAP.md` |
| Quick reference | `QUICK-REFERENCE.md` |
| Consolidation details | `PHASE2_CONSOLIDATION_REPORT.md` |
| Agent {name} | `agents/local-agents/{name}/` |
| Squad {name} | `squads/active-squads/{name}/` |
| Project {name} | `projects/{name}/` |
| Workflow {name} | `workflows/*/` (search) |
| Service info | `infrastructure-inventory.json` |
| MCP {name} | `mcp-servers-guide.md` (search) |

---

## Accessing Files

### Local Access
```bash
# List all projects
ls projects/

# Access an agent
cd agents/local-agents/dev/

# Browse squads
ls squads/active-squads/

# Search for tool
grep -i "tool-name" tools-master-registry.json

# Check infrastructure
cat infrastructure-inventory.json
```

### Registry Access
```bash
# Find agent
cat agents-master-registry.json | grep agent-name

# Find squad
cat squads-master-registry.json | grep squad-name

# Find tool
cat tools-master-registry.json | grep tool-name

# Find workflow
cat workflows-master-registry.json | grep workflow-name
```

### Documentation Access
```bash
# Full guide
cat COMPLETE-CONSOLIDATED-MAP.md

# Quick reference
cat QUICK-REFERENCE.md

# Consolidation details
cat PHASE2_CONSOLIDATION_REPORT.md

# MCP information
cat mcp-servers-guide.md
```

---

## File Organization Philosophy

**Single Source of Truth:** All 723 components in one unified directory structure

**Clear Hierarchy:**
- Layer 1 (Projects) → Layer 2 (Agents) → Layer 3 (Squads) → Layer 4-7 (Supporting)

**Searchable:** JSON registries for all major components

**Documented:** 10+ page comprehensive navigation guides

**Accessible:** Multiple access patterns (CLI, API, direct)

---

**Status:** Phase 2 Complete  
**Last Updated:** 2026-04-12  
**Next Review:** Phase 3 Integration

