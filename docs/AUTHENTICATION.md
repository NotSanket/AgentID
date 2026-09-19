# AgentID request authentication

## Why the registry alone is not enough

The blockchain can say that `AGT-TRAVEL-001` belongs to wallet `0xABC...`, but a JSON request can contain any text. An attacker can copy the AgentID. The receiver therefore needs two facts together:

1. the registry's current AgentID-to-wallet binding and Active/Revoked state; and
2. cryptographic proof that the current request was signed by that wallet.

AgentID verifies identity control. It does **not** prove that an AI is honest, safe, intelligent, or trustworthy.

## What the sender signs

AgentID uses EIP-712 typed structured data with this domain:

- name: `AgentID`
- version: `1`
- current chain ID
- current `AgentRegistry` address

The signed request covers `requestId`, sender AgentID, receiver AgentID, action, payload hash, timestamp, and nonce. The domain also binds the signature to this chain and contract.

EIP-712 is preferable to signing an arbitrary sentence because every field has a name and type. There is less ambiguity about what the user or agent authorized.

JSON object keys can be inserted in different orders. The backend recursively sorts keys, serializes the payload deterministically, and signs its Keccak-256 hash. Arrays keep their order. Changing a city, guest count, receiver, action, timestamp, nonce, or request ID changes the signed digest.

## Verification flow

```text
validate schema
  -> confirm receiver exists
  -> recover wallet from EIP-712 signature
  -> confirm recovered wallet has an AgentID
  -> read claimed sender from AgentRegistry
  -> require Active status
  -> compare recovered wallet with registered wallet
  -> require a fresh timestamp
  -> atomically consume an unused nonce
  -> route to the receiver agent
```

The recovered wallet is calculated from the message and signature; the sender does not get to choose it in a plain JSON field. An unregistered recovered wallet is blocked with `UNKNOWN_WALLET`. If a wallet registered to another agent signs while claiming TravelAI, the recovered and registered wallets differ, so the request is blocked with `WALLET_MISMATCH`.

Tampering also changes the digest. A mathematically well-formed signature may still recover *a* wallet for the altered data, but it will not recover TravelAI's registered wallet. In the deterministic security tests this recovered address is unregistered, so the result is `UNKNOWN_WALLET`; if it happened to be registered to another identity, the result would be `WALLET_MISMATCH`. Both outcomes block delivery because the original signer is no longer recovered.

## Freshness and replay protection

The default freshness window is 300 seconds, with 30 seconds of future clock-skew tolerance. Old or excessively future requests receive `REQUEST_EXPIRED`.

A nonce is a unique one-time value. The in-memory replay store consumes it only after every other authentication check succeeds. Submitting the same accepted request again receives `NONCE_REUSED`. Rejected requests do not consume their nonce.

Nonce state is off-chain because it is high-frequency operational data. Putting every request nonce on Ethereum would add latency, public data, and transaction cost without needing blockchain consensus. Stage 3 can persist this state outside Ethereum.

## Revocation

Revocation is an on-chain identity lifecycle event. Even a correctly signed request is blocked with `AGENT_REVOKED` when the registered identity is currently Revoked. Reactivation is also an owner-authorized on-chain action.

## Valid and impersonation examples

For a valid TravelAI request, the backend recovers TravelAI's wallet, finds the same wallet under `AGT-TRAVEL-001`, confirms Active status, freshness, and an unused nonce, then allows HotelAI to run.

For impersonation, the registered PaymentAI wallet signs a request that claims `AGT-TRAVEL-001`. Signature recovery returns PaymentAI's wallet, which differs from TravelAI's on-chain wallet. The backend records an off-chain `IMPERSONATION_BLOCKED` audit event and HotelAI never receives the request. A completely unregistered signer is separately recorded as `UNKNOWN_WALLET_BLOCKED`.

## On-chain versus off-chain records

- On-chain events describe identity registration, update, revocation, and reactivation.
- Off-chain audit events describe request verification and rejection attempts.

Audit entries are not called blockchain transactions because Stage 2 stores them only in process memory. They reset when the backend restarts. No conversations, payload history, or replay nonces are written to Ethereum.

## Rejection codes

The main codes are `INVALID_REQUEST`, `INVALID_SIGNATURE`, `UNKNOWN_WALLET`, `UNKNOWN_AGENT`, `UNKNOWN_RECEIVER`, `WALLET_MISMATCH`, `AGENT_REVOKED`, `REQUEST_EXPIRED`, `NONCE_REUSED`, and `SERVICE_UNAVAILABLE`. Results include individual check fields instead of returning only `true` or `false`.
