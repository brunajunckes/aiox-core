// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAave.sol";
import "./interfaces/IGnosisSafe.sol";
import "./DistributionLogic.sol";

/**
 * @title Chiesa
 * @notice Main vault contract for Igreja nas Casas Web3 Church Platform
 * @dev Manages donations, yield farming via Aave, and distribution logic
 */
contract Chiesa is Ownable, ReentrancyGuard, Pausable {
    // ============ State Variables ============

    IERC20 public usdc;
    IAave public aavePool;
    IGnosisSafe public gnosisSafe;
    DistributionLogic public distributionLogic;

    uint256 public totalDonations;
    uint256 public totalYieldGenerated;
    uint256 public yieldDistributedToChurch;

    // Donation tracking
    mapping(address => uint256) public donationsByUser;
    mapping(address => uint256) public lastDonationTime;

    address[] public donors;
    mapping(address => bool) private isDonor;

    // ============ Events ============

    event DonationReceived(address indexed donor, uint256 amount, uint256 timestamp);
    event YieldDistributed(uint256 amount, address indexed recipient, uint256 timestamp);
    event WithdrawalExecuted(address indexed recipient, uint256 amount, uint256 timestamp);

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _aavePool,
        address _gnosisSafe,
        address _distributionLogic
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_aavePool != address(0), "Invalid Aave pool address");
        require(_gnosisSafe != address(0), "Invalid Gnosis Safe address");
        require(_distributionLogic != address(0), "Invalid distribution logic address");

        usdc = IERC20(_usdc);
        aavePool = IAave(_aavePool);
        gnosisSafe = IGnosisSafe(_gnosisSafe);
        distributionLogic = DistributionLogic(_distributionLogic);
    }

    // ============ Donation Functions ============

    /**
     * @notice Receive donations in USDC
     * @param amount Amount of USDC to donate
     */
    function donate(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        if (!isDonor[msg.sender]) {
            isDonor[msg.sender] = true;
            donors.push(msg.sender);
        }

        donationsByUser[msg.sender] += amount;
        lastDonationTime[msg.sender] = block.timestamp;
        totalDonations += amount;

        emit DonationReceived(msg.sender, amount, block.timestamp);
    }

    // ============ Yield Management ============

    /**
     * @notice Deposit USDC into Aave to earn yield
     * @param amount Amount to deposit
     */
    function depositToAave(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.approve(address(aavePool), amount), "Approval failed");

        aavePool.deposit(address(usdc), amount, address(this), 0);
    }

    /**
     * @notice Withdraw yield from Aave
     * @param amount Amount to withdraw
     */
    function withdrawYield(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        uint256 withdrawn = aavePool.withdraw(address(usdc), amount, address(this));
        require(withdrawn > 0, "Withdrawal failed");

        totalYieldGenerated += withdrawn;
    }

    // ============ Distribution Functions ============

    /**
     * @notice Distribute yield according to distribution logic
     */
    function distributeYield() external onlyOwner nonReentrant {
        uint256 availableBalance = usdc.balanceOf(address(this));
        require(availableBalance > 0, "No balance to distribute");

        (address[] memory recipients, uint256[] memory amounts) =
            distributionLogic.calculateDistribution(availableBalance, donors);

        for (uint256 i = 0; i < recipients.length; i++) {
            require(usdc.transfer(recipients[i], amounts[i]), "Transfer failed");
            yieldDistributedToChurch += amounts[i];
            emit YieldDistributed(amounts[i], recipients[i], block.timestamp);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get list of all donors
     */
    function getDonors() external view returns (address[] memory) {
        return donors;
    }

    /**
     * @notice Get donor count
     */
    function getDonorCount() external view returns (uint256) {
        return donors.length;
    }

    /**
     * @notice Get user donation history
     */
    function getUserDonation(address user) external view returns (uint256) {
        return donationsByUser[user];
    }

    // ============ Admin Functions ============

    /**
     * @notice Pause contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
