#!/bin/bash

##############################################################################
# Certora Formal Verification Runner
#
# Usage: ./certora-run.sh [all|chiesa|distribution]
#
# Runs formal verification specs using Certora Prover for:
#   - Chiesa.sol (main vault contract)
#   - DistributionLogic.sol (distribution logic)
#
# Prerequisites:
#   - Certora CLI installed: npm install --save-dev @certora/cli
#   - Certora API key configured (CERTORA_KEY environment variable)
#   - Solc compiler available
#
# Author: @architect (Aria)
# Date: April 10, 2026
##############################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTRACTS_DIR="contracts"
DOCS_DIR="docs"
SOLC_VERSION="solc"  # Use solc from PATH

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

##############################################################################
# Pre-flight Checks
##############################################################################

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Certora CLI is installed
    if ! command -v certoraRun &> /dev/null; then
        log_error "Certora CLI not found. Install with: npm install --save-dev @certora/cli"
        exit 1
    fi

    # Check if solc is available
    if ! command -v solc &> /dev/null; then
        log_error "Solc compiler not found. Install with: npm install -g solc"
        exit 1
    fi

    # Check if CERTORA_KEY is set
    if [ -z "$CERTORA_KEY" ]; then
        log_error "CERTORA_KEY environment variable not set"
        log_info "Set your Certora API key: export CERTORA_KEY=your-key-here"
        exit 1
    fi

    # Check if spec files exist
    if [ ! -f "$CONTRACTS_DIR/Chiesa.spec" ]; then
        log_error "Chiesa.spec not found in $CONTRACTS_DIR/"
        exit 1
    fi

    if [ ! -f "$CONTRACTS_DIR/DistributionLogic.spec" ]; then
        log_error "DistributionLogic.spec not found in $CONTRACTS_DIR/"
        exit 1
    fi

    log_success "All prerequisites met"
}

##############################################################################
# Verification Functions
##############################################################################

verify_chiesa() {
    log_info "Starting Chiesa.sol formal verification..."
    log_info "Specs: 2 invariants + 8 properties"

    certoraRun \
        "$CONTRACTS_DIR/Chiesa.spec" \
        --solc solc \
        --verify Chiesa:"$CONTRACTS_DIR/Chiesa.sol" \
        --rule "*" \
        --output-json chiesa-verification.json \
        --msg "Chiesa Formal Verification - Invariants & Properties"

    if [ $? -eq 0 ]; then
        log_success "Chiesa verification completed"
        return 0
    else
        log_error "Chiesa verification failed"
        return 1
    fi
}

verify_distribution_logic() {
    log_info "Starting DistributionLogic.sol formal verification..."
    log_info "Specs: 2 invariants + 8 properties"

    certoraRun \
        "$CONTRACTS_DIR/DistributionLogic.spec" \
        --solc solc \
        --verify DistributionLogic:"$CONTRACTS_DIR/DistributionLogic.sol" \
        --rule "*" \
        --output-json distribution-verification.json \
        --msg "DistributionLogic Formal Verification - Invariants & Properties"

    if [ $? -eq 0 ]; then
        log_success "DistributionLogic verification completed"
        return 0
    else
        log_error "DistributionLogic verification failed"
        return 1
    fi
}

verify_all() {
    log_info "Starting full formal verification suite..."
    log_info "Total: 4 invariants + 16 properties across 2 contracts"

    local chiesa_status=0
    local distribution_status=0

    # Run verifications in parallel for speed
    verify_chiesa &
    chiesa_pid=$!

    verify_distribution_logic &
    distribution_pid=$!

    # Wait for both to complete
    wait $chiesa_pid || chiesa_status=$?
    wait $distribution_pid || distribution_status=$?

    if [ $chiesa_status -eq 0 ] && [ $distribution_status -eq 0 ]; then
        log_success "All verifications passed"
        generate_report
        return 0
    else
        log_error "Some verifications failed"
        [ $chiesa_status -ne 0 ] && log_error "  - Chiesa.sol verification failed"
        [ $distribution_status -ne 0 ] && log_error "  - DistributionLogic.sol verification failed"
        return 1
    fi
}

##############################################################################
# Report Generation
##############################################################################

generate_report() {
    log_info "Generating verification report..."

    if [ -f chiesa-verification.json ] && [ -f distribution-verification.json ]; then
        log_info "Creating comprehensive report..."

        cat > "$DOCS_DIR/certora-verification-report.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": [
    {
      "name": "Chiesa",
      "file": "contracts/Chiesa.sol",
      "spec": "contracts/Chiesa.spec",
      "invariants": 2,
      "properties": 8,
      "results": "chiesa-verification.json"
    },
    {
      "name": "DistributionLogic",
      "file": "contracts/DistributionLogic.sol",
      "spec": "contracts/DistributionLogic.spec",
      "invariants": 2,
      "properties": 8,
      "results": "distribution-verification.json"
    }
  ],
  "total_rules": 20,
  "documentation": "$DOCS_DIR/certora-verification-plan.md"
}
EOF

        log_success "Report generated: $DOCS_DIR/certora-verification-report.json"
    fi
}

##############################################################################
# Usage Help
##############################################################################

show_usage() {
    cat <<EOF
Usage: ./certora-run.sh [command]

Commands:
  all             Run full verification suite (default)
  chiesa          Verify Chiesa.sol only
  distribution    Verify DistributionLogic.sol only
  help            Show this help message

Examples:
  ./certora-run.sh                    # Full verification
  ./certora-run.sh chiesa              # Church vault only
  ./certora-run.sh distribution        # Distribution logic only

Prerequisites:
  - npm install --save-dev @certora/cli
  - export CERTORA_KEY=your-api-key
  - solc compiler in PATH

Documentation:
  See docs/certora-verification-plan.md for:
  - Invariant definitions and violations
  - Property descriptions and test cases
  - Counterexample analysis
  - Configuration and bounds checking

Timing:
  - Chiesa verification: 15-30 minutes
  - Distribution verification: 10-20 minutes
  - Full suite: 25-50 minutes (parallel execution)

EOF
}

##############################################################################
# Main
##############################################################################

main() {
    local command="${1:-all}"

    case "$command" in
        help|-h|--help)
            show_usage
            exit 0
            ;;
        all)
            check_prerequisites
            verify_all
            exit $?
            ;;
        chiesa)
            check_prerequisites
            verify_chiesa
            exit $?
            ;;
        distribution)
            check_prerequisites
            verify_distribution_logic
            exit $?
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main
main "$@"
