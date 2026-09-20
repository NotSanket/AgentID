# AgentID

## A Blockchain-Based Decentralized Identity and Trust Framework for Collaborative AI Agents

AgentID gives an AI agent a readable on-chain identity bound to an Ethereum wallet, then authenticates signed agent-to-agent requests before any receiver logic is allowed to run.

- Public frontend: https://sankets-agent-id.vercel.app
- Public backend: https://agentid-backend.onrender.com
- Blockchain: Ethereum Sepolia
- Chain ID: `11155111`
- AgentRegistry: `0xA8fC4db5eFD8F6a316fbAB81Fb4cb83A8826d42a`

**Architecture:** Browser wallet → Sepolia AgentRegistry → Render verification API → Supabase persistent metadata/audit/index → Vercel interface.

AgentID proves identity ownership, lifecycle state, and signed-request integrity. It does not prove that an AI model is intelligent, safe, truthful, or high quality.

## The problem

Collaborating AI agents need a reliable way to answer four basic questions:

1. Which identity is sending this request?
2. Does the sender control the wallet registered to that identity?
3. Is the identity currently Active rather than Revoked?
4. Has the signed request expired, been changed, or already been used?

A normal application account can answer some of these questions, but it places identity ownership and lifecycle authority entirely inside one database. AgentID keeps the small, security-critical identity record on Ethereum while using conventional persistence for richer application data.

## The solution

The `AgentRegistry` smart contract binds one AgentID to one wallet and records the agent name, organization, metadata reference, and Active/Revoked lifecycle. A sender signs the complete request with EIP-712. The backend recovers the signer, compares it with the on-chain owner, checks lifecycle state and freshness, atomically consumes the nonce, and only then routes the request to a deterministic receiver.

## Major features

- wallet-bound AgentID registration, lookup, update, revocation, and reactivation;
- public Agent Passports backed by real registry and lifecycle evidence;
- MetaMask/browser-wallet registration and EIP-712 signing;
- signer recovery and wallet-to-AgentID ownership verification;
- Active/Revoked enforcement, timestamp freshness, and replay protection;
- authentication-before-routing with `receiverExecuted: false` for blocked requests;
- persistent metadata, audit events, verified interactions, replay nonces, and decoded blockchain-event indexing;
- Registry, Verification, Communication, Security Lab, Trust Graph, Explorer, and Analytics pages;
- deterministic TravelAI, HotelAI, and PaymentAI handlers for explicit local development demonstrations;
- guarded local security scenarios covering valid, unknown-wallet, impersonation, revoked, expired, replay, payload-tamper, receiver-tamper, and malformed-signature cases;
- responsive Vite SPA with direct deep-link support on Vercel.

## Security model

A communication is accepted only when its complete typed request recovers the same wallet currently registered to an Active sender AgentID, the request is fresh, and its nonce has not already been accepted.

Production safeguards include:

- browser-wallet signatures; the backend does not hold production agent keys;
- Ethereum Sepolia chain `11155111` and the recorded AgentRegistry address;
- `ENABLE_DEMO_SIGNING=false`;
- no unlocked Hardhat accounts or Local Demo Wallet in production;
- an exact frontend-origin CORS allowlist rather than wildcard CORS;
- bounded request validation and fail-closed authentication dependencies;
- Supabase uniqueness for `(sender_agent_id, nonce)` as the persistent replay boundary;
- receiver execution only after successful authentication.

Local demo signing remains available only when explicitly enabled in development, using a loopback RPC and Hardhat chain `31337`.

## What is on-chain

Ethereum is authoritative for:

- AgentID;
- wallet owner and one-wallet/one-AgentID binding;
- agent name and organization;
- metadata URI/reference;
- Active or Revoked lifecycle state;
- registration, update, revocation, and reactivation events;
- transaction hashes, blocks, receipts, and contract proofs.

## What is off-chain

Supabase stores application data that does not need to be contract state:

- profile descriptions, categories, capabilities, avatar keys, and themes;
- authentication audit events;
- verified interaction history;
- consumed replay nonces;
- the persistent decoded blockchain-event index and scan checkpoint.

The event index accelerates reads and cold starts; it does not replace Ethereum as the authority. If the index and chain disagree, the chain is authoritative.

## Public production

The production stack is:

| Layer | Service |
|---|---|
| Interface | Vercel |
| API and verification | Render |
| Persistence | Supabase |
| Identity authority | Ethereum Sepolia |
| Wallet | MetaMask or another EIP-1193 browser wallet |

The real public registry currently proves the complete registration and passport flow with `AGT-TRAVEL-001` (TravelAI), Active on Sepolia. HotelAI and PaymentAI are optional manual public demo identities; the application never fabricates them.

Render Free may need tens of seconds to wake. The production frontend allows a bounded 75-second API window and schedules health polls only after the previous request finishes. A genuine failure is still shown honestly.

See [Production Deployment](docs/PRODUCTION_DEPLOYMENT.md) for the deployed topology and configuration boundaries.

## Local development

Requirements: Node.js 24, npm, and four terminals.

### 1. Start Hardhat

```powershell
cd "C:\BlockChain Project67\blockchain"
npm install
npm run compile
npm run node
```

### 2. Deploy and seed the local demonstration

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run demo:localhost
```

### 3. Start the backend

Copy the documented variable names from `backend/.env.example`. For the guarded local workflow, use development mode, loopback RPC, chain `31337`, and explicitly enable demo signing.

```powershell
cd "C:\BlockChain Project67\backend"
npm install
npm run dev
```

### 4. Start the frontend

```powershell
cd "C:\BlockChain Project67\frontend"
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Local demo identities and data are separate from public Sepolia production.

## Technology stack

- Solidity and Hardhat
- Node.js 24, Express 5, and strict TypeScript
- ethers.js v6 and EIP-712
- Supabase/PostgreSQL with Row Level Security
- React 19, Vite, React Router, Tailwind CSS, and Framer Motion
- Vitest, Testing Library, Mocha, and Chai
- Render and Vercel

## Testing

Final verified baseline:

- blockchain: **31/31** tests;
- backend: **161/161** tests;
- frontend: **80/80** tests;
- blockchain, backend, and frontend typechecks passing;
- Solidity compile passing;
- Vite production build passing.

Run the complete regression:

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
npm test -- --run
npm run build
```

## Current limitations

- AgentID proves wallet control and registry state, not intelligence, safety, truthfulness, or model quality.
- The public demonstration may contain only TravelAI until other owners manually register HotelAI and PaymentAI.
- A real multi-agent exchange needs separately owned registered identities; the presenter may need to switch MetaMask accounts.
- Receiver handlers are deterministic demonstrations, not LLM integrations.
- Trust Graph edges describe recorded interactions and blocks; they are not reputation scores.
- Supabase improves persistence and query performance but is not the blockchain authority.
- Free hosting can introduce backend cold-start delay.
- Contract source verification on Etherscan is still optional/pending because no API key was configured during deployment.

## Documentation

- [Final teacher demo and viva](docs/FINAL_DEMO.md)
- [Production deployment](docs/PRODUCTION_DEPLOYMENT.md)
- [Permanent project context](docs/PROJECT_CONTEXT.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Blockchain](docs/BLOCKCHAIN.md)
- [Supabase](docs/SUPABASE.md)
- [Security Lab](docs/SECURITY_LAB.md)
- [Trust Graph](docs/TRUST_GRAPH.md)
- [Explorer](docs/EXPLORER.md)
- [Analytics](docs/ANALYTICS.md)
