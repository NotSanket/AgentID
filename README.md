# AgentID

**A blockchain-based identity and request-authentication framework for collaborative AI agents.**

Stage 1 binds a readable AgentID to an Ethereum wallet and records whether the identity is Active or Revoked. Stage 2 adds EIP-712 authentication and authenticated routing. Stage 3 adds optional Supabase/PostgreSQL persistence for off-chain application data while preserving a complete in-memory fallback.

Identity verification does not prove that an agent is safe, truthful, intelligent, or well behaved.

## Current implementation

- Solidity `AgentRegistry` with the original 31 tests;
- deployment manifest updated with every actual deployment;
- Express and strict TypeScript backend using ethers v6 and Zod;
- canonical payload hashing and EIP-712 signatures;
- detailed authentication results and rejection codes;
- repository-based audit, replay, interaction, and metadata stores;
- official Supabase JavaScript client integration with startup fallback;
- versioned PostgreSQL migration with database-level nonce uniqueness and restricted public access;
- filtered/paginated history APIs and real stored-data analytics;
- offline deterministic TravelAI, HotelAI, and PaymentAI handlers;
- REST endpoints, 39 preserved Stage 2 tests, and 29 Stage 3 tests;
- real local authentication terminal demo.

There is no frontend or LLM integration yet. Supabase support is implemented, but real credentials are optional and were not available for live-connectivity verification.

## Prerequisites

- Node.js 24 LTS (`v24.21.0` is recorded in both `.nvmrc` files)
- npm
- PowerShell or another terminal

## Exact local workflow

### Terminal 1 — local blockchain

```powershell
cd "C:\BlockChain Project67\blockchain"
npm install
npm run compile
npm run node
```

Leave this terminal running.

### Terminal 2 — deploy and seed

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run demo:localhost
```

`demo:localhost` deploys a fresh `AgentRegistry`, registers TravelAI, HotelAI, and PaymentAI from three different Hardhat wallets, and writes its real address to `blockchain/deployments/localhost.json`. Use `npm run deploy:localhost` only when an empty, unseeded registry is wanted; it also refreshes the manifest.

### Terminal 3 — backend

```powershell
cd "C:\BlockChain Project67\backend"
npm install
npm run dev
```

The API starts at `http://127.0.0.1:4000`. Check `GET /api/health` before sending requests. With the default environment it reports `persistenceMode: IN_MEMORY`. See [the Supabase guide](docs/SUPABASE.md) to enable persistent mode.

### Terminal 4 — authentication demo

```powershell
cd "C:\BlockChain Project67\backend"
npm run demo:auth
```

The demo uses the unlocked local Hardhat accounts. It runs all nine documented security scenarios, never returns or logs private keys, and must not be used with real funds.

## Tests

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run typecheck
npm test

cd "C:\BlockChain Project67\backend"
npm run typecheck
npm test
```

Expected results are 31 blockchain tests and 68 backend tests: the original 39 Stage 2 tests plus 29 Stage 3 tests.

## REST endpoints

- `GET /api/health`
- `GET /api/network`
- `GET /api/agents`
- `GET /api/agents/:agentId`
- `GET /api/agents/wallet/:address`
- `POST /api/verify`
- `POST /api/communication/send`
- `GET /api/audit`
- `GET /api/interactions`
- `GET /api/interactions/:requestId`
- `GET /api/analytics/summary`
- `GET /api/analytics/security`
- `GET /api/metadata/agents`
- `GET /api/metadata/agents/:agentId`
- `GET /api/security/scenarios`

There is no HTTP endpoint that signs arbitrary data. See [backend/README.md](backend/README.md), [authentication documentation](docs/AUTHENTICATION.md), and [blockchain documentation](docs/BLOCKCHAIN.md).

## Security model in one sentence

Accept a communication only when its complete typed request recovers the same wallet currently registered to an Active sender AgentID, its timestamp is fresh, and its nonce has not previously been accepted.

Identity lifecycle belongs on-chain. Audit events, verified interaction history, application metadata, analytics inputs, and replay state remain off-chain in Supabase or the in-memory fallback.
