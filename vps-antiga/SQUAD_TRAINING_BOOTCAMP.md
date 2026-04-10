# SQUAD TRAINING BOOTCAMP — Learn the New Architecture

**Duration**: 30 minutes self-study
**Level**: All squads (from super-architect to specialized agents)
**Goal**: Understand /vps-root, find resources, optimize execution

---

## 🎯 BOOTCAMP MODULES (5 modules × 6 min each)

### MODULE 1: NAVIGATION (6 minutes)

**Learn**: Where everything is in /vps-root/

```
/vps-root/
├── Estrutura/      ← Where originals are (Paperclip, Claude Code)
├── Agents/         ← Where all agents live (46+)
├── skills/         ← Where all skills live (400+)
├── workflows/      ← Where workflows are indexed (100+)
├── projects/       ← Where project data is (5+ projects)
├── squads/         ← Where your squad definition is (46 squads)
├── workers/        ← Where daemons & workers run
├── backups/        ← Where recovery happens (3+ copies)
├── shared_libs/    ← Where reusable code lives
├── logs/           ← Where your execution logs go
├── configs/        ← Where vps.env lives
└── tmp/            ← Cache & temp files
```

**Exercise**: Find your squad folder
```bash
ls -la /vps-root/squads/{your-squad}/
ls -la /vps-root/Agents/
```

**Key Paths to Remember**:
- Agents: `/vps-root/Agents/{system}_agents/`
- Skills: `/vps-root/skills/{category}/`
- Workflows: `/vps-root/workflows/{scope}/`
- Logs: `/vps-root/logs/{squad}/`
- Config: `/vps-root/configs/vps.env`

---

### MODULE 2: IMPORTING (6 minutes)

**Learn**: How to load resources in your code

**Old Way** (broken after migration):
```javascript
const agents = require('/srv/ai/agents/ceo_agent');
const skills = require('/srv/paperclip/skills');
```

**New Way** (uses /vps-root):
```javascript
// Load from environment
const AGENTS_PATH = process.env.AGENTS_PATH; // /vps-root/Agents
const SKILLS_PATH = process.env.SKILLS_PATH; // /vps-root/skills
const agents = require(`${AGENTS_PATH}/ceo_agents`);
```

**Best Practice** (use shared library loader):
```javascript
const loader = require('/vps-root/shared_libs/utils/loader');
const agents = loader.loadAgents('ceo_agents');
const skills = loader.loadSkills('automation');
```

**Your Environment Variables** (in /vps-root/configs/vps.env):
```bash
AGENTS_PATH=/vps-root/Agents
SKILLS_PATH=/vps-root/skills
WORKFLOWS_PATH=/vps-root/workflows
PROJECTS_PATH=/vps-root/projects
SQUADS_PATH=/vps-root/squads
WORKERS_PATH=/vps-root/workers
SHARED_LIBS_PATH=/vps-root/shared_libs
LOGS_PATH=/vps-root/logs
```

**Exercise**: Update your squad's imports
1. Find your squad definition: `/vps-root/squads/{your-squad}/`
2. Replace old paths with env vars
3. Test: `source /vps-root/configs/vps.env && echo $AGENTS_PATH`

---

### MODULE 3: FINDING RESOURCES (6 minutes)

**Learn**: How to discover agents, skills, workflows

**Search for Agents**:
```bash
# List all agents
ls /vps-root/Agents/

# Find agent by name
find /vps-root/Agents -name "*orchestrator*"

# See agent definition
cat /vps-root/Agents/ceo_agents/agents-orchestrator.md
```

**Search for Skills**:
```bash
# List skill categories
ls /vps-root/skills/

# Find skills by type
ls /vps-root/skills/automation/
find /vps-root/skills -name "*create*"

# See skill definition
cat /vps-root/skills/automation/paperclip-create-agent.md
```

**Search for Workflows**:
```bash
# List workflows by scope
ls /vps-root/workflows/project_workflows/
ls /vps-root/workflows/cross_project/

# Find workflow
find /vps-root/workflows -name "*deploy*"
```

**Search in Documentation**:
```bash
# Knowledge map of architecture
cat /tmp/vps-knowledge/KNOWLEDGE_MAP.md

# Dependency graph
cat /tmp/vps-knowledge/AUTO_EVOLUTION_SYSTEM.md
```

**Discovery Index** (optional, auto-generated):
```bash
cat /vps-root/.discovery_index.json  # All agents, skills, workflows indexed
```

**Exercise**: 
1. Find 3 agents in your domain
2. Find 2 skills that help your mission
3. Find 1 workflow relevant to your squad

---

### MODULE 4: LOGGING & MONITORING (6 minutes)

**Learn**: Where logs go & how to read them

**Your Squad's Logs**:
```bash
# Location
/vps-root/logs/{squad_name}/

# List recent logs
ls -lh /vps-root/logs/{your-squad}/

# Follow in real-time
tail -f /vps-root/logs/{your-squad}/{your-squad}-*.log
```

**Log Format** (standard):
```
[2026-04-01 18:40:00] [INFO] Executing task: vps-reorganization
[2026-04-01 18:40:05] [METRIC] execution_time=5s agents_used=3 status=success
[2026-04-01 18:40:10] [ERROR] Failed to import shared_libs/connectors
```

**Searching Logs**:
```bash
# Find errors
grep -i error /vps-root/logs/{your-squad}/*.log

# Find metrics (performance data)
grep METRIC /vps-root/logs/{your-squad}/*.log

# Find specific agent execution
grep "Agent.*ceo" /vps-root/logs/{your-squad}/*.log

# Watch for import failures
grep "import failed\|path not found" /vps-root/logs/*
```

**System-Wide Logs**:
```bash
# All errors across VPS
grep -r "ERROR\|FATAL" /vps-root/logs/ | head -20

# Performance trends
tail -100 /vps-root/logs/metrics/*.log | grep METRIC

# Backup status
cat /vps-root/backups/.backup_manifest.json
```

**Exercise**:
1. Find your squad's latest log file
2. Search for one successful execution
3. Search for one error
4. Note execution time & metric

---

### MODULE 5: IMPROVEMENT CONTRIBUTION (6 minutes)

**Learn**: How to optimize & share improvements

**Track Your Metrics** (auto-tracked):
- Execution time (per task)
- Success rate (errors/attempts)
- Resource usage (CPU, memory)
- Dependencies resolved (import time)
- Token usage (if Claude called)

**Contribute an Improvement**:

**Step 1**: Identify pattern
```bash
# Find slow execution
grep -E "execution_time=[0-9]+s" /vps-root/logs/{your-squad}/*.log | sort -t= -k2 -rn | head -5

# Analyze: "Agent X took 3 seconds, Agent Y could do it in 1 second"
```

**Step 2**: Create improvement
```bash
# Reorder agents in your squad
# Edit: /vps-root/squads/{your-squad}/README.md

# Old order: [Agent-A, Agent-B, Agent-C]
# New order: [Agent-C, Agent-A || Agent-B]  # C first, then A&B parallel
```

**Step 3**: Validate
```bash
# Run your task again
# Measure: execution_time improved?

# Before: 5.2 seconds
# After: 3.8 seconds
# Improvement: +27% faster ✓
```

**Step 4**: Share pattern
```bash
# Create improvement file
cat > /vps-root/squads/{your-squad}/improvements.log << 'EOF'
[2026-04-01 19:00] Reordered agents: [C, A||B] instead of [A,B,C]
Result: 5.2s → 3.8s (+27% improvement)
Pattern: Agent C has no dependencies, run first in parallel
EOF

# Other squads can learn from this via automated analysis
```

**Exercise**:
1. Review your squad's last 10 executions
2. Identify one slow agent
3. Suggest reordering (document in .log)
4. Share via improvements.log file

---

## 📚 QUICK REFERENCE CARDS

### Card 1: Environment Variables
```bash
# Load these in your script
source /vps-root/configs/vps.env

# Or use individually
export AGENTS_PATH=/vps-root/Agents
export SKILLS_PATH=/vps-root/skills
```

### Card 2: Common Commands
```bash
# Find an agent
find /vps-root/Agents -name "*pattern*"

# View agent definition
cat /vps-root/Agents/{system}_{type}/{agent_name}.md

# Find skill by category
ls /vps-root/skills/{category}/

# View your logs
tail -50 /vps-root/logs/{your-squad}/*.log

# Check backup status
cat /vps-root/backups/.backup_manifest.json

# Test import
source /vps-root/configs/vps.env && echo "✓ Imports ready"
```

### Card 3: Error Recovery
```bash
# If import fails
Error: Cannot find /srv/ai/agents/...
Fix: Update path to /vps-root/Agents/...

# If workflow not found
Error: Workflow not found at /vps/workflows/...
Fix: Check /vps-root/workflows/{project/}cross_project/

# If logs not writing
Error: Cannot write to /tmp/logs/
Fix: Logs should go to /vps-root/logs/{squad}/
```

---

## 🎓 VERIFICATION QUIZ

**Q1**: Where do you find agent definitions?
**A**: `/vps-root/Agents/{system}_agents/`

**Q2**: What's the environment variable for skills?
**A**: `SKILLS_PATH=/vps-root/skills`

**Q3**: Where do your squad's logs go?
**A**: `/vps-root/logs/{your-squad}/`

**Q4**: How do you contribute an improvement?
**A**: Document in `/vps-root/squads/{your-squad}/improvements.log`

**Q5**: Where's the knowledge map?
**A**: `/tmp/vps-knowledge/KNOWLEDGE_MAP.md`

**Score**: 5/5 = Ready! 🚀

---

## ✅ BOOTCAMP COMPLETION CHECKLIST

- [ ] Read Module 1: Navigation (know where things are)
- [ ] Complete Exercise 1: Find your squad folder
- [ ] Read Module 2: Importing (know how to load resources)
- [ ] Complete Exercise 2: Update one import path
- [ ] Read Module 3: Finding Resources (discovery)
- [ ] Complete Exercise 3: Find 3 agents + 2 skills
- [ ] Read Module 4: Logging (monitoring)
- [ ] Complete Exercise 4: View your squad's logs
- [ ] Read Module 5: Improvements (contribution)
- [ ] Complete Exercise 5: Document one improvement idea
- [ ] Pass Verification Quiz: 5/5

**Status**: Ready for Evolution God Mode! 🚀

---

## 📞 GETTING HELP

**Question**: "Where's agent X?"
**Answer**: Check `/tmp/vps-knowledge/KNOWLEDGE_MAP.md` → Dependency Graph

**Question**: "How do I optimize my execution?"
**Answer**: Read `/tmp/vps-knowledge/AUTO_EVOLUTION_SYSTEM.md` → Auto-Improvement Algorithms

**Question**: "What's the new directory structure?"
**Answer**: Review `/tmp/vps-migration-plan/VPS_ROOT_STRUCTURE.md`

**Question**: "What are the dependencies?"
**Answer**: Consult `/tmp/vps-migration-plan/DEPENDENCY_MAP.md`

---

**Bootcamp Duration**: 30 minutes (including exercises)
**Cost**: Zero tokens (Ollama-only training)
**Result**: Your squad ready for god mode

✅ **You're ready to self-optimize and evolve!**
