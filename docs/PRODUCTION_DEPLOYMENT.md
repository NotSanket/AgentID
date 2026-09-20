# AgentID Production Deployment

This document records the actual Stage 9 public architecture. It contains public configuration and variable names only. Secret values, credential-bearing RPC URLs, private keys, and Supabase service-role credentials must remain in the hosting providers' secret stores.

## Live stack

| Layer | Production service | Public detail |
|---|---|---|
| Frontend | Vercel | `https://sankets-agent-id.vercel.app` |
| Backend | Render | `https://agentid-backend.onrender.com` |
| Persistence | Supabase | Server-side metadata, audits, interactions, replay nonces, event index |
| Blockchain | Ethereum Sepolia | Chain ID `11155111` |
| Smart contract | AgentRegistry | `0xA8fC4db5eFD8F6a316fbAB81Fb4cb83A8826d42a` |
| RPC | External Ethereum RPC provider | Credential stored only in Render |

Architecture: **Browser wallet → Sepolia AgentRegistry → Render verification API → Supabase persistent metadata/audit/index → Vercel interface.**

## Authority boundaries

Ethereum is authoritative for AgentID, wallet ownership, name, organization, metadata reference, lifecycle state, and lifecycle events. Supabase is an off-chain persistence and indexing layer. It must never be treated as the source of truth for who owns an AgentID or whether that identity is Active.

The browser wallet signs user-authorized registration/lifecycle transactions and EIP-712 communication requests. The production backend has no agent private key and does not sign on behalf of public identities.

## Vercel frontend

Deployment settings:

- root directory: `frontend`
- framework: Vite
- install command: `npm install` or the provider's lockfile-based default
- build command: `npm run build`
- output directory: `dist`
- Node.js: version 24 compatible with `frontend/.nvmrc` and `package.json`
- public variable: `VITE_API_BASE_URL` pointing to the public Render origin

`frontend/vercel.json` rewrites every path to `/index.html`. This preserves direct SPA links such as `/app/registry/AGT-TRAVEL-001`, `/app/communication`, and `/app/explorer`.

No private key, RPC credential, or Supabase service key belongs in a `VITE_*` variable. Values embedded in a Vite build are public.

## Render backend

Deployment settings:

- service type: Web Service
- root directory: `backend`
- runtime: Node.js
- Node.js: 24.x
- build command: `npm install`
- start command: `npm start`
- health endpoint: `/api/health`

Conceptual environment variables:

| Variable | Purpose | Secret? |
|---|---|---|
| `NODE_ENV` | Must be `production` | No |
| `HOST` / `PORT` | Render process binding | No |
| `RPC_URL` | Credential-bearing Sepolia RPC endpoint | **Yes** |
| `CHAIN_ID` | Must be `11155111` | No |
| `NETWORK_NAME` | `Sepolia` | No |
| `AGENT_REGISTRY_ADDRESS` | Public deployed address | No |
| `FRONTEND_ORIGINS` | Exact Vercel HTTPS origin allowlist | No |
| `SUPABASE_ENABLED` | Must be `true` for production persistence | No |
| `SUPABASE_URL` | Supabase project URL | Treat as backend configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged credential | **Yes** |
| `ENABLE_DEMO_SIGNING` | Must be `false` | No |
| `EVENT_SCAN_BLOCK_CHUNK` | Bounded log-query range; default `10` | No |
| `EVENT_SCAN_REQUEST_DELAY_MS` | Delay between historical reads; default `175` | No |

The production CORS configuration contains the exact Vercel origin. Wildcard CORS is not used.

## Persistent event index

Migration `supabase/migrations/202609200001_chain_event_index.sql` is applied in production. It creates:

- `chain_event_index`, keyed by chain, contract, transaction hash, and log index;
- `chain_indexer_state`, keyed by chain and contract with the last completed block;
- a database trigger that prevents checkpoint regression;
- Row Level Security and service-role-only access.

The reader starts from the recorded contract deployment block `11743199`. It reads Sepolia logs in bounded inclusive chunks, decodes only AgentRegistry lifecycle events, upserts the decoded events, and advances the checkpoint only after the chunk is stored. Empty chunks also advance the checkpoint. After restart, scanning resumes from `last_scanned_block + 1` rather than rescanning the complete history.

Ethereum remains authoritative. The index is a durable performance and availability aid, not a replacement ledger.

## Authentication and safe failure

For EIP-712 communication, the backend validates the complete request schema, recovers the signer, checks wallet ownership, verifies both identities and their Active status, validates timestamp freshness, and atomically consumes the nonce before receiver execution.

Security-critical failures are fail-closed:

- RPC or registry unavailable: verification cannot establish identity; receiver is not executed.
- replay-store unavailable: request returns service unavailable; receiver is not executed.
- invalid, expired, modified, replayed, revoked, or impersonated request: blocked before routing.
- audit or interaction persistence failure after a completed verified delivery: the real delivery remains reported, with an explicit persistence-degraded warning.

State-changing signed requests and blockchain transactions are never automatically retried.

## Render Free cold starts

Render Free can sleep and may take tens of seconds to wake. The production frontend uses a bounded 75-second API timeout and schedules the next health poll only after the previous request completes. It does not create overlapping polls or invent an online state. During a wake, wait for the health banner to settle or refresh once after approximately one minute.

## Local versus public

| Concern | Local development | Public production |
|---|---|---|
| Chain | Hardhat `31337` | Sepolia `11155111` |
| RPC | Loopback | External provider via Render secret |
| Signing | Optional guarded demo signers | Browser wallet only |
| `ENABLE_DEMO_SIGNING` | Explicitly enabled when needed | `false` |
| Persistence | In-memory or developer Supabase | Supabase required for readiness |
| Identities | Deterministic local demo identities | Real wallet-owned Sepolia identities |
| Security Lab execution | Available with all local guards | Disabled |

## Manual release procedure

No deployment is performed by this document update. After reviewing the final commit:

1. Push the reviewed commit to the configured Git remote.
2. Let Render build the backend only if its tracked source changed; do not alter its existing secrets.
3. Let Vercel build the frontend with the existing public `VITE_API_BASE_URL` configuration.
4. Confirm `/api/health` reports Sepolia `11155111`, reachable AgentRegistry, `SUPABASE`, `supabaseConnected: true`, and `demoSigningEnabled: false`.
5. Open the Vercel root and a direct deep link such as `/app/registry/AGT-TRAVEL-001`.
6. Confirm TravelAI remains Active and no identity or database record was created by deployment.
7. Do not register HotelAI or PaymentAI unless their real owners deliberately complete those optional browser-wallet transactions.
