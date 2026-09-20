# Security Lab

The Security Lab at `/app/security` demonstrates authentication-before-routing with eight fixed local scenarios:

| Scenario | Protection demonstrated |
|---|---|
| `VALID` | A fresh, correctly signed TravelAI request is verified and HotelAI executes. |
| `UNKNOWN_WALLET` | A signer without a registered AgentID is rejected. |
| `IMPERSONATION` | A registered wallet cannot claim another wallet's AgentID. |
| `REVOKED_AGENT` | A correctly signed request from a Revoked identity is rejected. |
| `REPLAY` | Reusing an accepted sender/nonce pair is rejected. |
| `EXPIRED` | A stale timestamp is rejected. |
| `PAYLOAD_TAMPER` | Changing the payload after signing invalidates the claimed identity. |
| `RECEIVER_TAMPER` | Changing the receiver after signing invalidates the claimed identity. |

Every request uses the existing EIP-712 authentication and communication pipeline. A blocked result has `receiverExecuted: false`; the receiver handler is called only after all checks pass.

The runner is deliberately narrow. It requires development mode, an explicit enable flag, local chain `31337`, a loopback RPC endpoint, and known unlocked Hardhat demo accounts. It exposes no arbitrary signing input and no private keys. Never enable it on a public or funded network.
