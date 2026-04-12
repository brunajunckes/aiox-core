# AIOX Unified Access Map

## Directory Structure

```
/root/aiox-unified/
├── agents/                 (10 agents from .aiox-core)
├── agents-registry.json    (Agent index)
├── skills-registry.json    (400+ skills index)
├── squads-registry.json    (46 squads index)  
├── workflows-registry.json (100+ workflows index)
└── ACCESS-MAP.md          (This file)
```

## How to Access

### Agents (10 main)
```bash
# Activate agent
@dev
@qa
@architect
@pm
@po
@sm
@data-engineer
@ux
@analyst
@devops

# Or use command
/AIOX:agents:dev
```

### 300+ More Agents
Access via VPS backup:
```bash
rclone lsf "gdrive:vps/extracted_backup/squads/"
rclone cat "gdrive:vps/extracted_backup/agents/{agent-id}/{file}"
```

### Skills (400+)
```bash
# NLP, Automation, Scraping, ML, Integration, DevOps, etc.
# Access via registry or VPS:
rclone ls "gdrive:vps/extracted_backup/skills/"
```

### Squads (46)
```bash
# 7 Super-Squads + 39 specialized
# Access via VPS:
rclone ls "gdrive:vps/extracted_backup/squads/"
```

### Workflows (100+)
```bash
# Story development, deployment, monitoring, etc.
# Access via VPS or local .aiox-core/
```

## Memory Layer

Access via AIOX memory commands:
```bash
aiox memory set "key" "value"
aiox memory get "key"
aiox memory search "term"
```

## VPS Backup Access

For everything not in unified/:
```bash
rclone lsf "gdrive:vps/extracted_backup/"
rclone cat "gdrive:vps/extracted_backup/{path}"
rclone copy "gdrive:vps/extracted_backup/{path}" /root/local/
```
