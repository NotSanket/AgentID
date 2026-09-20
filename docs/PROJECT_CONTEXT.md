# AgentID Project Context

This file is the durable source of truth for future AgentID work if chat history is unavailable. It describes the repository through the completed Stage 8 implementation on 2026-09-20. Future changes should update this document when the implemented architecture or verified results change.

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
- repository abstractions for audit events, replay nonces, verified interactions, agent metadata, and the chain event index;
- official Supabase JavaScript client integration backed by PostgreSQL;
- a complete in-memory persistence fallback;
- analytics calculated from stored authentication and interaction records;
- a React, TypeScript, and Vite portal with a responsive premium interface;
- a typed frontend API client connected to the backend identity, health, authentication, audit, and analytics APIs;
- browser-wallet writes through ethers `BrowserProvider`;
- strictly guarded local-Hardhat demo writes for teaching and development;
- a real Registry, Digital Agent Passport, identity issuance wizard, verification workspace, and live Command Center.

Stages 1–8 are implemented. Stage 9 has deployed the existing AgentRegistry to Ethereum Sepolia and is hardening the application before public hosting. Render and Vercel hosting are not deployed. Supabase support is implemented, and Stage 3 persistence plus Stage 5–8 workflows have been verified against the configured real project.

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

### Live Supabase verification

Live persistence was verified against the configured real Supabase project on 2026-09-19 without exposing or committing its server secret. The verification used a fresh local Hardhat chain and seeded registry, then confirmed:

- `/api/health` reported blockchain connectivity, chain ID `31337`, `persistenceMode: "SUPABASE"`, and `supabaseConnected: true`;
- the three TravelAI, HotelAI, and PaymentAI metadata rows existed;
- one valid TravelAI-to-HotelAI request was verified and created an audit event, interaction, and consumed replay nonce;
- all three records still existed after restarting only the backend;
- replaying the previously accepted signed request after restart was blocked with `NONCE_REUSED`;
- stored-data analytics reported two verification attempts, one verified request, one blocked request, one interaction, and one `NONCE_REUSED` block.

The live verification passed alongside the 31 Stage 1 tests, 39 preserved Stage 2 tests, 29 Stage 3 tests, backend typecheck, blockchain typecheck, and Solidity compile.

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

## Stage 4 — Premium Frontend Foundation

Stage 4 is **COMPLETE**. The application under `frontend/` uses:

- React 19 and strict TypeScript;
- Vite 8;
- React Router with nested console routes;
- Tailwind CSS 4 plus a CSS-variable design-token system;
- Framer Motion for focused route, overlay, sidebar, hero, and microinteraction motion;
- Lucide React icons;
- local Manrope and JetBrains Mono variable fonts;
- Vitest, jsdom, and Testing Library.

The design system defines semantic background, surface, border, text, accent, success, warning, danger, and info colors plus consistent radius, shadow, blur, spacing, and transition tokens. It uses a dark AI-identity/security visual language with restrained electric-blue, cyan, violet, emerald, amber, and red state accents.

Implemented public and console routes:

| Route | Stage 4 behavior |
|---|---|
| `/` | Premium landing page with conceptual agent identity network and Register → Sign → Verify → Communicate story |
| `/app` | Live-ready Command Center shell with real system health and honest empty states |
| `/app/registry` | Intentional future-module placeholder |
| `/app/register` | Intentional future-module placeholder |
| `/app/verification` | Intentional future-module placeholder |
| `/app/communication` | Intentional future-module placeholder |
| `/app/security` | Intentional future-module placeholder |
| `/app/trust-graph` | Intentional future-module placeholder |
| `/app/explorer` | Intentional future-module placeholder |
| `/app/analytics` | Intentional future-module placeholder |
| `/app/documentation` | Intentional future-module placeholder |
| `/app/settings` | Device-local visual preference foundation |
| all unknown paths | Branded NotFound recovery page |

The responsive application shell includes a top navbar, floating hover/click-expand sidebar, animated active-route indicator, mobile drawer navigation, notification/toast infrastructure, global status bar, keyboard-accessible command palette, and restrained route transitions. `Ctrl/Cmd + K` opens the command palette; filtering, Arrow Up/Down, Enter, Escape, focus restoration, and focus containment are implemented.

Reusable component foundations include:

- `AgentCard` and the digital `AgentPassport` credential;
- Verified, Active, Revoked, Blocked, Pending, and Offline badges;
- wallet, transaction hash, AgentID, block-number, and copy components;
- primary, secondary, ghost, danger, success, and technical buttons with loading state;
- text input, textarea, select, search, toggle, checkbox, field, and validation components;
- modal, confirmation dialog, and side drawer with focus handling;
- skeletons, empty states, reusable dashboard slots, notifications, and a safe error boundary.

The frontend API client reads `VITE_API_BASE_URL` (default `http://localhost:4000`). Identity/data requests have a bounded twelve-second timeout so first-load local registry scans and live Supabase analytics can settle; health polling remains independent and renders real backend/blockchain/chain/persistence information or a graceful `SYSTEM OFFLINE` state. Requests abort on unmount and validate JSON parsing. No Supabase server secret or blockchain private key exists in frontend configuration.

Browser CORS is intentionally narrow. The backend reads the comma-separated `FRONTEND_ORIGINS` variable, which defaults to `http://localhost:5173,http://127.0.0.1:5173`. It returns cross-origin headers only for an exact configured origin and never uses a wildcard. This integration adds no changes to authentication, replay protection, Supabase persistence, or blockchain behavior.

Verified Stage 4 results:

- **15 / 15 frontend tests passing** across rendering, landing content, routing, placeholders, sidebar behavior, command palette, mobile navigation, technical-value copying, online/offline health, reusable components, and error recovery;
- frontend strict TypeScript typecheck passing;
- Vite production build passing;
- live browser verification passing for `/` and `/app`, including chain ID `31337`, trusted-origin CORS, palette routing, mobile navigation, and no console errors;
- no horizontal overflow at 1920, 1440, 1366, 1024, 768, or 390 CSS pixels;
- **72 / 72 backend tests passing**: the preserved 68 Stage 1–3 backend tests plus 4 Stage 4 trusted-origin tests.

Stage 4 intentionally does not provide fake live metrics or pretend that future product actions work. Conceptual example agent nodes appear only in the clearly labeled landing illustration.

## Stage 5 - Core Agent Identity Portal

Stage 5 is **COMPLETE**. It turns the Stage 4 shell into a working identity product while preserving the Stage 1-4 architecture.

Implemented product routes:

| Route | Stage 5 behavior |
|---|---|
| `/app` | Real registry counts, lifecycle activity, authentication analytics, audit activity, health, and quick actions |
| `/app/register` | Five-step real identity issuance flow with browser-wallet and guarded local-demo modes |
| `/app/registry` | Searchable, filterable, sortable live registry using on-chain state plus optional metadata |
| `/app/registry/:agentId` | Digital Agent Passport, immutable lifecycle history, export/share/copy tools, and owner-gated lifecycle actions |
| `/app/verification` | AgentID/wallet registry verification plus the existing EIP-712 signed-request verifier |

Identity writes use one of two explicit modes:

- **Browser wallet mode** uses `window.ethereum`, ethers `BrowserProvider`, the connected account, the configured chain, and the real `AgentRegistry` contract. The browser wallet signs and submits its own transactions.
- **Local demo wallet mode** asks the backend to use an unlocked Hardhat account. It works only when `NODE_ENV=development`, `ENABLE_DEMO_SIGNING=true`, the configured and connected chain IDs are both `31337`, the RPC hostname is loopback, the registry is reachable, and the selected address is in the restricted Hardhat demo pool. The API returns labels, addresses, availability, assignments, and receipts - never private keys.

The registration wizard collects profile metadata, generates or validates an AgentID, checks preliminary availability, selects a controlling wallet, shows a review, submits a real transaction, waits for a real receipt, and displays the confirmed hash/block. Supabase metadata is saved after the chain operation. A metadata failure does not falsify the blockchain result: the UI reports that synchronization needs attention and offers a retry.

The Registry is reconstructed from `AgentRegistered` events and current contract records, then enriched with Supabase metadata when available. Blockchain identities remain visible if metadata storage is unavailable. The Digital Agent Passport includes owner, status, network, chain, contract, registration proof, and real Registered/Updated/Revoked/Reactivated events. Only the controlling selected/connected wallet is offered Update, Revoke, or Reactivate controls; the contract/backend ownership check remains authoritative.

Stage 5 backend additions include:

- registry and passport aggregation;
- AgentID availability and lifecycle-event APIs;
- contract configuration for browser-side ethers writes;
- owner-authorized metadata updates using a fresh EIP-191 signature;
- guarded local demo wallet listing and register/update/revoke/reactivate operations;
- confirmed transaction receipt mapping;
- current-wallet ownership checks and stable human-readable error codes.

Verified Stage 5 automated results:

- **16 Stage 5 backend tests** added;
- **88 / 88 total backend tests passing** (the preserved 72 plus 16 Stage 5 tests);
- **34 / 34 total frontend tests passing** (the preserved 15 plus 19 Stage 5 tests);
- **31 / 31 Stage 1 blockchain tests passing**;
- blockchain, backend, and frontend TypeScript checks passing;
- Solidity compile passing;
- Vite production build passing.

### Real ResearchAI acceptance run

A real end-to-end lifecycle was executed on local Hardhat chain `31337` against the real Supabase-backed backend. The deployed registry was `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`; ResearchAI was controlled by local demo wallet `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`.

| Operation | Block | Transaction hash | Observed result |
|---|---:|---|---|
| Register `AGT-RESEARCH-001` | 7 | `0x4c3b2e465c82b988c73079a0523ee965409b0ccce52130bcb08c97c9bc8567f3` | Active identity, wallet bound, metadata stored |
| Update | 8 | `0xc81f4841bd7b4c450c3a79398948cf5bb473d261d3e86e1a26c75a6eb99db553` | Organization and metadata updated |
| Revoke | 9 | `0xd3b1422b16dcddc09b8e10c4c79212115ebda9db665c100fea79cab16974ff44` | Registry and verification reported Revoked |
| Reactivate | 10 | `0x05c33f1e7651b81a3f1f6f04ee6067efb2dfbf54c30e23fd66b18679ef04e8ad` | Registry and verification returned Active |

The final Supabase-enriched profile contains category `Research` and capabilities `RESEARCH`, `SUMMARIZE`, and `CITE_SOURCES`. Browser verification displayed the real wallet, contract, chain, registration block, all four lifecycle events, and ACTIVE status. Public identity/config/demo-wallet responses were checked for secret or private-key fields and contained none.

The owner-gated browser flow was then exercised once more: the portal confirmed revoke transaction `0xd7a557906f34c34e3a591afd0709c519f2bad0123202ad4dc23330ee646308e8` in block 11, the Verification page reported `IDENTITY REVOKED`, the portal confirmed reactivation transaction `0x3a44d99e761a2871269eab10ce7a540cacd831acec5a1e9edec731b0d60fa6d6` in block 12, and Verification returned `IDENTITY VERIFIED` with ACTIVE status.

Responsive browser verification passed for the Command Center, registration wizard, Registry, Digital Agent Passport, and Verification pages at 1920, 1440, 1366, 1024, 768, and 390 CSS pixels with no document-level horizontal overflow.

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
| `GET` | `/api/identity/config` | Return public network, chain, registry address, and ABI data for browser-wallet writes. |
| `GET` | `/api/registry` | Return all event-discovered identities enriched with metadata where available. |
| `GET` | `/api/registry/:agentId` | Return one enriched Digital Agent Passport record. |
| `GET` | `/api/agents/:agentId/availability` | Report preliminary AgentID availability. |
| `GET` | `/api/agents/:agentId/events` | Return real registered/updated/revoked/reactivated contract events. |
| `PUT` | `/api/metadata/agents/:agentId` | Update metadata with a fresh signature from the controlling wallet. |
| `GET` | `/api/demo/wallets` | List safe local demo wallet labels, addresses, and availability when guarded demo signing is enabled. |
| `POST` | `/api/demo/identities` | Register a real local-chain identity using an allowed unlocked demo wallet. |
| `PUT` | `/api/demo/identities/:agentId` | Update owned on-chain fields when needed and synchronize metadata. |
| `POST` | `/api/demo/identities/:agentId/revoke` | Revoke an identity controlled by the selected allowed local demo wallet. |
| `POST` | `/api/demo/identities/:agentId/reactivate` | Reactivate an identity controlled by the selected allowed local demo wallet. |
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

There is no HTTP endpoint that accepts private keys or signs arbitrary data. The local demo write endpoints expose only the narrowly defined AgentRegistry operations and are disabled unless every development guard passes.

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

### Frontend

```powershell
cd "C:\BlockChain Project67\frontend"

npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The development server uses `http://127.0.0.1:5173`. Copy `frontend/.env.example` to an untracked `frontend/.env` only when the backend base URL must be changed.

The local Stage 5 workflow is:

1. Run `npm run node` in `blockchain/` and leave it running.
2. Run `npm run deploy:localhost` and `npm run demo:localhost` in a second `blockchain/` terminal.
3. In `backend/`, set `$env:NODE_ENV='development'` and `$env:ENABLE_DEMO_SIGNING='true'`, then run `npm run dev`. The flag is only for the local Hardhat teaching workflow.
4. Run `npm run dev` in `frontend/` and open `http://127.0.0.1:5173/app`.

Leave `ENABLE_DEMO_SIGNING` false or unset for every non-local environment. Browser-wallet mode does not require backend demo signing.

### Current Windows Workaround

On the current Windows/Codex host, Node's `os.userInfo()` fails during `tsx`/Hardhat startup, the normal user-profile Hardhat compiler cache can be locked or unavailable, and live Supabase HTTPS needs Node's system CA store. The existing repository-local workaround is still needed in this environment:

```powershell
$env:NODE_OPTIONS='--use-system-ca --require=../.tools/node-userinfo-workaround.cjs'
$env:LOCALAPPDATA='C:\BlockChain Project67\.tools\localappdata'
```

Set both variables before Hardhat commands. The `NODE_OPTIONS` preload is also needed before `tsx` commands such as `npm run dev` and `npm run demo:auth` on this host; `--use-system-ca` allows live Supabase TLS validation in this environment. A normal Windows installation where `os.userInfo()`, the user cache, and Node TLS validation work does not need these overrides.

To clear the overrides from the current PowerShell session:

```powershell
Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
Remove-Item Env:\LOCALAPPDATA -ErrorAction SilentlyContinue
```

## Stage 6 - Authenticated Agent-to-Agent Communication

Stage 6 is **COMPLETE**. It turns the preserved Stage 2 authentication-before-routing service into a real product workflow without duplicating authentication, routing, auditing, or persistence.

The request path is:

1. the backend prepares a canonical request with a UUID request ID, current server timestamp, and 32-byte cryptographically random nonce;
2. the controlling browser wallet or narrowly guarded local Hardhat signer signs the existing EIP-712 `AgentRequest` structure;
3. the backend recovers the signer, looks up both AgentIDs, matches the recovered wallet to the claimed sender, verifies Active lifecycle state, validates timestamp freshness, and atomically consumes the sender-scoped nonce;
4. only a fully verified request reaches the existing deterministic receiver router;
5. the authentication attempt is audited and a successful request/response interaction is persisted through the existing Stage 3 stores.

The communication UI at `/app/communication` provides:

- ownership-aware browser-wallet and guarded local-demo sender modes;
- Active receiver selection and receiver-supported actions;
- friendly and exact JSON payload editors;
- a real ten-stage trust pipeline driven by backend results;
- verified conversation and structured response views;
- explicit blocked states with `RECEIVER NOT EXECUTED`;
- a signed request inspector showing the EIP-712 domain, exact request, payload hash, nonce, and signature without exposing private keys;
- persistent verified and blocked communication history with filters and an accessible detail drawer;
- an exact-request replay demonstration that is blocked with `NONCE_REUSED`;
- a deliberate revoked-identity demonstration;
- a real two-step TravelAI to HotelAI, then TravelAI to PaymentAI workflow, with each request authenticated independently;
- real communication metrics and recent activity on Command Center;
- a concise verified-interaction summary on Agent Passport pages.

Stage 6 API additions are:

- `GET /api/communication/capabilities`;
- `POST /api/communication/prepare`;
- `GET /api/demo/communication/agents`;
- `POST /api/demo/communication/send`;
- the existing `GET /api/interactions` and `GET /api/interactions/:requestId` endpoints are used for history and details;
- `GET /api/audit` now supports an exact `requestId` filter.

The local demo signer is development-only, loopback-only, chain-31337-only, and restricted to the known TravelAI, HotelAI, and PaymentAI Hardhat accounts. It accepts only the AgentID owned by the selected wallet and never exposes a private key. Browser mode signs with `BrowserProvider` and requires the connected wallet and chain to match the prepared request.

Verified Stage 6 results on 2026-09-20:

- **14 Stage 6 backend tests added; 102 / 102 total backend tests passing**;
- **18 Stage 6 frontend tests added; 52 / 52 total frontend tests passing**;
- **31 / 31 Stage 1 blockchain tests passing**;
- blockchain, backend, and frontend typechecks passing;
- Solidity compile and frontend production build passing;
- responsive browser verification passing at 1920, 1440, 1366, 1024, 768, and 390 CSS pixels without horizontal overflow;
- live Supabase-backed valid request `REQ-b5e97166-1880-41a0-b476-f67d3cec7244` verified, executed by HotelAI, and persisted with an audit event and interaction;
- replay of that exact accepted request blocked with `NONCE_REUSED` and no receiver execution;
- revoked PaymentAI request `REQ-3ea20a25-bf35-4db1-9c1d-bba184ed64e4` blocked with `AGENT_REVOKED`, followed by successful reactivation;
- workflow requests `REQ-5dc2bb5a-8302-466d-be67-90865efba11e` and `REQ-70f801f4-9adf-4e73-96c7-9b1343c0c0c5` independently verified and delivered to HotelAI and PaymentAI.

The demo handlers return deterministic local data with source `SIMULATED_DEMO_DATA`. They are not LLMs, fine-tuned models, or external integrations. AgentID authenticates identity and request integrity; it does not certify the quality or safety of an agent's logic.

See `docs/COMMUNICATION.md` for the beginner-friendly communication guide.

## Current Known Issues / Workarounds

- The current Windows/Codex host needs `.tools/node-userinfo-workaround.cjs` for the Node `os.userInfo()` failure described above.
- Hardhat commands on this host use `.tools/localappdata` to avoid the unavailable or stale user-profile compiler cache.
- Live Supabase access on this host needs Node's `--use-system-ca` option; without it, the startup health check fails closed to `IN_MEMORY` mode.
- Browser access to the backend is restricted to `FRONTEND_ORIGINS`; add an explicit deployment origin before serving the frontend from another host.
- Git is initialized. In the current Codex shell, Git is installed at `C:\Program Files\Git\cmd\git.exe` but is not on `PATH`, so automation may need to invoke that full path.
- In `IN_MEMORY` mode, replay nonces, audit events, and interactions reset whenever the backend restarts.
- Supabase integration is covered by automated tests and live persistence was verified against the configured real project on 2026-09-19.
- Supabase requires the committed migration and metadata seed to be run manually for a new project.
- A local Hardhat chain and all of its deployed contract state reset whenever that local chain is restarted. Run the localhost seed again and use the refreshed deployment manifest.
- The demo uses unlocked local Hardhat accounts only. It must not be used with real funds.
- Stage 8 route-level and vendor splitting removes the prior oversized initial-chunk build advisory. Bundle sizes remain release metrics rather than permanent guarantees.

## Git Checkpoint

Stage 8 started from the clean Stage 7 checkpoint:

```text
full commit: fe05fbbfd5788cc09491429034a3e14efead162a
message: AgentID Stage 7 trust security explorer analytics
```

The Stage 8 completion commit uses message `AgentID Stage 8 final QA and deployment readiness`.

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

## Stage 4 Status

Stage 4 is complete and provides the premium visual and interaction foundation. The frontend is currently a Vite single-page application, so a future deployment host must serve `index.html` as the fallback for nested client routes.

## Stage 5 Status

Stage 5 is complete. The core identity routes use real AgentRegistry state and real persisted metadata. Registration, update, revoke, and reactivation wait for actual transaction receipts. Verification reports Active, Revoked, or Not Found from authoritative registry data, and the advanced mode exposes the preserved Stage 2 signed-request verifier.

## Stage 6 Status

Stage 6 is complete. Agent-to-agent requests use the existing EIP-712 schema and Stage 2 authentication-before-routing service. Verified interactions and all authentication attempts use the existing Stage 3 persistence stores. The communication page, replay and revoked-agent demonstrations, two-step travel workflow, Command Center metrics, Passport summary, automated tests, live Supabase-backed E2E verification, and responsive QA are complete.

## Stage 7 Status

Stage 7 is complete. It adds:

- a Trust Graph built from current on-chain identities, persisted verified interactions, and persisted blocked authentication events, without a trust-score claim;
- a development-only, loopback-only, chain-31337-only Security Lab with exactly eight executable scenarios and no arbitrary signing surface;
- a local-chain Explorer with current network and contract details, recent blocks, decoded AgentRegistry lifecycle events, transaction receipts, search, and receipt-derived gas insights;
- backend-aggregated analytics over registry, audit, interaction, and lifecycle records with one-hour, 24-hour, seven-day, and all-time ranges;
- expanded Command Center intelligence, a reusable real activity feed, guided presentation navigation, lazy-loaded Stage 7 routes, responsive styling, and focused automated tests.

Live verification on 2026-09-20 used local Hardhat chain `31337`, AgentRegistry `0x5FbDB2315678afecb367f032d93F642f64180aa3`, and the configured Supabase-backed backend. All eight Security Lab scenarios returned their exact expected codes. The valid request executed the receiver; all seven attack scenarios blocked receiver execution. Trust Graph, Explorer, and Analytics returned real records. Browser checks at 1920, 1440, 1366, 1024, 768, and 390 CSS pixels found no horizontal overflow.

Final verification passed **31 / 31 blockchain tests**, **115 / 115 backend tests**, and **70 / 70 frontend tests**, plus all three TypeScript checks, Solidity compilation, and the frontend production build. The final build emitted separate lazy chunks for Analytics (5.70 kB), Security Lab (5.99 kB), Trust Graph (7.71 kB), and Explorer (8.80 kB). The initial JavaScript chunk is 829.33 kB (268.34 kB gzip), so Vite's non-failing 500 kB chunk-size advisory remains.

See `docs/STAGE7_PLATFORM.md` for setup, route, data-source, guardrail, and verification details. Focused guides are in `docs/TRUST_GRAPH.md`, `docs/SECURITY_LAB.md`, `docs/EXPLORER.md`, and `docs/ANALYTICS.md`.

## Stage 8 Status

Stage 8 is complete. It is a QA, resilience, polish, performance, and deployment-readiness stage; it does not deploy the product or add a new large module.

Implemented and verified changes include:

- all console shell and product pages use route-level lazy loading, with separate React, ethers, and motion vendor chunks;
- the previous 829.33 kB (268.34 kB gzip) initial JavaScript chunk is replaced by a 27.53 kB (8.76 kB gzip) application entry plus 303.48 kB React, 250.57 kB ethers, and 135.53 kB motion vendor chunks;
- the Vite build no longer emits the prior 500 kB chunk-size advisory;
- a real Command Center `DEMO READY` check uses health data for backend, chain 31337, AgentRegistry reachability, configured persistence, and guarded local demo signing;
- backend-connected/blockchain-unavailable is shown as `SYSTEM DEGRADED`, not incorrectly collapsed into a generic offline state;
- completed delivery with later audit or interaction persistence failure remains a verified delivery and is visibly labeled `PERSISTENCE DEGRADED`; replay-store failures remain fail-closed with `SERVICE_UNAVAILABLE`;
- the Guided Demo follows Command Center, Registry, Agent Passport, Communication, Security Lab, Trust Graph, Explorer, and Analytics, with Previous, Next, and Exit controls and no automatic operations;
- Security Lab explains the real `UNKNOWN_WALLET` result for tampered signed fields without mislabeling it as a decoding failure;
- Analytics defines success rate as verified audit attempts divided by total audit attempts and remains safe at zero attempts;
- startup validation requires a registry address or deployment manifest, accepts an explicit network label, and rejects demo signing outside development before server startup;
- frontend public configuration remains limited to `VITE_API_BASE_URL`; backend RPC, chain, contract, origin, persistence, and secret configuration remain server-side;
- AgentID metadata, favicon, theme color, and social metadata are present without development URLs;
- Passport deep links show the correct page context title;
- Trust Graph filter controls reflow at 1024 CSS pixels without page overflow;
- `docs/DEPLOYMENT_READINESS.md` documents current architecture, production and security requirements, SPA fallback, and an unexecuted Stage 9 checklist.

The final local golden path used fresh Hardhat chain `31337`, AgentRegistry `0x5FbDB2315678afecb367f032d93F642f64180aa3`, and Supabase persistence. It confirmed:

- three seeded Active identities and a working TravelAI passport;
- valid request `LAB-2c2b43f0-d67f-4c29-b52e-3b18fe52121a` verified and executed by HotelAI;
- replay request `LAB-31f9825f-8dd7-435a-b859-2e5e75221275` first verified, then blocked with `NONCE_REUSED` and no receiver execution;
- revoked request `LAB-b63585e4-bdbd-47de-a24e-f00dfb1286b6` blocked with `AGENT_REVOKED` and no receiver execution;
- revoke transaction `0xeaa4ff6ed036844d7c1c292573e902d818ab8e4f7057f1a8d191e7843305612b` at block 5 and reactivate transaction `0xfc72f4543b78f2f8ff11e251292992cd3495ab69301b2d5db6b4a38c0b6759f8` at block 6;
- post-reactivation request `LAB-79488915-4674-43a7-87e2-ac74d8a48f69` verified and executed;
- Trust Graph returned 3 real nodes and 3 persisted relationship edges, Explorer returned real blocks/events/receipts, and Analytics returned real registry/audit/interaction/lifecycle metrics;
- direct browser visits to 11 important routes at 1920, 1440, 1366, 1024, 768, and 390 CSS pixels passed 66/66 checks without horizontal overflow or error screens.

Final regression passed **31 / 31 blockchain tests**, **118 / 118 backend tests**, and **74 / 74 frontend tests**, plus all three TypeScript checks, Solidity compilation, and the frontend production build.

## Stage 9 Status

Stage 9 implementation and production hardening are complete. The existing AgentRegistry is deployed to Ethereum Sepolia at `0xA8fC4db5eFD8F6a316fbAB81Fb4cb83A8826d42a` on chain `11155111`, with deployment block `11743199`. The public backend and frontend are live, and TravelAI (`AGT-TRAVEL-001`) is the first public Active identity. HotelAI and PaymentAI remain pending optional manual, wallet-owned registration and must not be fabricated by application code.

### Stage 9 production UX hardening

The public Command Center now treats a reachable Sepolia backend, expected chain `11155111`, reachable AgentRegistry, and connected Supabase persistence as production readiness. Disabled demo signing is an expected production guardrail rather than a failure; the explicitly enabled local Hardhat workflow retains its chain `31337` demo readiness behavior.

Frontend API requests allow a bounded 75-second production window for a Render Free cold start while local development keeps its 12-second timeout. Health polling schedules the next bounded attempt only after the current request finishes, so a slow wake cannot create overlapping requests or a fake online state.

Production Communication uses real public AgentRegistry identities for browser-wallet-owned EIP-712 requests. It does not add backend private-key signing, fake signatures, or fake interactions. The local demo signer remains development-only. Security Lab keeps its genuine scenario catalog visible but disables controlled execution when the development-only demo signer is unavailable. Explorer terminology now describes the connected Ethereum network and real chain evidence rather than assuming local Hardhat.

### Stage 9 public event scanning note

Production JSON-RPC providers may limit the block range accepted by `eth_getLogs`. AgentID reads AgentRegistry history from the contract deployment block recorded in the active deployment manifest and scans forward in bounded, inclusive chunks (10 blocks by default) instead of querying from block zero to latest in one request. All Registry, Passport lifecycle, Trust Graph, Explorer, Analytics, and Command Center paths that depend on AgentRegistry events use the shared scanner. A healthy public registry with no `AgentRegistered` events is a valid empty registry and returns an empty list rather than an availability error.

The shared public reader performs one address-only `eth_getLogs` request per chunk and decodes Registered, Updated, Revoked, and Reactivated events locally. Requests are sequential with a configurable 175 ms default delay. Rate limits and temporary provider failures receive at most three total attempts with bounded backoff; invalid parameters, authentication failures, and other deterministic errors are not retried.

The event-history hierarchy is:

1. the process-memory cache for repeated reads;
2. the Supabase event index and per-chain/per-contract checkpoint for cold starts;
3. incremental blockchain RPC reads for blocks after the durable checkpoint.

Ethereum remains authoritative. Supabase is only a persistent index of decoded, verified on-chain logs, and memory is only a performance cache. Registry, Passport lifecycle, Trust Graph, Explorer, Analytics, and Command Center all continue to use the same shared reader.

For every completed block chunk, decoded lifecycle events are idempotently upserted before `last_scanned_block` advances. The event key is `(chain_id, contract_address, transaction_hash, log_index)`. If the cursor update fails after event insertion, replaying the chunk is safe. Empty chunks also advance the checkpoint, so the current empty public registry does not trigger a full deployment-to-latest rescan after every backend restart. A cold start loads the namespaced checkpoint and indexed history, then asks Sepolia only for `last_scanned_block + 1` through the latest block. A failed storage operation never advances the in-memory cursor or discards an earlier valid memory snapshot.

The migration `supabase/migrations/202609200001_chain_event_index.sql` creates `chain_event_index` and `chain_indexer_state`, applies RLS and server-only permissions, and prevents checkpoint regression. It has been manually applied to the live Supabase project. The production health endpoint reports `persistenceMode: SUPABASE` and `supabaseConnected: true`.

Read-only Sepolia verification on 2026-09-20 initially scanned deployment block `11743199` through block `11744788` in 159 bounded log requests and found the then-empty registry. A newly constructed reader started at block `11744789` and made one incremental request instead of rescanning deployment history. After the live migration and public registration, the registry returned Active TravelAI with its registration lifecycle event at block `11745089`. The final read-only closure check found one public identity and made no chain or database mutation. The live API currently returns the stored organization spelling `Wanders Lab`; the supplied presentation label `Wander Labs` should not be used to overwrite the existing identity during closure.

## Stage 9 Final Closure

The public architecture is Browser Wallet → Sepolia AgentRegistry → Render verification API → Supabase persistent metadata/audit/index → Vercel interface. Production demo signing remains disabled, Local Demo Wallet endpoints remain unavailable, exact-origin CORS remains enforced, and no production agent private key is held by the backend. Public communication requires a real owner-controlled browser-wallet signature; distinct owners may need to switch MetaMask accounts. Security Lab execution remains an explicitly guarded local Hardhat capability, while the public UI documents the tested scenarios without fabricating execution.

Final presentation and operations references are `docs/FINAL_DEMO.md` and `docs/PRODUCTION_DEPLOYMENT.md`. No automatic Render/Vercel deployment, Supabase mutation, contract deployment, or identity registration is part of this closure commit.
