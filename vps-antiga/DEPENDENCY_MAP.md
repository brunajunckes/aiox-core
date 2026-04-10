# VPS Dependency Map — Complete System Graph

**Generated**: 2026-04-01
**Scope**: All systems being unified

---

## 🔗 IMPORT DEPENDENCY GRAPH

### Paperclip System
```
/srv/paperclip/
├── packages/* (services)
│   ├── adapter-* (imports: skills, agents, shared_libs)
│   ├── shared (imports: connectors, utils)
│   └── ui (imports: agents API, workflows)
├── .agents/ 
│   ├── skills/ (imports: @paperclipai/adapter-utils)
│   └── agents/ (imports: shared_libs, connectors)
├── skills/
│   ├── paperclip-create-agent
│   ├── paperclip-run-agent
│   └── ... (many skills)
└── data/instances/*/workspaces/*/agents/
    └── (imports: parent adapters, shared libs)

CRITICAL IMPORTS:
- @paperclipai/adapter-utils (everywhere)
- ../../../shared_libs/connectors
- ./shared_libs/logging
- process.env.AGENTS_PATH
```

### Claude Code System
```
/root/.claude/
├── hooks/ (automated behaviors)
│   ├── Auto-login (imports: settings)
│   ├── Agent config (imports: agents, squads)
│   └── ... (26 hooks)
├── skills/
│   ├── squad (imports: /srv/ai/squads)
│   ├── memory (imports: memory files)
│   └── ...
├── projects/*
│   ├── .planning/ (workflows, plans)
│   └── memory/ (persistent state)
└── settings.json (references paths)

CRITICAL IMPORTS:
- /srv/ai/squads/*
- /srv/ai/agents/*
- ./memory/*
- process.env.CLAUDE_ROOT
```

### AI Infrastructure System
```
/srv/ai/
├── agents/
│   ├── ceo_agent/ (imports: shared_libs, workflows)
│   ├── analytics_agent/ (imports: ml_models, logging)
│   └── ...
├── squads/
│   ├── super-architect/ (orchestrates agents)
│   ├── super-execution/ (uses agents, daemons)
│   └── ... (46 squads)
├── skills/
│   ├── nlp/
│   ├── automation/
│   └── ...
├── workflows/
│   ├── project_workflows/ (imports: agents, skills)
│   └── cross_project/ (git_hunter, orchestration)
└── _archive/ (legacy projects)

CRITICAL IMPORTS:
- ./shared_libs/* (all agents)
- ./connectors/* (Paperclip API calls)
- ./agents/* (squad composition)
```

### Git Hunter System
```
/srv/git-hunter/
├── watcher.py (imports: requests, paperclip API)
└── logs/

CRITICAL IMPORTS:
- http://localhost:3100 (Paperclip API)
- GitHub API (external)
- Logging to /srv/git-hunter/logs/
```

### System Daemons
```
/tmp/
├── orion-cpu-monitor.sh (logs: /tmp/orion.log)
├── dex-daemon.sh (logs: /tmp/dex.log)
├── cpu-aware-queue.sh (logs: /tmp/queue.log)
└── link-recovery.sh (logs: /tmp/link-recovery.log)

CRITICAL IMPORTS:
- System commands (top, ps, curl)
- Log files
```

---

## 📊 CROSS-SYSTEM DEPENDENCIES

### Paperclip → Others
```
Paperclip API
├── Returns agents (from /srv/ai/agents/)
├── Executes skills (from /srv/paperclip/skills/)
├── Orchestrates workflows (from /srv/ai/workflows/)
├── Routes to squads (from /srv/ai/squads/)
└── Logs to Git Hunter (via webhook)
```

### Claude Code → Others
```
Claude Code
├── Loads squads (from /srv/ai/squads/)
├── Invokes agents (from /srv/ai/agents/)
├── Executes skills (from /root/.claude/skills/)
├── Uses memory (from /root/.claude/projects/*/memory/)
└── Triggers hooks (in /root/.claude/hooks/)
```

### Git Hunter → Others
```
Git Hunter
├── Discovers repos (GitHub API)
├── Creates issues (Paperclip API @ localhost:3100)
├── Logs discoveries (to /srv/git-hunter/logs/)
└── Can trigger workflows (if enabled)
```

### Squads → Others
```
Squads (from /srv/ai/squads/)
├── Compose multiple agents (from /srv/ai/agents/)
├── Use shared skills (from /srv/ai/skills/)
├── Execute workflows (from /srv/ai/workflows/)
├── Import shared_libs (from /srv/ai/shared_libs/)
└── Run workers (from /srv/git-hunter/, /tmp/)
```

---

## 🔄 ENVIRONMENT VARIABLES TO TRACK

| Variable | Current Value | Used By | Must Update |
|----------|---------------|---------|------------|
| `AGENTS_PATH` | Undefined | Paperclip | Yes → `/vps-root/Agents/` |
| `SQUADS_PATH` | `/srv/ai/squads` | Claude, Paperclip | Yes → `/vps-root/squads/` |
| `SKILLS_PATH` | Multiple | Multiple | Yes → `/vps-root/skills/` |
| `WORKFLOWS_PATH` | Multiple | Squads | Yes → `/vps-root/workflows/` |
| `PROJECTS_PATH` | `/root/.claude/projects` | Claude | Yes → `/vps-root/projects/` |
| `WORKERS_PATH` | `/srv/git-hunter`, `/tmp/` | Daemons | Yes → `/vps-root/workers/` |
| `SHARED_LIBS_PATH` | Undefined | All | Yes → `/vps-root/shared_libs/` |
| `LOGS_PATH` | `/tmp/`, `/var/log/` | All | Yes → `/vps-root/logs/` |
| `CONFIG_PATH` | Multiple | All | Yes → `/vps-root/configs/` |
| `BACKUPS_PATH` | Undefined | Scripts | Yes → `/vps-root/backups/` |

---

## 📦 HARD DEPENDENCIES (Cannot Break)

### 1. Paperclip API Server
- **Must Stay**: `/srv/paperclip/server/`
- **Reason**: Only production instance
- **Migration**: Symlink or copy, update env vars only

### 2. Node Modules
- **Concern**: `/srv/paperclip/node_modules/` (large)
- **Migration**: Keep in place, don't copy
- **Symlinks**: Create symlinks from `/vps-root/Estrutura/paperclip/node_modules` → `/srv/paperclip/node_modules/`

### 3. Database Connections
- **Concern**: Paperclip database (SQLite/PostgreSQL)
- **Migration**: No changes needed, references via env vars
- **Validation**: Test DB connectivity after path updates

### 4. Relative Imports in Code
- **Concern**: Code like `require('../../../utils')`
- **Migration**: Either update all paths OR keep directory structure compatible
- **Recommendation**: Use approach of creating wrapper paths/symlinks to maintain compatibility

---

## 🚨 CIRCULAR DEPENDENCIES TO WATCH

### Claude Code ↔ Paperclip
```
Claude Code
  ├─→ calls Paperclip API (localhost:3100)
  ├─→ writes issues to Paperclip
  └─→ reads agents from /srv/ai/agents/

Paperclip
  ├─→ loads agents from /srv/ai/agents/
  ├─→ invokes Claude Code skills
  └─→ calls Claude API (via Claude Code integration)
```

**Mitigation**: Keep APIs isolated, use proper request queuing

### Squads ↔ Agents
```
Squads
  ├─→ load agents
  └─→ execute agents

Agents
  ├─→ can trigger squads
  └─→ can call other agents
```

**Mitigation**: Version agents, track execution traces

---

## 📝 IMPORT PATTERNS TO REPLACE

### Pattern 1: Relative Imports
```javascript
// BEFORE
const agents = require('../../../agents/ceo_agent');

// AFTER
const agents = require('/vps-root/Agents/ceo_agents');
```

### Pattern 2: Env Var References
```bash
# BEFORE
AGENTS_PATH=/srv/ai/agents
SKILLS_PATH=/srv/paperclip/skills

# AFTER
AGENTS_PATH=/vps-root/Agents
SKILLS_PATH=/vps-root/skills
```

### Pattern 3: Shell Scripts
```bash
# BEFORE
source /root/.claude/hooks/auto-login.sh

# AFTER
source /vps-root/Estrutura/claude_code/hooks/auto-login.sh
```

### Pattern 4: Python Imports
```python
# BEFORE
from agents.ceo import ceo_agent

# AFTER
import sys
sys.path.insert(0, '/vps-root/Agents')
from ceo_agents import ceo_agent
```

---

## ✅ VALIDATION CHECKLIST

After migration, verify:

- [ ] All env vars pointing to `/vps-root/`
- [ ] All `require()`/`import` statements resolve
- [ ] All symlinks active and correct
- [ ] Paperclip API accessible
- [ ] Claude Code hooks executing
- [ ] Git Hunter discovering repos
- [ ] Agents loading from new paths
- [ ] Skills callable from all systems
- [ ] Workflows triggering properly
- [ ] Logs going to `/vps-root/logs/`
- [ ] Backups running automatically
- [ ] Configs in `/vps-root/configs/`

---

## 🔐 ROLLBACK DEPENDENCIES

If rollback needed, must restore in order:

1. **System Daemons** (Orion, Dex, etc.) — stop first
2. **Squads** (stop orchestration)
3. **Agents** (stop processing)
4. **Database/State** (restore snapshots)
5. **Config Files** (restore original paths)
6. **Import Paths** (revert code changes)

**Time**: ~5-10 minutes if backup strategy solid
