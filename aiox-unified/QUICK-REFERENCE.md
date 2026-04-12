# AIOX Unified — Quick Reference Card

## 🚀 Quick Navigation

### I want to...

| Task | Command | Location |
|------|---------|----------|
| Activate a main agent | `@dev` (or @qa, @architect, @pm, @po, @sm, @data-engineer, @ux, @analyst, @devops) | `agents/local-agents/` |
| Access agent help | `@agent-name` then `*help` | Agent directory |
| Start a new story | `@po` then `*create-story` | `projects/` |
| Run a workflow | `aiox-core workflow run {workflow-id}` | `workflows/` |
| Find a tool | Search `tools-master-registry.json` | `tools-skills/` |
| Check infrastructure | `cat infrastructure-inventory.json` | Root |
| Access a squad | `ls squads/active-squads/{squad-id}/` | `squads/active-squads/` |
| List all agents | `cat agents-master-registry.json` | Root |
| Get MCP info | Read `mcp-servers-guide.md` | Root |

---

## 📊 Master Registries at a Glance

```
/root/aiox-unified/
├── registry.json                    ← Start here (master index)
├── agents-master-registry.json      ← 207 agents
├── squads-master-registry.json      ← 33 squads
├── tools-master-registry.json       ← 374 tools
├── workflows-master-registry.json   ← 57 workflows
├── infrastructure-inventory.json    ← 18 services
├── mcp-servers-guide.md            ← 14 MCPs
│
├── projects/                        ← 20 projects
├── agents/local-agents/             ← 10 main agents
├── squads/active-squads/            ← 15 active squads
├── tools-skills/                    ← 374 tools
├── workflows/                       ← 57 workflows
│
└── COMPLETE-CONSOLIDATED-MAP.md    ← Full navigation guide (8+ pages)
```

---

## 🎯 Common Patterns

### Agent Commands
```bash
@dev          # Activate Developer
*help         # Show available commands
*create-story # For Scrum Master

@qa          # Activate QA
*qa-gate     # Run QA validation

@architect   # Activate Architect
*help        # Show design commands
```

### Tool Access
```bash
@skill-name          # Activate a skill
/AIOX:skills:name    # Skill command syntax
curl http://localhost:8081/{endpoint}  # AutoFlow API
```

### Project Access
```bash
ls projects/aiox-main/
cd projects/autoflow/
cat projects/paperclip/package.json
```

### Squad Access
```bash
ls squads/active-squads/
cd squads/active-squads/apex/
ls squads/active-squads/apex/agents/
```

### Service Health
```bash
curl http://127.0.0.1:11434/api/tags        # Ollama
curl http://localhost:8081/health            # AutoFlow
psql -U postgres -h 127.0.0.1 -c 'SELECT 1' # PostgreSQL
redis-cli ping                               # Redis
```

---

## 📈 Statistics

| Layer | Count | Access |
|-------|-------|--------|
| Projects | 20 | `projects/` |
| Agents | 207 | `@agent-name` or `agents/` |
| Squads | 33 | `squads/active-squads/` |
| Tools | 374 | `@skill-name` or `tools-skills/` |
| Workflows | 57 | `workflows/` or `aiox-core workflow` |
| Services | 18 | See `infrastructure-inventory.json` |
| MCPs | 14 | See `mcp-servers-guide.md` |
| **TOTAL** | **723** | **Consolidated** |

---

## 🔗 Key Links

### Documentation
- **Full Navigation:** `/root/aiox-unified/COMPLETE-CONSOLIDATED-MAP.md`
- **Infrastructure:** `/root/aiox-unified/infrastructure-inventory.json`
- **MCPs:** `/root/aiox-unified/mcp-servers-guide.md`
- **Consolidation Report:** `/root/aiox-unified/PHASE2_CONSOLIDATION_REPORT.md`

### Memory Files
- **Phase 2 Complete:** `/root/.claude/projects/-root/memory/PHASE2_CONSOLIDATION_COMPLETE.md`
- **MEGA Plan:** `/root/.claude/projects/-root/memory/MEGA_CONSOLIDATION_PLAN.md`

### Main Registry Files
- `registry.json` — Master index
- `agents-master-registry.json` — 207 agents
- `squads-master-registry.json` — 33 squads
- `tools-master-registry.json` — 374 tools
- `workflows-master-registry.json` — 57 workflows

---

## ⚡ Pro Tips

1. **Always start with registry.json** to understand structure
2. **Use @agent-name** for quick agent activation
3. **Check COMPLETE-CONSOLIDATED-MAP.md** for detailed navigation
4. **Infrastructure health checks** available in infrastructure-inventory.json
5. **MCP issues?** See mcp-servers-guide.md for troubleshooting
6. **Can't find something?** Search the relevant *-master-registry.json

---

## 🆘 Quick Support

| Issue | Check |
|-------|-------|
| Agent not found | `cat agents-master-registry.json \| grep agent-name` |
| Tool not working | `cat tools-master-registry.json \| grep tool-name` |
| Service down | `curl` health check from infrastructure-inventory.json |
| Squad not found | `ls squads/active-squads/` |
| Workflow fails | Check `workflows-master-registry.json` for dependencies |
| MCP issue | Read `mcp-servers-guide.md` Known Issues section |

---

**Consolidated:** 2026-04-12  
**Status:** Phase 2 Complete  
**Total Components:** 723  
**Storage:** ~45 GB / 222,609 files

---

*AIOX Unified — Single Source of Truth for Entire Ecosystem*
