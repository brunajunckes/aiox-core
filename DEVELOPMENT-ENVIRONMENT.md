# AIOX Development Environment Setup Guide

**Last Updated:** 2026-04-07  
**For Stories:** 1.2 (Constitution Validation), 1.3 (CI/CD Pipeline), 1.4 (Dashboard & Monitoring)

## Quick Start

### 1. Verify Node.js & npm
```bash
node --version  # Expected: v22.22.2 or higher
npm --version   # Expected: 10.9.7 or higher
```

### 2. Install Dependencies
All packages pre-installed. If needed:
```bash
npm ci   # In each project directory
```

### 3. Environment Configuration
Central `.env` at `/root/.env` with LLM providers, search tools, database config.

### 4. Verify Framework
```bash
npm run doctor         # Full health check
aiox doctor           # Direct CLI command
```

## Project Directories

```
/root/
├── .aiox-core/              # Framework core (L1-L2 protected)
├── aiox-dashboard/          # Story 1.4 (Dashboard & Monitoring)
├── paperclip/               # Companion CLI tool
├── .claude/                 # Framework configuration
├── docs/stories/            # Story files location
├── TEST-FIXTURES/           # Test data and mocks
├── .env                     # Environment variables
└── DEVELOPMENT-ENVIRONMENT.md  # This file
```

## Quality Gates Configuration

### npm Scripts
- `npm test` - Run all test suites
- `npm run lint` - ESLint validation
- `npm run typecheck` - TypeScript validation
- `npm run build` - Production build

### Pre-commit Hooks
Husky configured to run: lint → typecheck → tests

### CodeRabbit Integration
```bash
coderabbit --prompt-only --base main
```

## Test Fixtures Location

```
/root/TEST-FIXTURES/
├── story-1.2/              # Story 1.2 QA fixtures
├── story-1.3/              # Story 1.3 CI/CD fixtures
├── story-1.4/              # Story 1.4 Dashboard fixtures
├── mock-data/              # Reusable mock data
└── expectations/           # Expected test outcomes
```

## Story-Specific Setup

### Story 1.2 (Constitutional Validation)
- Location: `/root/TEST-FIXTURES/story-1.2/qa-checklist.json`
- Owner: @qa (Quinn)

### Story 1.3 (CI/CD Pipeline)
- Location: `/root/TEST-FIXTURES/story-1.3/ci-cd-workflows.yaml`
- Owner: @devops (Gage)

### Story 1.4 (Dashboard & Monitoring)
- Location: `/root/TEST-FIXTURES/story-1.4/dashboard-fixtures.json`
- Owner: @architect (Aria)

## References

- **Framework Rules:** `/root/.claude/rules/`
- **Constitution:** `/root/.aiox-core/constitution.md`
- **Story Lifecycle:** `/root/.claude/rules/story-lifecycle.md`
- **Active Story:** `/root/docs/stories/1.1.story.md`
- **Epic Plan:** `/root/docs/stories/EPIC-1-EXECUTION.yaml`

**Status:** Ready for Production
