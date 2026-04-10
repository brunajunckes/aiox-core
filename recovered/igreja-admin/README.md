# Igreja Admin Dashboard

Next.js 14 + TypeScript admin dashboard for Igreja nas Casas Web3 platform with Church.sol integration.

## Features

- Web3 wallet integration (MetaMask)
- Chiesa.sol smart contract interaction (ethers.js v6)
- Admin dashboard with Recharts visualizations
- Blog management system
- Church member registration
- PostgreSQL database with Supabase
- NextAuth authentication
- Traefik reverse proxy support
- Docker containerization

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker & Docker Compose (for containerized deployment)
- MetaMask browser extension (for Web3 interaction)

## Setup

1. Clone and install:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with:
   - `NEXT_PUBLIC_CHIESA_ADDRESS` - Deployed Chiesa.sol address
   - `NEXT_PUBLIC_CHAIN_ID` - Network ID (11155111 for Sepolia)
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`

4. Run development server:
```bash
npm run dev
```

Visit http://localhost:3000

## Docker Deployment

```bash
docker-compose up -d
```

Services:
- **iglesia-admin** - Next.js app (port 3000)
- **postgres** - PostgreSQL database (port 5432)
- **traefik** - Reverse proxy (port 80/443, UI on 8080)

## Development

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Run tests
```

## Web3 Integration

See `lib/web3-integration.ts` for Chiesa.sol integration:

```typescript
const web3 = createWeb3Integration(chiesiAddress)
await web3.connectWallet()
await web3.donate('100')
const balance = await web3.getChurchBalance()
```

## Project Structure

```
iglesia-admin/
├── lib/
│   ├── web3-integration.ts    # Chiesa.sol interactions
│   └── abis/
│       └── Chiesa.ts          # Contract ABI
├── pages/                     # Next.js pages & API routes
├── components/                # React components
├── public/                    # Static assets
├── styles/                    # CSS & Tailwind
└── docker-compose.yml         # Full stack
```

## License

MIT
