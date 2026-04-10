# Certora Formal Verification — Igreja Smart Contracts

**Status:** ✅ Specs Ready for Prover Execution  
**Last Updated:** April 10, 2026  
**Total Verification Rules:** 20 (4 invariants + 16 properties)  
**Expected Coverage:** Critical business logic and security properties

---

## Quick Start

### 1. Run Full Verification
```bash
# Set up Certora API key
export CERTORA_KEY="your-certora-api-key"

# Run verification script
./certora-run.sh all
```

### 2. Verify Single Contract
```bash
./certora-run.sh chiesa      # Vault contract only
./certora-run.sh distribution # Distribution logic only
```

### 3. Read Documentation
```bash
# Comprehensive guide to all properties and invariants
cat docs/certora-verification-plan.md
```

---

## What's Being Verified

### Igreja Vault (Chiesa.sol)
✅ **Invariant 1:** Total donations preserved (sum of individual amounts == total)  
✅ **Invariant 2:** Distribution percentages sum to 100%  

✅ **Property 1:** Ownership guard (onlyOwner enforcement)  
✅ **Property 2:** Positive donations only (amount > 0 required)  
✅ **Property 3:** Aave integration atomicity  
✅ **Property 4:** Balance integrity after donation  
✅ **Property 5:** Yield withdrawal bounds  
✅ **Property 6:** Donor isolation (one donor's contribution doesn't affect others)  
✅ **Property 7:** No unauthorized distribution  
✅ **Property 8:** Distribution calculation correctness  

### Distribution Logic (DistributionLogic.sol)
✅ **Invariant 1:** Percentage sum always 100  
✅ **Invariant 2:** Owner immutability  

✅ **Property 1:** Owner-only configuration  
✅ **Property 2:** Percentage sum validation  
✅ **Property 3:** Percentage bounds [0, 100]  
✅ **Property 4:** Rounding correctness  
✅ **Property 5:** Distribution recipient consistency  
✅ **Property 6:** Distribution amount bounds  
✅ **Property 7:** No division by zero  
✅ **Property 8:** Distribution percentage application  

---

## File Structure

```
contracts/
├── Chiesa.sol                   # Main vault contract (167 lines)
├── Chiesa.spec                  # Formal verification spec (8 properties + 2 invariants)
├── DistributionLogic.sol        # Distribution logic (111 lines)
├── DistributionLogic.spec       # Formal verification spec (8 properties + 2 invariants)
├── interfaces/
│   ├── IAave.sol               # Aave lending pool interface
│   ├── IGnosisSafe.sol         # Gnosis Safe interface
│   └── IERC20.sol              # ERC20 token interface
└── mocks/
    └── MockAave.sol            # Mock Aave for testing

docs/
├── certora-verification-plan.md # Complete verification guide
│                                 # (English descriptions + Certora syntax for each property)
├── certora-verification-report.json # Generated after prover run
└── ...

certora-run.sh                    # Verification runner script
CERTORA_README.md                 # This file
```

---

## Key Invariants

### Invariant 1: Donation Preservation
```
sum(donationsByUser[donor] for all donors) == totalDonations
```

**Why it matters:** Prevents donation loss, double-counting, or unauthorized transfers.

**Example violation:** If `donate()` only incremented `totalDonations` but forgot `donationsByUser[user]`, the sum would be incorrect.

### Invariant 2: Percentage Consistency
```
churchPercentage + donorRewardPercentage + reservePercentage == 100
```

**Why it matters:** Prevents misconfiguration that could distribute >100% or <100% of funds.

**Example violation:** If `setDistributionPercentages()` didn't validate the sum, someone could set 60+30+15=105.

---

## Critical Properties

### Property: Distribution Calculation Correctness
The most important property — ensures funds are correctly distributed:

```
For each recipient:
  church receives:   (balance × churchPercentage) / 100
  each donor gets:   (balance × donorPercentage) / 100 / donorCount
  reserve absorbs:   rounding losses (up to donorCount wei)
```

**Test case:**
```
Balance: 1000 USDC
Church: 60%, Donors: 30%, Reserve: 10%
3 donors

Expected distribution:
  Church:  600
  Alice:   100
  Bob:     100
  Charlie: 100
  Reserve: 100
```

---

## How Certora Verification Works

### 1. **Rule Execution**
Certora's SMT solver exhaustively checks all execution paths for each rule.

### 2. **VERIFIED Result**
The property holds for ALL possible contract states and inputs.

### 3. **FAILED Result**
Certora provides a **counterexample**: exact sequence of calls proving the violation.

### 4. **TIMED OUT Result**
Verification didn't complete. Rule may need simplification or more specific preconditions.

---

## Expected Results

### Success (All VERIFIED)
```
┌──────────────────────────────────────┐
│        FULL VERIFICATION PASSED       │
├──────────────────────────────────────┤
│ Chiesa.sol:                          │
│  ✓ 2 Invariants verified             │
│  ✓ 8 Properties verified             │
│                                      │
│ DistributionLogic.sol:               │
│  ✓ 2 Invariants verified             │
│  ✓ 8 Properties verified             │
│                                      │
│ TOTAL: 4 Invariants + 16 Properties  │
└──────────────────────────────────────┘
```

### Failure (Property violated)
```
Rule distributionCalculationCorrectness FAILED

Counterexample trace:
1. setDistributionPercentages(50, 40, 20)  ✓ Valid sum = 110
   ^ BUG FOUND: Accepted invalid sum!

Expected: Revert with "sum must equal 100"
Actual: Successfully set percentages to 50, 40, 20
```

---

## Running Verification

### Prerequisites
```bash
# 1. Install Certora CLI
npm install --save-dev @certora/cli

# 2. Get Certora API key from https://www.certora.com/
# 3. Set environment variable
export CERTORA_KEY="your-api-key-here"

# 4. Verify Solc is available
which solc
```

### Full Verification Suite
```bash
./certora-run.sh all
# Runs both Chiesa and DistributionLogic in parallel
# Expected time: 25-50 minutes
```

### Single Contract
```bash
./certora-run.sh chiesa
# Verifies Chiesa.sol only
# Expected time: 15-30 minutes
```

### Debug Mode (Single Property)
```bash
certoraRun \
  contracts/Chiesa.spec \
  --solc solc \
  --verify Chiesa:contracts/Chiesa.sol \
  --rule "ownershipGuard" \
  --msg "Debug: Test ownership enforcement"
```

---

## Understanding the Specs

### CVL (Certora Verification Language) Syntax

**Invariant (must always hold):**
```cvl
invariant totalDonationsPreserved()
    forall address donor. donationsByUser[donor] <= totalDonations
```

**Property (rule to verify):**
```cvl
rule ownershipGuard {
    env e;
    require e.msg.sender != owner;
    depositToAave@withrevert(e, amount);
    assert lastReverted;  // Must revert
}
```

**Method Declaration:**
```cvl
methods {
    function totalDonations() external returns uint256 envfree;
    function _.balanceOf(address) external => DISPATCHER(true);
}
```

---

## Interpreting Results

### ✅ VERIFIED
Property holds for all possible executions. No bugs in this aspect.

### ❌ FAILED
Certora found a counterexample (bug). Examine the trace:
1. What sequence of calls led to the violation?
2. What was the contract state before/after?
3. Fix the code and re-run.

### ⏱️ TIMED OUT
Verification didn't complete in time. Options:
1. Refine the rule with stronger preconditions
2. Split into smaller rules
3. Increase timeout (if available)

---

## What We're NOT Verifying

### ⚠️ External Dependencies
- **Aave behavior:** Specs assume correct Aave implementation
- **USDC contract:** Assumes standard ERC20 (non-fee tokens)
- **Gnosis Safe:** Assumes safe multisig behavior

**Mitigation:** Integration testing with real testnet deployments.

### ⚠️ Specification Completeness
- **Non-reentrant behavior:** Assumes `nonReentrant` guard works
- **Pausable behavior:** Specs don't verify pause/unpause logic
- **Owner changes:** Specs assume owner never changes

**Mitigation:** Review these separately in code audit.

---

## Common Violations & Fixes

### Violation: "donationsByUser[user] not incremented"
**Cause:** `donate()` function missing `donationsByUser[msg.sender] += amount`  
**Fix:** Add the state update

### Violation: "Non-owner called restricted function"
**Cause:** Missing `onlyOwner` modifier  
**Fix:** Add modifier to function declaration

### Violation: "Percentages sum to 105 after setDistributionPercentages"
**Cause:** Missing `require(_church + _donors + _reserve == 100)` check  
**Fix:** Add validation in setter

### Violation: "Division by zero when donors.length == 0"
**Cause:** Missing empty donors check  
**Fix:** Add `if (donors.length == 0) { return special case }`

---

## Next Steps After Verification

### 1. Generate HTML Report
```bash
certoraRun contracts/*.spec \
  --solc solc \
  --verify "*" \
  --html_report chiesa_verification.html
```

### 2. CI/CD Integration
Add to GitHub Actions:
```yaml
- name: Formal Verification
  run: ./certora-run.sh all
```

### 3. Audit Publication
Publish Certora results along with external audit for transparency.

### 4. Monitoring
Set up alerts for any future rule violations in production code.

---

## References

- **Certora Prover:** https://www.certora.com/
- **CVL Documentation:** https://docs.certora.com/en/latest/language/index.html
- **Best Practices:** https://docs.certora.com/en/latest/

---

## Support

For questions about the specs, see:
- **Property definitions:** `docs/certora-verification-plan.md`
- **Spec code:** `contracts/Chiesa.spec`, `contracts/DistributionLogic.spec`
- **Verification guide:** This file

---

**Prepared by:** @architect (Aria)  
**For:** Igreja nas Casas Web3 Church Platform  
**Date:** April 10, 2026
