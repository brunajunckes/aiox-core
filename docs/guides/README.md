# AIOS Guides

Complete documentation index for AIOS system guides.

---

## 🚀 1MCP Implementation (Production-Ready)

**Status:** ✅ Complete & Ready to Deploy
**Token Reduction:** 85% (280K → 40K)
**Setup Time:** 5 minutes

### Quick Start

**Want 85% token reduction in 5 minutes?**
→ Read: [`1mcp-quickstart.md`](./1mcp-quickstart.md)

### Complete Documentation

| Guide | Purpose | Time | Audience |
|-------|---------|------|----------|
| **[1MCP Implementation](./1mcp-implementation.md)** | Full comprehensive guide | 20 min | All users |
| **[Quick Start](./1mcp-quickstart.md)** | Fast 5-minute setup | 5 min | Developers |
| **[Troubleshooting](./1mcp-troubleshooting.md)** | Complete diagnostic reference | 15 min | Support teams |
| **[AIOS Integration](./1mcp-aios-integration.md)** | Agent workflows & presets | 15 min | AIOS developers |
| **[Implementation Summary](./1MCP-IMPLEMENTATION-SUMMARY.md)** | Executive overview | 5 min | Decision makers |

### Configuration Templates

- **[1MCP Config Template](../../aios-core/templates/1mcp-config.yaml)** - Production-ready YAML config

---

## 🧪 TOON Benchmark (Phase 2)

**Status:** Ready to Execute (Requires Validation)
**Location:** `benchmarks/toon-parsing/`
**Purpose:** Validate if TOON can reduce tokens further (40K → 12K)

**Next Step:** Run benchmark to decide if TOON should be implemented.

```bash
cd benchmarks/toon-parsing
npm run benchmark
```

**Decision Criteria:**
- ≥ 90% accuracy → Implement TOON (Phase 2)
- 80-90% accuracy → Caution (limited rollout)
- < 80% accuracy → Stick with 1MCP only

---

## 📦 v2.1 Framework Documentation

**Status:** ✅ Complete (Story 2.16)
**Version:** 2.1.0
**Last Updated:** 2025-12-01

### Core Architecture

| Guide | Purpose | Time | Audience |
|-------|---------|------|----------|
| **[Module System Architecture](../architecture/module-system.md)** | v2.1 modular architecture (4 modules) | 15 min | Architects, Developers |
| **[Service Discovery Guide](./service-discovery.md)** | Worker discovery and registry API | 10 min | Developers |
| **[Migration Guide v2.0→v2.1](../migration/v2.0-to-v2.1.md)** | Step-by-step migration instructions | 20 min | All users upgrading |

### System Configuration

| Guide | Purpose | Time | Audience |
|-------|---------|------|----------|
| **[Quality Gates Guide](./quality-gates.md)** | 3-layer quality gate system | 15 min | QA, DevOps |
| **[MCP Global Setup Guide](./mcp-global-setup.md)** | Global MCP server configuration | 10 min | All users |

### Quick Navigation (v2.1)

**...understand the 4-module architecture**
→ [`module-system.md`](../architecture/module-system.md) (15 min)

**...discover available workers and tasks**
→ [`service-discovery.md`](./service-discovery.md) (10 min)

**...migrate from v2.0 to v2.1**
→ [`v2.0-to-v2.1.md`](../migration/v2.0-to-v2.1.md) (20 min)

**...configure quality gates**
→ [`quality-gates.md`](./quality-gates.md) (15 min)

**...setup global MCP servers**
→ [`mcp-global-setup.md`](./mcp-global-setup.md) (10 min)

---

## 📚 Other Guides

- [Agent Reference Guide](../agent-reference-guide.md)
- [Git Workflow Guide](../git-workflow-guide.md)
- [Getting Started](../getting-started.md)
- [Troubleshooting](../troubleshooting.md)

---

## Quick Navigation

### I want to...

**...reduce token usage by 85%**
→ [`1mcp-quickstart.md`](./1mcp-quickstart.md) (5 min)

**...understand how 1MCP works**
→ [`1mcp-implementation.md`](./1mcp-implementation.md) (20 min)

**...fix 1MCP issues**
→ [`1mcp-troubleshooting.md`](./1mcp-troubleshooting.md) (15 min)

**...integrate 1MCP with AIOS agents**
→ [`1mcp-aios-integration.md`](./1mcp-aios-integration.md) (15 min)

**...see executive summary**
→ [`1MCP-IMPLEMENTATION-SUMMARY.md`](./1MCP-IMPLEMENTATION-SUMMARY.md) (5 min)

**...validate TOON optimization**
→ `../../benchmarks/toon-parsing/README.md` (Phase 2)

---

## Documentation Stats

**Total Documentation:** ~2000 lines
**Guides Created:** 5 comprehensive documents
**Coverage:** Installation, Configuration, Integration, Troubleshooting, Summary
**Production Status:** ✅ Ready to deploy

---

## Support

- **GitHub Issues:** Tag `1mcp`, `documentation`, `guides`
- **Slack:** `#aios-support`
- **Experts:** @pedro, @mitchell, @andrej, @guillermo

---

**Last Updated:** 2025-01-14
**Version:** 1.0
