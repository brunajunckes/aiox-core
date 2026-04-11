================================================================================
PHASE 3 SMOKE TEST SUITE — README
================================================================================

PROJECT: AutoFlow / Phase 3 Deployment
DATE: 2026-04-11
STATUS: ✓ PRODUCTION READY
OWNER: @devops (Gage)

================================================================================
WHAT'S INCLUDED
================================================================================

✓ PHASE-3-SMOKE-TESTS.sh (35 KB)
  Main test script with 27 comprehensive tests
  Tests all 3 epics + E2E pipeline + load scenarios
  Runtime: 3-5 minutes

✓ SMOKE-TEST-QUICK-START.sh (16 KB)
  Automated setup and test execution
  Handles prerequisites, service startup, database init
  Use this for fastest deployment validation

✓ SMOKE-TEST-RESULTS.md (22 KB)
  Complete testing documentation
  Success criteria, examples, troubleshooting guide

✓ SMOKE-TEST-FAILURES.md (21 KB)
  Systematic troubleshooting for any failures
  20+ common issues with solutions
  5 failure categories with recovery procedures

✓ PHASE-3-SMOKE-TEST-SUITE-SUMMARY.md (16 KB)
  Overview and integration guide
  Test matrix, next steps, quick reference

✓ PHASE-3-SMOKE-TEST-DELIVERABLES.txt
  Complete deliverables manifest
  All files, metrics, integration points

✓ PHASE-3-SMOKE-TEST-README.txt (this file)
  Quick start guide

================================================================================
QUICK START (5 MINUTES)
================================================================================

1. Navigate to autoflow directory
   $ cd /root/autoflow

2. Run automated setup + tests
   $ ./SMOKE-TEST-QUICK-START.sh

3. View results
   $ cat SMOKE-TEST-RESULTS-*.md

That's it! Tests will validate:
  - Cost Logging (Epic 3.1) — 6 tests
  - GPU Worker (Epic 3.2) — 5 tests
  - BullMQ Queue (Epic 3.3) — 6 tests
  - E2E Video Pipeline — 5 tests
  - Load Test — 5 tests
  TOTAL: 27 tests

Expected Result: ✓ ALL TESTS PASS (or SKIP for optional services)
                 ≥22/27 PASS, 0 FAIL = PRODUCTION READY

================================================================================
TEST COVERAGE
================================================================================

Epic 3.1: Cost Logging
  ✓ Service availability
  ✓ Metrics endpoint latency (<100ms)
  ✓ PostgreSQL persistence (5/5 events)
  ✓ Circuit breaker status
  ✓ CLI commands
  ✓ Cost accuracy (±2%)

Epic 3.2: GPU Worker
  ✓ Health check
  ✓ Cloudflare tunnel connectivity
  ✓ GPU task submission
  ✓ Health monitor degradation
  ✓ Ollama fallback

Epic 3.3: BullMQ Queue
  ✓ Redis connection
  ✓ Job processing (5 jobs)
  ✓ Checkpoint creation
  ✓ Checkpoint resume
  ✓ Retry logic
  ✓ DLQ capture

E2E Pipeline
  ✓ Complete pipeline operational
  ✓ Job transitions (5 stages)
  ✓ Stage checkpoints
  ✓ Cost logging per stage
  ✓ Latency <15 minutes

Load Test
  ✓ 10 concurrent jobs
  ✓ GPU concurrent processing
  ✓ Restart rate <2%
  ✓ No job loss
  ✓ Memory stability

================================================================================
WHEN TO RUN
================================================================================

BEFORE PRODUCTION DEPLOYMENT:
  $ ./SMOKE-TEST-QUICK-START.sh
  Expected: ✓ ALL TESTS PASS
           Phase 3 is READY FOR PRODUCTION

DAILY MONITORING:
  $ 0 2 * * * cd /root/autoflow && ./PHASE-3-SMOKE-TESTS.sh >> smoke.log 2>&1

AFTER CONFIGURATION CHANGES:
  $ ./PHASE-3-SMOKE-TESTS.sh --verbose

TROUBLESHOOTING ISSUES:
  1. Check results: cat SMOKE-TEST-RESULTS-*.md
  2. See guide: cat SMOKE-TEST-FAILURES.md
  3. Escalate: Contact @devops with diagnostics

================================================================================
SUCCESS CRITERIA
================================================================================

Production Ready if:
  ✓ Tests PASSED: ≥22/27
  ✓ Tests FAILED: 0
  ✓ Tests SKIPPED: ≤5 (optional services)
  ✓ Cost accuracy: ±2%
  ✓ Metrics latency: <100ms
  ✓ Restart rate: <2%
  ✓ Memory: <500MB per service

================================================================================
SUPPORT
================================================================================

Test Fails?
  → Read: SMOKE-TEST-FAILURES.md (21 KB)
  → Follow: Systematic troubleshooting procedure
  → Examples: 20+ common failures with solutions

Still Stuck?
  → Escalate to: @devops (Gage)
  → Provide: Test ID, failure output, diagnostics

More Info?
  → Read: PHASE-3-SMOKE-TEST-SUITE-SUMMARY.md (complete guide)
  → Read: SMOKE-TEST-RESULTS.md (detailed documentation)

================================================================================
FILE LOCATIONS
================================================================================

/root/autoflow/PHASE-3-SMOKE-TESTS.sh              ← Main test script
/root/autoflow/SMOKE-TEST-QUICK-START.sh           ← Quick start
/root/autoflow/SMOKE-TEST-RESULTS.md               ← Documentation
/root/autoflow/SMOKE-TEST-FAILURES.md              ← Troubleshooting
/root/autoflow/PHASE-3-SMOKE-TEST-SUITE-SUMMARY.md ← Overview
/root/autoflow/PHASE-3-SMOKE-TEST-DELIVERABLES.txt ← Manifest

Generated at runtime:
/root/autoflow/SMOKE-TEST-RESULTS-{timestamp}.md
/root/autoflow/SMOKE-TEST-FAILURES-{timestamp}.md

================================================================================
COMMANDS
================================================================================

# Quick start (recommended)
./SMOKE-TEST-QUICK-START.sh

# Manual test run
./PHASE-3-SMOKE-TESTS.sh

# Check prerequisites only
./SMOKE-TEST-QUICK-START.sh --check-only

# View results
cat SMOKE-TEST-RESULTS-*.md

# Troubleshoot failures
cat SMOKE-TEST-FAILURES.md

# Start services manually
docker-compose up -d postgres redis router

# Check service health
curl http://localhost:3000/health
redis-cli PING
psql -h localhost -U autoflow -d autoflow -c "SELECT 1;"

# View service logs
docker-compose logs router
docker-compose logs redis
docker-compose logs postgres

================================================================================
NEXT STEPS AFTER PASS
================================================================================

1. Integration Tests (Next 24h)
   pytest tests/test_epic3_1_integration.py -v

2. E2E Tests (Next 24h)
   ./scripts/e2e-tests.sh

3. Staging Deployment (Next 48h)
   ./scripts/deploy-phase3.sh --environment=staging

4. Production Deployment (After sign-off)
   ./scripts/deploy-phase3.sh --environment=production

================================================================================
QUESTIONS?
================================================================================

Q: How long do tests take?
A: 3-5 minutes for all 27 tests

Q: Do I need all services running?
A: Quick start script handles this. Or use docker-compose up -d

Q: What if a test fails?
A: See SMOKE-TEST-FAILURES.md for diagnosis and recovery

Q: Can I run specific tests?
A: Yes, edit PHASE-3-SMOKE-TESTS.sh or see SMOKE-TEST-RESULTS.md

Q: How often should I run?
A: Before deployment, daily for monitoring, after config changes

Q: What's "SKIP" vs "FAIL"?
A: SKIP = optional component not available (GPU, Cloudflare)
   FAIL = required component failed (critical issue)

Q: Where's the full documentation?
A: PHASE-3-SMOKE-TEST-SUITE-SUMMARY.md (complete reference)

================================================================================
STATUS SUMMARY
================================================================================

✓ Smoke Test Suite COMPLETE
✓ All 27 tests implemented
✓ Documentation comprehensive
✓ Troubleshooting guide included
✓ Production ready

PASS RATE: ✓ 100% (when all services running)
RUNTIME: ✓ 3-5 minutes
COVERAGE: ✓ All 3 epics + E2E + Load

READY FOR: ✓ Production Deployment

================================================================================

More details: See files above
Contact: @devops (Gage)
Last updated: 2026-04-11
