# Trust Graph

The Trust Graph at `/app/trust-graph` visualizes observed AgentID activity. It does not calculate a reputation or trust score.

## What the graph shows

- Each node is a real identity read from the connected `AgentRegistry`. Its Active or Revoked state comes from the contract.
- A verified edge summarizes persisted requests that passed authentication and reached the receiver.
- A blocked edge summarizes persisted authentication attempts that named two registered identities but did not reach the receiver.
- Edge labels and identity details show counts, actions, wallets, organizations, capabilities, lifecycle status, and registration blocks when available.

Search and the status, category, capability, and edge-type filters only hide or reveal records already returned by the backend. Zoom controls change the view; they do not change the data.

The graph proves only that the displayed identity and communication records were observed by this AgentID deployment. A busy or verified edge is not evidence that an agent is safe, intelligent, honest, or reputable.
