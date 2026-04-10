# VPS Reorganization — Complete Migration Plan

**Date**: 2026-04-01
**Status**: Planning Phase
**Risk Level**: MEDIUM (complex, multi-system impact)
**Estimated Time**: 2-4 hours
**Rollback Time**: 30 minutes

---

## 📋 PHASE 1: DISCOVERY & DEPENDENCY MAPPING

### 1.1 System Inventory
- [x] /srv/ai → agents, squads, skills, workflows (~500MB)
- [x] /srv/paperclip → monorepo, skills, agents (~4.2GB)
- [x] /root/.claude → hooks, skills, projects, memory
- [x] /srv/git-hunter → autonomous watcher (small)
- [x] Dependencies & imports in all systems

### 1.2 Key Components to Migrate

**Agents** (currently scattered):
```
/srv/ai/agents/ceo_agent/
/srv/ai/agents/analytics_agent/
/srv/paperclip/.agents/
/srv/paperclip/data/instances/*/workspaces/*/agents/
/root/.claude/projects/*/agents/
```

**Skills**:
```
/srv/ai/skills/
/srv/paperclip/skills/
/root/.claude/skills/
```

**Workflows**:
```
/srv/ai/workflows/
/srv/paperclip/packages/ (multi-service workflows)
```

**Squads**:
```
/srv/ai/squads/ (super-architect, super-execution, etc.)
```

**Projects**:
```
/srv/paperclip/projects/ (if any)
/root/.claude/projects/
/srv/ai/_archive/projects/
```

**Workers**:
```
Git Hunter (/srv/git-hunter/)
Dex Daemon (/tmp/dex-daemon.sh)
Orion Monitor (/tmp/orion-cpu-monitor.sh)
CPU Queue (/tmp/cpu-aware-queue.sh)
Link Recovery (/tmp/link-recovery.sh)
```

### 1.3 Dependency Graph

**Critical Dependencies**:
1. Paperclip imports agents & skills from multiple locations
2. Claude Code hooks reference /root/.claude/* paths
3. Git Hunter writes issues to Paperclip API
4. Agents import shared_libs, connectors, utils

**Import Patterns to Track**:
- `from @paperclipai/...` → packages/
- `from ../agents/` → relative imports
- `import shared_libs` → needs centralization
- Environment vars pointing to fixed paths

---

## 🚀 PHASE 2: STRUCTURE CREATION (Parallel Safe)

### 2.1 Create Root & Main Folders

```bash
mkdir -p /vps-root/{Estrutura,Agents,skills,workflows,projects,squads,workers,backups,shared_libs,logs,configs,tmp}
```

### 2.2 Create Subfolders

**Estrutura/** (keeps originals intact)
```
Estrutura/
  paperclip/      # ln -s /srv/paperclip → /vps-root/Estrutura/paperclip
  claude_code/    # ln -s /root/.claude → /vps-root/Estrutura/claude_code
  openclaw/       # empty (future)
  aiox/           # empty (future)
```

**Agents/** (organized by system)
```
Agents/
  paperclip_agents/       # /srv/paperclip/.agents/
  ceo_agents/             # /srv/ai/agents/ceo_agent/
  analytics_agents/       # /srv/ai/agents/analytics_agent/
  workspace_agents/       # /srv/paperclip/data/instances/*/agents/
  claude_agents/          # /root/.claude/projects/*/agents/
```

**skills/** (by category)
```
skills/
  nlp/                    # language processing
  automation/             # task automation
  scraping/               # web scraping
  ml_models/              # machine learning
  shared/                 # multi-system skills
```

**workflows/** (by scope)
```
workflows/
  project_workflows/      # per-project workflows
  cross_project/          # multi-agent workflows (Git Hunter, orchestration)
```

**projects/** (all projects)
```
projects/
  paperclip/
    stories/
    docs/
    logs/
    checklists/
    data/
  claude_code/
    stories/
    docs/
    logs/
    checklists/
    data/
  hubme_ai/
    stories/
    docs/
    logs/
    checklists/
    data/
  git_hunter/
    stories/
    docs/
    logs/
    checklists/
    data/
```

**squads/** (team ownership)
```
squads/
  super-architect/        # → /srv/ai/squads/super-architect/
  super-execution/        # → /srv/ai/squads/super-execution/
  super-data/
  super-growth/
  ...
```

**workers/** (by system)
```
workers/
  paperclip_workers/
  claude_workers/
  git_hunters/            # watcher.py, discovery agents
  system_daemons/         # Orion, Dex, Queue, Link Recovery
```

**backups/** (automated)
```
backups/
  Estrutura/              # daily backup
  skills/                 # daily backup
  workflows/              # daily backup
  projects/               # daily backup
  .backup_manifest.json   # tracking
```

**configs/** (unified)
```
configs/
  paperclip_config/       # docker-compose, env vars
  claude_config/          # hooks, settings.json, keybindings
  aiox_config/
  openclaw_config/
  vps.env                 # centralized env vars
```

**shared_libs/** (reusable)
```
shared_libs/
  utils/                  # common functions
  connectors/             # API clients (Paperclip, Slack, GitHub)
  database/               # DB utilities
  logging/                # centralized logging
  auth/                   # authentication helpers
```

---

## 📥 PHASE 3: DATA MIGRATION (Sequential, with Validation)

### 3.1 Backup Everything First

```bash
# Before ANY migration:
rsync -av /srv/ai /backups/srv-ai-backup-$(date +%s)/
rsync -av /srv/paperclip /backups/srv-paperclip-backup-$(date +%s)/
rsync -av /root/.claude /backups/root-claude-backup-$(date +%s)/
tar czf /backups/complete-vps-$(date +%s).tar.gz /srv/ai /srv/paperclip /root/.claude
```

### 3.2 Create Symlinks for Safety (non-destructive)

Instead of moving files, use symlinks initially:

```bash
# Estrutura
ln -s /srv/paperclip /vps-root/Estrutura/paperclip
ln -s /root/.claude /vps-root/Estrutura/claude_code

# Agents (copy important ones, symlink others)
cp -r /srv/ai/agents/ceo_agent /vps-root/Agents/ceo_agents/
cp -r /srv/ai/agents/analytics_agent /vps-root/Agents/analytics_agents/

# Squads
ln -s /srv/ai/squads /vps-root/squads

# Skills
cp -r /srv/ai/skills/* /vps-root/skills/shared/
cp -r /srv/paperclip/skills/* /vps-root/skills/automation/
```

### 3.3 Update Import Paths (with validation)

For each system, update imports:

**Paperclip**:
- Change `from '../agents/...'` → `from '/vps-root/Agents/...'`
- Update env vars: `AGENTS_PATH=/vps-root/Agents`

**Claude Code**:
- Update .claude/settings.json for new paths
- Update hooks to reference /vps-root/

**Scripts**:
- Update `#!` shebangs and relative paths
- Test each script after update

### 3.4 Validation Checklist

For each component migrated:
- [ ] Files copied intact (checksums match)
- [ ] Symlinks working
- [ ] Imports resolve correctly
- [ ] Service starts without errors
- [ ] Logs show no path-not-found errors
- [ ] Rollback command documented

---

## 🔄 PHASE 4: ACTIVATION & MONITORING

### 4.1 Enable Services Incrementally

1. Start with read-only components (configs, shared_libs)
2. Migrate squads & agents
3. Migrate workflows
4. Migrate projects
5. Test full system

### 4.2 Monitoring

Watch logs for:
```bash
tail -f /vps-root/logs/* | grep -i error
grep "path not found" /vps-root/logs/*
grep "import failed" /vps-root/logs/*
```

### 4.3 Rollback Procedure

If anything breaks:
```bash
# Stop all services
systemctl stop paperclip claude-code git-hunter

# Restore from backup
rsync -av /backups/srv-ai-backup-*/srv/ai /srv/ai
rsync -av /backups/srv-paperclip-backup-*/srv/paperclip /srv/paperclip
rsync -av /backups/root-claude-backup-*/.claude /root/.claude

# Restart
systemctl start paperclip claude-code git-hunter
```

---

## 📊 PERMISSIONS & OWNERSHIP

Set appropriate permissions:

```bash
# Read-only for shared components
chmod -R 555 /vps-root/shared_libs/
chmod -R 555 /vps-root/backups/

# Read-write for projects
chmod -R 755 /vps-root/projects/
chmod -R 755 /vps-root/logs/

# Restricted for configs
chmod -R 700 /vps-root/configs/
chown root:root /vps-root/configs/

# Executable for workers
chmod -x /vps-root/workers/**/*.sh
chmod +x /vps-root/workers/**/*.py
```

---

## 📝 SUCCESS CRITERIA

✅ All components at /vps-root
✅ All imports resolve
✅ All services start without errors
✅ Zero data loss
✅ Rollback tested
✅ Monitoring active
✅ Documentation complete

---

## 📅 TIMELINE

- **Phase 1 (Discovery)**: 15 minutes
- **Phase 2 (Structure)**: 10 minutes
- **Phase 3 (Migration)**: 60-120 minutes
- **Phase 4 (Activation)**: 30 minutes
- **Total**: ~2-3 hours

---

## ⚠️ RISKS & MITIGATION

| Risk | Mitigation |
|------|-----------|
| Import paths break | Automated grep + replace with testing |
| Data loss | 3+ backups before starting |
| Service downtime | Incremental activation, symlinks first |
| Dependency conflicts | Dependency graph audit before migration |
| Rollback failure | Tested procedure, backup retention |

