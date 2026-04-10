// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @dev Interface for Gnosis Safe multisig wallet
 */
interface IGnosisSafe {
    /**
     * @dev Executes a transaction through the Gnosis Safe
     * @param to Destination address
     * @param value ETH value to send
     * @param data Encoded function call
     * @param operation Operation type (0: CALL, 1: DELEGATECALL)
     * @param safeTxGas Gas limit for the transaction
     * @param baseGas Gas overhead
     * @param gasPrice Gas price to use
     * @param gasToken Token to reimburse gas in (0 = ETH)
     * @param refundReceiver Address to receive gas reimbursement
     * @param signatures Packed signatures from owners
     */
    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool success);

    /**
     * @dev Get list of owners
     */
    function getOwners() external view returns (address[] memory);

    /**
     * @dev Check if address is an owner
     */
    function isOwner(address owner) external view returns (bool);

    /**
     * @dev Get owner count
     */
    function getOwnerCount() external view returns (uint256);

    /**
     * @dev Get required number of confirmations
     */
    function getThreshold() external view returns (uint256);
}
