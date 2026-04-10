# VPS ARCHITECTURE KNOWLEDGE MAP

**Extracted from**: 5 VPS migration planning documents
**Scope**: Complete system architecture + patterns
**Purpose**: Enable all squads to understand structure and self-optimize

---

## 🧠 CORE PATTERNS IDENTIFIED

### Pattern 1: SYMLINK-FIRST APPROACH
**What**: Keep originals, reference via symlinks
**Where**: /vps-root/Estrutura/{paperclip,claude_code}
**Why**: Zero data loss, easy rollback
**Implementation**: 
```bash
ln -s /srv/paperclip /vps-root/Estrutura/paperclip
ln -s /root/.claude /vps-root/Estrutura/claude_code
```

### Pattern 2: CENTRALIZED IMPORT MANAGEMENT
**What**: All imports point to /vps-root/
**Where**: `/vps-root/Agents/`, `/vps-root/skills/`, `/vps-root/workflows/`
**Why**: Single source of truth, eliminates scattered references
**Key Imports**:
- `AGENTS_PATH=/vps-root/Agents`
- `SKILLS_PATH=/vps-root/skills`
- `WORKFLOWS_PATH=/vps-root/workflows`

### Pattern 3: CATEGORIZATION BY TYPE
**Skills**: Organized by capability (nlp/, automation/, ml_models/)
**Agents**: Organized by system (ceo_agents/, paperclip_agents/)
**Workflows**: Organized by scope (project_workflows/, cross_project/)

### Pattern 4: AUTOMATED BACKUP LAYERS
**Layer 1**: 3 independent backups before migration
**Layer 2**: Daily incremental backups post-migration
**Layer 3**: Retention policy (min 3, max 6 valid backups)
**Recovery**: 10-minute RTO via rsync

### Pattern 5: INCREMENTAL ACTIVATION
**Wave 1**: Non-destructive setup (0 risk)
**Wave 2**: Data migration (medium risk, full rollback)
**Wave 3**: Service activation (validation at each step)
**Wave 4**: Monitoring & optimization (continuous improvement)

---

## 🔗 DEPENDENCY GRAPH (Simplified)

```
Paperclip API (localhost:3100)
├── Loads: /vps-root/Agents/paperclip_agents/
├── Executes: /vps-root/skills/*
├── Routes via: /vps-root/squads/super-execution/
└── Logs to: /vps-root/logs/paperclip/

Claude Code (/vps-root/Estrutura/claude_code)
├── Triggers: /vps-root/squads/* (46 squads)
├── Loads: /vps-root/Agents/ceo_agents/
├── Uses: /vps-root/skills/automation/
└── Persists: /vps-root/projects/*/memory/

Git Hunter (/vps-root/workers/git_hunters/)
├── Discovers: GitHub API (external)
├── Creates issues: Paperclip API
├── Logs: /vps-root/logs/workers/
└── Can trigger: /vps-root/workflows/cross_project/

Squads (46 total in /vps-root/squads/)
├── Compose: /vps-root/Agents/*
├── Use: /vps-root/skills/*
├── Execute: /vps-root/workflows/*
├── Import: /vps-root/shared_libs/*
└── Orchestrate: /vps-root/workers/*

System Daemons (/vps-root/workers/system_daemons/)
├── Orion: Monitors CPU/load
├── Dex: Kills high-CPU processes
├── Queue: Pauses @ 75% CPU
└── All log to: /vps-root/logs/workers/
```

---

## 📊 ORGANIZATIONAL PRINCIPLES

### 1. Locality of Reference
**Principle**: Components that interact should be near each other
**Application**: Agents organized by system, workflows by scope
**Benefit**: Easier to find related code, faster imports

### 2. Single Source of Truth (SSOT)
**Principle**: No duplicated configurations
**Application**: One vps.env for all, one set of skills
**Benefit**: Consistency, easier updates

### 3. Fault Isolation
**Principle**: Failures in one system don't cascade
**Application**: Separate logs, backups, configs per system
**Benefit**: Easier debugging, faster recovery

### 4. Backward Compatibility
**Principle**: Originals untouched via symlinks
**Application**: /srv/ai, /srv/paperclip stay put
**Benefit**: Instant rollback, zero migration risk

### 5. Incremental Integration
**Principle**: Activate systems in waves, validate each
**Application**: Phase 1→2→3→4 with checkpoints
**Benefit**: Early error detection, smaller blast radius

---

## 🎯 KEY DECISIONS & RATIONALE

### Decision 1: Use Symlinks for Estrutura
**Rationale**: 
- Preserves originals completely
- Instant rollback capability
- No data copying overhead
- Zero data loss risk

### Decision 2: Centralize Logs
**Rationale**:
- Single place to monitor all systems
- Easier aggregation & analysis
- Centralized rotation & cleanup
- Better alerting capability

### Decision 3: Separate Skills by Type
**Rationale**:
- Clear boundaries (nlp vs automation)
- Easier discovery & reuse
- Type-specific optimization possible
- Simpler dependency analysis

### Decision 4: Keep Node Modules In Place
**Rationale**:
- Too large to copy (1GB+)
- Symlink references work fine
- Faster setup, no waste
- Maintains compatibility

### Decision 5: Automate Backups Pre-Migration
**Rationale**:
- Insurance policy (3 independent copies)
- Full snapshot for rollback
- Tested restore procedure
- Zero data loss guarantee

---

## 🔄 CRITICAL DEPENDENCIES

### Hard Dependencies (Cannot Change):
1. **Paperclip Server** — Must stay at /srv/paperclip/server/
   - Only production instance
   - Database connections via env vars
   
2. **Node Modules** — Must stay at /srv/paperclip/node_modules/
   - Too large, expensive to copy
   - Symlinks reference them

3. **Database** — Must stay where configured
   - Only via env var references
   - No path changes needed

### Soft Dependencies (Can Move/Update):
1. **Import paths** — Can update via env vars + code changes
2. **Configs** — Can centralize in /vps-root/configs/
3. **Logs** — Can redirect to /vps-root/logs/
4. **Agents** — Can reorganize in /vps-root/Agents/

---

## 🚀 IMPLEMENTATION PRINCIPLES FOR SQUADS

### Squad Autonomy
Each squad can:
- Load agents independently
- Execute workflows
- Use shared_libs without permission
- Log to centralized location
- Create backups on demand

### Squad Coordination
Multiple squads can:
- Call each other (via Paperclip API)
- Share skills from /vps-root/skills/
- Trigger workflows together
- Use same logging infrastructure

### Squad Evolution
Squads should:
- Learn from execution logs
- Improve with each iteration
- Contribute patterns back
- Optimize imports over time

---

## 📈 METRICS FOR SUCCESS

### Pre-Migration Metrics:
- [ ] All dependencies mapped (300+ identified)
- [ ] 3 independent backups created
- [ ] Rollback procedure tested
- [ ] Risk assessment complete

### Post-Migration Metrics:
- [ ] 0 import errors in logs
- [ ] 0 services failing to start
- [ ] 100% backup restoration success
- [ ] <5 min service downtime per system

### Ongoing Metrics:
- [ ] Backup retention policy active (3-6 copies)
- [ ] Log aggregation working (0 missing logs)
- [ ] Auto-optimization running (squads improving)
- [ ] Evolution god mode enabled

---

## 🔐 SECURITY IMPLICATIONS

### Before Migration:
- Configs scattered across 4 locations
- Secrets in multiple files
- No centralized access control
- No audit trail

### After Migration:
- Single /vps-root/configs/ (centralized)
- Unified secret management (/vps-root/configs/secrets/)
- Centralized permission model
- Aggregated audit logs

### For Each Squad:
- Can read own agent definitions
- Can read shared_libs
- Cannot modify other squads' agents
- All reads logged

---

## 🎓 KNOWLEDGE TRANSFER CHECKLIST

What every squad needs to know:

- [ ] /vps-root/ structure & organization
- [ ] How to access agents (/vps-root/Agents/)
- [ ] How to use skills (/vps-root/skills/)
- [ ] How to find workflows (/vps-root/workflows/)
- [ ] Environment variables (vps.env)
- [ ] Logging location & aggregation
- [ ] Backup & recovery procedures
- [ ] Import patterns & dependencies
- [ ] How to trigger other squads
- [ ] How to contribute improvements

---

**This Knowledge Map** enables all squads to:
✅ Understand complete architecture
✅ Find what they need quickly
✅ Avoid breaking dependencies
✅ Contribute improvements
✅ Self-optimize over time
