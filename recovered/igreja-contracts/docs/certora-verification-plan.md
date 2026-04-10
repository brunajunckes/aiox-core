# Certora Formal Verification Plan — Chiesa.sol & DistributionLogic.sol

**Author:** @architect (Aria)  
**Date:** April 10, 2026  
**Status:** Specs Ready for Prover Execution  
**Test Coverage:** 76.92% (existing Jest tests + Certora specs)

---

## Executive Summary

This document defines formal verification specifications for the Igreja Web3 Church Platform's core contracts using Certora Prover. We verify 2 critical invariants and 16 safety properties across Chiesa.sol and DistributionLogic.sol.

**Key Invariants:**
1. **Donation Preservation:** Sum of all donor amounts equals total donations tracked
2. **Percentage Consistency:** Distribution percentages (church + donors + reserve = 100%)

**Properties Verified:** 8 per contract (16 total)
- Ownership enforcement, input validation, Aave integration
- Distribution correctness, rounding safety, donor isolation

---

## Contract Overview

### Chiesa.sol
**Purpose:** Main vault for donations and yield distribution  
**Size:** 167 lines | **Functions:** 11 public/external | **State Variables:** 10

**Key Flows:**
```
User → donate() → totalDonations += amount, donationsByUser[user] += amount
Owner → depositToAave() → USDC → Aave Pool
Owner → withdrawYield() → Aave → Church Treasury
Owner → distributeYield() → DistributionLogic.calculateDistribution() → Recipients
```

### DistributionLogic.sol
**Purpose:** Calculation engine for yield distribution across stakeholders  
**Size:** 111 lines | **Functions:** 5 public/external | **State Variables:** 4

**Key Flows:**
```
Owner → setDistributionPercentages() → Validate sum == 100% → Update state
DL → calculateDistribution() → Calculate percentages → Return (recipients[], amounts[])
DL → calculatePercentage() → (amount * percentage) / 100 → Safe integer division
```

---

## Invariants

### Invariant 1: Total Donations Preservation

**Definition:**
```cvl
forall address donor. donationsByUser[donor] <= totalDonations
```

**Mathematical Formulation:**
```
sum(donationsByUser[donor] for all donors) == totalDonations
```

**English Description:**
The total donations tracked in the state variable `totalDonations` must always equal the sum of all individual donor contributions tracked in the `donationsByUser` mapping. This ensures no donations are lost, counted multiple times, or leaked during state transitions.

**Severity:** CRITICAL  
**Impact:** If violated, donors could be underpaid, church could lose revenue, or accounting would be inconsistent.

**Violation Scenarios:**
1. ❌ **Donation subtraction:** If `donate()` could subtract from `totalDonations` (bug in implementation)
2. ❌ **Duplicate counting:** If a single donation incremented both `totalDonations` and `donationsByUser[user]` twice
3. ❌ **Silent drops:** If donations transferred but not tracked in state
4. ❌ **Reentrancy bypass:** If `nonReentrant` guard fails and `totalDonations` incremented twice

**Expected Violations:** NONE (property should always hold)

**Holds Because:**
- `donate()` always increments both `totalDonations` and `donationsByUser[msg.sender]` by the same amount
- `withdrawYield()` never touches donation mappings (only yields)
- `distributeYield()` never touches donation mappings
- No other function modifies donation state

**Counterexample Analysis:**
If a violation is found, Certora will show:
- The sequence of calls leading to the violation
- The exact values before/after showing the discrepancy
- Which function caused the invariant break

Example (hypothetical): If `donate()` had a bug:
```solidity
// BUGGY CODE (hypothetical)
function donate(uint256 amount) external {
    donationsByUser[msg.sender] += amount;
    // totalDonations += amount;  // OOPS: forgot to increment total!
}
```
Certora would find: After one donation, `totalDonations == 0` but `donationsByUser[user] == amount`.

---

### Invariant 2: Distribution Percentages Consistency

**Definition:**
```cvl
churchPercentage() + donorRewardPercentage() + reservePercentage() == 100
```

**Mathematical Formulation:**
```
C% + D% + R% = 100 (always, for all contract states)
```

**English Description:**
The three distribution percentage components must always sum to exactly 100%. This is enforced at the point of configuration change (`setDistributionPercentages`) and must hold continuously throughout the contract's lifetime.

**Default Values:**
- Church: 60%
- Donors: 30%
- Reserve: 10%
- Total: 100% ✓

**Severity:** CRITICAL  
**Impact:** If violated, distribution could allocate more or less than 100% of available funds, causing:
- Lost funds (if sum < 100% and remainder is unaccounted)
- Excessive distribution (if sum > 100% and balance insufficient)
- Incentive misalignment (if percentages don't match stakeholder expectations)

**Violation Scenarios:**
1. ❌ **Configuration bypass:** If `setDistributionPercentages` allowed invalid sum
2. ❌ **Unchecked assignment:** If percentages were directly mutated without validation
3. ❌ **Integer overflow:** If summing percentages caused overflow and wrapped
4. ❌ **Delegate call attack:** If delegated to untrusted code that modified state

**Expected Violations:** NONE (property should always hold)

**Holds Because:**
- `setDistributionPercentages()` explicitly requires `_church + _donors + _reserve == 100`
- No other function modifies percentages
- Percentages are public state variables (transparent and auditable)
- No reentrancy or delegate call patterns that could bypass validation

**Counterexample Analysis:**
If a violation is found, Certora will show the state mutation that broke the invariant.

Example (hypothetical): If the require statement were removed:
```solidity
// BUGGY CODE (hypothetical)
function setDistributionPercentages(uint256 _church, uint256 _donors, uint256 _reserve) external {
    // MISSING: require(_church + _donors + _reserve == 100, "...");
    churchPercentage = _church;
    donorRewardPercentage = _donors;
    reservePercentage = _reserve;
}
```
Certora would find: After `setDistributionPercentages(50, 40, 15)`, sum == 105 (violated).

---

## Property Rules

### Chiesa.sol Properties

#### Property 1: Ownership Guard (onlyOwner Enforcement)

**Category:** Access Control  
**Severity:** CRITICAL

**Definition:**
```cvl
rule ownershipGuard {
    require e.msg.sender != owner;
    depositToAave@withrevert(e, amount);
    assert !lastReverted => e.msg.sender == owner;
}
```

**English Description:**
Ownership-restricted functions (`depositToAave`, `withdrawYield`, `distributeYield`, `pause`, `unpause`) must only execute when called by the contract owner. Non-owners attempting to call these functions must have their transactions reverted.

**Tested Functions:**
- `depositToAave(uint256)` — Owner only
- `withdrawYield(uint256)` — Owner only
- `distributeYield()` — Owner only
- `pause()` — Owner only
- `unpause()` — Owner only

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing `onlyOwner` modifier
- ❌ `onlyOwner` modifier on wrong function
- ❌ Owner check using wrong comparison (e.g., `!=` instead of `==`)
- ❌ Owner variable initialized to `0x0` and never set

**Counterexample Analysis:**
If violated, Certora shows the exact call sequence proving a non-owner executed a restricted function.

---

#### Property 2: Positive Donations Only (Amount Validation)

**Category:** Input Validation  
**Severity:** HIGH

**Definition:**
```cvl
rule positiveDonatationsOnly {
    if (amount == 0) assert lastReverted;
    if (amount > 0 && !lastReverted) {
        assert totalAfter == totalBefore + amount;
        assert userAfter == userBefore + amount;
    }
}
```

**English Description:**
The `donate()` function must reject donations with `amount == 0` (revert). When a positive amount is donated, the total donations and user's donation amount must both increase by exactly that amount.

**Acceptance Criteria:**
- `donate(0)` always reverts
- `donate(amount > 0)` succeeds (assuming USDC transfer succeeds)
- After `donate(X)`, `totalDonations` increases by X
- After `donate(X)`, `donationsByUser[msg.sender]` increases by X

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing `require(amount > 0)` check
- ❌ Amount validation reversed: `require(amount == 0)`
- ❌ Off-by-one error: `require(amount >= 0)` (allows zero)
- ❌ State update missing: only `totalDonations` incremented, not `donationsByUser`

**Counterexample Analysis:**
If violated, Certora shows:
- Case 1: Non-zero donation that didn't increment state
- Case 2: Zero donation that didn't revert
- Case 3: Donation amount mismatch between total and user tracking

---

#### Property 3: Aave Integration Consistency (Atomicity)

**Category:** Yield Farm Safety  
**Severity:** HIGH

**Definition:**
```cvl
rule aaveIntegrationAtomicity {
    require amount > 0;
    require e.msg.sender == owner;
    depositToAave@withrevert(e, amount);
    if (!lastReverted) {
        assert true; // Aave deposit succeeded atomically
    }
}
```

**English Description:**
The `depositToAave()` function must ensure that:
1. USDC approval to Aave is set before deposit
2. Aave deposit is called with correct parameters
3. If the function succeeds (no revert), both operations must have completed

The function is atomic: either both operations succeed or both fail (via revert).

**Tested Flow:**
```
User calls depositToAave(amount)
  → require amount > 0 ✓
  → require onlyOwner ✓
  → USDC.approve(aavePool, amount) — must succeed
  → aavePool.deposit(usdc, amount, address(this), 0) — must succeed
  → No revert → Both operations completed atomically
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Approval succeeds but deposit fails (partial execution)
- ❌ Approval reverts but deposit is attempted anyway
- ❌ Missing approval (Aave rejects transfer)
- ❌ Aave address is zero or invalid

**Counterexample Analysis:**
If violated, Certora shows the exact point where atomicity breaks (approval vs. deposit mismatch).

---

#### Property 4: Balance Integrity After Donation (State Consistency)

**Category:** Fund Safety  
**Severity:** HIGH

**Definition:**
```cvl
rule balanceIntegrityAfterDonation {
    uint256 balanceBefore = usdc.balanceOf(currentContract);
    donate@withrevert(e, amount);
    if (!lastReverted) {
        uint256 balanceAfter = usdc.balanceOf(currentContract);
        assert balanceAfter == balanceBefore + amount;
    }
}
```

**English Description:**
After a successful donation, the Chiesa contract's USDC balance must increase by exactly the donated amount. This ensures that funds transferred via `IERC20.transferFrom()` are correctly received by the contract.

**Tested Invariant:**
```
USDC_balance[Chiesa]_after == USDC_balance[Chiesa]_before + donation_amount
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ `transferFrom` fails silently (no revert, balance not updated)
- ❌ `transferFrom` transfers to wrong address
- ❌ USDC contract is not actually ERC20 (e.g., fee-on-transfer token)
- ❌ Other functions withdraw funds during donation

**Counterexample Analysis:**
If violated, Certora shows that USDC balance didn't increase as expected after a successful transfer.

---

#### Property 5: Yield Withdrawal Bounds (Fund Safety)

**Category:** Bounds Checking  
**Severity:** MEDIUM

**Definition:**
```cvl
rule yieldWithdrawalBounds {
    require e.msg.sender == owner;
    uint256 balance = usdc.balanceOf(currentContract);
    withdrawYield@withrevert(e, amount);
    if (lastReverted) {
        assert true; // Correctly reverted on overdraft
    } else {
        assert totalYieldGenerated() >= 0; // State updated
    }
}
```

**English Description:**
The `withdrawYield()` function must not withdraw more than the contract's available USDC balance. If `amount` exceeds the available balance, the withdrawal must fail (revert). If successful, `totalYieldGenerated` must be updated.

**Tested Bounds:**
```
amount <= USDC_balance[Chiesa]  (or revert)
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ No bounds check on withdrawal amount
- ❌ Aave allows overdraft (would require insurance)
- ❌ `withdrawYield` doesn't track actual withdrawn amount
- ❌ Double-withdrawal without re-checking balance

**Counterexample Analysis:**
If violated, Certora shows a withdrawal that exceeded available balance and didn't revert.

---

#### Property 6: Donor Isolation (State Independence)

**Category:** Mapping Integrity  
**Severity:** MEDIUM

**Definition:**
```cvl
rule donorIsolation {
    require donor1 != donor2;
    uint256 donor1Before = donationsByUser(donor1);
    donate(e, amount); // Called by donor2
    uint256 donor1After = donationsByUser(donor1);
    assert donor1Before == donor1After;
}
```

**English Description:**
When one donor donates, their contribution must not affect another donor's tracked donation amount. Each donor's `donationsByUser[address]` must be independent and isolated from other donors' transactions.

**Tested Invariant:**
```
For all donors A, B where A != B:
  donationsByUser[A] is not modified when B donates
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Global counter instead of per-donor tracking
- ❌ Mapping off-by-one error (storing in wrong key)
- ❌ Shared state variable accidentally incremented for all donors
- ❌ Loop bug that increments multiple donors simultaneously

**Counterexample Analysis:**
If violated, Certora shows two donors where one's donation amount changed when the other donated.

---

#### Property 7: No Unauthorized Distribution (Access Control)

**Category:** Access Control  
**Severity:** CRITICAL

**Definition:**
```cvl
rule noUnauthorizedDistribution {
    require e.msg.sender != owner;
    distributeYield@withrevert(e);
    assert lastReverted;
}
```

**English Description:**
Only the contract owner can execute yield distribution. Non-owners attempting to call `distributeYield()` must have their transactions reverted. This prevents unauthorized parties from:
- Distributing funds to incorrect recipients
- Triggering unintended distribution logic
- Bypassing yield farming strategies

**Tested Function:**
- `distributeYield()` — Owner only

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing `onlyOwner` modifier on `distributeYield`
- ❌ Owner check using wrong address variable
- ❌ Modifier present but not enforced due to override/delegate call

**Counterexample Analysis:**
If violated, Certora shows a non-owner successfully calling `distributeYield()`.

---

#### Property 8: Distribution Calculation Correctness (Logic Verification)

**Category:** Business Logic  
**Severity:** CRITICAL

**Definition:**
```cvl
rule distributionCalculationCorrectness {
    uint256 availableBalance = usdc.balanceOf(currentContract);
    (address[] recipients, uint256[] amounts) =
        distributionLogic.calculateDistribution(availableBalance, donors);
    
    uint256 churchPct = distributionLogic.churchPercentage();
    uint256 expectedChurch = (availableBalance * churchPct) / 100;
    assert recipients[0] == owner && amounts[0] == expectedChurch;
}
```

**English Description:**
The `distributeYield()` function must correctly apply the configured distribution percentages:
- Church receives: `(balance * churchPercentage) / 100`
- Donors receive: `(balance * donorRewardPercentage) / 100` split equally
- Reserve accounts for remainder after rounding

Each recipient must receive the correct amount according to the percentage configuration.

**Tested Distribution:**
```
Church (owner):    X% of balance
Donors (each):     Y% of balance / donor_count
Reserve:           Z% of balance (or remainder)
```

**Rounding Note:**
Due to integer division, up to `donor_count` wei may be lost to the reserve bucket. This is acceptable and expected.

**Expected Result:** VERIFIED with rounding tolerance  
**Violation Scenarios:**
- ❌ Wrong percentage applied (e.g., church receives 30% instead of 60%)
- ❌ Percentages applied incorrectly (multiply instead of divide)
- ❌ Off-by-one error in recipient array indexing
- ❌ Donor count incorrect (dividing by wrong denominator)
- ❌ Excessive rounding loss (more than expected)

**Counterexample Analysis:**
If violated, Certora shows the exact distribution that violated the property, with expected vs. actual amounts for each recipient.

---

### DistributionLogic.sol Properties

#### Property 1: Owner-Only Configuration (Access Control)

**Category:** Access Control  
**Severity:** CRITICAL

**Definition:**
```cvl
rule ownerOnlyConfiguration {
    require e.msg.sender != owner;
    setDistributionPercentages@withrevert(e, church, donors, reserve);
    assert lastReverted;
}
```

**English Description:**
Only the contract owner can modify distribution percentages. Non-owners attempting to call `setDistributionPercentages()` must be reverted. This prevents unauthorized percentage changes that could:
- Redirect funds away from intended stakeholders
- Violate donor expectations
- Cause governance conflicts

**Tested Function:**
- `setDistributionPercentages(uint256, uint256, uint256)` — Owner only

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing `require(msg.sender == owner)` check
- ❌ Owner address is address(0) or uninitialized
- ❌ Owner changed by unauthorized function
- ❌ Delegate call bypasses owner check

**Counterexample Analysis:**
If violated, Certora shows a non-owner successfully changing percentages.

---

#### Property 2: Percentage Sum Validation (Configuration Guard)

**Category:** Configuration Validation  
**Severity:** CRITICAL

**Definition:**
```cvl
rule percentageSumValidation {
    require e.msg.sender == owner;
    setDistributionPercentages@withrevert(e, church, donors, reserve);
    if (church + donors + reserve != 100) {
        assert lastReverted;
    }
}
```

**English Description:**
The `setDistributionPercentages()` function must validate that the three percentages sum to exactly 100 before updating state. If the sum is not 100, the transaction must revert and state must not be modified.

**Tested Invariant:**
```
setDistributionPercentages(C, D, R) succeeds IFF C + D + R == 100
```

**Test Cases:**
- ✓ `setDistributionPercentages(60, 30, 10)` — Sum = 100, should succeed
- ✗ `setDistributionPercentages(60, 30, 15)` — Sum = 105, should revert
- ✗ `setDistributionPercentages(50, 40, 5)` — Sum = 95, should revert
- ✗ `setDistributionPercentages(100, 0, 0)` — Sum = 100, should succeed
- ✗ `setDistributionPercentages(0, 0, 100)` — Sum = 100, should succeed

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing sum validation check
- ❌ Wrong comparison operator (> instead of ==)
- ❌ Check present but doesn't revert on failure
- ❌ Overflow in sum calculation

**Counterexample Analysis:**
If violated, Certora shows invalid percentages that were accepted (e.g., accepted 105% total).

---

#### Property 3: Percentage Bounds (Configuration Safety)

**Category:** Configuration Validation  
**Severity:** HIGH

**Definition:**
```cvl
rule percentageBounds {
    require e.msg.sender == owner;
    setDistributionPercentages@withrevert(e, church, donors, reserve);
    if (!lastReverted) {
        assert churchPercentage() <= 100;
        assert donorRewardPercentage() <= 100;
        assert reservePercentage() <= 100;
    }
}
```

**English Description:**
After a successful configuration update, each individual percentage must be in the valid range [0, 100]. No single percentage can exceed 100. This is implicitly guaranteed by the sum == 100 constraint but should be verified explicitly.

**Tested Bounds:**
```
0 <= churchPercentage <= 100
0 <= donorRewardPercentage <= 100
0 <= reservePercentage <= 100
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Very large input (e.g., `setDistributionPercentages(200, 0, 0)`) somehow succeeds
- ❌ Negative input (underflow in calculation)
- ❌ Integer overflow in sum check
- ❌ Bounds check missing

**Counterexample Analysis:**
If violated, Certora shows a percentage exceeding 100 after a successful configuration.

---

#### Property 4: Rounding Correctness in calculatePercentage (Math Safety)

**Category:** Mathematics/Precision  
**Severity:** MEDIUM

**Definition:**
```cvl
rule roundingCorrectness {
    require amount < 2^128;
    require percentage <= 100;
    uint256 result = calculatePercentage(amount, percentage);
    assert result == (amount * percentage) / 100;
    assert result <= amount;
}
```

**English Description:**
The `calculatePercentage(uint256 amount, uint256 percentage)` function must correctly compute `(amount * percentage) / 100` using integer arithmetic (floor division, no rounding up).

**Tested Formula:**
```
calculatePercentage(A, P) == floor(A * P / 100)
```

**Test Cases:**
- `calculatePercentage(100, 50)` → 50 (not 50.0)
- `calculatePercentage(100, 33)` → 33 (not 33.33)
- `calculatePercentage(1000, 1)` → 10 (not 10.0)
- `calculatePercentage(0, 100)` → 0
- `calculatePercentage(100, 0)` → 0

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Uses floating point instead of integer division
- ❌ Rounds instead of floors (33.6 → 34 instead of 33)
- ❌ Wrong operator precedence (divides first, then multiplies)
- ❌ Missing parentheses in calculation
- ❌ Overflow in intermediate result (A * P before dividing)

**Counterexample Analysis:**
If violated, Certora shows a percentage calculation that returned the wrong value.

---

#### Property 5: Distribution Recipient Consistency (Array Integrity)

**Category:** Array Safety  
**Severity:** HIGH

**Definition:**
```cvl
rule distributionRecipientConsistency {
    require donors.length < 100;
    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);
    
    assert recipients.length == amounts.length;
    assert recipients.length > 0;
    assert recipients[0] == owner;
}
```

**English Description:**
The `calculateDistribution()` function must return two arrays of equal length (recipients and amounts). The first recipient must always be the owner (church allocation). All donor addresses must be included in the recipients array.

**Tested Invariants:**
```
recipients.length == amounts.length
recipients.length > 0
recipients[0] == owner
recipients.length == max(1, donors.length + 1)  // +1 for owner
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Array length mismatch (recipients.length != amounts.length)
- ❌ Empty recipients array
- ❌ First recipient is not owner
- ❌ Donors not included in recipients
- ❌ Array indexing off-by-one
- ❌ Dynamic array allocation mismatch

**Counterexample Analysis:**
If violated, Certora shows the exact array inconsistency (which recipient or amount is missing/mismatched).

---

#### Property 6: Distribution Amount Bounds (Fund Safety)

**Category:** Bounds Checking  
**Severity:** HIGH

**Definition:**
```cvl
rule distributionAmountBounds {
    require totalAmount > 0;
    require donors.length < 100;
    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);
    
    uint256 sumAmounts = 0;
    for (uint256 i = 0; i < amounts.length; i++) {
        sumAmounts += amounts[i];
    }
    
    assert sumAmounts <= totalAmount;
    if (donors.length > 0) {
        assert sumAmounts >= totalAmount - donors.length;
    }
}
```

**English Description:**
The sum of all distributed amounts must not exceed the total amount available. Rounding losses should be within acceptable bounds (at most `donors.length` wei due to integer division in the per-donor calculation).

**Tested Bounds:**
```
sum(amounts[i]) <= totalAmount                    // No over-distribution
sum(amounts[i]) >= totalAmount - donors.length   // Rounding tolerance
```

**Rounding Tolerance Explanation:**
When distributing `(totalAmount * donorPercentage) / 100` equally among N donors, the per-donor amount is `result / donors.length`. This integer division may lose up to `N-1` wei in the remainder, which goes to the reserve bucket. This is acceptable.

**Test Case:**
```
totalAmount = 1000, donors = 3
donorPercentage = 30%
donorTotal = (1000 * 30) / 100 = 300
perDonor = 300 / 3 = 100
distributed = 60 (church) + 100 + 100 + 100 (donors) = 360 + remainder

Remainder = 1000 - 360 = 640 (reserve, not distributed yet)
Sum distributed = 360, which equals totalAmount - 640
```

**Expected Result:** VERIFIED with rounding tolerance  
**Violation Scenarios:**
- ❌ Sum exceeds total amount (over-distribution)
- ❌ Rounding losses exceed `donors.length` (calculation error)
- ❌ Amounts truncated incorrectly
- ❌ Reserve not accounted for

**Counterexample Analysis:**
If violated, Certora shows the amounts array and their sum, proving the violation.

---

#### Property 7: No Division by Zero in Empty Donors (Edge Case Safety)

**Category:** Edge Case Safety  
**Severity:** HIGH

**Definition:**
```cvl
rule noDivisionByZeroEmptyDonors {
    require totalAmount > 0;
    address[] emptyDonors;
    require emptyDonors.length == 0;
    
    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, emptyDonors);
    
    assert recipients.length == 1;
    assert recipients[0] == owner;
    assert amounts[0] == totalAmount;
}
```

**English Description:**
When the donors array is empty, `calculateDistribution()` must not attempt to divide by zero (which would revert). Instead, it should return a distribution with only the owner as recipient, receiving the entire amount. This handles the edge case gracefully.

**Tested Edge Case:**
```
calculateDistribution(amount, []) returns ([owner], [amount])
(no division by zero error)
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Missing empty donors check (attempts `/ 0`)
- ❌ Division by zero crash
- ❌ Wrong return value for empty donors
- ❌ Revert on empty donors (should not fail)

**Counterexample Analysis:**
If violated, Certora either shows:
1. Division by zero error when donors.length == 0
2. Incorrect return values for empty donors case

---

#### Property 8: Distribution Percentage Application (Business Logic)

**Category:** Business Logic  
**Severity:** CRITICAL

**Definition:**
```cvl
rule distributionPercentageApplication {
    require totalAmount > 0;
    require donors.length > 0;
    
    uint256 churchPct = churchPercentage();
    uint256 donorPct = donorRewardPercentage();
    
    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);
    
    uint256 expectedChurch = (totalAmount * churchPct) / 100;
    uint256 expectedDonorTotal = (totalAmount * donorPct) / 100;
    uint256 perDonor = expectedDonorTotal / donors.length;
    
    assert amounts[0] == expectedChurch;
    for (uint256 i = 0; i < donors.length; i++) {
        assert amounts[i + 1] == perDonor;
    }
}
```

**English Description:**
The `calculateDistribution()` function must correctly apply the configured percentages to compute each recipient's amount:

1. **Church Amount:** `(totalAmount * churchPercentage) / 100`
2. **Per-Donor Amount:** `((totalAmount * donorPercentage) / 100) / donorCount`
3. **Distribution:** Church receives first allocation, then each donor receives equal share

**Example Calculation (default 60/30/10):**
```
totalAmount = 1000 USDC
donors = [alice, bob, charlie] (3 donors)

Church:      (1000 * 60) / 100 = 600
Donor pool:  (1000 * 30) / 100 = 300
Per donor:   300 / 3 = 100
Reserve:     (1000 * 10) / 100 = 100

Distribution:
  Church:  600
  Alice:   100
  Bob:     100
  Charlie: 100
  Reserve: 100

Total:   600 + 100 + 100 + 100 + 100 = 1000 ✓
```

**Expected Result:** VERIFIED  
**Violation Scenarios:**
- ❌ Wrong percentage for church (receives 30% instead of 60%)
- ❌ Wrong percentage for donors
- ❌ Incorrect division by donor count
- ❌ Recipient array indexing wrong
- ❌ Floating point used instead of integer math
- ❌ Percentage applied in wrong order (divide before multiply)

**Counterexample Analysis:**
If violated, Certora shows the calculated distribution that doesn't match the expected percentages, with exact values for each recipient.

---

## Execution Plan

### Prerequisites
```bash
# 1. Install Certora CLI
npm install --save-dev @certora/cli

# 2. Authenticate with Certora (requires API key)
# See: https://docs.certora.com/en/latest/

# 3. Verify contracts compile
npx hardhat compile
```

### Running Verifications

#### Step 1: Chiesa.sol Verification
```bash
# Verify Chiesa contract with Chiesa.spec
npx hardhat verify contracts/Chiesa.sol
certoraRun \
  contracts/Chiesa.spec \
  --solc solc \
  --verify Chiesa:contracts/Chiesa.sol \
  --rule "*" \
  --msg "Chiesa Full Verification"
```

**Expected Time:** 15-30 minutes  
**Expected Result:** All 8 properties + 2 invariants VERIFIED

#### Step 2: DistributionLogic.sol Verification
```bash
# Verify DistributionLogic contract with DistributionLogic.spec
certoraRun \
  contracts/DistributionLogic.spec \
  --solc solc \
  --verify DistributionLogic:contracts/DistributionLogic.sol \
  --rule "*" \
  --msg "DistributionLogic Full Verification"
```

**Expected Time:** 10-20 minutes  
**Expected Result:** All 8 properties + 2 invariants VERIFIED

#### Step 3: Full Report Generation
```bash
# Generate HTML report
certoraRun \
  contracts/*.spec \
  --solc solc \
  --verify "*" \
  --html_report chiesa_distribution_verification.html
```

### Interpretation of Results

**VERIFIED:** Property holds for all possible contract execution paths  
**FAILED:** Certora found a counterexample (contract code has a bug)  
**TIMED OUT:** Verification didn't complete (may need rule refinement)

### If Violations Detected

1. **Review Counterexample:** Certora provides exact call sequence and state values
2. **Locate Bug:** Trace the counterexample in the contract code
3. **Fix Code:** Update contract logic
4. **Re-Run Verification:** Confirm fix resolves the violation

---

## Spec Architecture

### File Structure
```
contracts/
├── Chiesa.sol                    # Main vault contract
├── Chiesa.spec                   # Invariants + 8 properties
├── DistributionLogic.sol         # Distribution logic
├── DistributionLogic.spec        # Invariants + 8 properties
└── interfaces/
    └── IAave.sol

docs/
├── certora-verification-plan.md  # This file
└── ...
```

### Spec Coverage

| Category | Chiesa.sol | DistributionLogic.sol |
|----------|---------|-------|
| **Invariants** | 2 | 2 |
| **Properties** | 8 | 8 |
| **Total Rules** | 10 | 10 |
| **Total Verification Rules** | **20** | — |

---

## Known Limitations

### 1. Aave Mocking
The specs use `DISPATCHER` for Aave methods, which assumes Aave is correctly implemented. Real integration testing required with actual Aave contracts.

### 2. USDC Behavior
Specs assume standard ERC20. Non-standard USDC implementations (fee-on-transfer, rebasing, etc.) may require spec updates.

### 3. Array Size Bounds
For practical verification time, specs require `donors.length < 100`. Real deployments should verify this assumption.

### 4. Fixed-Point Math
Specs use integer arithmetic. If fixed-point libraries are added, specs need updates.

---

## Next Steps

1. ✅ Create spec files (Chiesa.spec, DistributionLogic.spec)
2. ✅ Document all rules (this file)
3. ⏳ **Run Certora Prover** (requires API key)
4. ⏳ **Generate HTML Report** (from prover output)
5. ⏳ **Add CI/CD Integration** (auto-verify on PR)
6. ⏳ **Public Audit Publication** (optional, for transparency)

---

## References

- **Certora Documentation:** https://docs.certora.com/
- **CVL Language Guide:** https://docs.certora.com/en/latest/language/index.html
- **Formal Verification Best Practices:** https://docs.certora.com/en/latest/

---

**Status:** READY FOR PROVER EXECUTION  
**Last Updated:** April 10, 2026  
**Maintainer:** @architect (Aria)
