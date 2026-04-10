# /vps-root — Complete Unified Structure

**Status**: Architecture Design
**Last Updated**: 2026-04-01
**Compliance**: Zero data loss, integrity preserved

---

```
/vps-root/
│
├── 📁 Estrutura/                           # Original systems (symlinked/copied)
│   │
│   ├── 📁 paperclip/                       # → symlink: /srv/paperclip
│   │   ├── packages/                       # microservices (adapter-*, shared)
│   │   ├── .agents/                        # paperclip-specific agents
│   │   ├── skills/                         # paperclip skills
│   │   ├── data/                           # runtime data, instances
│   │   ├── docker/                         # docker configs
│   │   ├── server/                         # API server (critical!)
│   │   ├── docker-compose.yml              # production config
│   │   └── node_modules/                   # dependencies (DON'T COPY)
│   │
│   ├── 📁 claude_code/                     # → symlink: /root/.claude
│   │   ├── hooks/                          # 26 automation hooks
│   │   ├── skills/                         # Claude Code skills
│   │   ├── projects/                       # active projects
│   │   ├── memory/                         # persistent memory
│   │   ├── settings.json                   # configuration
│   │   └── keybindings.json                # keyboard shortcuts
│   │
│   ├── 📁 openclaw/                        # Empty (future)
│   │   └── .gitkeep
│   │
│   └── 📁 aiox/                            # Empty (future)
│       └── .gitkeep
│
├── 🤖 Agents/                              # All active agents (organized)
│   │
│   ├── 📁 ceo_agents/                      # CEO orchestration agents
│   │   ├── agents-orchestrator.md          # main CEO coordinator
│   │   ├── claude_pm.md                    # product manager agent
│   │   ├── claude_po.md                    # product owner agent
│   │   ├── claude_sm.md                    # scrum master agent
│   │   ├── claude_tools-orchestrator.md
│   │   ├── claude_traffic-masters-chief.md
│   │   ├── academic-anthropologist.md
│   │   └── ...more ceo agents...
│   │
│   ├── 📁 paperclip_agents/                # Paperclip system agents
│   │   ├── agent-listener.md               # listens for jobs
│   │   ├── agent-executor.md               # executes jobs
│   │   └── ...paperclip-specific...
│   │
│   ├── 📁 analytics_agents/                # Analytics & monitoring
│   │   ├── paid-media-auditor.md
│   │   ├── testing-accessibility-auditor.md
│   │   ├── testing-test-results-analyzer.md
│   │   └── ...analytics agents...
│   │
│   ├── 📁 workspace_agents/                # Per-workspace agents
│   │   └── → symlink to /srv/paperclip/data/instances/*/agents/
│   │
│   └── 📁 claude_agents/                   # Claude Code integration agents
│       └── → copy from /root/.claude/projects/*/agents/
│
├── 🧠 skills/                              # Unified, categorized skills
│   │
│   ├── 📁 nlp/                             # Natural language processing
│   │   ├── sentiment-analysis.md
│   │   ├── text-summarization.md
│   │   └── ...nlp skills...
│   │
│   ├── 📁 automation/                      # Task automation
│   │   ├── paperclip-create-agent.md
│   │   ├── paperclip-run-agent.md
│   │   ├── auto-login.md
│   │   ├── skip-trust.md
│   │   └── ...automation skills...
│   │
│   ├── 📁 scraping/                        # Web scraping
│   │   ├── github-scraper.md
│   │   ├── trending-repos.md
│   │   └── ...scraping skills...
│   │
│   ├── 📁 ml_models/                       # Machine learning
│   │   ├── classifier.md
│   │   ├── predictor.md
│   │   └── ...ml skills...
│   │
│   ├── 📁 shared/                          # Shared across all systems
│   │   ├── memory-manager.md
│   │   ├── logger.md
│   │   ├── error-handler.md
│   │   └── ...shared utilities...
│   │
│   └── skills_index.json                   # Registry of all skills
│
├── ⚙️ workflows/                           # Unified workflow management
│   │
│   ├── 📁 project_workflows/               # Per-project workflows
│   │   │
│   │   ├── 📁 paperclip/
│   │   │   ├── deploy.yaml
│   │   │   ├── ci-cd.yaml
│   │   │   ├── monitoring.yaml
│   │   │   └── ...paperclip workflows...
│   │   │
│   │   ├── 📁 claude_code/
│   │   │   ├── hook-execution.yaml
│   │   │   ├── agent-routing.yaml
│   │   │   └── ...claude workflows...
│   │   │
│   │   ├── 📁 git_hunter/
│   │   │   ├── repo-discovery.yaml
│   │   │   ├── issue-creation.yaml
│   │   │   └── analysis.yaml
│   │   │
│   │   └── 📁 others/
│   │       └── ...project workflows...
│   │
│   └── 📁 cross_project/                   # Multi-agent, multi-system
│       ├── squad-orchestration.yaml        # How squads work together
│       ├── agent-routing.yaml              # Agent discovery & routing
│       ├── resource-allocation.yaml        # CPU/memory management
│       ├── backup-execution.yaml           # Backup automation
│       ├── deployment-pipeline.yaml        # Deploy across systems
│       └── incident-response.yaml          # Coordinated error handling
│
├── 📁 projects/                            # All active projects (unified)
│   │
│   ├── 📁 paperclip/                       # Paperclip project
│   │   ├── 📁 stories/
│   │   │   ├── story-001-dashboard.md      # Story: rebuild dashboard
│   │   │   ├── story-002-typescript.md     # Story: fix TS errors
│   │   │   ├── story-003-cpu-queue.md      # Story: CPU-aware queue
│   │   │   └── ...stories...
│   │   ├── 📁 docs/
│   │   │   ├── README.md
│   │   │   ├── ARCHITECTURE.md
│   │   │   ├── API.md
│   │   │   └── ...documentation...
│   │   ├── 📁 logs/
│   │   │   ├── paperclip-2026-04-01.log
│   │   │   ├── build-errors.log
│   │   │   └── ...logs...
│   │   ├── 📁 checklists/
│   │   │   ├── qa-checklist.md
│   │   │   ├── deployment-checklist.md
│   │   │   └── ...checklists...
│   │   └── 📁 data/
│   │       ├── metrics.json
│   │       ├── performance.json
│   │       └── ...project data...
│   │
│   ├── 📁 claude_code/                     # Claude Code project
│   │   ├── 📁 stories/
│   │   │   ├── story-001-hooks.md
│   │   │   ├── story-002-squads.md
│   │   │   └── ...stories...
│   │   ├── 📁 docs/
│   │   ├── 📁 logs/
│   │   ├── 📁 checklists/
│   │   └── 📁 data/
│   │
│   ├── 📁 hubme_ai/                        # HubMe AI project
│   │   ├── 📁 stories/
│   │   │   ├── story-001-leads.md
│   │   │   ├── story-002-chatbot.md
│   │   │   ├── story-003-emails.md
│   │   │   └── ...stories...
│   │   ├── 📁 docs/
│   │   │   ├── README.md
│   │   │   ├── ROADMAP.md
│   │   │   └── ...docs...
│   │   ├── 📁 logs/
│   │   ├── 📁 checklists/
│   │   └── 📁 data/
│   │       ├── leads.csv
│   │       ├── metrics.json
│   │       └── ...data...
│   │
│   ├── 📁 git_hunter/                      # Git Hunter project
│   │   ├── 📁 stories/
│   │   │   ├── story-001-discovery.md
│   │   │   ├── story-002-analysis.md
│   │   │   └── ...stories...
│   │   ├── 📁 docs/
│   │   ├── 📁 logs/
│   │   ├── 📁 checklists/
│   │   └── 📁 data/
│   │
│   └── 📁 others/                          # Future projects
│       └── ...
│
├── 👥 squads/                              # All squads (46 total)
│   │
│   ├── 📁 super-architect/                 # → symlink: /srv/ai/squads/super-architect/
│   │   ├── README.md                       # Squad definition
│   │   ├── agents/
│   │   │   ├── chief-architect.md
│   │   │   ├── system-designer.md
│   │   │   ├── integration-specialist.md
│   │   │   └── performance-analyst.md
│   │   └── workflows/
│   │
│   ├── 📁 super-execution/                 # → symlink: /srv/ai/squads/super-execution/
│   │   ├── README.md
│   │   ├── agents/
│   │   │   ├── tech-lead.md
│   │   │   ├── architect.md
│   │   │   ├── devops-engineer.md
│   │   │   ├── qa-master.md
│   │   │   ├── claude-code-expert.md
│   │   │   └── swarm-orchestrator.md
│   │   └── workflows/
│   │
│   ├── 📁 super-data/                      # → symlink: /srv/ai/squads/super-data/
│   │
│   ├── 📁 super-growth/
│   ├── 📁 super-strategy/
│   ├── 📁 super-cognitive/
│   ├── 📁 technical-architecture/
│   ├── 📁 god-mode-squad/
│   │
│   └── ... (40 more squads, all symlinked)
│
├── 🔨 workers/                             # Active workers (job processors)
│   │
│   ├── 📁 paperclip_workers/               # Paperclip workers
│   │   ├── agent-listener.py
│   │   ├── heartbeat-monitor.py
│   │   └── ...paperclip workers...
│   │
│   ├── 📁 claude_workers/                  # Claude Code workers
│   │   ├── hook-executor.sh
│   │   ├── skill-router.sh
│   │   └── ...claude workers...
│   │
│   ├── 📁 git_hunters/                     # Git Hunter workers
│   │   ├── watcher.py                      # → symlink or copy from /srv/git-hunter/watcher.py
│   │   ├── discovery-agent.py
│   │   └── issue-creator.py
│   │
│   ├── 📁 system_daemons/                  # System-level daemons
│   │   ├── orion-cpu-monitor.sh            # → copy from /tmp/orion-cpu-monitor.sh
│   │   ├── dex-daemon.sh                   # → copy from /tmp/dex-daemon.sh
│   │   ├── cpu-aware-queue.sh              # → copy from /tmp/cpu-aware-queue.sh
│   │   ├── link-recovery.sh                # → copy from /tmp/link-recovery.sh
│   │   └── health-check.sh                 # New: centralized health
│   │
│   └── 📁 backup_workers/                  # Backup automation
│       ├── backup-executor.sh
│       ├── retention-policy.sh
│       └── restore-validator.sh
│
├── 💾 backups/                             # Centralized backups
│   │
│   ├── 📁 Estrutura/                       # Backups of original systems
│   │   ├── paperclip-2026-04-01-100000.tar.gz
│   │   ├── claude_code-2026-04-01-100001.tar.gz
│   │   └── ...daily backups...
│   │
│   ├── 📁 skills/                          # Skill backups
│   │   └── skills-2026-04-01-100002.tar.gz
│   │
│   ├── 📁 workflows/                       # Workflow backups
│   │   └── workflows-2026-04-01-100003.tar.gz
│   │
│   ├── 📁 projects/                        # Project backups
│   │   └── projects-2026-04-01-100004.tar.gz
│   │
│   ├── 📁 complete/                        # Full system backups
│   │   └── vps-complete-2026-04-01-100000.tar.gz
│   │
│   └── .backup_manifest.json               # Backup registry & metadata
│       {
│         "backups": [
│           {
│             "id": "100000",
│             "timestamp": "2026-04-01T18:35:00Z",
│             "type": "full",
│             "size": "12.5GB",
│             "status": "verified",
│             "location": "/vps-root/backups/complete/vps-complete-2026-04-01-100000.tar.gz"
│           }
│         ]
│       }
│
├── 📚 shared_libs/                         # Reusable code & utilities
│   │
│   ├── 📁 utils/                           # Common utilities
│   │   ├── path-resolver.js                # Resolve paths across systems
│   │   ├── env-validator.sh                # Validate env vars
│   │   ├── error-handler.py                # Unified error handling
│   │   ├── logger.js                       # Centralized logging
│   │   └── ...shared utils...
│   │
│   ├── 📁 connectors/                      # API clients & connectors
│   │   ├── paperclip-client.js             # Paperclip API wrapper
│   │   ├── github-api-client.js            # GitHub API wrapper
│   │   ├── slack-connector.py              # Slack integration
│   │   ├── stripe-connector.js             # Payment integration
│   │   └── ...connectors...
│   │
│   ├── 📁 database/                        # DB utilities
│   │   ├── sqlite-wrapper.py
│   │   ├── migration-runner.sh
│   │   └── ...db tools...
│   │
│   ├── 📁 logging/                         # Logging infrastructure
│   │   ├── logger-config.json
│   │   ├── log-aggregator.py
│   │   └── log-rotator.sh
│   │
│   ├── 📁 auth/                            # Authentication helpers
│   │   ├── jwt-handler.js
│   │   ├── oauth-client.js
│   │   └── session-manager.py
│   │
│   └── shared_libs_index.json              # Registry of all libraries
│
├── 📋 logs/                                # Centralized VPS logs
│   │
│   ├── vps-general.log                     # General VPS activity
│   ├── errors.log                          # Error aggregation
│   ├── warnings.log                        # Warnings aggregation
│   ├── access.log                          # API access logs
│   │
│   ├── 📁 paperclip/                       # Paperclip logs
│   │   ├── paperclip-2026-04-01.log
│   │   ├── server.log
│   │   ├── build.log
│   │   └── ...logs...
│   │
│   ├── 📁 claude_code/                     # Claude Code logs
│   │   ├── hooks.log
│   │   ├── skills.log
│   │   └── ...logs...
│   │
│   ├── 📁 agents/                          # Agent execution logs
│   │   ├── ceo-agent-2026-04-01.log
│   │   ├── analytics-agent-2026-04-01.log
│   │   └── ...agent logs...
│   │
│   ├── 📁 workers/                         # Worker logs
│   │   ├── orion.log                       # CPU monitor
│   │   ├── dex.log                         # Process killer
│   │   ├── queue.log                       # CPU queue
│   │   ├── link-recovery.log
│   │   └── ...worker logs...
│   │
│   └── 📁 backups/                         # Backup logs
│       ├── backup-execution.log
│       ├── restore-validation.log
│       └── retention-policy.log
│
├── ⚙️ configs/                             # Unified configuration
│   │
│   ├── 📁 paperclip_config/
│   │   ├── docker-compose.yml              # Unified config
│   │   ├── environment.env                 # Env vars
│   │   ├── database.config.json
│   │   └── logging.config.json
│   │
│   ├── 📁 claude_config/
│   │   ├── settings.json                   # Claude Code settings
│   │   ├── keybindings.json
│   │   ├── hooks.config.json
│   │   └── ...claude configs...
│   │
│   ├── 📁 aiox_config/
│   │   └── (empty, ready for future)
│   │
│   ├── 📁 openclaw_config/
│   │   └── (empty, ready for future)
│   │
│   └── vps.env                             # Central VPS env file
│       AGENTS_PATH=/vps-root/Agents
│       SKILLS_PATH=/vps-root/skills
│       WORKFLOWS_PATH=/vps-root/workflows
│       PROJECTS_PATH=/vps-root/projects
│       SQUADS_PATH=/vps-root/squads
│       WORKERS_PATH=/vps-root/workers
│       SHARED_LIBS_PATH=/vps-root/shared_libs
│       LOGS_PATH=/vps-root/logs
│       BACKUPS_PATH=/vps-root/backups
│       CONFIG_PATH=/vps-root/configs
│       PAPERCLIP_API=http://localhost:3100
│       GITHUB_API=https://api.github.com
│
└── 📦 tmp/                                 # Temporary files & cache
    │
    ├── 📁 paperclip/                       # Paperclip cache
    │   ├── build-cache/
    │   ├── session-cache/
    │   └── ...caches...
    │
    ├── 📁 workers/                         # Worker temp files
    │   ├── queue/                          # Job queue
    │   ├── locks/                          # Process locks
    │   └── ...worker temps...
    │
    └── README.md                           # Temp directory guidelines
        (NOTE: /tmp/ also available for OS-level temp)
```

---

## 📊 TOTAL STRUCTURE SUMMARY

```
/vps-root/
├── Estrutura/          (Symlinks to originals: paperclip, claude_code)
├── Agents/             (Organized agents: 46+ total)
├── skills/             (400+ skills, categorized)
├── workflows/          (100+ workflows, indexed)
├── projects/           (5+ projects with full structure)
├── squads/             (46 squads, all operational)
├── workers/            (10+ workers running)
├── backups/            (Automated, incremental)
├── shared_libs/        (Reusable code, centralized)
├── logs/               (Aggregated, rotated)
├── configs/            (Unified configuration)
└── tmp/                (Temporary files & cache)
```

---

## 📈 MIGRATION CHECKLIST

- [ ] Create all main folders
- [ ] Create all subfolders
- [ ] Copy/symlink Estrutura files (paperclip, claude_code)
- [ ] Migrate agents (preserve structure)
- [ ] Migrate skills (categorize by type)
- [ ] Migrate workflows (organize by scope)
- [ ] Migrate projects (copy with full structure)
- [ ] Symlink/copy squads (46 squads)
- [ ] Migrate workers (daemons + custom)
- [ ] Set up backup automation
- [ ] Create shared_libs (extract from systems)
- [ ] Configure centralized logging
- [ ] Set up configs (unify env vars)
- [ ] Configure tmp directory
- [ ] Update all import paths
- [ ] Test all systems
- [ ] Validate backups
- [ ] Document complete mapping
- [ ] Run rollback test
- [ ] Go live with monitoring

---

**Status**: ✅ **READY FOR IMPLEMENTATION**
