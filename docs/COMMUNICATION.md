# AgentID Authenticated Communication

This guide explains Stage 6 in beginner-friendly terms. The demo shows how one software agent can prove its identity before another agent is allowed to process its request.

## The simple idea

TravelAI wants HotelAI to search for rooms. HotelAI should not trust the text `AGT-TRAVEL-001` by itself, because anyone could type that name. TravelAI therefore signs the complete request with the wallet that controls its AgentID.

AgentID checks the signature and the on-chain identity before HotelAI runs:

```text
TravelAI prepares and signs a request
                 |
                 v
AgentID authenticates the trust envelope
                 |
          VERIFIED only
                 v
HotelAI executes its deterministic handler
                 |
                 v
Audit and interaction records are persisted
```

If any security check fails, the request is blocked and the receiver is not executed.

## What EIP-712 signing means

EIP-712 is a standard way for an Ethereum wallet to sign structured data. The Stage 6 request binds all of these values together:

- request ID;
- sender AgentID;
- receiver AgentID;
- action;
- canonical payload hash;
- timestamp;
- nonce.

Changing any signed value changes what the signature represents. The backend uses the same Stage 2 schema and canonical payload hashing code to recover the signing wallet. Stage 6 does not introduce a second signing format.

The private key never leaves the wallet. Browser mode asks the connected wallet to sign. Local demo mode asks the backend to use a known unlocked Hardhat signer under strict development guards; its API never returns the key.

## The authentication gates

The backend applies the following checks before routing:

1. **Receiver lookup** - the receiver must exist in `AgentRegistry` and be Active.
2. **Signature recovery** - the EIP-712 signature must be valid and produce a wallet address.
3. **Sender lookup** - the wallet and claimed sender AgentID must both be registered.
4. **Wallet match** - the recovered wallet must be the wallet currently bound to the claimed AgentID.
5. **Lifecycle state** - a Revoked sender is blocked with `AGENT_REVOKED`.
6. **Timestamp freshness** - old requests and requests too far in the future are rejected.
7. **Nonce replay protection** - the sender/nonce pair must not have been accepted before.

Only after every gate passes does `CommunicationService` call the existing deterministic receiver router. A blocked result always reports `receiverExecuted: false`.

## Why the nonce exists

A valid signature could otherwise be copied and submitted repeatedly. Each prepared request receives a cryptographically random 32-byte nonce. The replay store atomically consumes the sender/nonce pair during successful authentication.

Replaying the exact accepted envelope therefore returns:

```text
BLOCKED
NONCE_REUSED
RECEIVER NOT EXECUTED
```

In Supabase mode, the unique nonce record survives a backend restart. In in-memory mode, it lasts only for that backend process.

## Active and Revoked identities

The Ethereum `AgentRegistry` remains the authority for identity ownership and lifecycle state. Supabase does not decide whether an identity is Active.

Revocation is immediate authentication policy: a correctly signed request from a Revoked sender is still blocked. Reactivation restores the same AgentID; it does not create a new identity.

## Persistence

Every authentication attempt writes an audit event when persistence is available. Successful verified delivery also writes an interaction containing the request ID, sender, receiver, action, request payload, response payload, result code, duration, and creation time.

The interaction table intentionally does not retain private keys, signatures, or reusable nonce material. The current-session inspector can display the signed envelope for teaching, while persistent history combines the safe interaction and audit records.

## Demo agents are deterministic handlers

TravelAI, HotelAI, and PaymentAI are local deterministic handlers used to demonstrate authenticated agent architecture. They return predictable `SIMULATED_DEMO_DATA` and make no external API calls.

They are not LLMs, trained models, or fine-tuned models. AgentID is the identity and authentication layer around agent logic; it does not claim that the underlying logic is intelligent, safe, truthful, or high quality.

The supported handlers are:

| Receiver | Actions |
|---|---|
| TravelAI | `PLAN_TRIP`, `BUILD_ITINERARY` |
| HotelAI | `SEARCH_HOTELS`, `CHECK_AVAILABILITY` |
| PaymentAI | `AUTHORIZE_PAYMENT`, `MOCK_PAYMENT` |

The Travel Workflow sends two independent signed requests: TravelAI to HotelAI, followed by TravelAI to PaymentAI. Each arrow shown as verified corresponds to a completed authentication and receiver execution.

## Using the Communication page

Open `/app/communication` after starting the local chain, deploying and seeding the registry, and starting the backend and frontend.

1. Choose local demo or browser-wallet signing.
2. Select a sender that the chosen wallet controls.
3. Select an Active receiver and one of its supported actions.
4. Edit the friendly payload fields or switch to exact JSON.
5. Select **Sign & Send Request**.
6. Watch the real trust pipeline change from waiting/processing to pass or fail.
7. Inspect the response, trust envelope, signed request, audit result, and persistent history.

The **Replay Previous Request** action resubmits the exact accepted request and signature. It is deliberately expected to fail with `NONCE_REUSED`. A Revoked local demo identity is labeled as a controlled lifecycle failure demonstration.

Communication fails closed when the backend or blockchain is unavailable. The UI disables delivery and shows `VERIFICATION SERVICE UNAVAILABLE`.

## Run locally

Use four PowerShell terminals:

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run node
```

```powershell
cd "C:\BlockChain Project67\blockchain"
npm run deploy:localhost
npm run demo:localhost
```

```powershell
cd "C:\BlockChain Project67\backend"
$env:NODE_ENV='development'
$env:ENABLE_DEMO_SIGNING='true'
npm run dev
```

```powershell
cd "C:\BlockChain Project67\frontend"
npm run dev
```

Then open `http://127.0.0.1:5173/app/communication`.

The backend reads the ignored `backend/.env`. Never copy the Supabase service-role secret or a wallet private key into frontend code, documentation, screenshots, API responses, or Git.
