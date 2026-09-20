# Stage 7: Trust Graph, Security Lab, Explorer, and Analytics

Stage 7 turns the existing AgentID identity, authentication, communication, and persistence layers into an operational intelligence console. It does not replace or bypass any earlier security control.

## Start the complete local system

Open four PowerShell terminals.

```powershell
# Terminal 1
cd "C:\BlockChain Project67\blockchain"
npm run node

# Terminal 2
cd "C:\BlockChain Project67\blockchain"
npm run demo:localhost

# Terminal 3
cd "C:\BlockChain Project67\backend"
$env:NODE_ENV='development'
$env:ENABLE_DEMO_SIGNING='true'
npm start

# Terminal 4
cd "C:\BlockChain Project67\frontend"
npm run dev
```

Open `http://127.0.0.1:5173/app`. Confirm the header says `SYSTEM ONLINE`, `CHAIN 31337`, and the expected persistence mode before running a demo.

## Trust Graph

Route: `/app/trust-graph`

- Nodes come from the real `AgentRegistry` and show current Active or Revoked state.
- Verified edges come from persisted successful interactions.
- Blocked edges come from persisted blocked audit events where both endpoints are registered identities.
- Search and lifecycle-status filters operate on these real records.

The graph deliberately does not calculate reputation, reliability, or a trust score. It visualizes observed, persisted facts only.

## Security Lab

Route: `/app/security`

The lab can run exactly eight controlled scenarios: `VALID`, `UNKNOWN_WALLET`, `IMPERSONATION`, `REVOKED_AGENT`, `REPLAY`, `EXPIRED`, `PAYLOAD_TAMPER`, and `RECEIVER_TAMPER`.

Each request passes through the existing EIP-712 authentication and communication service. A blocked result must show that receiver execution did not occur. The revoked scenario confirms real revoke and reactivate transactions around the test.

Execution is disabled unless every guard is true:

- `NODE_ENV=development`;
- `ENABLE_DEMO_SIGNING=true`;
- configured and connected chain ID `31337`;
- loopback RPC host;
- seeded TravelAI and HotelAI owners are unlocked local Hardhat accounts;
- the unknown-wallet case uses an unlocked Hardhat account that is not registered.

There is no arbitrary signing, wallet, payload, RPC, contract-address, or private-key input. Never enable the demo signer on a public or funded network.

## Explorer

Route: `/app/explorer`

The Explorer reads the connected JSON-RPC provider and the configured AgentRegistry. It shows the current network and contract, recent canonical blocks, decoded identity lifecycle events, relevant transactions, receipt status, and receipt-derived gas usage. Search covers AgentIDs, wallets, hashes, and loaded block numbers.

## Advanced Analytics

Route: `/app/analytics`

Analytics are computed by the backend from real registry identities, paginated audit events, persisted interactions, and blockchain lifecycle events. The time selector supports one hour, 24 hours, seven days, and all time. Empty ranges show an honest empty state rather than demo totals.

## Stage 7 API

- `GET /api/stage7/trust-graph`
- `GET /api/stage7/analytics?range=1h|24h|7d|all`
- `GET /api/stage7/explorer?limit=8&query=...`
- `GET /api/security/scenarios`
- `POST /api/security/scenarios/:scenario`

The last endpoint accepts only the eight enumerated scenario names and ignores arbitrary request fields.

## Verification

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run compile
npm run typecheck
npm test

cd "C:\BlockChain Project67\backend"
npm run typecheck
npm test

cd "C:\BlockChain Project67\frontend"
npm run typecheck
npm test
npm run build
```

The four Stage 7 routes are lazy-loaded into separate production chunks. Responsive browser verification covers 1920, 1440, 1366, 1024, 768, and 390 CSS-pixel widths.

Focused beginner guides are available in `TRUST_GRAPH.md`, `SECURITY_LAB.md`, `EXPLORER.md`, and `ANALYTICS.md`.
