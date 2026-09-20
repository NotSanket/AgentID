# AgentID Final Demo and Viva Guide

This guide is designed so a second-year CSE student can present AgentID without needing another document.

## Before the presentation

1. Open `https://sankets-agent-id.vercel.app`.
2. Open `https://agentid-backend.onrender.com/api/health` in another tab and wait for `status: ok` if Render is waking.
3. Confirm MetaMask is on Ethereum Sepolia, chain ID `11155111`.
4. Keep the TravelAI Agent Passport ready at `/app/registry/AGT-TRAVEL-001`.
5. Do not expose the seed phrase, private key, RPC credential, or Supabase key.
6. Do not register, revoke, or update an identity during the presentation unless that transaction has been deliberately planned.

The public registry may contain only TravelAI. That is enough to prove the real public registration and passport flow. HotelAI and PaymentAI are optional manual public demo identities.

## A. 30-second explanation

“AgentID is a decentralized identity and request-authentication framework for collaborative AI agents. A smart contract binds a readable AgentID to an Ethereum wallet and records whether it is Active or Revoked. When one agent sends a request, its owner signs the complete request with EIP-712. The backend recovers the signer, checks the on-chain identity, timestamp, and nonce, and only then executes the receiver. Supabase stores metadata and audit history, but Ethereum remains the identity authority.”

## B. 60-second demo

1. Open the landing page and say: “This is the public Vercel interface connected to Ethereum Sepolia.”
2. Open **Registry**, select **TravelAI**, and say: “This is a real wallet-bound AgentID read from the deployed AgentRegistry.”
3. Point to **Active**, the owner wallet, registration transaction, and block evidence.
4. Open **Verification** and say: “The backend verifies ownership and lifecycle from the blockchain.”
5. Open **Communication** and say: “The browser wallet signs an EIP-712 request; authentication happens before routing.”
6. Open **Security Lab** and say: “Public attack execution is intentionally disabled because production has no demo private keys.”
7. Finish on **Explorer** or **Analytics** and say: “These pages show real chain evidence and persisted records, including valid empty states.”

## C. 2-minute demo

Follow this order:

1. **Landing Page** — explain the identity problem and the public architecture.
2. **Command Center** — show Sepolia, Supabase, and production readiness.
3. **Registry → TravelAI** — show the real identity and Agent Passport.
4. **Verification** — explain wallet recovery, Active status, freshness, and nonce checks.
5. **Communication** — explain browser-wallet signing and authentication-before-routing.
6. **Security Lab** — show the eight controlled scenario definitions; explain why execution is local-only.
7. **Explorer** — show real Sepolia blocks, events, transactions, and receipt-derived gas.
8. **Analytics** — explain that values come only from persisted records and may correctly be zero.

Closing line: “AgentID does not judge intelligence or truthfulness. It establishes who signed, which AgentID that wallet owns, whether the identity is Active, and whether the request is fresh and unreplayed.”

## D. 5-minute demo

### Minute 1 — Problem and architecture

Use the Landing Page. Explain that agents need portable identity and authenticated messages. Point out the architecture:

**Browser wallet → Sepolia AgentRegistry → Render verification API → Supabase persistence → Vercel interface.**

Explain why Sepolia is used: it behaves like Ethereum but uses test ETH, so the public demonstration does not risk real funds.

### Minute 2 — Registry and passport

Open Registry and TravelAI. Explain:

- AgentID is the readable identifier `AGT-TRAVEL-001`.
- Wallet binding means the registered Ethereum address is the identity owner.
- The smart contract enforces one AgentID per wallet and one wallet per AgentID.
- Active/Revoked is on-chain lifecycle state.
- Registration block and transaction are independently checkable evidence.

### Minute 3 — Verification and communication

Open Verification, then Communication. Explain that EIP-712 gives the wallet a readable structured request to sign. The signature covers sender, receiver, action, payload hash, timestamp, nonce, chain, and verifying contract. Changing a signed field invalidates the authorization.

Explain replay protection: a nonce is a one-time value. Once an accepted nonce is stored, the same request is blocked as `NONCE_REUSED`. Receiver code runs only after every authentication check passes.

### Minute 4 — Security and observability

Open Security Lab. Read the scenario names, but do not claim they were executed publicly. Production keeps `ENABLE_DEMO_SIGNING=false`; guarded attack execution belongs to local Hardhat development.

Open Trust Graph. Explain that nodes are real registered identities and edges come only from persisted verified interactions or blocked security activity. It is not a reputation score.

### Minute 5 — Chain evidence and analytics

Open Explorer. Show Sepolia chain information, the registry address, real blocks, lifecycle events, transaction hashes, receipts, and gas usage.

Open Analytics. Explain that it calculates verification attempts, verified/blocked counts, interactions, and blocked reasons from persisted audit and interaction records. Empty datasets are valid; the UI must never invent impressive numbers.

Finish with the authority boundary: Ethereum controls identity and lifecycle; Supabase makes off-chain history and indexed reads persistent.

## E. Exact click order and speaking guide

### 1. Landing Page

- **Click:** Open the public frontend, then choose **Launch AgentID Console**.
- **Say:** “AgentID gives collaborative AI agents wallet-bound identities and authenticated requests.”
- **Proves:** The public Vercel entry point and overall product purpose.

### 2. Command Center

- **Click:** **Command Center** in the sidebar.
- **Say:** “Production readiness uses the real Sepolia chain, reachable AgentRegistry, connected Supabase, and browser-wallet-only signing.”
- **Proves:** Live dependency reporting. Demo signing being disabled is a production security success.

### 3. Registry

- **Click:** **Registry**, then the **TravelAI** card.
- **Say:** “This list comes from real AgentRegistry events. TravelAI is not a hard-coded public identity.”
- **Proves:** On-chain discovery and lifecycle state.

### 4. TravelAI Agent Passport

- **Click:** Open `AGT-TRAVEL-001`; expand or copy technical values if useful.
- **Say:** “The passport combines authoritative on-chain identity with clearly separated off-chain profile metadata.”
- **Proves:** AgentID, wallet owner, organization as stored by the contract, Active status, and transaction/lifecycle evidence.

### 5. Verification

- **Click:** **Verification**. Inspect an AgentID or signed-request result; do not submit a transaction unless planned.
- **Say:** “Verification recovers the cryptographic signer and compares it with the wallet registered to the claimed Active AgentID.”
- **Proves:** Signer recovery, wallet binding, lifecycle checks, freshness, and replay checks.

### 6. Communication

- **Click:** **Communication**, select **Browser Wallet**, and inspect the available real registry identities.
- **Say:** “MetaMask is the source of the sender signature. The backend has no production agent key. A different agent owner may require switching the connected MetaMask account.”
- **Proves:** EIP-712, real ownership, and authentication-before-routing.
- **Honest limitation:** With only TravelAI publicly registered, a real distinct sender-to-receiver exchange cannot be fabricated. HotelAI and PaymentAI remain optional manual registrations.

### 7. Security Lab

- **Click:** **Security Lab** and select scenario names without running them publicly.
- **Say:** “The definitions and automated tests demonstrate the attacks, but production execution is disabled because demo signing is disabled.”
- **Proves:** Guardrails and fail-closed design, not a claim that the system is impossible to attack.

The guarded scenarios are:

- `VALID`
- `UNKNOWN_WALLET`
- `IMPERSONATION`
- `REVOKED_AGENT`
- `REPLAY`
- `EXPIRED`
- `PAYLOAD_TAMPER`
- `RECEIVER_TAMPER`

Every blocked case must report that the receiver was not executed. Malformed signatures are also handled safely by the authentication tests.

### 8. Trust Graph

- **Click:** **Trust Graph**, select a node, and inspect observed edges.
- **Say:** “Nodes come from the registry. Edges come from real persisted verified or blocked activity.”
- **Proves:** Evidence-backed relationships.
- **Do not say:** That an edge is reputation, endorsement, or a trust score.

### 9. Explorer

- **Click:** **Explorer**; inspect the network, registry, recent block, event, transaction, or receipt.
- **Say:** “This is Ethereum Sepolia evidence. Gas values are derived from transaction receipts.”
- **Proves:** Real chain, blocks, hashes, lifecycle events, and execution receipts.

### 10. Analytics

- **Click:** **Analytics** and change the time range if records exist.
- **Say:** “Success rate is verified audit attempts divided by total audit attempts. With zero attempts, the safe result is zero.”
- **Proves:** Real calculations over persisted audit and interaction data.

## Key concepts in simple language

### What AgentID means

An AgentID is a readable unique identifier, such as `AGT-TRAVEL-001`, stored in the registry and bound to one wallet.

### How MetaMask proves ownership

MetaMask signs a transaction or typed message using the wallet's private key without revealing that key. Ethereum or ethers.js recovers the public wallet address from the signature. Matching that address with the registry proves control of the registered wallet.

### Why EIP-712 is used

EIP-712 signs structured fields instead of an unclear text blob. The chain ID and AgentRegistry address are part of the domain, reducing cross-chain and cross-contract replay risk.

### What a nonce is

A nonce is a one-time request value. AgentID stores accepted sender-and-nonce pairs. Reusing one is blocked before receiver execution.

### Why authentication happens before routing

If routing happened first, an attacker could trigger receiver behavior before being rejected. AgentID authenticates first and returns `receiverExecuted: false` for every blocked request.

### Revoke and reactivate

Revoking keeps the identity record but changes its lifecycle state so authentication fails. Reactivating restores Active status. Only the registered owner can perform those actions.

### What Supabase does

Supabase persists richer profile metadata, audit events, verified interactions, replay nonces, and a decoded event index. It does not decide who owns an AgentID.

### Why persistent event indexing exists

Public RPC providers limit large log queries and Render can restart. The index stores decoded lifecycle events and the last completed block, allowing the backend to resume incrementally instead of rescanning from deployment every time.

### Render cold-start behavior

If the backend is waking, the health banner may remain in a checking state for tens of seconds. Wait up to about one minute, then refresh once. Do not interpret a temporary wake-up delay as fabricated data or retry a signed request automatically.

## DO NOT CLAIM

Do not claim that:

- blockchain proves intelligence;
- blockchain proves an agent is safe;
- blockchain proves an agent response is truthful;
- Trust Graph is reputation;
- every field is stored on-chain;
- AgentID proves model quality;
- AgentID eliminates all malicious agents;
- Security Lab attacks were executed against public production when execution was disabled;
- Supabase is the identity authority;
- an absent HotelAI or PaymentAI exists publicly.

## Viva questions and concise answers

1. **What problem are you solving?**
   AgentID authenticates which registered AI-agent identity sent a request and blocks expired, modified, replayed, revoked, or impersonated requests before receiver execution.

2. **Why use blockchain?**
   It provides a shared, independently verifiable ownership and lifecycle record that is not controlled only by the application database.

3. **Why not use only a normal database?**
   A database is efficient for metadata and history, but its operator could unilaterally change identity ownership. AgentID keeps that authority on-chain and uses a database for non-authoritative application data.

4. **Why Sepolia?**
   Sepolia behaves like public Ethereum while using test ETH, making it suitable for a real public demonstration without real monetary risk.

5. **What exactly is decentralized?**
   Identity ownership and lifecycle are enforced by the deployed Ethereum contract. The web interface, API, and Supabase persistence are conventional hosted components.

6. **What is AgentID?**
   A unique readable identifier stored in AgentRegistry and bound to one Ethereum wallet.

7. **What does the wallet prove?**
   A valid signature proves control of the wallet's private key at signing time. It does not prove the agent is intelligent or honest.

8. **What does EIP-712 do?**
   It defines typed structured data so the wallet signs exact request fields under a specific chain and contract domain.

9. **What is replay protection?**
   It prevents an already accepted signed request from being submitted again.

10. **What is a nonce?**
    A unique one-time value included in a signed request and stored after acceptance.

11. **Why use Supabase?**
    It provides persistent PostgreSQL storage for metadata, audits, interactions, nonces, and the event index across backend restarts.

12. **What stays on-chain?**
    AgentID, wallet owner, name, organization, metadata reference, lifecycle state, and lifecycle events.

13. **What stays off-chain?**
    Rich profile fields, audit history, verified interactions, replay records, analytics inputs, and decoded event-index records.

14. **What happens if Supabase fails?**
    Production readiness degrades. Security-critical replay persistence fails closed, so the receiver does not execute. The blockchain identity still exists independently.

15. **What happens if the RPC fails?**
    The backend cannot verify authoritative identity or lifecycle state, so verification fails closed and the UI reports the chain as unavailable.

16. **Why use local Hardhat?**
    It gives deterministic accounts and fast development testing without public gas or production keys.

17. **Why is demo signing disabled publicly?**
    A public backend must not hold or expose agent private keys or unlocked development accounts. Public users sign through their own browser wallet.

18. **What is the persistent event index?**
    A Supabase copy of decoded, verified AgentRegistry events plus a per-chain checkpoint used for efficient incremental reads. Ethereum remains authoritative.

19. **How is duplicate communication prevented?**
    The sender and nonce pair is atomically stored with a uniqueness constraint. Reuse returns `NONCE_REUSED` before routing.

20. **How does revocation work?**
    The owner submits an on-chain revoke transaction. The identity remains visible but changes to Revoked, and authentication rejects it until reactivated.

21. **What is the Trust Graph?**
    A visualization of real registry identities and recorded verified or blocked relationships. It is not a reputation engine.

22. **What are the current limitations?**
    The public registry may have only one identity, receiver handlers are deterministic, free hosting can cold-start, and identity proof does not establish response quality or safety.

23. **How could this become a product?**
    It could offer organization-issued credentials, policy controls, enterprise directories, and SDKs while preserving wallet-bound verification and clear authority boundaries.

24. **Why does authentication occur before receiver execution?**
    It prevents untrusted requests from triggering any protected receiver logic.

25. **Can Supabase change an AgentID owner?**
    No. Ownership is read from AgentRegistry on Ethereum.

26. **What happens when there are no analytics records?**
    The UI shows valid zeros. It never creates fake activity to make the dashboard look busy.

## Future Product Direction

Possible future work includes organization-issued agent credentials, richer verifiable claims, cross-chain or interoperable identity, enterprise agent directories, policy-based permissions, SDK/API integrations, and human-approved trust attestations. These are product directions, not features claimed by the current implementation.
