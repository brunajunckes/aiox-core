---
paths: **/*
---

# MCP Server Usage Rules

## CRITICAL: Tool Selection Priority

ALWAYS prefer native Claude Code tools over MCP servers:

| Task | USE THIS | NOT THIS |
|------|----------|----------|
| Read files | `Read` tool | docker-gateway |
| Write files | `Write` / `Edit` tools | docker-gateway |
| Run commands | `Bash` tool | docker-gateway |
| Search files | `Glob` tool | docker-gateway |
| Search content | `Grep` tool | docker-gateway |
| List directories | `Bash(ls)` or `Glob` | docker-gateway |

## docker-gateway (Desktop Commander) Restrictions

### ONLY use docker-gateway when:
1. User explicitly says "use docker" or "use container"
2. User explicitly mentions "Desktop Commander"
3. Task specifically requires Docker container operations
4. User asks to run something inside a Docker container

### NEVER use docker-gateway for:
- Reading local files (use `Read` tool)
- Writing local files (use `Write` or `Edit` tools)
- Running shell commands (use `Bash` tool)
- Searching files (use `Glob` or `Grep` tools)
- Listing directories (use `Bash(ls)` or `Glob`)
- Running Node.js or Python scripts (use `Bash` tool)

## playwright MCP Restrictions

### ONLY use playwright when:
1. User explicitly asks for browser automation
2. User wants to take screenshots of web pages
3. User needs to interact with a website
4. Task requires web scraping or testing

### NEVER use playwright for:
- General file operations
- Running commands
- Anything not related to web browsers

## Rationale

- Native tools execute on the LOCAL system (Windows)
- docker-gateway executes inside Docker containers (Linux)
- Using docker-gateway for local operations causes path mismatches and failures
- Native tools are faster and more reliable for local operations
