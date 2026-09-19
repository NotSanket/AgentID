# AgentID backend (Stage 3)

This Express/TypeScript service proves that the sender of an agent request controls the wallet registered to its claimed AgentID. It uses EIP-712 signatures, reads authoritative identity state from `AgentRegistry`, rejects stale or replayed requests, and routes only verified requests to deterministic offline TravelAI, HotelAI, and PaymentAI handlers. Stage 3 adds optional Supabase persistence with a complete in-memory fallback.

## Setup

Use Node.js 24 LTS. First start and seed the blockchain as described in the root README. The seed command writes `blockchain/deployments/localhost.json`; this backend reads the contract address from that file and the ABI from Hardhat's compiled artifact.

```powershell
cd "C:\BlockChain Project67\backend"
npm install
Copy-Item .env.example .env   # optional; defaults use Hardhat localhost and in-memory persistence
npm run typecheck
npm test
npm run dev
```

The default server is `http://127.0.0.1:4000`. `AGENT_REGISTRY_ADDRESS` can override the manifest address, but no old address is embedded in source code. Without complete Supabase credentials the backend logs `Persistence mode: IN_MEMORY` and remains fully usable.

Stage 4 browser access uses an explicit trusted-origin allowlist. `FRONTEND_ORIGINS` is a comma-separated list and defaults to the two local Vite origins `http://localhost:5173,http://127.0.0.1:5173`. Unlisted origins receive no cross-origin permission. Keep production origins explicit rather than using a wildcard.

To enable persistent storage, apply `supabase/migrations/202609190001_stage3_persistence.sql` and configure the server-only variables described in `docs/SUPABASE.md`. Never expose the server key to frontend code.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Backend, RPC, contract, and persistence health |
| GET | `/api/network` | Current network and AgentRegistry information |
| GET | `/api/agents` | Identities discovered from registration events |
| GET | `/api/agents/:agentId` | Lookup by readable AgentID |
| GET | `/api/agents/wallet/:address` | Reverse wallet lookup |
| POST | `/api/verify` | Authenticate a signed request without executing it |
| POST | `/api/communication/send` | Authenticate, then route to the receiver |
| GET | `/api/audit` | Filtered and paginated authentication audit events |
| GET | `/api/interactions` | Filtered and paginated verified interaction history |
| GET | `/api/interactions/:requestId` | One verified interaction by request ID |
| GET | `/api/analytics/summary` | Real aggregate verification and interaction metrics |
| GET | `/api/analytics/security` | Real blocked-request counts grouped by reason |
| GET | `/api/metadata/agents` | Application metadata merged with live blockchain identities |
| GET | `/api/metadata/agents/:agentId` | One enriched agent with live wallet and lifecycle status |
| GET | `/api/security/scenarios` | Demo scenario descriptions |

POST bodies use `{ "request": { ... }, "signature": "0x..." }`. There is deliberately no HTTP signing endpoint. Local demo signing uses Hardhat's unlocked development accounts only.

## Authentication demo

With the local node running and the seeded manifest current:

```powershell
npm run demo:auth
```

The demo executes all nine required scenarios: valid communication, unknown wallet, registered-wallet impersonation, on-chain revocation, expired request, replayed nonce, payload tampering, receiver tampering, and malformed signature. It uses real runtime addresses and signatures and reactivates TravelAI after the revocation scenario.

## Persistence and seeding

The backend selects one mode at startup:

- `IN_MEMORY`: audit events, interactions, and replay nonces last for the process lifetime; predefined demo metadata is available immediately.
- `SUPABASE`: audit events, interactions, replay nonces, and metadata persist in PostgreSQL.

Seed or update the three demo metadata records with:

```powershell
npm run seed:data
```

The seed is an upsert and does not alter blockchain identities. See `docs/SUPABASE.md` for beginner setup, migration, RLS, fallback, and verification instructions. See `docs/AUTHENTICATION.md` for the authentication model.
