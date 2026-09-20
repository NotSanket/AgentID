# AgentID Deployment Readiness

AgentID is structurally ready for a future deployment review, but it is **not publicly deployed**. Stage 8 performs local QA and prepares configuration boundaries only. Public hosting, a public RPC, and a testnet contract belong to Stage 9 and require an explicit review before execution.

## Current local architecture

### Frontend

- React 19, TypeScript, Vite, React Router, Tailwind CSS, and Framer Motion.
- Runs locally at `http://127.0.0.1:5173`.
- Reads only the public `VITE_API_BASE_URL` setting; the safe development default is `http://127.0.0.1:4000`.
- Uses browser-wallet signing for user-controlled writes and a narrowly guarded local-demo mode for teacher demonstrations.
- All console routes are lazy-loaded. A production host must serve `index.html` for unknown client-side routes.

### Backend

- Node.js 24, Express 5, strict TypeScript, ethers v6, and Zod.
- Runs locally at `http://127.0.0.1:4000`.
- Validates RPC, expected chain, AgentRegistry address or deployment manifest, persistence configuration, allowed origins, and demo-signing rules at startup.
- Recovers EIP-712 signers, checks wallet-to-AgentID ownership and Active lifecycle status, enforces freshness, atomically consumes replay nonces, and routes only verified requests.
- CORS uses the exact comma-separated `FRONTEND_ORIGINS` allowlist; it does not use a wildcard.

### Supabase

- Persists agent metadata, audit events, successful interactions, and replay nonces through repository adapters.
- Uses one backend-only Supabase client. The service-role credential must never be exposed to the browser.
- The `(sender_agent_id, nonce)` uniqueness constraint is the atomic replay boundary.
- `SUPABASE_ENABLED=false` selects the complete in-memory fallback. In-memory records reset with the backend process.

### Blockchain

- `AgentRegistry` is the authority for wallet ownership and Active/Revoked lifecycle state.
- Local development uses Hardhat chain `31337`, a loopback RPC, and `blockchain/deployments/localhost.json`.
- A public environment can use a configured RPC URL, chain ID, network label, and deployed registry address without changing application logic.

## Persistence and resilience policy

Authentication remains fail-closed for every security-critical dependency. A replay-store read/write failure returns `SERVICE_UNAVAILABLE`; the receiver is not executed, and the same request must not be retried automatically.

Audit and interaction persistence are post-decision observability. If authentication and deterministic receiver execution have already succeeded, a later audit or interaction write failure does not falsely reverse that completed delivery. The API returns `AUDIT_PERSISTENCE_FAILED` or `INTERACTION_PERSISTENCE_FAILED`, and the communication UI marks the result `PERSISTENCE DEGRADED`. It never claims that a missing record exists. This preserves the established Stage 2–7 semantics while making the degraded state visible.

Retries are deliberately not added to state-changing nonce, delivery, or blockchain operations. Safe idempotent reads may be retried by a caller using a bounded policy, but no operation may consume a nonce, execute a receiver, or submit a transaction twice.

## Production requirements

### Public frontend hosting

- Host the built `frontend/dist/` files over HTTPS.
- Set public `VITE_API_BASE_URL` before building.
- Configure SPA fallback so `/app`, `/app/registry/:agentId`, `/app/communication`, `/app/security`, `/app/trust-graph`, `/app/explorer`, and `/app/analytics` serve `index.html` on direct visits.
- Do not place private keys, mnemonics, Supabase service credentials, or other secrets in `VITE_*` variables.

### Public backend hosting

- Use Node.js 24 and HTTPS behind the hosting platform's trusted proxy/load balancer.
- Provide the environment values below through the host's secret manager, not committed files.
- Keep `NODE_ENV=production` and `ENABLE_DEMO_SIGNING=false`.
- Restrict network access and logs so request signatures and operational errors do not expose secrets.

### Public RPC and contract

- Choose a public Ethereum testnet during Stage 9; Stage 8 intentionally does not choose or deploy one.
- Deploy the reviewed `AgentRegistry` contract and record its real address and chain ID.
- Configure `RPC_URL`, `CHAIN_ID`, `AGENT_REGISTRY_ADDRESS`, and optionally `NETWORK_NAME` together.
- Verify bytecode exists at the configured address and `/api/health` reports the intended chain before enabling the frontend.

### Supabase

- Apply the committed migration in `supabase/migrations/` to the selected project.
- Keep Row Level Security and existing privilege restrictions enabled.
- Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the backend.
- Seed public-demo metadata only after the public AgentIDs exist on the selected registry.
- Validate backup, retention, regional, and rate-limit requirements before a real launch.

### Environment variables

Backend variables are documented in `backend/.env.example`:

| Variable | Production expectation |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | Hosting-platform bind settings |
| `RPC_URL` | Public testnet HTTPS RPC |
| `CHAIN_ID` | Exact chosen testnet chain ID |
| `NETWORK_NAME` | Human-readable public network label |
| `AGENT_REGISTRY_ADDRESS` | Deployed public registry address |
| `FRONTEND_ORIGINS` | Exact HTTPS frontend origins |
| `SUPABASE_ENABLED` | `true` when persistent mode is required |
| `SUPABASE_URL` | Backend-only project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend secret manager only |
| `ENABLE_DEMO_SIGNING` | `false` |

Frontend variables are documented in `frontend/.env.example`:

| Variable | Production expectation |
|---|---|
| `VITE_API_BASE_URL` | Public HTTPS backend base URL; public information only |

## Security requirements

- Never deploy, upload, log, or return a private key or mnemonic.
- Keep Supabase service-role credentials backend-only and outside Git.
- Keep demo signing disabled outside explicit local development. The backend also requires chain `31337` and a loopback RPC for guarded demo signing and Security Lab execution.
- Use an exact CORS origin allowlist. Do not use `*` for these APIs.
- Validate the connected chain and deployed registry bytecode at startup and through `/api/health`.
- Preserve timestamp freshness, wallet-to-AgentID matching, Active-state verification, and atomic nonce replay protection.
- Preserve authentication-before-routing: blocked requests must always report `receiverExecuted: false`.
- Treat audit/interaction warnings as observability degradation, never as evidence that an absent record exists.
- Do not automatically retry a signed request, nonce write, receiver execution, or blockchain transaction.

## Local launch procedure

Use four terminals in this order:

```powershell
cd "C:\BlockChain Project67\blockchain"
npm install
npm run compile
npm run node
```

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run demo:localhost
```

```powershell
cd "C:\BlockChain Project67\backend"
npm install
$env:NODE_ENV='development'
$env:ENABLE_DEMO_SIGNING='true'
npm run dev
```

```powershell
cd "C:\BlockChain Project67\frontend"
npm install
npm run dev
```

Open `http://127.0.0.1:5173/app`. `DEMO READY` is displayed only when the backend, chain `31337`, contract, configured persistence mode, and guarded demo signing are all healthy.

## Stage 9 deployment checklist — do not execute during Stage 8

1. Review and approve a specific Ethereum testnet, RPC provider, frontend host, backend host, and Supabase project.
2. Re-run all blockchain, backend, and frontend tests from a clean checkout.
3. Review the Solidity compiler settings, contract source, deployment account, and testnet funding plan.
4. Deploy `AgentRegistry` to the approved testnet and independently verify its bytecode/address.
5. Configure backend secrets and public network values with demo signing disabled.
6. Apply and verify the Supabase migration and server-only permissions.
7. Configure the exact HTTPS frontend CORS origin and backend URL.
8. Configure SPA fallback, TLS, health checks, log retention, and rollback behavior.
9. Build the frontend using only public configuration and deploy the immutable build artifacts.
10. Run public-environment smoke tests for health, registry reads, wallet connection, signing, verification, replay blocking, revocation, Explorer, and Analytics.
11. Confirm no local `.env`, key, mnemonic, service-role credential, development log, or unlocked-account workflow was deployed.
12. Record the final public URLs, chain ID, contract address, release commit, and verification evidence in project documentation.

No Stage 9 action above has been executed by Stage 8.
