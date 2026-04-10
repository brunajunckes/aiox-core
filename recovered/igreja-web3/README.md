# Igreja nas Casas — Web3 React Frontend

React 18 + TypeScript + Vite web3 application for Igreja nas Casas transparent donation platform with Gnosis Safe multi-sig integration.

## Architecture

```
src/
├── components/
│   ├── WalletConnect.tsx      # MetaMask/WalletConnect connection UI
│   ├── BalanceDisplay.tsx     # Wallet & Safe balance display with USD conversion
│   └── GnosisSafeInterface.tsx # Multi-sig transaction management
├── hooks/
│   └── useWeb3.ts            # Core Web3 state management (ethers.js)
└── App.tsx                    # Main app component
```

## Features

- **Wallet Connection**: MetaMask/WalletConnect integration via ethers.js v6
- **Balance Display**: Real-time ETH balance with live USD conversion (CoinGecko API)
- **Gnosis Safe Interface**: Multi-sig transaction creation, approval, and execution
- **Responsive Design**: Mobile-first with gradient UI
- **Full TypeScript**: Strict mode enabled, zero-any policy

## Tech Stack

- React 18.2 with React Router (optional)
- TypeScript 5.0 (strict mode)
- Vite 4.3 (dev server)
- ethers.js 6.7.1 (Web3 provider)
- @safe-global/safe-core-sdk 3.3.5 (Gnosis Safe)
- Vitest + @testing-library/react (unit tests)

## Development

### Install dependencies
```bash
npm install
```

### Development server
```bash
npm run dev
```
Opens http://localhost:5173

### Build for production
```bash
npm run build
```
Output: `dist/`

### Run tests
```bash
npm test
```

### Type check
```bash
npm run type-check
```

### Lint
```bash
npm run lint
```

## Security Considerations

⚠️ **This is a demonstration UI.** Before production deployment:

1. **Professional Security Audit**
   - Smart contract audit (Certora/Trail of Bits recommended)
   - Frontend penetration test
   - Full threat modeling (see: threat-model.md)

2. **Multi-Sig Configuration**
   - Minimum 5-of-7 signer threshold
   - Signers in different geographic regions
   - Hardware wallet enforcement (Ledger/Trezor)

3. **Compliance**
   - AML/KYC for stablecoin handling
   - Brazilian regulatory review
   - Cross-border transaction documentation

4. **Monitoring & Alerting**
   - Real-time yield monitoring
   - Signer activity alerts
   - Oracle price manipulation detection

## Environment Variables

```bash
# .env.local
VITE_RPC_URL=https://polygon-rpc.com
VITE_SAFE_ADDRESS=0x...
```

## File List

- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite configuration with React plugin
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript strict mode config
- `src/components/WalletConnect.tsx` - Wallet connection UI (98 lines)
- `src/components/BalanceDisplay.tsx` - Balance display component (206 lines)
- `src/components/GnosisSafeInterface.tsx` - Safe transaction UI (387 lines)
- `src/hooks/useWeb3.ts` - Web3 state management (138 lines)
- `src/App.tsx` - Main app component (225 lines)
- `tests/useWeb3.test.ts` - Hook unit tests (61 lines)

## Deployment

### Vercel (recommended)
```bash
npm install -g vercel
vercel deploy
```

### Static hosting
```bash
npm run build
# Upload dist/ to hosting provider
```

## Progress

- [x] Project scaffold with Vite + TypeScript
- [x] WalletConnect component
- [x] BalanceDisplay component with live pricing
- [x] GnosisSafeInterface component
- [x] useWeb3 hook with ethers.js
- [x] Unit tests (5 passing)
- [x] Build pipeline (npm run build)
- [x] Type checking (strict mode)
- [ ] E2E tests (Playwright)
- [ ] Security audit
- [ ] Production deployment
