// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Interface for Aave Lending Pool interactions
 */
interface IAave {
    /**
     * @dev Deposit tokens into Aave pool to earn yield
     * @param asset The token address to deposit
     * @param amount The amount to deposit
     * @param onBehalfOf The address to receive aTokens
     * @param referralCode Referral code
     */
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @dev Withdraw tokens from Aave pool
     * @param asset The token to withdraw
     * @param amount The amount to withdraw
     * @param to The destination address
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @dev Get user account data
     */
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

/**
 * @dev Interface for Aave aToken (interest-bearing token)
 */
interface IAToken {
    /**
     * @dev Get the balance of aTokens
     */
    function balanceOf(address user) external view returns (uint256);

    /**
     * @dev Approve spending of aTokens
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Get underlying asset address
     */
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
