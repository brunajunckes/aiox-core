---
epic_id: EPIC-45
epic_name: Igreja Reconstruction & KYC/AML Implementation
story_count: 8
sprint: 45-46
status: Draft
created_at: 2026-04-11
source: .aiox-core/constitution.md Article III (Story-Driven Development)
---

# EPIC-45: Igreja Reconstruction & KYC/AML Implementation

**Epic ID:** EPIC-45  
**Status:** Draft  
**Duration:** 2 Sprints (45-46)  
**Created:** 2026-04-11  
**Related Planning:** `/root/.claude/projects/-root/memory/SPRINT-45-PLANNING.md`

---

## 🎯 Epic Purpose

Reconstruct 4 missing Igreja pages (Comunidade, Plantar, Semear, Admin Dashboard) that were lost during VPS migration and implement KYC/AML validation with Sismo proof of residence attestation.

## 🔗 Related Context

- **Story 43.4:** Igreja Admin Dashboard (Supabase, NextAuth, Blog) ✅ COMPLETE
- **Story 43.1-43.2:** Smart Contracts (Chiesa.sol, Hardhat, tests) ✅ COMPLETE
- **Story 42.2:** Web3 Frontend (React, ethers.js) ✅ COMPLETE
- **Missing:** 4 community pages + KYC/AML workflow

---

## 📋 Story Inventory

### Sprint 45 Stories

| ID | Title | Status | Description |
|---|---|---|---|
| **45.1** | Database Schema Design | Draft | Create tables for Comunidade, Plantar, Semear, Admin Dashboard |
| **45.2** | API Scaffolding & Middleware | Draft | Setup routes, middleware, authentication layer |
| **45.3** | Authentication & Authorization | Draft | JWT, role-based access, Supabase auth integration |
| **45.4** | Comunidade (Community Forum) | Draft | Thread creation, comments, reputation system |
| **45.5** | Plantar (Project Management) | Draft | Project CRUD, funding, milestones, team management |
| **45.6** | Semear (Idea Voting System) | Draft | Idea submission, voting, community feedback |
| **45.7** | Dashboard Admin (System Admin) | Draft | Health monitoring, user management, analytics |

### Sprint 46 Stories

| ID | Title | Status | Description |
|---|---|---|---|
| **46.1** | Real-Time Features | Draft | WebSocket/Realtime for chat, voting, updates |
| **46.2** | Chiesa.sol Integration | Draft | End-to-end donations, project funding via blockchain |
| **46.3** | KYC/AML with Sismo | Draft | Document verification, compliance, attestation |
| **46.4** | E2E Testing & Optimization | Draft | Full test suite, performance tuning, Lighthouse |

---

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend:** Next.js 14, React 18, TypeScript
- **Backend:** Next.js API routes
- **Database:** Supabase PostgreSQL
- **Auth:** NextAuth.js + JWT
- **Real-Time:** Supabase Realtime
- **Web3:** ethers.js v6, Chiesa.sol
- **KYC:** Sismo attestation service

### Key Database Entities
```
communities → community_threads → community_comments
           → member_profiles

projects → project_milestones
        → project_updates
        → project_team

ideas → idea_votes
     → idea_discussions
     → contributor_recognition

admin_logs, system_health, user_roles
```

### Integration Points
- Supabase for persistence
- NextAuth for authentication
- Chiesa.sol for donations
- Sismo for KYC verification
- Realtime subscriptions for live updates

---

## 📊 Business Value & Success Metrics

### For Users
- ✅ Community engagement tools (Comunidade)
- ✅ Project planning & crowdfunding (Plantar)
- ✅ Democratic idea validation (Semear)
- ✅ System oversight (Admin Dashboard)
- ✅ Compliance verification (KYC/AML)

### Success Criteria
| Metric | Target | Success Criteria |
|--------|--------|---|
| **Test Coverage** | 70% | Unit tests >70%, E2E coverage >60% |
| **Performance** | Lighthouse ≥80 | All pages score ≥80 on Lighthouse |
| **QA Gate** | PASS | All 7 checks passing per story |
| **Completeness** | 100% AC | All acceptance criteria met |
| **Code Quality** | Excellent | ESLint, TypeScript, code review |

---

## 🚀 Delivery Timeline

### Sprint 45 (Week 1-2)
**Goal:** Foundation & CRUD operations

- **Week 1:** Database schema + API scaffolding + auth layer
  - Story 45.1: Schema design & migrations
  - Story 45.2: API routes & middleware
  - Story 45.3: Authentication layer

- **Week 2:** Feature implementation (CRUD)
  - Story 45.4: Comunidade CRUD
  - Story 45.5: Plantar CRUD
  - Story 45.6: Semear CRUD
  - Story 45.7: Admin Dashboard core

**Deliverables:**
- ✅ Supabase schema migrated
- ✅ All API endpoints CRUD-functional
- ✅ JWT + role-based access working
- ✅ React components for all 4 pages
- ✅ Unit tests (70%+ coverage)

### Sprint 46 (Week 3-4)
**Goal:** Advanced features & integration

- **Week 3:** Real-time + Web3 integration
  - Story 46.1: WebSocket/Realtime updates
  - Story 46.2: Chiesa.sol donation flows

- **Week 4:** KYC/AML + E2E testing
  - Story 46.3: Sismo KYC verification
  - Story 46.4: E2E tests + optimization

**Deliverables:**
- ✅ Real-time chat/notifications working
- ✅ End-to-end donation pipeline
- ✅ KYC verification workflow
- ✅ E2E test suite complete
- ✅ Lighthouse ≥85 all pages

---

## 🔐 Security & Compliance

### Security Considerations
- **OWASP Baseline:** Input validation, SQL injection protection, XSS prevention
- **Authentication:** JWT + NextAuth.js, rate limiting (3 req/IP/hour)
- **Authorization:** Role-based access control (user roles in database)
- **Data Protection:** PII encrypted at rest (Supabase encryption)
- **API Security:** CORS configured, rate limiting, request validation

### Compliance
- **KYC/AML:** Sismo proof of residence for large donors
- **Privacy:** GDPR-compliant user data handling
- **Audit Trail:** admin_logs table tracks all sensitive operations
- **Transparency:** Public financial reports (optional)

---

## 📚 Dependencies & Prerequisites

### Already Available
- ✅ Supabase project (ifoeqcopamhvrqrbwdua)
- ✅ NextAuth.js setup (Story 43.4)
- ✅ Smart Contracts deployed (Story 43.1-43.2)
- ✅ Web3 integration layer (Story 43.4)
- ✅ TailwindCSS styling system
- ✅ Testing infrastructure (Jest)

### New Requirements
- ⚠️ Sismo SDK (for KYC attestation)
- ⚠️ WebSocket library (Socket.io or native)
- ⚠️ Document upload service (if not using Supabase Storage)

---

## 🎓 Implementation Notes

### Architectural Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Monolith (Next.js) | Existing infrastructure, faster delivery |
| Database | Supabase PostgreSQL | Already configured, extensible schema |
| Real-Time | Supabase Realtime | Native support, no extra infrastructure |
| Web3 | Chiesa.sol via existing layer | Reuse working abstraction |
| KYC | Sismo attestation | Standards-based, third-party verified |

### Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| No original designs | HIGH | Create UX from community feedback + best practices |
| Smart Contract integration | MEDIUM | Reuse existing Web3 service layer |
| Real-time performance | MEDIUM | Database indexing + caching strategy |
| KYC compliance | MEDIUM | Use Sismo (trusted provider), audit logging |

---

## 📋 Story Templates Ready

The following story template files are in `/root/recovered/igreja-admin/docs/stories/active/`:

- `45.1.database-schema-design.md`
- `45.2.api-scaffolding-middleware.md`
- `45.3.auth-layer-jwt-rbac.md`
- `45.4.comunidade-community-forum.md`
- `45.5.plantar-project-management.md`
- `45.6.semear-idea-voting.md`
- `45.7.admin-dashboard-system.md`

Plus Sprint 46 stories:
- `46.1.realtime-features.md`
- `46.2.chiesa-integration.md`
- `46.3.kyc-aml-sismo.md`
- `46.4.e2e-testing-optimization.md`

---

## 🔄 Process Flow

```
@po validates EPIC → @sm creates 8 story files
    ↓
@dev implements Story 45.1 → 45.7 (Sprint 45)
    ↓
@qa gates each story (7 checks: code/tests/AC/security/perf/regressions/docs)
    ↓
@dev implements Story 46.1 → 46.4 (Sprint 46)
    ↓
@qa final gate + regression testing
    ↓
@devops pushes to GitHub + deploys production
```

---

## 📊 Metrics & Reporting

### Sprint 45 Success Metrics
- Story completion: 7/7 stories DONE
- Test coverage: >70% across all stories
- Code quality: ESLint/TypeScript/review all PASS
- QA gate: All 7 checks passing
- No regressions in existing functionality

### Sprint 46 Success Metrics
- Story completion: 4/4 stories DONE
- E2E test coverage: >60%
- Performance: Lighthouse ≥85 all pages
- KYC compliance: Full audit trail, zero failed verifications
- Deployment: Zero downtime, smooth production rollout

---

## ✅ Readiness Checklist

- [x] Epic purpose defined
- [x] Story inventory complete (8 stories)
- [x] Architecture decisions documented
- [x] Database schema designed
- [x] API specifications written
- [x] Risk assessment completed
- [x] Dependencies identified
- [x] Success criteria defined
- [ ] @po validates & approves
- [ ] @sm creates detailed story files
- [ ] @dev begins implementation

---

**Epic:** EPIC-45 — Igreja Reconstruction & KYC/AML  
**Status:** Ready for @po validation  
**Next Step:** @po validates, @sm creates story files  
**Planning Reference:** `/root/.claude/projects/-root/memory/SPRINT-45-PLANNING.md`
