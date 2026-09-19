# AgentID backend (Stage 2)

This Express/TypeScript service proves that the sender of an agent request controls the wallet registered to its claimed AgentID. It uses EIP-712 signatures, reads identity state from `AgentRegistry`, rejects stale or replayed requests, and routes only verified requests to deterministic offline TravelAI, HotelAI, and PaymentAI handlers.

## Setup

Use Node.js 24 LTS. First start and seed the blockchain as described in the root README. The seed command writes `blockchain/deployments/localhost.json`; this backend reads the contract address from that file and the ABI from Hardhat's compiled artifact.

```powershell
cd "C:\BlockChain Project67\backend"
npm install
Copy-Item .env.example .env   # optional; defaults already suit Hardhat localhost
npm run typecheck
npm test
npm run dev
```

The default server is `http://127.0.0.1:4000`. `AGENT_REGISTRY_ADDRESS` can override the manifest address, but no old address is embedded in source code.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Backend, RPC, chain, block, and contract reachability |
| GET | `/api/network` | Current network and AgentRegistry information |
| GET | `/api/agents` | Identities discovered from registration events |
| GET | `/api/agents/:agentId` | Lookup by readable AgentID |
| GET | `/api/agents/wallet/:address` | Reverse wallet lookup |
| POST | `/api/verify` | Authenticate a signed request without executing it |
| POST | `/api/communication/send` | Authenticate, then route to the receiver |
| GET | `/api/audit` | In-memory off-chain authentication events |
| GET | `/api/security/scenarios` | Demo scenario descriptions |

POST bodies use `{ "request": { ... }, "signature": "0x..." }`. There is deliberately no HTTP signing endpoint. Local demo signing uses Hardhat's unlocked development accounts only.

## Authentication demo

With the local node running and the seeded manifest current:

```powershell
npm run demo:auth
```

The demo executes all nine required scenarios: valid communication, unknown wallet, registered-wallet impersonation, on-chain revocation, expired request, replayed nonce, payload tampering, receiver tampering, and malformed signature. It uses real runtime addresses and signatures and reactivates TravelAI after the revocation scenario.

Replay nonces and audit events are intentionally in memory for Stage 2 and reset when the process restarts. See `docs/AUTHENTICATION.md` for the viva explanation.
