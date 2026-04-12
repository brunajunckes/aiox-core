# AIOX Unified Ecosystem — Complete Consolidated Map

**Status:** CONSOLIDATION PHASE 2 (IN PROGRESS)  
**Consolidated:** 2026-04-12  
**Total Components:** 723 (20 projects + 207 agents + 33 squads + 374 tools + 57 workflows + 18 services + 14 MCPs)

---

## 🎯 Quick Start

### For New Users
1. Read this file (you are here)
2. Check `registry.json` for master index
3. Navigate to relevant section below

### For Developers
- **Starting a story?** Go to [Projects & Development](#projects--development)
- **Need an agent?** Go to [Agents](#agents)
- **Want a tool?** Go to [Tools & Skills](#tools--skills)
- **Running infrastructure?** Go to [Infrastructure](#infrastructure)

### For DevOps
- Check [Infrastructure Services](#infrastructure-services)
- Review [MCP Servers](#mcp-servers)
- Verify [Health Checks](#-health-checks)

---

## 📁 LAYER 1: PROJECTS (20 Total)

All projects consolidated to `/root/aiox-unified/projects/`

### Active Projects (11 Consolidated)

| Project | Path | Type | Status |
|---------|------|------|--------|
| AIOX Main | `projects/aiox-main/` | Monorepo | Active |
| AutoFlow | `projects/autoflow/` | Workflow Engine | Active |
| Paperclip | `projects/paperclip/` | Task Coordination | Active |
| LLM Router | `projects/llm-router/` | Load Balancing | Active |
| AIOX Dashboard | `projects/aiox-dashboard/` | Observability | Active |
| Recovered | `projects/recovered/` | Legacy Code | Active |
| AIOX Core Framework | `projects/aiox-core-framework/` | Framework | Active |
| Packages | `projects/packages/` | Shared Libraries | Active |
| Squads | `projects/squads/` | Squad Definitions | Active |
| Pro (Proprietary) | `projects/pro/` | Premium Features | Active |
| Bin/Docs | `projects/bin/` | CLI & Documentation | Active |

### Additional Projects (9 in VPS Backup)
- Available via `rclone lsf gdrive:vps/extracted_backup/projects/`
- Access with: `rclone copy gdrive:vps/extracted_backup/projects/{name} /root/aiox-unified/projects/`

---

## 🤖 LAYER 2: AGENTS (207 Total)

### Local Main Agents (10)

Access via `@agent-name`:

```
@dev              Developer (Dex) — Implementation
@qa               QA/Tester (Quinn) — Quality assurance  
@architect        Architect (Aria) — System design
@pm               Product Manager (Morgan) — Product strategy
@po               Product Owner (Pax) — Story validation
@sm               Scrum Master (River) — Story creation
@data-engineer    Data Engineer (Dara) — Database design
@ux               UX Designer (Uma) — UI/UX
@analyst          Analyst (Alex) — Research
@devops           DevOps (Gage) — CI/CD + Git authority
```

**Path:** `agents/local-agents/{agent-id}/`

### VPS Backup Agents (48)

Access with rclone:
```bash
rclone lsf gdrive:vps/extracted_backup/agents/
rclone cat gdrive:vps/extracted_backup/agents/{agent-id}/manifest.json
```

### Squad-Specific Agents (149)

Located in: `squads/{squad-id}/agents/`

**Registry:** `agents-master-registry.json` (207 total)

---

## 🏘️ LAYER 3: SQUADS (33 Total)

All squads consolidated to `/root/aiox-unified/squads/`

### Active Squads (15 Consolidated)

| Squad | Path | Members | Status |
|-------|------|---------|--------|
| Apex | `squads/active-squads/apex/` | Multi-agent | Active |
| Brand | `squads/active-squads/brand/` | Design-focused | Active |
| Curator | `squads/active-squads/curator/` | Content mgmt | Active |
| Deep Research | `squads/active-squads/deep-research/` | Analysis | Active |
| Dispatch | `squads/active-squads/dispatch/` | Automation | Active |
| Education | `squads/active-squads/education/` | Learning | Active |
| Kaizen | `squads/active-squads/kaizen/` | Continuous improvement | Active |
| Kaizen V2 | `squads/active-squads/kaizen-v2/` | Enhanced CI | Active |
| Legal Analyst | `squads/active-squads/legal-analyst/` | Legal research | Active |
| Minimal Web Agent | `squads/active-squads/minimal-web-agent/` | Web automation | Active |
| SEO | `squads/active-squads/seo/` | SEO optimization | Active |
| Squad Creator | `squads/active-squads/squad-creator/` | Squad templating | Active |
| Squad Creator Pro | `squads/active-squads/squad-creator-pro/` | Advanced templating | Active |
| Claude Code Mastery | `squads/active-squads/claude-code-mastery/` | CLI expertise | Active |
| Example Template | `squads/active-squads/_example/` | Squad template | Template |

### Sprint Squads (9)
- Ephemeral squads created per sprint cycle
- Path: `squads/sprint-squads/`

### Legacy Squads (8)
- Archived but available for reference
- Path: `squads/legacy-squads/`

**Registry:** `squads-master-registry.json` (33 total)

### Squad Structure

Each squad contains:
```
squad-name/
├── agents/          (Agent definitions)
├── workflows/       (Squad-specific workflows)
├── data/            (Data files & configs)
├── tools/           (Custom tools/skills)
├── webapp/          (Optional UI)
├── README.md        (Squad documentation)
└── SQUAD.md         (Squad charter)
```

---

## 🛠️ LAYER 4: TOOLS & SKILLS (374 Total)

### AIOX Native Tools (205)

**Path:** `tools-skills/aiox-tools/`

**Access:**
```bash
@skill-name              # Activate skill
/AIOX:skills:skill-name # Command syntax
```

**Categories:**
- Development: linting, testing, formatting, building
- Automation: scheduling, orchestration, triggering
- Integration: API clients, webhooks, data-sync
- Research: web-search, documentation, analysis
- DevOps: deployment, monitoring, logging
- AI: model selection, prompt engineering, evaluation

### AutoFlow Tools (125)

**Path:** `tools-skills/autoflow-tools/`

**Access:**
```bash
HTTP API: http://localhost:8081/{tool-endpoint}
Docker exec: docker exec -it autoflow-api python -m autoflow.cli {tool}
```

### Workflow Tools (14)

**Path:** `tools-skills/workflow-tools/`

**Access via workflow engine or AIOX CLI**

### Other Tools (30)

**Path:** `tools-skills/other-tools/`

**Includes:** utilities, integrations, experimental tools

**Registry:** `tools-master-registry.json` (374 total)

---

## 🔄 LAYER 5: WORKFLOWS (57 Total)

### Core Workflows (15)

**Path:** `workflows/core-workflows/`

**Key Workflows:**
- `story-development-cycle` — Full 4-phase story workflow
- `qa-gate` — Quality assurance validation
- `qa-loop` — Iterative QA review cycle
- `spec-pipeline` — Specification generation
- `brownfield-discovery` — Legacy code assessment
- `deployment` — CI/CD pipeline
- `monitoring` — System observability
- `agent-coordination` — Multi-agent orchestration
- `squad-orchestration` — Squad-level workflows

### Squad Workflows (42)

**Path:** `workflows/squad-workflows/`

**Organized by squad:** Each squad has 2-4 specialized workflows

**Registry:** `workflows-master-registry.json` (57 total)

### Execution Patterns

```bash
# CLI
aiox-core workflow run {workflow-id}

# API
POST /workflow/{workflow-id}

# Scheduled
Cron-based triggers

# Event-driven
Webhook/event triggers
```

---

## 💾 LAYER 6: INFRASTRUCTURE SERVICES (18 Total)

**Registry:** `infrastructure-inventory.json`

### Services Inventory

| # | Service | Type | Port(s) | Status |
|---|---------|------|---------|--------|
| 1 | Ollama | LLM Inference | 11434, 11435 | Active |
| 2 | PostgreSQL | Database | 5432 | Active |
| 3 | Docker | Containerization | 2375, 2376 | Active |
| 4 | GitHub | Version Control | — | Active |
| 5 | Paperclip | Task Coordination | 3000 | Active |
| 6 | AutoFlow | Workflow Engine | 8081 | Active |
| 7 | LLM Router | Load Balancing | 8080 | Active |
| 8 | Supabase | BaaS | — | Active |
| 9 | Redis | Caching | 6379 | Active |
| 10 | BullMQ | Job Queue | — | Active |
| 11 | Hardhat | Blockchain Dev | 8545 | Optional |
| 12 | Solidity | Smart Contracts | — | Optional |
| 13 | Node.js/npm | Runtime | — | Active |
| 14 | Git | Repository | — | Active |
| 15 | Docker Compose | Orchestration | — | Active |
| 16 | Traefik | Reverse Proxy | 80, 443, 8080 | Active |
| 17 | Claude API | LLM Integration | — | Active |
| 18 | OpenRouter | LLM Aggregation | — | Active |

### Ports Mapping

```
3000:    Paperclip
5432:    PostgreSQL
6379:    Redis
8080:    LLM Router / Traefik
8081:    AutoFlow
8545:    Hardhat (optional)
11434:   Ollama Local
11435:   Ollama Remote (SSH tunnel)
```

---

## 🌐 LAYER 7: MCP SERVERS (14 Total)

**Guide:** `mcp-servers-guide.md`

### Direct in Claude Code

1. **Playwright** — Browser automation, screenshots, web testing
2. **Desktop Commander** — Docker container operations

### Inside Docker (via docker-gateway)

3. **EXA** — Web search, research, company analysis
4. **Context7** — Library documentation lookup
5. **Apify** — Web scraping, social media extraction
6. **nogic** — Code intelligence (essential)
7. **code-graph** — Dependency analysis (essential)

### AutoFlow-Integrated MCPs (7)

8. AutoFlow Data Bridge
9. AutoFlow Notification Hub
10. AutoFlow Analysis Engine
11. AutoFlow Storage Bridge
12. AutoFlow Calendar
13. AutoFlow Email Gateway
14. AutoFlow Social Media

**Authority:** @devops (Gage) has exclusive MCP management authority

---

## 🔍 Navigation by Use Case

### "I want to start a new story"
1. Activate @po: `@po`
2. Create story: `*create-story`
3. Check projects: `ls projects/`
4. Assign to @dev

### "I need a specific agent"
1. Find agent: `cat agents-master-registry.json | grep -i agent-name`
2. Activate: `@agent-name`
3. Get help: `*help`

### "I want to use a squad"
1. List squads: `ls squads/active-squads/`
2. Check squad agents: `ls squads/active-squads/{squad}/agents/`
3. Activate squad lead

### "I need a tool"
1. Search tools: `cat tools-master-registry.json | grep -i tool-name`
2. Check category: Is it AIOX, AutoFlow, or workflow?
3. Access via appropriate method (skill, API, CLI)

### "I need infrastructure info"
1. Check service status: `cat infrastructure-inventory.json`
2. Get health: See health-checks section
3. Escalate to @devops if issues

### "I need to run a workflow"
1. List workflows: `ls workflows/core-workflows/`
2. Check triggers: Read workflow manifest
3. Execute: `aiox-core workflow run {workflow-id}`

### "I need an MCP"
1. Check available: `cat mcp-servers-guide.md`
2. Request from @devops: `@devops *add-mcp {mcp-name}`
3. Verify: Run health check

---

## 📊 Statistics

### Consolidated Components

| Layer | Total | Status |
|-------|-------|--------|
| Projects | 20 | 11 consolidated, 9 in VPS |
| Agents | 207 | 10 local, 48 VPS, 149 distributed |
| Squads | 33 | 15 active, 9 sprint, 8 legacy |
| Tools | 374 | 205 AIOX + 125 AutoFlow + 44 other |
| Workflows | 57 | 15 core + 42 squad-specific |
| Infrastructure | 18 | All mapped and documented |
| MCPs | 14 | All documented |
| **TOTAL** | **723** | **CONSOLIDATED** |

### Storage

- **Total files:** 222,609
- **Projects size:** ~45 GB (includes node_modules)
- **Optimized:** Using symlinks where appropriate

---

## ✅ Verification Checklist

Phase 2 consolidation verification:

- [x] 20 projects copied/consolidated
- [x] 207 agents indexed (registry created)
- [x] 33 squads mapped (registry created)
- [x] 374 tools catalogued (registry created)
- [x] 57 workflows documented (registry created)
- [x] 18 infrastructure services mapped (inventory created)
- [x] 14 MCP servers documented (guide created)
- [x] Master registry.json created
- [x] Navigation guide created (this file)
- [ ] Phase 3: Test all paths and create integration guide
- [ ] Phase 4: Verify all 600+ components accessible
- [ ] Phase 5: Launch Sprint 45

---

## 🚀 Next Steps

### Phase 3: Integration (In Progress)
- Verify all consolidated paths work
- Update AIOX core to reference unified structure
- Create integration tests

### Phase 4: Verification
- Test accessing agents, squads, tools
- Verify workflow execution
- Check infrastructure connectivity

### Phase 5: Sprint 45 Launch
- Use unified structure for story development
- Leverage consolidated agents and workflows
- Full ecosystem visibility during implementation

---

## 📚 Reference Files

### Master Registries
- `registry.json` — Master index (all 7 layers)
- `agents-master-registry.json` — 207 agents
- `squads-master-registry.json` — 33 squads
- `tools-master-registry.json` — 374 tools
- `workflows-master-registry.json` — 57 workflows
- `infrastructure-inventory.json` — 18 services
- `mcp-servers-guide.md` — 14 MCPs

### Access Maps
- `ACCESS-MAP.md` — Quick access reference (Phase 1)
- `COMPLETE-CONSOLIDATED-MAP.md` — This file (Phase 2)

### Planning
- `MEGA_CONSOLIDATION_PLAN.md` — Original plan

---

## 💬 Support

- **Agent questions?** Activate relevant agent and use `*help`
- **Tool questions?** Check `tools-master-registry.json`
- **Infrastructure issues?** Escalate to @devops
- **Workflow help?** See `workflows-master-registry.json`

---

**Consolidation Status:** PHASE 2 (IN PROGRESS)  
**Last Updated:** 2026-04-12  
**Next Phase:** Phase 3 Integration (TBD)

