// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockAave
 * @notice Mock Aave lending pool for testing
 */
contract MockAave {
    mapping(address => mapping(address => uint256)) public balances;

    event Deposit(address indexed asset, uint256 amount, address indexed onBehalfOf);
    event Withdraw(address indexed asset, uint256 amount, address indexed to);

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        // Mock: just track balance
        balances[onBehalfOf][asset] += amount;
        emit Deposit(asset, amount, onBehalfOf);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(balances[msg.sender][asset] >= amount, "Insufficient balance");
        balances[msg.sender][asset] -= amount;
        emit Withdraw(asset, amount, to);
        return amount;
    }

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
        )
    {
        return (1000e18, 0, 500e18, 80, 80, 1e18);
    }
}

/**
 * @title MockToken
 * @notice Mock ERC20 token for testing
 */
contract MockToken is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
    {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * 10 ** uint256(decimals_));
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
