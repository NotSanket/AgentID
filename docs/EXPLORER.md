# AgentID Explorer

The Explorer at `/app/explorer` reads the connected local Ethereum JSON-RPC provider and the configured `AgentRegistry`.

It shows:

- recent canonical blocks with hashes, parent hashes, timestamps, and transaction counts;
- real transaction receipts with status and gas used;
- decoded `Registered`, `Updated`, `Revoked`, and `Reactivated` contract events;
- the AgentID and owner associated with each lifecycle event;
- receipt-derived average gas grouped by actual contract operation;
- search matches for loaded AgentIDs, wallets, transaction hashes, event hashes, and block numbers.

The local chain is a disposable development network. Restarting Hardhat removes its chain state, so the registry must be redeployed and seeded again. Block numbers, hashes, and gas values are observations from the current run, not production guarantees.
