# Smart Contract Security Analysis - Igreja Nas Casas Web3

**Status:** Design Phase (Story 43.1)  
**Last Updated:** 2026-04-10  
**Architect:** Aria (@architect)

---

## I. STRIDE Threat Model

STRIDE framework aplicado aos contratos Igreja e DistributionLogic.

### 1.1 Spoofing (Falsificação de Identidade)

**Threat:** Atacante se passa por owner ou signer válido.

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| SP-001 | Caller falsifies as `owner` | LOW | HIGH | Require msg.sender == owner checks + access modifiers |
| SP-002 | Attacker steals private keys | MEDIUM | CRITICAL | Use Gnosis Safe (M-of-N key distribution) + hardware wallets |
| SP-003 | Signer key compromise | MEDIUM | CRITICAL | Key rotation via Gnosis Safe + multi-sig recovery |

**Controls:**

```solidity
// SP-001: Strict identity verification
modifier onlyOwner() {
    require(msg.sender == owner, "OnlyOwner");
    _;
}

modifier onlyMultiSig() {
    require(msg.sender == address(gnosisSafe), "OnlyMultiSig");
    _;
}

// Event logging for forensics
event UnauthorizedAccess(address indexed attempted, bytes data, uint256 timestamp);
```

---

### 1.2 Tampering (Alteração de Dados)

**Threat:** Atacante modifica saldo, depósitos ou regras sem autorização.

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| TA-001 | Direct state variable write | CRITICAL | CRITICAL | Solidity access control (private/internal) |
| TA-002 | Integer overflow in balance calc | LOW | MEDIUM | Solidity 0.8+ auto-protection |
| TA-003 | Depositor balance manipulation | LOW | HIGH | Immutable record + multi-sig approval |
| TA-004 | Distribution rules altered | MEDIUM | MEDIUM | Multi-sig gate on rule changes |

**Controls:**

```solidity
// TA-001: Strict visibility controls
contract Igreja {
    // Private state - cannot be modified externally
    mapping(address => uint256) private depositors;
    uint256 private totalDeposits;
    
    // Only via functions with checks
    function deposit(...) external onlyOwner nonReentrant {
        depositors[msg.sender] += amount;  // ← Controlled modification
    }
}

// TA-003: Immutable audit trail
event DepositRecord(
    indexed address depositor,
    uint256 amount,
    uint256 blockNumber,
    bytes32 txHash
);

// TA-004: Multi-sig gates
modifier onlyMultiSig() {
    require(msg.sender == address(gnosisSafe), "MultiSigOnly");
    _;
}

function updateDistributionRules(...) external onlyMultiSig {
    // Only Gnosis Safe can change rules (5-of-7 approval)
}
```

---

### 1.3 Repudiation (Negação de Ação)

**Threat:** Ator nega ter feito ação (ex: "Não recebi o dinheiro").

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| RE-001 | Depositor denies deposit | LOW | MEDIUM | Event logs + blockchain record (immutable) |
| RE-002 | Admin denies yield distribution | LOW | MEDIUM | Transaction hash + event logs on IPFS |
| RE-003 | Signer denies approval | LOW | LOW | Gnosis Safe transaction log (on-chain) |

**Controls:**

```solidity
// RE-001: Comprehensive event logging
event DepositReceived(
    indexed address indexed depositor,
    uint256 indexed amount,
    uint256 timestamp,
    bytes32 ipfsHash  // ← Link para prova
);

// RE-002: Store proof on IPFS
// Community can verify: TX hash → Events → IPFS document
struct DistributionRecord {
    uint256 proposalId;
    bytes32 ipfsHash;      // Link para PDF/doc assinado
    address[] signers;     // Quem assinou
    uint256[] timestamps;  // Quando
    bytes[] signatures;    // Assinaturas criptográficas
}

// RE-003: Gnosis Safe logs all actions
// Available at: Safe.gnosis.io/{chainId}/{safeAddress}
```

---

### 1.4 Information Disclosure (Vazamento de Dados)

**Threat:** Dados sensíveis (balances, regras) são expostos.

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| ID-001 | Individual balances exposed | MEDIUM | MEDIUM | Private mapping + selective view (only owner) |
| ID-002 | Yield farming strategy leaked | MEDIUM | LOW | Strategy change via multi-sig (no privacy needed) |
| ID-003 | Signer identities exposed | MEDIUM | LOW | Use Safe.gnosis.io (official interface) |

**Controls:**

```solidity
// ID-001: Balance visibility control
contract Igreja {
    mapping(address => uint256) private depositors;  // ← Private
    
    // Only owner/donor can see their own balance
    function getBalance(address depositor) external view returns (uint256) {
        require(msg.sender == owner || msg.sender == depositor, "NotAuthorized");
        return depositors[depositor];
    }
    
    // Public only for aggregates
    function getTotalDeposits() external view returns (uint256) {
        return totalDeposits;
    }
}

// ID-002: Strategy is public (nothing to hide)
// All rules and decisions published on IPFS
```

---

### 1.5 Denial of Service (Negação de Serviço)

**Threat:** Atacante torna contratos inutilizáveis.

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| DO-001 | Infinite loop in distribution | MEDIUM | HIGH | Upper limit on recipients (e.g., max 10) |
| DO-002 | Out of gas on large arrays | MEDIUM | HIGH | Paginate operations, batch limits |
| DO-003 | Revert bomb (always fail) | LOW | MEDIUM | Fallback to emergency withdraw |
| DO-004 | Pause via exploit | MEDIUM | MEDIUM | Graceful degradation + pause mechanism |

**Controls:**

```solidity
// DO-001: Batch size limits
function batchWithdraw(
    address[] calldata recipients,
    uint256[] calldata amounts
) external onlyOwner nonReentrant {
    require(recipients.length <= 10, "MaxBatchSize: 10");
    require(recipients.length == amounts.length, "LengthMismatch");
    
    for (uint i = 0; i < recipients.length; i++) {
        require(usdc.transfer(recipients[i], amounts[i]), "TransferFailed");
    }
}

// DO-002: Paginated withdrawals
function withdrawPage(
    uint256 page,
    uint256 pageSize
) external view returns (address[] memory, uint256[] memory) {
    require(pageSize <= 50, "MaxPageSize: 50");
    // Return only requested page
}

// DO-003: Emergency withdraw bypass
modifier emergencyPause() {
    if (paused) return;  // Continue even if paused
    _;
}

function emergencyWithdraw(uint256 amount) external onlyOwner emergencyPause {
    require(usdc.transfer(owner, amount), "Transfer failed");
}

// DO-004: Pause mechanism
bool public paused = false;

modifier whenNotPaused() {
    require(!paused, "ContractPaused");
    _;
}

function pause() external onlyOwner {
    paused = true;
    emit Paused(block.timestamp);
}

function unpause() external onlyMultiSig {
    paused = false;
    emit Unpaused(block.timestamp);
}
```

---

### 1.6 Elevation of Privilege (Elevação de Privilégio)

**Threat:** Atacante ganha privilégios não autorizados.

| Threat ID | Description | Likelihood | Impact | Mitigation |
|-----------|-------------|------------|--------|-----------|
| EP-001 | Non-owner modifies balance | CRITICAL | CRITICAL | Strict access modifiers + tests |
| EP-002 | Non-multisig executes distribution | CRITICAL | CRITICAL | Hardcoded gnosisSafe address check |
| EP-003 | Contract upgraded to malicious code | MEDIUM | CRITICAL | Use transparent proxy or immutable core |

**Controls:**

```solidity
// EP-001: Immutable access control
modifier onlyOwner() {
    require(msg.sender == owner, "OnlyOwner");
    _;
}

// EP-002: Hardcoded multi-sig address (after testnet verification)
address public constant GNOSIS_SAFE = 0x...;  // ← immutable after deployment

modifier onlyMultiSig() {
    require(msg.sender == GNOSIS_SAFE, "OnlyGnosisSafe");
    _;
}

// EP-003: Proxy pattern with timelock
// Contract can be upgraded, but with 48-hour delay + multi-sig
contract IGlejaProxy is TransparentUpgradeableProxy {
    // Multi-sig as admin
}
```

---

## II. Common Smart Contract Vulnerabilities (OWASP Top 10)

### 2.1 Reentrancy (HIGH)

**Attack Vector:** Nested call modifies state unexpectedly.

```solidity
// VULNERABLE
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    
    (bool success, ) = msg.sender.call{value: amount}("");  // ← Callback!
    require(success);
    
    balances[msg.sender] -= amount;  // ← Too late!
}

// Attacker's fallback() {
//   withdraw() again → re-enter → drain all funds
// }
```

**Mitigation:**

```solidity
function withdraw(uint256 amount) external nonReentrant {
    require(depositors[msg.sender] >= amount);
    
    // EFFECTS first
    depositors[msg.sender] -= amount;
    totalDeposits -= amount;
    
    // INTERACTIONS last
    require(usdc.transfer(msg.sender, amount), "Transfer failed");
}
```

**Status:** PROTECTED (nonReentrant guard)

---

### 2.2 Arithmetic Under/Overflow (LOW in 0.8+)

**Attack Vector:** Integer wraps around.

```solidity
// VULNERABLE (Solidity < 0.8)
uint8 x = 255;
x += 1;  // ← wraps to 0
```

**Mitigation:** Solidity 0.8.0+ has automatic checks.

```solidity
pragma solidity 0.8.20;  // ← Automatic revert on overflow

uint256 totalDeposits = type(uint256).max;
totalDeposits += 1;  // ← Reverts automatically
```

**Status:** PROTECTED (Solidity 0.8.20)

---

### 2.3 Unchecked External Calls (MEDIUM)

**Attack Vector:** External call fails silently.

```solidity
// VULNERABLE
usdc.transfer(recipient, amount);  // ← Return value ignored!

// SAFE
require(usdc.transfer(recipient, amount), "Transfer failed");
```

**Mitigation:**

```solidity
// Always check return values
bool success = usdc.transfer(recipient, amount);
require(success, "Transfer failed");

// Or use low-level call with proper error handling
(bool success, bytes memory data) = usdc.call(
    abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
);
require(success, "Transfer failed");
```

**Status:** PROTECTED (all transfers use require)

---

### 2.4 Delegatecall Injection (CRITICAL)

**Attack Vector:** Malicious delegatecall to attacker code.

```solidity
// VULNERABLE
(bool success, ) = attackerAddress.delegatecall(data);  // ← Don't do this!
```

**Mitigation:**

```solidity
// RULE: Never use delegatecall with untrusted input
// Use staticcall or call for external contracts
(bool success, ) = usdc.call(abi.encodeWithSignature(...));
```

**Status:** NOT VULNERABLE (no delegatecall in design)

---

### 2.5 Front-Running (MEDIUM)

**Attack Vector:** Attacker observes mempool TX, submits front-running TX with higher gas.

```
Victim submits: withdrawYield(1000 USDC)
Attacker sees in mempool
Attacker submits: harvestYield() with higher gas
Block:
  - Attacker's harvestYield() executes first
  - No yield left for victim
  - Victim's withdraw fails
```

**Mitigation for Sensitive Ops:**

```solidity
// Commit-Reveal pattern for critical withdrawals
function commitWithdrawal(bytes32 commitment) external {
    require(commitments[msg.sender] == bytes32(0), "Pending");
    commitments[msg.sender] = commitment;
}

function revealWithdrawal(uint256 amount, string calldata proof) 
    external 
    nonReentrant 
{
    bytes32 commitment = keccak256(abi.encodePacked(amount, proof));
    require(commitments[msg.sender] == commitment, "InvalidProof");
    require(block.timestamp >= commitmentTime[msg.sender] + 2 blocks, "TooSoon");
    
    // Execute
}
```

**Status:** LOW RISK (yield distribution not time-sensitive; distribution is multi-sig approved)

---

### 2.6 Timestamp Dependence (LOW)

**Attack Vector:** Attacker influences block.timestamp for time-locks.

```solidity
// VULNERABLE
require(block.timestamp >= unlockTime, "Locked");
```

**Mitigation:**

```solidity
// Use block height for critical delays
require(block.number >= unlockBlock + DELAY_BLOCKS, "TooSoon");

// Or reasonable time delays (24-72 hours)
require(block.timestamp >= createdAt + 24 hours, "TooSoon");
```

**Status:** PROTECTED (use block.number for Gnosis Safe delays)

---

### 2.7 Malicious Fallback (LOW)

**Attack Vector:** External contract's fallback() does unexpected work.

```solidity
// SAFE: We only use USDC (audited token)
// USDC has no fallback, only functions
usdc.transfer(recipient, amount);

// NOT VULNERABLE because:
// - USDC is ERC20 standard (audited)
// - No fallback function in USDC
// - transfer() returns bool (no payload)
```

**Status:** SAFE (only interact with known, audited tokens)

---

### 2.8 Access Control (HIGH)

**Attack Vector:** Functions callable by anyone.

```solidity
// VULNERABLE
function withdraw(uint256 amount) external {
    usdc.transfer(msg.sender, amount);  // ← Anyone can call!
}

// SAFE
function withdraw(uint256 amount) external onlyOwner nonReentrant {
    require(depositors[msg.sender] >= amount);
    depositors[msg.sender] -= amount;
    require(usdc.transfer(msg.sender, amount));
}
```

**Status:** PROTECTED (all critical functions have access modifiers)

---

### 2.9 Bad Randomness (LOW)

**Attack Vector:** Use block properties for randomness.

```solidity
// VULNERABLE
uint random = uint(blockhash(block.number - 1)) % 100;
```

**Mitigation:** We don't use randomness in distribution logic.

**Status:** NOT APPLICABLE (no randomness needed)

---

### 2.10 Unchecked Low-Level Calls (HIGH)

**Attack Vector:** .call() doesn't check return value.

```solidity
// VULNERABLE
(bool success, ) = recipient.call{value: amount}("");
// Success is ignored!

// SAFE
(bool success, ) = recipient.call{value: amount}("");
require(success, "Call failed");
```

**Status:** PROTECTED (all calls use require)

---

## III. Formal Verification Strategy

### 3.1 Certora Formal Proofs

**Objective:** Mathematically verify critical properties.

**Key Properties to Prove:**

```gherkin
# Property 1: Total deposits conservation
rule depositConservation {
    env e;
    
    uint256 balanceBefore = getTotalDeposits();
    deposit(_, amount);
    uint256 balanceAfter = getTotalDeposits();
    
    assert(balanceAfter == balanceBefore + amount, "Deposit not recorded");
}

# Property 2: No unauthorized balance increase
rule noUnauthorizedDeposit {
    env e;
    
    address depositor;
    uint256 balanceBefore = depositors[depositor];
    
    calldatafun(e);
    
    uint256 balanceAfter = depositors[depositor];
    
    if (balanceAfter > balanceBefore) {
        assert(e.msg.sender == owner, "Unauthorized increase");
    }
}

# Property 3: Withdrawal only decreases balance
rule withdrawalValid {
    env e;
    
    address depositor;
    uint256 amount;
    uint256 balanceBefore = depositors[depositor];
    
    withdraw(depositor, amount);
    
    uint256 balanceAfter = depositors[depositor];
    
    assert(balanceAfter == balanceBefore - amount, "Invalid withdrawal");
}

# Property 4: Distribution respects approval
rule distributionApprovalGate {
    env e;
    
    uint256 proposalId;
    
    // Can only execute if 5-of-7 approved
    executeDistribution(proposalId);
    
    DistributionProposal proposal = proposals[proposalId];
    assert(proposal.approvals >= 5, "Insufficient approvals");
}
```

**Setup:**

```bash
# Create specs/Igreja.spec (CVL - Certora Verification Language)
# Run:
certoraRun specs/Igreja.conf

# Reports:
# - Verified properties
# - Violations found
# - Coverage metrics
```

---

### 3.2 Slither Static Analysis

**Objective:** Find common vulnerabilities automatically.

**Configuration:**

```yaml
# .slither.yml
detectors:
  - reentrancy
  - timestamp-dependence
  - unchecked-calls
  - incorrect-equality
  - shadowing-state

export-json: slither-report.json
exclude-paths: node_modules,test
```

**Run:**

```bash
slither . --json slither-report.json

# Outputs:
# - High: critical vulnerabilities
# - Medium: significant issues
# - Low: style recommendations
```

**Expected Clean Report:**

```
High: 0
Medium: 0
Low: 0 (or minor style items)
```

---

## IV. Test Coverage Goals

### 4.1 Coverage Targets

| Category | Target | Tool |
|----------|--------|------|
| **Line Coverage** | 95%+ | Istanbul/Hardhat coverage |
| **Branch Coverage** | 90%+ | Same |
| **Function Coverage** | 100% | Same |

### 4.2 Test Categories

```javascript
describe("Chiesa.sol", () => {
  describe("Deposits", () => {
    it("should accept valid deposit", () => { ... });
    it("should reject zero deposit", () => { ... });
    it("should track depositor balance", () => { ... });
    it("should prevent replay attacks", () => { ... });
    it("should emit event on deposit", () => { ... });
  });
  
  describe("Withdrawals", () => {
    it("should allow valid withdrawal", () => { ... });
    it("should reject overdraw", () => { ... });
    it("should prevent reentrancy", () => { ... });
    it("should transfer correct amount", () => { ... });
  });
  
  describe("Yield", () => {
    it("should harvest yield from Aave", () => { ... });
    it("should calculate yield correctly", () => { ... });
    it("should handle failed Aave calls", () => { ... });
  });
  
  describe("Security", () => {
    it("should prevent unauthorized deposit", () => { ... });
    it("should reject calls from non-owner", () => { ... });
    it("should verify multi-sig for critical ops", () => { ... });
  });
});
```

---

## V. Audit Checklist (Pre-Launch)

- [ ] All functions have access control checks
- [ ] No unchecked external calls
- [ ] No reentrancy vulnerabilities
- [ ] No arithmetic overflow/underflow
- [ ] Events emitted for all state changes
- [ ] Natspec comments on all public functions
- [ ] Test coverage >= 95%
- [ ] Slither report: 0 High/Medium
- [ ] Certora formal proofs: All pass
- [ ] Code review: 2+ independent reviewers
- [ ] Gas optimization: No excessive costs
- [ ] Emergency procedures documented
- [ ] Disaster recovery plan written
- [ ] Deployment script tested on testnet
- [ ] Multisig tested with real Gnosis Safe
- [ ] Aave integration tested on Polygon Mumbai
- [ ] Security audit by reputable firm (optional for Phase 1)

---

## VI. Incident Response Plan

**If vulnerability discovered:**

1. **Pause contract immediately**
   ```solidity
   paused = true;  // Only multi-sig can unpause
   ```

2. **Emergency withdrawal available**
   ```solidity
   function emergencyWithdraw(uint256 amount) external onlyOwner {
       require(usdc.transfer(owner, amount));
   }
   ```

3. **Communicate with community**
   - Post on Igreja website
   - Email all depositors
   - Provide recovery steps

4. **Upgrade contract** (if using proxy)
   - Fix bug in new implementation
   - Multi-sig approves upgrade
   - Deploy new contract version

5. **Post-mortem**
   - Document incident
   - Analyze root cause
   - Implement new tests
   - Update threat model

---

## VII. Risk Summary

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|-----------|
| Reentrancy | HIGH | LOW | nonReentrant guard |
| Unauthorized access | HIGH | LOW | strict modifiers + multi-sig |
| Arithmetic errors | MEDIUM | LOW | Solidity 0.8.20 |
| Front-running | MEDIUM | MEDIUM | No time-sensitive ops; multi-sig approval |
| Aave protocol failure | HIGH | LOW | Emergency withdraw + backup strategy |
| Signer key compromise | CRITICAL | MEDIUM | Hardware wallet + key rotation |
| Smart contract bug | MEDIUM | LOW | Formal verification + audits |

**Overall Security Posture:** MEDIUM-HIGH (with proper testing and audit)

---

## VIII. Continuous Security

**Post-Deployment:**

1. **Monitor for suspicious activity**
   - Fund flow anomalies
   - Unusual access patterns
   - Gas-intensive operations

2. **Regular code audits**
   - Annual professional audit
   - Community security reviews
   - Bug bounty program

3. **Keep dependencies updated**
   - OpenZeppelin Contracts updates
   - Solidity compiler patches
   - Hardhat framework updates

4. **User education**
   - Security best practices
   - How to verify blockchain data
   - Phishing awareness

---

**Next:** @qa designs test suite (Story 43.3). @dev implements + tests (Story 43.2).

