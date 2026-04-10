// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DistributionLogic
 * @notice Handles yield distribution logic for Chiesa vault
 * @dev Calculates distribution based on donation amounts and timestamps
 */
contract DistributionLogic {
    // ============ Constants ============

    uint256 public constant PRECISION = 1e18;
    uint256 public constant MIN_DONATION = 1e6; // 1 USDC

    // ============ Distribution Configuration ============

    uint256 public churchPercentage = 60; // 60% to church operations
    uint256 public donorRewardPercentage = 30; // 30% back to donors
    uint256 public reservePercentage = 10; // 10% reserve

    address public owner;

    // ============ Events ============

    event DistributionConfigUpdated(uint256 church, uint256 donors, uint256 reserve);

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Distribution Calculation ============

    /**
     * @notice Calculate distribution amounts for recipients
     * @param totalAmount Total amount to distribute
     * @param donors Array of donor addresses
     * @return recipients Distribution recipients
     * @return amounts Amounts for each recipient
     */
    function calculateDistribution(uint256 totalAmount, address[] calldata donors)
        external
        view
        returns (address[] memory recipients, uint256[] memory amounts)
    {
        // Guard against empty donors array - prevent division by zero
        if (donors.length == 0) {
            recipients = new address[](1);
            amounts = new uint256[](1);
            recipients[0] = owner;
            amounts[0] = totalAmount;
            return (recipients, amounts);
        }

        // For now, simple distribution: 60% church, 30% donor rewards, 10% reserve
        uint256 churchAmount = (totalAmount * churchPercentage) / 100;
        uint256 donorRewardAmount = (totalAmount * donorRewardPercentage) / 100;

        recipients = new address[](donors.length + 1);
        amounts = new uint256[](donors.length + 1);

        // Church gets first allocation
        recipients[0] = owner;
        amounts[0] = churchAmount;

        // Remaining distributed to donors equally
        uint256 perDonorAmount = donorRewardAmount / donors.length;

        for (uint256 i = 0; i < donors.length; i++) {
            recipients[i + 1] = donors[i];
            amounts[i + 1] = perDonorAmount;
        }

        return (recipients, amounts);
    }

    /**
     * @notice Calculate percentage of total
     * @param amount Base amount
     * @param percentage Percentage value
     */
    function calculatePercentage(uint256 amount, uint256 percentage)
        public
        pure
        returns (uint256)
    {
        return (amount * percentage) / 100;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update distribution percentages
     */
    function setDistributionPercentages(
        uint256 _church,
        uint256 _donors,
        uint256 _reserve
    ) external {
        require(msg.sender == owner, "Only owner");
        require(_church + _donors + _reserve == 100, "Percentages must sum to 100");

        churchPercentage = _church;
        donorRewardPercentage = _donors;
        reservePercentage = _reserve;

        emit DistributionConfigUpdated(_church, _donors, _reserve);
    }
}
