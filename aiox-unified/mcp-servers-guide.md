# MCP Servers Guide — AIOX Ecosystem

**Consolidated:** 2026-04-12  
**Total MCPs:** 14 documented

---

## Direct in Claude Code (Global ~/.claude.json)

### 1. **Playwright**
- **Purpose:** Browser automation, screenshots, web testing
- **Type:** Web browser control
- **Status:** Active
- **Commands:** Navigate, screenshot, interact with DOM
- **Use Cases:** UI testing, web scraping, form filling

### 2. **Desktop Commander**
- **Purpose:** Docker container operations (docker-gateway)
- **Type:** Container management
- **Status:** Active
- **Access:** Via docker-gateway MCP
- **Dependencies:** Docker daemon running

---

## Inside Docker Desktop (via docker-gateway)

### 3. **EXA**
- **Purpose:** Web search, research, company/competitor analysis
- **Type:** Search engine
- **Status:** Active
- **Configuration:** API key in ~/.docker/mcp/config.yaml
- **Use Cases:** 
  - Real-time web research
  - Competitor analysis
  - Trend monitoring
  - Current information lookup

### 4. **Context7**
- **Purpose:** Library documentation lookup
- **Type:** Documentation index
- **Status:** Active
- **Access:** resolve-library-id() → get-library-docs()
- **Use Cases:**
  - React/Vue/Angular docs
  - Framework API reference
  - Library version comparison
  - Up-to-date documentation

### 5. **Apify**
- **Purpose:** Web scraping, Actors, social media data extraction
- **Type:** Web automation & scraping
- **Status:** Active (with auth fixes)
- **Tools:** 7 specialized tools
  - apify-slash-rag-web-browser
  - search-actors
  - call-actor
  - fetch-actor-details
  - get-actor-output
  - search-apify-docs
  - fetch-apify-docs
- **Use Cases:**
  - Social media data extraction
  - E-commerce scraping
  - Automated data collection
  - RAG-enabled web browsing

### 6. **nogic**
- **Purpose:** Code intelligence (dependency tracking, usage patterns)
- **Type:** Code analysis
- **Status:** Essential, always loaded
- **Use Cases:**
  - Find all imports of a module
  - Track function usages
  - Analyze dependency chains
  - Circular dependency detection

### 7. **code-graph**
- **Purpose:** Dependency analysis and visualization
- **Type:** Graph analysis
- **Status:** Essential, always loaded
- **Use Cases:**
  - Generate dependency graphs
  - Detect circular dependencies
  - Visualize module relationships
  - Depth-based analysis

---

## AutoFlow-Integrated MCPs

### 8-14. **AutoFlow Special MCPs** (7 additional)

These are specialized MCPs for AutoFlow workflows:

| # | Name | Purpose | Status |
|---|------|---------|--------|
| 8 | AutoFlow Data Bridge | Connect to external data sources | Active |
| 9 | AutoFlow Notification Hub | Send alerts and notifications | Active |
| 10 | AutoFlow Analysis Engine | Run ML/analytics workflows | Active |
| 11 | AutoFlow Storage Bridge | Cloud storage integration | Active |
| 12 | AutoFlow Calendar | Schedule and calendar integration | Active |
| 13 | AutoFlow Email Gateway | Email sending and parsing | Active |
| 14 | AutoFlow Social Media | Social media API integration | Active |

---

## 🔧 MCP Configuration Locations

**Global Configuration:**
```
~/.claude.json                    # Playwright, Desktop Commander
~/.docker/mcp/config.yaml         # EXA, Context7, Apify (Docker MCPs)
~/.docker/mcp/catalogs/           # MCP catalog files
```

**Project Configuration:**
```
.claude/settings.json             # Local MCP overrides
.aiox-core/data/tool-registry.yaml # Tool registry
```

---

## ⚙️ Known Issues & Workarounds

### Docker MCP Secrets Bug (Dec 2025)

**Issue:** Secrets not passed to containers properly

**Symptom:** MCP shows "(N prompts)" instead of "(N tools)"

**Workaround:** Edit `~/.docker/mcp/catalogs/docker-mcp.yaml` directly with hardcoded values:
```yaml
apify:
  env:
    - name: APIFY_API_TOKEN
      value: 'actual-token-value'
```

**Working MCPs:** EXA (key in `config.yaml` instead of secrets store)

---

## 🚀 Quick Access Guide

### List Available MCPs
```bash
# Check ~/.claude.json
cat ~/.claude.json | grep '"mcpServers"'

# List Docker MCPs
docker mcp tools ls
```

### Add New MCP
```bash
# Via @devops agent
@devops *add-mcp {mcp-name}

# Manual: edit ~/.docker/mcp/catalogs/docker-mcp.yaml
```

### Test MCP Health
```bash
# Test Playwright (local)
npx playwright --version

# Test Docker MCP
curl http://localhost:8080/health

# Test EXA
curl -X POST http://localhost:8080/mcp/exa/search \
  -H "Authorization: Bearer $EXA_API_KEY" \
  -d '{"query":"search term"}'
```

---

## 📋 MCP Governance

**Authority:** @devops (Gage) has EXCLUSIVE authority over MCP management

**Allowed Operations:**
- Add/remove MCPs
- Configure authentication
- Update MCP versions
- Manage Docker MCP toolkit
- Troubleshoot MCP issues

**Delegation:** Other agents request MCP changes via @devops

**Tools Selection:**
- Use native Claude Code tools for local operations (Read, Write, Bash, Grep, Glob)
- Use MCPs only when explicitly needed or for services running in Docker
- Prefer native tools over MCP equivalents (see tool-selection matrix)

---

## 📚 Reference

- **Complete tool registry:** `.aiox-core/data/tool-registry.yaml`
- **MCP usage rules:** `.claude/rules/mcp-usage.md`
- **Tool selection guidance:** `.claude/rules/tool-examples.md`
- **Tool examples:** `.aiox-core/data/mcp-tool-examples.yaml`

---

**Last Updated:** 2026-04-12  
**Phase:** CONSOLIDATION_PHASE_2  
**Status:** IN_PROGRESS
