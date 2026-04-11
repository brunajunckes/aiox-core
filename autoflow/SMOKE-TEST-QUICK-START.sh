#!/bin/bash
################################################################################
# Phase 3 Smoke Test — Quick Start Guide
#
# This script provides a quick start for executing Phase 3 smoke tests with
# all necessary prerequisites and environment setup.
#
# Usage: ./SMOKE-TEST-QUICK-START.sh [options]
#
# Options:
#   --help              Show this help message
#   --check-only        Only check prerequisites, don't run tests
#   --verbose           Show detailed output
#   --full              Run full test suite (default is quick mode)
################################################################################

set -uo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Options
CHECK_ONLY=${CHECK_ONLY:-false}
VERBOSE=${VERBOSE:-false}
FULL_TEST=${FULL_TEST:-false}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# PREREQUISITE CHECKS
# ─────────────────────────────────────────────────────────────────────────────

check_prerequisites() {
    print_header "Checking Prerequisites"

    local checks_passed=0
    local checks_failed=0

    # Check Docker
    if command -v docker &> /dev/null; then
        print_success "Docker installed"
        ((checks_passed++))
    else
        print_error "Docker not installed"
        ((checks_failed++))
    fi

    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose installed"
        ((checks_passed++))
    else
        print_error "Docker Compose not installed"
        ((checks_failed++))
    fi

    # Check curl
    if command -v curl &> /dev/null; then
        print_success "curl installed"
        ((checks_passed++))
    else
        print_error "curl not installed"
        ((checks_failed++))
    fi

    # Check psql
    if command -v psql &> /dev/null; then
        print_success "psql installed"
        ((checks_passed++))
    else
        print_warning "psql not installed (database checks will be limited)"
        ((checks_passed++))
    fi

    # Check redis-cli
    if command -v redis-cli &> /dev/null; then
        print_success "redis-cli installed"
        ((checks_passed++))
    else
        print_warning "redis-cli not installed (Redis checks will be limited)"
        ((checks_passed++))
    fi

    echo ""
    print_info "Prerequisites: ${checks_passed} available, ${checks_failed} missing"

    if [ $checks_failed -gt 0 ]; then
        print_error "Cannot proceed without required tools"
        return 1
    fi

    return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# SERVICE CHECKS
# ─────────────────────────────────────────────────────────────────────────────

check_services() {
    print_header "Checking Required Services"

    local services_ready=0
    local services_missing=0

    # Check if in correct directory
    if [ ! -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
        print_error "docker-compose.yml not found in ${SCRIPT_DIR}"
        print_info "Please run from /root/autoflow directory"
        return 1
    fi

    print_info "Docker Compose file found"

    # Start services if not running
    echo ""
    print_info "Checking Docker services..."

    # PostgreSQL
    if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
        print_success "PostgreSQL running"
        ((services_ready++))
    else
        print_warning "PostgreSQL not running - attempting to start"
        docker-compose up -d postgres 2>/dev/null || print_error "Failed to start PostgreSQL"
        ((services_missing++))
    fi

    # Redis
    if docker-compose ps redis 2>/dev/null | grep -q "Up"; then
        print_success "Redis running"
        ((services_ready++))
    else
        print_warning "Redis not running - attempting to start"
        docker-compose up -d redis 2>/dev/null || print_error "Failed to start Redis"
        ((services_missing++))
    fi

    # Router
    if docker-compose ps router 2>/dev/null | grep -q "Up"; then
        print_success "Router running"
        ((services_ready++))
    else
        print_warning "Router not running - attempting to start"
        docker-compose up -d router 2>/dev/null || print_error "Failed to start Router"
        ((services_missing++))
    fi

    # Job Queue (optional)
    if docker-compose ps job-queue 2>/dev/null | grep -q "Up"; then
        print_success "Job Queue running"
        ((services_ready++))
    else
        print_warning "Job Queue not running (will start as needed)"
        ((services_missing++))
    fi

    echo ""
    print_info "Services: ${services_ready} running, ${services_missing} starting"

    # Wait for services to be ready
    if [ $services_missing -gt 0 ]; then
        print_info "Waiting for services to become healthy..."
        sleep 10
    fi

    return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# DATABASE SETUP
# ─────────────────────────────────────────────────────────────────────────────

setup_database() {
    print_header "Initializing Database"

    # Wait for PostgreSQL to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if PGPASSWORD=autoflow_secure_dev_only psql -h localhost -U autoflow -d autoflow -c "SELECT 1" >/dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start after 30 seconds"
            return 1
        fi
        sleep 1
    done

    # Create cost_events table if it doesn't exist
    print_info "Checking/creating cost_events table..."
    PGPASSWORD=autoflow_secure_dev_only psql -h localhost -U autoflow -d autoflow << 'EOF' >/dev/null 2>&1
CREATE TABLE IF NOT EXISTS autoflow_cost_events (
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  event_id VARCHAR(16) PRIMARY KEY,
  type VARCHAR(50),
  status VARCHAR(20),
  provider VARCHAR(20),
  model VARCHAR(50),
  complexity_level VARCHAR(20),
  estimated_cost_usd NUMERIC(10,6),
  actual_cost_usd NUMERIC(10,6),
  tokens_input INT,
  tokens_output INT,
  latency_ms INT,
  circuit_state VARCHAR(20),
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON autoflow_cost_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_cost_provider ON autoflow_cost_events(provider);
CREATE INDEX IF NOT EXISTS idx_cost_complexity ON autoflow_cost_events(complexity_level);
EOF

    if [ $? -eq 0 ]; then
        print_success "Cost events table ready"
    else
        print_error "Failed to create cost events table"
        return 1
    fi

    return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# RUN SMOKE TESTS
# ─────────────────────────────────────────────────────────────────────────────

run_smoke_tests() {
    print_header "Running Phase 3 Smoke Tests"

    if [ ! -f "${SCRIPT_DIR}/PHASE-3-SMOKE-TESTS.sh" ]; then
        print_error "Smoke test script not found: ${SCRIPT_DIR}/PHASE-3-SMOKE-TESTS.sh"
        return 1
    fi

    echo ""
    print_info "Executing smoke test suite..."
    echo ""

    # Run the smoke tests
    bash "${SCRIPT_DIR}/PHASE-3-SMOKE-TESTS.sh"
    local exit_code=$?

    echo ""
    if [ $exit_code -eq 0 ]; then
        print_success "All smoke tests PASSED"
    elif [ $exit_code -eq 1 ]; then
        print_warning "Some tests failed (see results for details)"
    else
        print_error "Smoke tests exited with code $exit_code"
    fi

    return $exit_code
}

# ─────────────────────────────────────────────────────────────────────────────
# SHOW RESULTS
# ─────────────────────────────────────────────────────────────────────────────

show_results() {
    print_header "Test Results"

    local latest_result=$(ls -t "${SCRIPT_DIR}"/SMOKE-TEST-RESULTS-*.md 2>/dev/null | head -1)

    if [ -n "$latest_result" ]; then
        echo ""
        print_info "Latest results: $latest_result"
        echo ""

        # Show summary
        grep -A 10 "^Results:" "$latest_result" || true
        grep -A 2 "^Overall Status:" "$latest_result" || true

        echo ""
        print_info "View full results:"
        echo "  cat $latest_result"

        # Check for failures
        local failures=$(ls -t "${SCRIPT_DIR}"/SMOKE-TEST-FAILURES-*.md 2>/dev/null | head -1)
        if [ -n "$failures" ] && [ -s "$failures" ]; then
            echo ""
            print_warning "Failures found: $failures"
            echo "  See: $(basename $failures)"
        fi
    else
        print_error "No test results found"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN FLOW
# ─────────────────────────────────────────────────────────────────────────────

usage() {
    cat << 'EOF'
Phase 3 Smoke Test — Quick Start

Usage: ./SMOKE-TEST-QUICK-START.sh [options]

Options:
    --help          Show this help message
    --check-only    Only check prerequisites, don't run tests
    --verbose       Show detailed output
    --full          Run full test suite

Examples:
    # Quick check before running tests
    ./SMOKE-TEST-QUICK-START.sh --check-only

    # Run smoke tests with all prerequisites
    ./SMOKE-TEST-QUICK-START.sh

    # Run with verbose output
    ./SMOKE-TEST-QUICK-START.sh --verbose

Prerequisites:
    - Docker & Docker Compose
    - curl, psql, redis-cli
    - Services: PostgreSQL, Redis, Router

Expected Runtime:
    - Prerequisite checks: ~10 seconds
    - Service startup: ~30-60 seconds
    - Smoke tests: ~3-5 minutes
    - Total: ~5-7 minutes

Output Files:
    - SMOKE-TEST-RESULTS-{timestamp}.md
    - SMOKE-TEST-FAILURES-{timestamp}.md (if failures found)

Next Steps After PASS:
    1. Review results: cat SMOKE-TEST-RESULTS-*.md
    2. Run integration tests: pytest tests/test_*.py -v
    3. Execute E2E tests: ./run-e2e-tests.sh
    4. Deploy to production: ./scripts/deploy-phase3.sh

Support:
    - See SMOKE-TEST-FAILURES.md for troubleshooting
    - Contact @devops (Gage) for escalation

EOF
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                usage
                exit 0
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --full)
                FULL_TEST=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Header
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║              Phase 3 Smoke Test Suite — Quick Start Guide                  ║"
    echo "║                                                                            ║"
    echo "║  Testing all 3 epics: Cost Logging, GPU Worker, BullMQ Queue               ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"

    # Step 1: Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi

    if [ "$CHECK_ONLY" = true ]; then
        print_header "Prerequisite Check Complete"
        print_success "All required tools are available"
        exit 0
    fi

    # Step 2: Check services
    if ! check_services; then
        exit 1
    fi

    # Step 3: Setup database
    if ! setup_database; then
        exit 1
    fi

    # Step 4: Run tests
    if ! run_smoke_tests; then
        echo ""
        print_warning "Some tests failed - see results below"
    fi

    # Step 5: Show results
    show_results

    echo ""
    print_header "Quick Start Complete"
    echo ""
}

main "$@"
