# Smart Contract Architecture - Igreja Nas Casas Web3

**Status:** Design Phase (Story 43.1)  
**Last Updated:** 2026-04-10  
**Architect:** Aria (@architect)

---

## I. Executive Overview

A Igreja Nas Casas Web3 necessita de um sistema de contratos inteligentes que:

1. **Armazene depósitos comunitários** com segurança e transparência
2. **Distribua renda de yield farming** de forma automática e auditável
3. **Implemente governança descentralizada** via multi-assinatura (5-of-7)
4. **Maximize retorno** através de farming em Aave V3 (Polygon)
5. **Proteja contra ataques comuns** (reentrancy, overflow, front-running)

**Stack Tecnológico:**
- **Blockchain:** Polygon (Layer 2, low-cost, EVM-compatible)
- **Lending Protocol:** Aave V3 (battle-tested, security audited)
- **Wallet Governance:** Gnosis Safe (institutional-grade multi-sig)
- **Development:** Hardhat + OpenZeppelin Contracts v4.9+
- **Verification:** Solidity 0.8.20 (latest security patches)

---

## II. Core Contract Architecture

### 2.1 Igreja.sol — Main Vault Contract

**Purpose:** Central hub para depósitos, resgates e gerenciamento de yield.

**Responsabilidades:**
- Aceitar depósitos em USDC/USDT (stablecoins)
- Manter registro de balanço por doador
- Executar resgates com segurança
- Delegar farmagem para DistributionLogic
- Emitir eventos auditáveis

**Diagram:**

```
┌─────────────────────────────────────┐
│        Igreja.sol (Vault)           │
├─────────────────────────────────────┤
│ State Variables:                    │
│  - owner: address (Gnosis Safe)     │
│  - usdc: IERC20 (token)             │
│  - totalDeposits: uint256           │
│  - depositors: mapping[addr→uint]   │
│  - distributionLogic: address       │
│                                     │
│ Functions:                          │
│  - deposit(amount) → uint           │
│  - withdraw(amount) → bool          │
│  - getBalance(depositor) → uint     │
│  - getTotalDeposits() → uint        │
│  - harvestYield() → uint            │
└─────────────────────────────────────┘
         ↓ delegates to
┌─────────────────────────────────────┐
│  DistributionLogic.sol              │
│  (yield farming + distribution)     │
└─────────────────────────────────────┘
         ↓ calls
┌─────────────────────────────────────┐
│  Aave V3 LendingPool                │
│  (yield generation)                 │
└─────────────────────────────────────┘
```

**Key Functions:**

```solidity
// Depósito com registro de doador
function deposit(
    address depositor,
    uint256 amount,
    string memory donorName
) external onlyOwner nonReentrant returns (uint256 depositId) {
    require(amount > 0, "Amount must be > 0");
    require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    
    depositors[depositor] += amount;
    totalDeposits += amount;
    
    emit DepositReceived(depositor, amount, block.timestamp, depositId);
}

// Resgate seguro com verificação de saldo
function withdraw(
    address depositor,
    uint256 amount
) external onlyOwner nonReentrant returns (bool) {
    require(depositors[depositor] >= amount, "Insufficient balance");
    
    depositors[depositor] -= amount;
    totalDeposits -= amount;
    
    require(usdc.transfer(depositor, amount), "Transfer failed");
    emit Withdrawal(depositor, amount, block.timestamp);
    return true;
}

// Coleta yield de Aave
function harvestYield() external onlyOwner nonReentrant returns (uint256 yieldAmount) {
    uint256 aaveBalance = aUsdc.balanceOf(address(this));
    uint256 currentValue = aaveBalance; // aUsdc 1:1 com USDC
    yieldAmount = currentValue - totalDeposits;
    
    require(yieldAmount > 0, "No yield to harvest");
    emit YieldHarvested(yieldAmount, block.timestamp);
}
```

---

### 2.2 DistributionLogic.sol — Yield Distribution Engine

**Purpose:** Implementar regras de distribuição de yield com multi-sig approval.

**Responsabilidades:**
- Armazenar regras de distribuição (percentuais, destinatários)
- Exigir aprovação multi-assinatura (5-of-7) para mudanças
- Calcular distribuição proporcionalmente aos depósitos
- Emitir comprovantes de distribuição (events + logs)

**Distribution Rules (Exemplo):**

```
Total Yield = 100 USDC

Distribuição (propostos):
├── 50% → Desenvolvimento de Software (Equipamento)
├── 25% → Salários de Liderança
├── 15% → Manutenção de Infraestrutura
└── 10% → Fundo de Emergência

Approval Workflow:
┌────────────────┐
│ Proposição     │ (1 Signer: Líder Tech)
└────────┬───────┘
         ↓
┌────────────────┐
│ Votação 5-of-7 │ (Gnosis Safe)
└────────┬───────┘
         ↓
┌────────────────┐
│ Execução       │ (Automática após confirmação)
└────────────────┘
```

**Key Functions:**

```solidity
// Proposição de distribuição
struct DistributionProposal {
    uint256 id;
    address[] recipients;
    uint256[] amounts;
    string[] purposes;
    uint256 totalAmount;
    bytes32 ipfsHash; // Link para documentação completa
    uint256 createdAt;
    uint256 approvals;
    mapping(address => bool) hasApproved;
    bool executed;
}

// Propor nova distribuição
function proposeDistribution(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string[] calldata purposes,
    bytes32 ipfsHash
) external onlyOwner returns (uint256 proposalId) {
    require(recipients.length == amounts.length, "Length mismatch");
    require(recipients.length <= 10, "Max 10 recipients");
    
    uint256 total = 0;
    for (uint i = 0; i < amounts.length; i++) {
        total += amounts[i];
    }
    require(total <= getAvailableYield(), "Insufficient yield");
    
    DistributionProposal storage proposal = proposals[++proposalCounter];
    // ... populate fields
    
    emit DistributionProposed(proposalId, total, ipfsHash, block.timestamp);
    return proposalId;
}

// Aprovar via multi-sig (executado por Gnosis Safe)
function approveDistribution(uint256 proposalId) external onlyMultiSig {
    DistributionProposal storage proposal = proposals[proposalId];
    require(!proposal.executed, "Already executed");
    
    proposal.approvals++;
    proposal.hasApproved[msg.sender] = true;
    
    if (proposal.approvals >= REQUIRED_APPROVALS) {
        executeDistribution(proposalId);
    }
}

// Executar distribuição aprovada
function executeDistribution(uint256 proposalId) internal {
    DistributionProposal storage proposal = proposals[proposalId];
    require(proposal.approvals >= REQUIRED_APPROVALS, "Insufficient approvals");
    
    for (uint i = 0; i < proposal.recipients.length; i++) {
        require(
            usdc.transfer(proposal.recipients[i], proposal.amounts[i]),
            "Transfer failed"
        );
    }
    
    proposal.executed = true;
    emit DistributionExecuted(proposalId, block.timestamp);
}
```

---

### 2.3 Aave V3 Integration

**Strategy:** Depositar USDC em Aave V3 Polygon para gerar yield.

**Flow:**

```
1. Receber USDC em Igreja.sol
   ↓
2. Aprovar saldo para Aave LendingPool
   ↓
3. Depositar em Aave (receber aUSDC 1:1)
   ↓
4. aUSDC acumula rendimento (variável ou estável)
   ↓
5. Sacar USDC + Yield quando necessário
```

**Contract Integrations:**

```solidity
interface IAaveLendingPool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

interface IAToken {
    function balanceOf(address user) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

// Em Igreja.sol:
function depositInAave(uint256 amount) internal {
    // Aprovar USDC para Aave
    usdc.approve(address(aaveLendingPool), amount);
    
    // Depositar em Aave
    aaveLendingPool.supply(
        address(usdc),
        amount,
        address(this), // onBehalfOf
        0 // referralCode
    );
    
    emit AaveDeposit(amount, block.timestamp);
}

function withdrawFromAave(uint256 amount) internal returns (uint256) {
    uint256 withdrawn = aaveLendingPool.withdraw(
        address(usdc),
        amount,
        address(this)
    );
    
    emit AaveWithdrawal(withdrawn, block.timestamp);
    return withdrawn;
}
```

**Yield Farming Strategy:**
- **Asset Pool:** USDC (alta liquidez, low volatility)
- **Mode:** Interest-bearing (stablecoin yield)
- **Expected APY:** 3-7% (varia com condições de mercado)
- **Risk Profile:** Low (AAA-rated stablecoin, battle-tested protocol)

---

### 2.4 Gnosis Safe Integration (Multi-Signature Governance)

**Configuration:** 5-of-7 Signers

**Signers (Proposto):**

```
1. Líder Espiritual (João)
2. Coordenador Financeiro (Maria)
3. Desenvolvedor Principal (Gage)
4. Auditor Externo (Firma Certificada)
5. Representante Comunitário (Pedro)
6. Suplente 1 (Ana)
7. Suplente 2 (Carlos)

Quórum: 5 de 7 (71%)
Timeout: 72 horas para execução
Delay: 24 horas após aprovação
```

**Functions Protected by Multi-Sig:**

```solidity
modifier onlyMultiSig() {
    require(msg.sender == address(gnosisSafe), "Only Gnosis Safe");
    _;
}

// Funções que requerem multi-sig:
- updateDistributionRules(...)      // Mudar % de distribuição
- changeAavePool(...)                // Mudar estratégia de yield
- emergencyWithdraw(...)             // Sacar fundos de emergência
- upgradePolicies(...)               // Mudar políticas
- removeDeposit(...)                 // Remover depósito (rare)
```

**Workflow de Aprovação:**

```
1. Proposição (qualquer signer inicia)
   Transação com encoded data via ethers.js
   
2. Votação (4 signers adicionais confirmam via Gnosis interface)
   ✓ Signer 1 aprova
   ✓ Signer 2 aprova
   ✓ Signer 3 aprova
   ✓ Signer 4 aprova (quórum alcançado)
   
3. Execução (qualquer signer executa após delay)
   - 24 horas de espera
   - Execução on-chain
   - Eventos emitidos
   - Transparência total
```

---

## III. Security Patterns

### 3.1 Reentrancy Protection

**Attack Vector:** Função maliciosa chama novamente a função original antes de estado ser atualizado.

**Mitigation:**

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Igreja is ReentrancyGuard {
    // Usa padrão Checks-Effects-Interactions
    
    function withdraw(address depositor, uint256 amount) 
        external 
        onlyOwner 
        nonReentrant  // ← Previne reentrancy
        returns (bool) 
    {
        // CHECKS
        require(depositors[depositor] >= amount, "Insufficient");
        
        // EFFECTS (estado antes de interação externa)
        depositors[depositor] -= amount;
        totalDeposits -= amount;
        
        // INTERACTIONS (último)
        require(usdc.transfer(depositor, amount), "Transfer failed");
        
        return true;
    }
}
```

### 3.2 Overflow/Underflow Protection

**Protection:** Solidity 0.8.0+ tem built-in overflow protection.

```solidity
pragma solidity 0.8.20;  // ← Revert automático em overflow

contract Igreja {
    uint256 public totalDeposits; // Revert se ultrapassar uint256.max
    
    function deposit(uint256 amount) external {
        totalDeposits += amount; // Safe: reverte se overflow
    }
}
```

### 3.3 Checks-Effects-Interactions Pattern

**Order:**

```
1. CHECKS (validações)
   - require(condition, "error")
   - Não modifica estado
   
2. EFFECTS (muda estado interno)
   - depositors[addr] -= amount
   - totalDeposits -= amount
   
3. INTERACTIONS (chamadas externas)
   - usdc.transfer(...)
   - aaveLendingPool.supply(...)
```

**Exemplo Correto:**

```solidity
function withdraw(address depositor, uint256 amount) external onlyOwner nonReentrant {
    // 1. CHECKS
    require(amount > 0, "Amount must be > 0");
    require(depositors[depositor] >= amount, "Insufficient balance");
    
    // 2. EFFECTS
    depositors[depositor] -= amount;
    totalDeposits -= amount;
    
    // 3. INTERACTIONS
    (bool success, ) = usdc.call(
        abi.encodeWithSignature("transfer(address,uint256)", depositor, amount)
    );
    require(success, "Transfer failed");
}
```

### 3.4 Access Control

**Pattern:**

```solidity
address public owner; // Gnosis Safe

modifier onlyOwner() {
    require(msg.sender == owner, "Only owner");
    _;
}

modifier onlyMultiSig() {
    require(msg.sender == address(gnosisSafe), "Only multi-sig");
    _;
}

// Funções críticas
function harvestYield() external onlyOwner { ... }
function updateRules(bytes calldata rules) external onlyMultiSig { ... }
```

### 3.5 Front-Running Prevention

**Strategy:** Para transações sensíveis, usar commit-reveal pattern.

```solidity
// Commit Phase (2 blocos depois)
function commitWithdrawal(bytes32 commitment) external {
    require(commitments[msg.sender] == bytes32(0), "Pending");
    commitments[msg.sender] = commitment;
    commitmentTime[msg.sender] = block.timestamp;
}

// Reveal Phase (2+ blocos depois)
function revealWithdrawal(uint256 amount, string calldata proof) external nonReentrant {
    bytes32 commitment = keccak256(abi.encodePacked(amount, proof));
    require(commitments[msg.sender] == commitment, "Invalid proof");
    require(block.timestamp >= commitmentTime[msg.sender] + 2 blocks, "Too soon");
    
    // Execute withdrawal
    require(usdc.transfer(msg.sender, amount), "Transfer failed");
}
```

---

## IV. Event Logging for Auditability

**Every critical action emits an event:**

```solidity
event DepositReceived(
    indexed address depositor,
    uint256 amount,
    uint256 timestamp,
    uint256 depositId
);

event Withdrawal(
    indexed address depositor,
    uint256 amount,
    uint256 timestamp
);

event YieldHarvested(
    uint256 amount,
    uint256 timestamp
);

event DistributionProposed(
    indexed uint256 proposalId,
    uint256 totalAmount,
    bytes32 ipfsHash,
    uint256 timestamp
);

event DistributionExecuted(
    indexed uint256 proposalId,
    uint256 timestamp
);

event AaveDeposit(uint256 amount, uint256 timestamp);
event AaveWithdrawal(uint256 amount, uint256 timestamp);
```

**Query Pattern (via TheGraph):**

```javascript
query {
  depositReceiveds(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    depositor
    amount
    timestamp
  }
  
  yieldHarvesteds(first: 5) {
    id
    amount
    timestamp
  }
  
  distributionExecuteds(first: 3) {
    proposalId
    timestamp
  }
}
```

---

## V. Deployment Strategy

### 5.1 Contract Deployment Order

```
1. Deploy Igreja.sol
   - Constructor: set USDC, owner (Gnosis Safe)
   
2. Deploy DistributionLogic.sol
   - Constructor: set Igreja reference, Gnosis Safe owner
   
3. Link Igreja ← DistributionLogic
   - setDistributionLogic(distributionLogic.address)
   
4. Verify on Polygonscan
   - Source code public (security transparency)
   
5. Setup Gnosis Safe
   - Add signers
   - Set threshold (5-of-7)
   - Configure owners address in Igreja
```

### 5.2 Initialization Checklist

```
[ ] USDC contract address (Polygon): 0x...
[ ] Aave LendingPool address (Polygon): 0x...
[ ] aUSDC token address (Polygon): 0x...
[ ] Gnosis Safe deployed and configured
[ ] All 7 signers registered
[ ] Threshold set to 5
[ ] Igreja owner = Gnosis Safe address
[ ] DistributionLogic owner = Gnosis Safe address
[ ] Initial capital deposited (small test amount)
[ ] Events verified on Polygonscan
[ ] Backup of all addresses + ABIs
```

---

## VI. Contract Interfaces

```solidity
// IERC20 (standard token operations)
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// IIgreja
interface IIgreja {
    function deposit(address depositor, uint256 amount, string memory name) external returns (uint256);
    function withdraw(address depositor, uint256 amount) external returns (bool);
    function getBalance(address depositor) external view returns (uint256);
    function getTotalDeposits() external view returns (uint256);
    function harvestYield() external returns (uint256);
}

// IDistributionLogic
interface IDistributionLogic {
    function proposeDistribution(address[] calldata recipients, uint256[] calldata amounts) external returns (uint256);
    function approveDistribution(uint256 proposalId) external;
    function getProposal(uint256 proposalId) external view returns (bytes memory);
}
```

---

## VII. Gas Optimization Notes

**Key Optimizations:**

1. **Storage Packing:** Agrupar variáveis do mesmo tamanho
   ```solidity
   uint128 depositsCount;
   uint128 yieldCount;
   // = 1 storage slot (256 bits)
   ```

2. **Immutable Variables:** Para valores que não mudam
   ```solidity
   address immutable usdc;  // Salvo no bytecode, não storage
   ```

3. **Call Over StaticCall:** Quando não precisa de view
   ```solidity
   (bool success, ) = usdc.call(...);  // Mais barato que transfer
   ```

4. **Batch Operations:** Agregar múltiplas operações
   ```solidity
   function batchWithdraw(address[] calldata recipients, uint256[] calldata amounts) external {
       for (uint i = 0; i < recipients.length; i++) {
           withdraw(recipients[i], amounts[i]);
       }
   }
   ```

---

## VIII. Disaster Recovery

**Scenario 1: Contract Compromised**
```
- Pause contract (paused flag)
- Trigger emergency withdrawal
- Move funds to cold wallet (multi-sig backup)
- Upgrade contract (proxy pattern optional)
```

**Scenario 2: Aave Protocol Issue**
```
- Withdraw from Aave
- Move to backup lending protocol (Compound)
- Update strategy via multi-sig
- Resume farming
```

**Scenario 3: Loss of Signers**
```
- Multi-sig recovery (address social recovery)
- Replace signer via remaining signers
- Update Igreja owner reference
- Continue operations
```

---

## IX. Roadmap

**Phase 1 (Sprint 43-44):** Core Contracts
- [ ] Igreja.sol implemented + tested
- [ ] DistributionLogic.sol + multi-sig integration
- [ ] Aave integration layer
- [ ] Security audit ready

**Phase 2 (Sprint 45-46):** Deployment & Verification
- [ ] Deploy to Polygon testnet
- [ ] Setup Gnosis Safe testnet
- [ ] Integration tests with real Aave
- [ ] Security audit completion

**Phase 3 (Sprint 47-48):** Mainnet Launch
- [ ] Deploy to Polygon mainnet
- [ ] Initial capital deposit
- [ ] Yield farming begins
- [ ] Community governance activated

---

## X. References

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/4.x/)
- [Aave V3 Protocol](https://docs.aave.com/hub/)
- [Gnosis Safe Docs](https://docs.gnosis.io/safe/)
- [Solidity Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [STRIDE Threat Modeling](https://en.wikipedia.org/wiki/STRIDE_(security))

---

**Next Step:** @dev implementa contratos conforme este design. Seguir test-driven development (Story 43.2).
