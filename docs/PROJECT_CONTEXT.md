# AgentID Project Context

This file is the durable source of truth for future AgentID work if chat history is unavailable. It describes the repository through the completed Stage 3 implementation on 2026-09-19. Future changes should update this document when the implemented architecture or verified results change.

## Project Goal

AgentID is a blockchain-backed decentralized identity and authentication layer for collaborative AI agents.

It verifies that an AgentID is bound to a specific wallet, that a request was signed by the wallet currently associated with that identity, and that the identity is Active rather than Revoked. AgentID does **not** prove that an AI agent is safe, intelligent, truthful, well behaved, or non-malicious.

## Current Architecture

The current implementation has these layers:

- a local Ethereum development blockchain provided by Hardhat;
- `AgentRegistry.sol` as the on-chain identity and lifecycle source of truth;
- wallet-bound AgentIDs, with one identity per wallet;
- a Node.js, Express, and TypeScript backend;
- ethers v6 for RPC, contract, EIP-712, and signature operations;
- EIP-712 signed agent requests with canonical payload hashes;
- an authentication service that recovers the signer and verifies it against the registry;
- timestamp freshness and nonce replay protection;
- deterministic offline TravelAI, HotelAI, and PaymentAI demo handlers;
- repository abstractions for audit events, replay nonces, verified interactions, and agent metadata;
- official Supabase JavaScript client integration backed by PostgreSQL;
- a complete in-memory persistence fallback;
- analytics calculated from stored authentication and interaction records.

The frontend has **not** been implemented. The `frontend/` directory contains only a placeholder README. Supabase support is implemented, but live connectivity has not been verified because real project credentials were not provided.

## Stage 1 — Blockchain Foundation

Stage 1 is implemented in `blockchain/` and includes:

- the `AgentRegistry` Solidity smart contract;
- `registerAgent`;
- `getAgent`;
- `getAgentByWallet`;
- `verifyAgent`;
- `updateAgent`;
- `revokeAgent`;
- `reactivateAgent`;
- registration ownership bound to `msg.sender`;
- one AgentID per wallet;
- duplicate readable-AgentID protection;
- Active and Revoked lifecycle state;
- `AgentRegistered`, `AgentUpdated`, `AgentRevoked`, and `AgentReactivated` events;
- local deployment and deployment-manifest scripts;
- deterministic demo seed scripts;
- a transaction-receipt-based local gas report.

Verified Stage 1 result: **31 / 31 blockchain tests passing**.

The demo seed defines these identities, each controlled by a different local Hardhat wallet:

| AgentID | Name | Organization |
|---|---|---|
| `AGT-TRAVEL-001` | TravelAI | Wander Labs |
| `AGT-HOTEL-001` | HotelAI | StaySphere |
| `AGT-PAYMENT-001` | PaymentAI | PayFlow |

The current `docs/local-gas-report.json` records actual local transaction receipt values using Solidity 0.8.34 with the optimizer enabled for 200 runs:

| Operation | Gas used |
|---|---:|
| `registerAgent` | 297408 |
| `updateAgent` | 61507 |
| `revokeAgent` | 37719 |
| `reactivateAgent` | 37762 |

These are local observations, not permanent guarantees. They can change when the contract, compiler settings, or input sizes change.

## Stage 2 — Authentication + Backend

Stage 2 is implemented in `backend/` and includes:

- an Express 5 and strict TypeScript backend;
- ethers v6 blockchain integration;
- EIP-712 typed request signing and verification;
- recursive canonical JSON serialization and Keccak-256 payload hashing;
- cryptographic signer recovery with `verifyTypedData`;
- recovered-wallet registration lookup and wallet-to-AgentID comparison;
- Active/Revoked sender verification from `AgentRegistry`;
- request timestamp freshness and future-clock-skew validation;
- atomic in-memory nonce replay protection;
- authentication-before-routing, so a receiver handler is not executed for a blocked request;
- typed audit events for verified and blocked requests;
- REST APIs for health, registry lookup, verification, communication, audits, and scenarios;
- deterministic offline TravelAI, HotelAI, and PaymentAI handlers;
- a real local terminal authentication demo using Hardhat accounts and the deployed registry.

Verified Stage 2 result: **39 / 39 backend tests passing**.

The nine verified security scenarios and their actual result codes are:

| # | Scenario | Result | Code |
|---:|---|---|---|
| 1 | Valid TravelAI to HotelAI request | VERIFIED | `VERIFIED` |
| 2 | Unknown wallet | BLOCKED | `UNKNOWN_WALLET` |
| 3 | Registered wallet impersonating TravelAI | BLOCKED | `WALLET_MISMATCH` |
| 4 | Revoked TravelAI | BLOCKED | `AGENT_REVOKED` |
| 5 | Expired request | BLOCKED | `REQUEST_EXPIRED` |
| 6 | Replayed accepted nonce | BLOCKED | `NONCE_REUSED` |
| 7 | Payload modified after signing | BLOCKED | `UNKNOWN_WALLET` |
| 8 | Receiver modified after signing | BLOCKED | `UNKNOWN_WALLET` |
| 9 | Malformed signature | BLOCKED safely | `INVALID_SIGNATURE` |

For the deterministic tampering scenarios, changing signed data causes recovery to produce a different, unregistered address, so the observed code is `UNKNOWN_WALLET`. If a recovered address happened to belong to another registered identity, the request would instead be blocked with `WALLET_MISMATCH`.

## Stage 3 — Persistent Off-Chain Data Layer

Stage 3 adds persistence without moving identity authority away from Ethereum. The backend uses repository interfaces so authentication and application services do not depend directly on Supabase.

Implemented repositories and adapters:

- `AuditStore`: `InMemoryAuditStore` and `SupabaseAuditStore`;
- `ReplayStore`: `InMemoryReplayStore` and `SupabaseReplayStore`;
- `InteractionStore`: `InMemoryInteractionStore` and `SupabaseInteractionStore`;
- `AgentMetadataStore`: `InMemoryAgentMetadataStore` and `SupabaseAgentMetadataStore`.

At startup, `SUPABASE_ENABLED=false` selects the complete in-memory implementation. When Supabase is enabled with a URL and server key, the backend performs a health check and selects Supabase only if it is reachable and migrated. Missing configuration or a failed startup health check selects fallback mode and reports a warning through the health endpoint.

Stage 3 includes:

- `@supabase/supabase-js` 2.116.0;
- typed database rows isolated in `backend/src/persistence/database.types.ts`;
- a versioned SQL migration in `supabase/migrations/`;
- persistent audit events;
- atomic sender-scoped replay nonce insertion;
- successful verified interaction history without signatures or secrets;
- application metadata merged with live blockchain identity state;
- analytics calculated from stored events and interactions;
- validated filtering and limit/offset pagination;
- an idempotent metadata seed command;
- a complete offline test suite using memory and mocked Supabase clients.

Verified backend result after Stage 3: **68 / 68 tests passing**. This is the preserved 39 Stage 2 tests plus **29 Stage 3 tests**.

### Database tables

| Table | Purpose | Important constraint |
|---|---|---|
| `agent_metadata` | Descriptions, categories, capabilities, avatar keys, and themes | `agent_id` is unique but is not identity authority |
| `audit_events` | Verified and blocked authentication attempts | Off-chain events only; no invented transaction hashes |
| `interactions` | Successful verified request/response history | `request_id` is unique |
| `replay_nonces` | Accepted sender nonce usage | `(sender_agent_id, nonce)` is unique |

Row Level Security is enabled on all tables. The migration creates no anonymous/authenticated browser policies, revokes those roles' table privileges, and grants server access to `service_role`. The server key bypasses RLS and must remain secret.

### Persistence failure behavior

- Audit persistence failure never changes an authentication decision; the result includes `AUDIT_PERSISTENCE_FAILED`.
- Interaction persistence failure never discards an already verified deterministic response; the result includes `INTERACTION_PERSISTENCE_FAILED`.
- Replay persistence is security-critical. An unexpected replay-store failure blocks authentication with `SERVICE_UNAVAILABLE`.
- A database unique-constraint error for an existing sender/nonce pair maps cleanly to `NONCE_REUSED`.

## Important Security Model

A registered identity alone is not enough because anybody can place an AgentID string in JSON. A request must also prove control of the associated wallet.

The implemented authentication flow is:

```text
signed request
  -> validate request schema and receiver existence
  -> recover signer from the complete EIP-712 request
  -> look up the recovered wallet in AgentRegistry
  -> look up the claimed sender AgentID
  -> require the sender identity to be Active
  -> compare the recovered and registered wallets
  -> validate timestamp freshness
  -> atomically consume an unused nonce
  -> accept and route, or reject without routing
```

The EIP-712 message binds the request ID, sender AgentID, receiver AgentID, action, canonical payload hash, timestamp, and nonce. Its domain also binds the chain ID and current `AgentRegistry` address.

## Current APIs

These are the routes actually implemented in `backend/src/app.ts`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Report backend status plus blockchain, chain, block, and contract reachability. |
| `GET` | `/api/network` | Return the current configured network and registry health information. |
| `GET` | `/api/agents` | List identities discovered from `AgentRegistered` events and current registry records. |
| `GET` | `/api/agents/wallet/:address` | Look up the AgentID registered to an Ethereum wallet. |
| `GET` | `/api/agents/:agentId` | Look up a registry identity by readable AgentID. |
| `POST` | `/api/verify` | Authenticate a signed request without executing receiver behavior. |
| `POST` | `/api/communication/send` | Authenticate a signed request and route it only if verification succeeds. |
| `GET` | `/api/audit` | Return filtered, paginated authentication audit events. |
| `GET` | `/api/interactions` | Return filtered, paginated successful interaction history. |
| `GET` | `/api/interactions/:requestId` | Return one interaction by request ID. |
| `GET` | `/api/analytics/summary` | Return real aggregate verification and interaction metrics. |
| `GET` | `/api/analytics/security` | Return blocked-attempt totals grouped by stored reason. |
| `GET` | `/api/metadata/agents` | Return metadata merged with current blockchain records. |
| `GET` | `/api/metadata/agents/:agentId` | Return one enriched agent with live wallet and status. |
| `GET` | `/api/security/scenarios` | Return descriptions and expected codes for the nine security scenarios. |

There is no HTTP endpoint that signs arbitrary data.

## Current Data Storage

On-chain storage currently contains:

- AgentID records and their wallet ownership;
- profile metadata fields and timestamps;
- Active/Revoked lifecycle state;
- identity lifecycle events.

Current off-chain storage contains:

- accepted replay nonces in `replay_nonces` or an in-memory `Set`;
- authentication audit events in `audit_events` or an in-memory array;
- successful verified interactions in `interactions` or an in-memory repository;
- richer agent metadata in `agent_metadata` or predefined in-memory demo metadata;
- deterministic simulated agent response data generated at runtime.

No request payload history, replay nonce, audit entry, metadata record, or simulated conversation is written to Ethereum. Supabase persists these records when configured; otherwise they last for the backend process lifetime.

## Working Commands

Node.js `24.21.0` is recorded in both `.nvmrc` files. Run blockchain commands from `blockchain/` and backend commands from `backend/`.

### Blockchain

```powershell
cd "C:\BlockChain Project67\blockchain"

npm run compile
npm run typecheck
npm test
npm run node
npm run deploy:localhost
npm run demo:localhost
npm run gas
```

The commands correspond to:

- compile: `hardhat compile`;
- typecheck: `tsc --noEmit`;
- tests: `hardhat test`;
- local node: `hardhat node`;
- localhost deploy: `hardhat run scripts/deploy.ts --network localhost`;
- localhost demo seed: `hardhat run scripts/seed-demo.ts --network localhost`;
- gas report: `hardhat run scripts/gas-report.ts`.

`npm run deploy` and `npm run demo` also exist for Hardhat's default in-process network, but the localhost workflow uses `deploy:localhost` and `demo:localhost`.

### Backend

```powershell
cd "C:\BlockChain Project67\backend"

npm run dev
npm run typecheck
npm test
npm run demo:auth
npm run seed:data
```

The commands correspond to:

- development server: `tsx watch src/server.ts`;
- typecheck: `tsc --noEmit`;
- tests: `vitest run`;
- authentication demo: `tsx src/demo/auth-demo.ts`.
- demo metadata seed: `tsx src/scripts/seed-data.ts`.

The local end-to-end workflow is: keep `npm run node` running in one blockchain terminal, run `npm run demo:localhost` in a second terminal, then run the backend or `npm run demo:auth` from `backend/`.

### Current Windows Workaround

On the current Windows/Codex host, Node's `os.userInfo()` fails during `tsx`/Hardhat startup and the normal user-profile Hardhat compiler cache can be locked or unavailable. The existing repository-local workaround is still needed in this environment:

```powershell
$env:NODE_OPTIONS='--require=../.tools/node-userinfo-workaround.cjs'
$env:LOCALAPPDATA='C:\BlockChain Project67\.tools\localappdata'
```

Set both variables before Hardhat commands. The `NODE_OPTIONS` preload is also needed before `tsx` commands such as `npm run dev` and `npm run demo:auth` on this host. A normal Windows installation where `os.userInfo()` and the user cache work does not need these overrides.

To clear the overrides from the current PowerShell session:

```powershell
Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:\LOCALAPPDATA -ErrorAction SilentlyContinue
```

## Current Known Issues / Workarounds

- The current Windows/Codex host needs `.tools/node-userinfo-workaround.cjs` for the Node `os.userInfo()` failure described above.
- Hardhat commands on this host use `.tools/localappdata` to avoid the unavailable or stale user-profile compiler cache.
- Git is initialized. In the current Codex shell, Git is installed at `C:\Program Files\Git\cmd\git.exe` but is not on `PATH`, so automation may need to invoke that full path.
- In `IN_MEMORY` mode, replay nonces, audit events, and interactions reset whenever the backend restarts.
- Supabase integration is implemented and mocked in automated tests, but live connectivity has not been verified without real credentials.
- Supabase requires the committed migration and metadata seed to be run manually for a new project.
- A local Hardhat chain and all of its deployed contract state reset whenever that local chain is restarted. Run the localhost seed again and use the refreshed deployment manifest.
- The demo uses unlocked local Hardhat accounts only. It must not be used with real funds.

## Git Checkpoint

The known-good Stage 2 checkpoint is:

```text
commit: 963cf64
full commit: 963cf64fd9de89f56960b8065dbad6755ef06895
message: AgentID Stage 2 complete
```

This checkpoint was confirmed as the repository `HEAD` before this context document was added.

## Stage 3 Status

Stage 3 is complete and includes:

- Supabase integration;
- persistent audit events;
- persistent nonce/replay records where appropriate;
- interaction history;
- agent metadata;
- dashboard analytics data;
- repository interfaces that allow Supabase or a local fallback;
- migration and schema setup.

Stage 3 does **not** replace the blockchain as the identity source of truth. Wallet ownership and AgentID lifecycle state remain authoritative on `AgentRegistry`.

Required environment variables are documented in `backend/.env.example`:

```dotenv
SUPABASE_ENABLED=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. A current Supabase secret key or legacy service-role key can be placed in that backend variable. It must never be returned by an API or copied into frontend code.

The complete setup, migration, RLS, seeding, testing, and fallback instructions are in `docs/SUPABASE.md`.

## Next Stage

Stage 4 — premium frontend and design system.

## Future Stages

- Stage 5 — core AgentID UI modules.
- Stage 6 — agent communication and an optional LLM layer.
- Stage 7 — Trust Graph, Security Lab, Explorer, and analytics.
- Stage 8 — QA, edge cases, and polish.
- Stage 9 — final demo and documentation.
