# AgentID blockchain guide

This guide explains the current blockchain layer in simple terms for a project demonstration or viva.

## What the registry proves

The `AgentRegistry` contract is the identity source of truth. It can prove that an AgentID was registered by a wallet and show the identity's current lifecycle status.

It does **not** prove that an AI agent behaves safely, tells the truth, is intelligent, or is free from malicious code. Those are different security questions.

## The Agent struct

Each identity is stored as an `Agent` record:

| Field | Meaning |
|---|---|
| `agentId` | Human-readable ID such as `AGT-TRAVEL-001` |
| `name` | Display name such as `TravelAI` |
| `organization` | Organization responsible for the agent |
| `owner` | Ethereum wallet that registered and controls the identity |
| `metadataURI` | Optional reference to richer off-chain metadata |
| `registeredAt` | Blockchain timestamp when registration occurred |
| `updatedAt` | Timestamp of the latest profile or status change |
| `status` | `None`, `Active`, or `Revoked` |

The owner and AgentID cannot be changed by `updateAgent`. This keeps V1 ownership simple and auditable.

## Readable IDs and mappings

Users work with readable strings such as `AGT-HOTEL-001`. Internally, Solidity calculates:

```solidity
keccak256(bytes(agentId))
```

This fixed-size `bytes32` key makes mapping lookup efficient. The original readable ID is still stored in the record and returned to the application, so a future UI does not need to show an ugly hash.

The contract uses three private mappings:

1. Agent key to the full `Agent` record.
2. Wallet address to its Agent key for reverse lookup.
3. Wallet address to a registration flag.

The third mapping makes the “one wallet, one identity” V1 rule explicit. Private mappings stop other contracts from reading raw storage through an automatically generated getter, but blockchain storage is still publicly observable. Private must not be confused with secret.

## Why `msg.sender` matters

`msg.sender` is the wallet that actually submitted the transaction. During registration, the contract stores `msg.sender` as the identity owner.

This prevents a dangerous design where a form supplies one wallet address but a different wallet sends the transaction. If the contract trusted the form value, someone could create misleading or unusable ownership records. Binding registration to `msg.sender` means the registering wallet demonstrates control by signing and sending the blockchain transaction.

For update, revoke, and reactivate operations, the contract compares `msg.sender` with the stored owner. An unrelated wallet receives the `NotAgentOwner` custom error.

## Lifecycle

```text
Not registered (None)
        |
        | registerAgent
        v
      Active <--------------------+
        |                         |
        | revokeAgent             | reactivateAgent
        v                         |
      Revoked --------------------+
```

- `None` means no record exists for that AgentID.
- `Active` means the identity exists and is currently enabled.
- `Revoked` means the identity still exists but must not pass active verification.

Only `Active -> Revoked` and `Revoked -> Active` are valid status changes. Revoking twice or reactivating an already Active identity fails with `InvalidStatus`. There is no delete operation, so the identity and lifecycle events remain auditable.

## Contract functions

### `registerAgent`

Validates field lengths and required text, rejects duplicate IDs, rejects a wallet that already owns an identity, stores `msg.sender` as owner, and starts the identity as Active.

### `getAgent`

Returns the full record for a readable AgentID. A missing ID fails clearly with `AgentNotFound`.

### `getAgentByWallet`

Uses the reverse mapping to return the identity owned by a wallet. An unregistered wallet fails with `WalletNotRegistered`.

### `verifyAgent`

Returns whether the ID exists, whether it is Active, its owner, status, and timestamps. Unlike direct lookup, verification intentionally does not revert for an unknown ID; it returns `exists = false`. This is convenient for a future API performing identity checks.

### `updateAgent`

Lets only the owner change the name, organization, and metadata URI. It cannot change the AgentID or wallet owner. It refreshes `updatedAt`.

### `revokeAgent` and `reactivateAgent`

These owner-only functions perform the two allowed lifecycle transitions and refresh `updatedAt`.

## Validation and security choices

- Required AgentID, name, and organization fields cannot be empty.
- Text lengths are capped to avoid unexpectedly large on-chain records.
- Metadata URI may be empty because richer metadata is optional.
- AgentIDs and wallets cannot be registered twice.
- Owner-only changes are checked before state updates.
- The contract makes no external calls, so there is no external interaction or re-entrancy surface in these functions.
- Custom errors provide clear failures while using less gas than long revert strings.
- There are no admin overrides, destructive deletes, or hidden ownership transfers.

The functions follow checks-effects-interactions: validate first, update state second, and then emit an event. There are currently no external interactions.

## Events

The contract emits:

- `AgentRegistered`;
- `AgentUpdated`;
- `AgentRevoked`;
- `AgentReactivated`.

Each event includes an indexed AgentID hash, an indexed owner wallet, the readable AgentID, and a timestamp. Indexed fields allow a future Explorer to filter logs efficiently, while the readable ID makes displayed activity understandable.

Events are useful for history and feeds, but current contract storage remains the source for the latest status.

## Active versus Revoked

An Active result means: “this identity exists, is linked to this wallet, and has not currently been revoked.” It does not mean: “trust everything this agent says.”

A Revoked identity remains readable so other systems can see its owner and history, but `verifyAgent` returns `isActive = false`. A later backend should reject normal authenticated requests from a Revoked identity.

## How signed AI-agent requests will connect later

A future request flow can be:

1. TravelAI prepares a request containing its AgentID, payload, timestamp, and nonce.
2. TravelAI's wallet signs a deterministic representation of that request.
3. The receiving backend recovers the wallet address from the signature.
4. The backend calls `verifyAgent(AgentID)`.
5. It checks that the identity exists, is Active, and its stored owner equals the recovered signer.
6. It separately applies authorization, behavior, rate-limit, and business rules.

This proves control of the registered wallet at request time. The timestamp and nonce will help prevent replay attacks. The message body and conversation still remain off-chain.

## Gas report

The checked-in `local-gas-report.json` was generated from real Hardhat transaction receipts for registration, update, revoke, and reactivate. Run `npm run gas` after changing contract code. Gas values are observations, not promises, because different inputs and compiler settings can change them.

