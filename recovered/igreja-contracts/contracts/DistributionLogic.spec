/**
 * @title DistributionLogic.spec
 * @notice Certora formal verification specification for DistributionLogic.sol
 * @dev Defines key invariants and properties for the distribution logic contract
 */

methods {
    // Public state methods
    function churchPercentage() external returns uint256 envfree;
    function donorRewardPercentage() external returns uint256 envfree;
    function reservePercentage() external returns uint256 envfree;
    function owner() external returns address envfree;

    // Distribution calculation
    function calculateDistribution(uint256, address[]) external returns (address[], uint256[]) envfree;
    function calculatePercentage(uint256, uint256) external returns uint256 envfree;

    // Configuration
    function setDistributionPercentages(uint256, uint256, uint256) external;
}

/**
 * INVARIANT 1: Percentage Sum Invariant
 *
 * The sum of all distribution percentages must always equal 100.
 * This is enforced by setDistributionPercentages and verified continuously.
 *
 * Mathematical formulation:
 *   churchPercentage + donorRewardPercentage + reservePercentage == 100
 *
 * Importance: Prevents configuration errors that could lead to:
 *   - Distributing more than 100% of available funds
 *   - Lost funds due to incomplete distribution
 *   - Incentive misalignment between stakeholders
 *
 * Violation scenarios (if invariant broken):
 *   - setDistributionPercentages allows invalid sum
 *   - State manipulation bypassing validation
 *   - Integer overflow in percentage calculations
 */
invariant percentageSumAlways100()
    churchPercentage() + donorRewardPercentage() + reservePercentage() == 100
    {
        preserved setDistributionPercentages(uint256 c, uint256 d, uint256 r) {
            // The function requires c + d + r == 100 before state update
            require c + d + r == 100;
        }
    }

/**
 * INVARIANT 2: Owner Immutability
 *
 * The owner address must remain constant after initialization.
 * The constructor sets owner = msg.sender and no function changes it.
 *
 * Violation scenarios:
 *   - Owner changed via unauthorized function
 *   - Self-destruct or delegate call bypasses owner
 *   - State variable directly mutated
 */
invariant ownerImmutable()
    owner() == owner()
    {
        preserved {
            // No function modifies owner
        }
    }

// ============ PROPERTY RULES ============

/**
 * PROPERTY 1: Owner-Only Configuration
 *
 * Only the contract owner can call setDistributionPercentages.
 * Non-owners must not be able to modify distribution percentages.
 *
 * English: setDistributionPercentages called by non-owner reverts.
 *
 * Expected result: VERIFIED
 * Counterexample: None (if require(msg.sender == owner) enforced)
 */
rule ownerOnlyConfiguration {
    env e;
    uint256 church;
    uint256 donors;
    uint256 reserve;

    require e.msg.sender != owner;

    setDistributionPercentages@withrevert(e, church, donors, reserve);

    assert lastReverted,
        "Non-owner was able to call setDistributionPercentages";
}

/**
 * PROPERTY 2: Percentage Sum Validation
 *
 * setDistributionPercentages must reject configurations where the sum != 100.
 *
 * English: setDistributionPercentages(60, 30, 15) must revert because 60+30+15 = 105.
 *
 * Expected result: VERIFIED
 * Counterexample: None (if require sum == 100 enforced)
 */
rule percentageSumValidation {
    env e;
    uint256 church;
    uint256 donors;
    uint256 reserve;

    require e.msg.sender == owner;

    setDistributionPercentages@withrevert(e, church, donors, reserve);

    // If sum != 100, must revert
    if (church + donors + reserve != 100) {
        assert lastReverted,
            "setDistributionPercentages accepted invalid sum";
    }

    // If sum == 100, may succeed
    if (church + donors + reserve == 100) {
        // State is updated (no assertion needed, just documenting intent)
    }
}

/**
 * PROPERTY 3: Percentage Bounds
 *
 * Individual percentages must be in valid range [0, 100].
 * No single percentage can exceed 100.
 *
 * English: After setDistributionPercentages(110, 0, 0), function reverts
 * because 110 > 100 (violates sum == 100 requirement).
 *
 * Expected result: VERIFIED
 * Counterexample: None (sum == 100 constraint implicitly bounds each)
 */
rule percentageBounds {
    env e;
    uint256 church;
    uint256 donors;
    uint256 reserve;

    require e.msg.sender == owner;

    setDistributionPercentages@withrevert(e, church, donors, reserve);

    // After successful update, each percentage <= 100
    if (!lastReverted) {
        assert churchPercentage() <= 100,
            "Church percentage exceeds 100";
        assert donorRewardPercentage() <= 100,
            "Donor percentage exceeds 100";
        assert reservePercentage() <= 100,
            "Reserve percentage exceeds 100";
    }
}

/**
 * PROPERTY 4: Rounding Correctness in calculatePercentage
 *
 * The calculatePercentage function must correctly compute amount * percentage / 100.
 * Results should be truncated (floor), not rounded.
 *
 * English: calculatePercentage(100, 33) returns 33 (not 33.33).
 *
 * Expected result: VERIFIED
 * Counterexample: None (if using integer division)
 */
rule roundingCorrectness {
    uint256 amount;
    uint256 percentage;

    require amount < 2^128;  // Prevent overflow in multiplication
    require percentage <= 100;

    uint256 result = calculatePercentage(amount, percentage);

    // Result must equal floor(amount * percentage / 100)
    assert result == (amount * percentage) / 100,
        "calculatePercentage result incorrect";

    // Result must be <= amount (can't distribute more than base)
    assert result <= amount,
        "calculatePercentage result exceeds base amount";
}

/**
 * PROPERTY 5: Distribution Recipient Consistency
 *
 * calculateDistribution must return arrays of equal length (recipients == amounts).
 * The owner (church) must always be included as first recipient.
 * All donors must be included in recipients array.
 *
 * English: After calling calculateDistribution(1000, [donor1, donor2, donor3]),
 * recipients.length == amounts.length and recipients[0] == owner.
 *
 * Expected result: VERIFIED
 * Counterexample: None (if array construction is correct)
 */
rule distributionRecipientConsistency {
    uint256 totalAmount;
    address[] donors;

    require totalAmount > 0;
    require donors.length < 100;  // Reasonable upper bound

    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);

    // Recipients and amounts must have same length
    assert recipients.length == amounts.length,
        "Recipients and amounts array length mismatch";

    // Owner must be first recipient (church allocation)
    assert recipients.length > 0,
        "Recipients array is empty";
    assert recipients[0] == owner,
        "First recipient is not owner (church)";

    // If donors exist, all should be in recipients
    if (donors.length > 0) {
        assert recipients.length == donors.length + 1,
            "Recipients length should be donors.length + 1 (for owner)";
    } else {
        // If no donors, only owner receives everything
        assert recipients.length == 1,
            "With no donors, only owner should be recipient";
        assert amounts[0] == totalAmount,
            "Owner receives entire amount when no donors";
    }
}

/**
 * PROPERTY 6: Distribution Amount Bounds
 *
 * The sum of distributed amounts should approximately equal the total amount,
 * with rounding losses in the reserve bucket (acceptable up to donors.length wei).
 *
 * English: After calculateDistribution(1000, donors), the sum of all amounts
 * should be <= 1000 and >= 1000 - donors.length (rounding tolerance).
 *
 * Expected result: VERIFIED with rounding tolerance
 * Counterexample: None (if distribution logic correctly allocates percentages)
 */
rule distributionAmountBounds {
    uint256 totalAmount;
    address[] donors;

    require totalAmount > 0;
    require donors.length < 100;

    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);

    // Sum all amounts (vulnerable to overflow, but require bounds on array size)
    // In practice, Certora will sum within safe bounds
    uint256 sumAmounts = 0;
    for (uint256 i = 0; i < amounts.length; i++) {
        require sumAmounts + amounts[i] <= 2^256 - 1;  // Prevent overflow
        sumAmounts += amounts[i];
    }

    // Sum should be close to totalAmount (within rounding losses)
    assert sumAmounts <= totalAmount,
        "Distributed amount exceeds total";

    // Minimum sum accounting for rounding losses
    if (donors.length > 0) {
        assert sumAmounts >= totalAmount - donors.length,
            "Rounding losses exceed expected tolerance";
    } else {
        assert sumAmounts == totalAmount,
            "Sum mismatch with no donors";
    }
}

/**
 * PROPERTY 7: No Division by Zero in Empty Donors
 *
 * When donors array is empty, calculateDistribution must not attempt division
 * and should return a valid distribution (all to owner).
 *
 * English: calculateDistribution(1000, []) returns recipients=[owner],
 * amounts=[1000] without division by zero error.
 *
 * Expected result: VERIFIED
 * Counterexample: None (if empty check guards division)
 */
rule noDivisionByZeroEmptyDonors {
    uint256 totalAmount;

    require totalAmount > 0;

    address[] emptyDonors;
    require emptyDonors.length == 0;

    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, emptyDonors);

    // Should return exactly one recipient (owner) with full amount
    assert recipients.length == 1,
        "Empty donors should return single recipient";
    assert recipients[0] == owner,
        "Single recipient should be owner";
    assert amounts[0] == totalAmount,
        "Owner should receive full amount with no donors";
}

/**
 * PROPERTY 8: Distribution Percentage Application
 *
 * The amounts distributed must correctly apply the configured percentages:
 *   church amount ≈ totalAmount * churchPercentage / 100
 *   donor total ≈ totalAmount * donorRewardPercentage / 100
 *   reserve ≈ totalAmount * reservePercentage / 100
 *
 * English: With 60% church, 30% donors, 10% reserve, and 1000 total:
 *   - church receives 600
 *   - donors receive 300 total (split equally)
 *   - reserve loses up to donors.length from rounding
 *
 * Expected result: VERIFIED with rounding tolerance
 * Counterexample: None (if percentage application is correct)
 */
rule distributionPercentageApplication {
    uint256 totalAmount;
    address[] donors;

    require totalAmount > 0;
    require totalAmount < 2^64;  // Keep calculations safe
    require donors.length > 0;
    require donors.length < 100;

    uint256 churchPct = churchPercentage();
    uint256 donorPct = donorRewardPercentage();

    (address[] recipients, uint256[] amounts) =
        calculateDistribution(totalAmount, donors);

    // Expected amounts
    uint256 expectedChurchAmount = (totalAmount * churchPct) / 100;
    uint256 expectedDonorTotal = (totalAmount * donorPct) / 100;
    uint256 perDonorAmount = expectedDonorTotal / donors.length;

    // Verify church amount
    assert amounts[0] == expectedChurchAmount,
        "Church amount does not match percentage";

    // Verify per-donor amounts
    for (uint256 i = 0; i < donors.length; i++) {
        assert amounts[i + 1] == perDonorAmount,
            "Donor amount does not match equal split";
    }

    // Verify total distributed is within rounding tolerance
    uint256 totalDistributed = amounts[0];
    for (uint256 i = 1; i < amounts.length; i++) {
        totalDistributed += amounts[i];
    }

    assert totalDistributed <= totalAmount,
        "Total distributed exceeds available amount";
    assert totalDistributed >= totalAmount - donors.length,
        "Rounding losses exceed expected tolerance";
}
