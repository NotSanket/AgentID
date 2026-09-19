# AgentID Identity Portal

This guide explains the Stage 5 identity portal in beginner-friendly terms. It covers how an AI agent receives an AgentID, what the controlling wallet means, and how to use the local demonstration safely.

## The simple idea

An AgentID is a readable name such as `AGT-RESEARCH-001` that is registered in the `AgentRegistry` smart contract. The contract binds that ID to the Ethereum wallet that submitted the registration transaction.

The blockchain answers three authoritative questions:

1. Does this AgentID exist?
2. Which wallet controls it?
3. Is it currently Active or Revoked?

Supabase stores useful profile information such as a description, category, and capabilities. That information enriches the identity, but it does not replace the blockchain as the source of truth for ownership or lifecycle status.

## Wallet ownership and `msg.sender`

When `registerAgent` runs, Solidity records `msg.sender` as the owner. `msg.sender` is the address that submitted the transaction. The frontend cannot choose a different owner in a form field.

The same wallet must later submit on-chain updates, revocation, or reactivation. The UI hides protected actions for other wallets, but that is only a convenience: the smart contract and backend enforce ownership again.

Never use a local Hardhat demo wallet with real funds. These unlocked accounts exist only for local development.

## Two write modes

### Browser wallet

Browser-wallet mode uses an injected Ethereum wallet through `window.ethereum` and ethers `BrowserProvider`. The connected user reviews and signs the real contract transaction. The portal checks that the wallet is on chain `31337` for the local demo.

For metadata-only changes, the wallet signs a short, timestamped authorization message. The backend recovers the signer and confirms that it still controls the AgentID before saving metadata.

### Local demo wallet

Local demo mode is a teaching convenience. The backend uses one of a small set of unlocked accounts supplied by the local Hardhat node. It exposes only the wallet label, address, whether it is available, and any assigned AgentID.

The mode works only when all of these are true:

- `NODE_ENV=development`;
- `ENABLE_DEMO_SIGNING=true`;
- the configured and connected chain IDs are `31337`;
- the RPC endpoint is `localhost`, `127.0.0.1`, or `::1`;
- the selected address belongs to the restricted demo-wallet pool;
- the deployed AgentRegistry is reachable.

The backend never returns, accepts, logs, or stores private keys. Leave demo signing disabled outside the local teaching environment.

## Registering an agent

Open `/app/register` and complete the five real steps:

1. **Profile** - enter the name, organization, description, category, and capabilities.
2. **AgentID** - generate or enter an uppercase identifier such as `AGT-RESEARCH-001`. The backend performs a preliminary availability check; the contract makes the final uniqueness decision.
3. **Ownership** - connect a browser wallet or choose an available local demo wallet.
4. **Review** - confirm the identity, owner wallet, network, and chain ID.
5. **Issue identity** - submit the real transaction and wait for its receipt.

Success shows the actual transaction hash, block number, wallet, contract, chain, and ACTIVE state. It also provides direct links to the Digital Agent Passport and Registry.

Metadata is synchronized after the chain confirms. If that separate step fails, the identity still exists on-chain. The portal displays `Identity registered on-chain. Metadata synchronization requires attention.` and offers a metadata retry.

## Digital Agent Passport

The passport at `/app/registry/:agentId` combines authoritative blockchain data with optional profile metadata. It shows:

- name, AgentID, organization, description, category, and capabilities;
- owner wallet, lifecycle status, network, chain ID, and registry contract;
- registration block and transaction hash;
- the real Registered, Updated, Revoked, and Reactivated event timeline;
- copy, share, and JSON export controls.

Select or connect the controlling wallet to reveal Update, Revoke, or Reactivate actions.

## Updating, revoking, and reactivating

On-chain fields are the agent name, organization, and metadata URI. Changing one of those fields requires a real contract transaction and receipt.

Description, category, capabilities, avatar key, and accent theme are off-chain metadata. They are saved separately after owner authorization. A metadata-only edit does not create an unnecessary blockchain transaction.

Revoking changes the contract state from Active to Revoked. Signed requests from that identity are then rejected by authentication. Reactivating changes the same existing identity back to Active; it does not create a new AgentID.

## Registry and verification

`/app/registry` discovers identities from registration events, fetches their current contract records, and adds metadata where available. It still shows blockchain identities if Supabase metadata cannot be loaded.

`/app/verification` has two modes:

- **Registry verification** looks up an AgentID or wallet and reports ACTIVE, REVOKED, or NOT FOUND using the real AgentRegistry.
- **Advanced signed request** submits the structured EIP-712 request and signature to the existing Stage 2 verifier. It displays signature, wallet-match, lifecycle, timestamp, and replay-nonce checks plus the backend result code.

An ACTIVE result proves that the AgentID exists, is bound to the displayed wallet, and is not revoked. It does not prove that the agent is safe, truthful, intelligent, or reputable.

## Run the complete local portal

Use four PowerShell terminals.

Terminal 1:

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run node
```

Terminal 2:

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run deploy:localhost
npm run demo:localhost
```

Terminal 3:

```powershell
cd "C:\BlockChain Project67\backend"
$env:NODE_ENV='development'
$env:ENABLE_DEMO_SIGNING='true'
npm run dev
```

Terminal 4:

```powershell
cd "C:\BlockChain Project67\frontend"
npm run dev
```

Open `http://127.0.0.1:5173/app`.

The backend reads its untracked `backend/.env`. Never copy its Supabase server key into the frontend, documentation, screenshots, commits, or API responses.

## Verification commands

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

On the current Windows/Codex host, use the repository-local `NODE_OPTIONS` and `LOCALAPPDATA` workaround documented in `PROJECT_CONTEXT.md` before Hardhat or backend startup. A normal local installation may not need it.
