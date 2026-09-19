import { ChevronDown, FileCheck2 } from "lucide-react";
import type { IdentityTransactionResult } from "../../types/api";
import { BlockNumber, TransactionHash, WalletAddress } from "../ui/TechnicalValue";
import { StatusBadge } from "../ui/StatusBadge";

export function TransactionReceiptPanel({ transaction }: { transaction: IdentityTransactionResult }) {
  return (
    <section className="transaction-panel" aria-label="Transaction confirmation">
      <header><span><FileCheck2 /><span><strong>{transaction.operation} CONFIRMED</strong><small>Real blockchain receipt</small></span></span><StatusBadge tone="verified" label="CONFIRMED" /></header>
      <div className="transaction-grid">
        <div><small>TRANSACTION HASH</small><TransactionHash value={transaction.transactionHash} /></div>
        <div><small>BLOCK NUMBER</small><BlockNumber value={transaction.blockNumber} /></div>
        <div><small>FROM</small><WalletAddress value={transaction.from} /></div>
        <div><small>CONTRACT</small><WalletAddress value={transaction.to} /></div>
        <div><small>CHAIN ID</small><code>{transaction.chainId}</code></div>
        <div><small>AGENTID</small><code>{transaction.agentId}</code></div>
      </div>
      <details><summary><ChevronDown /> Raw technical details</summary><pre>{JSON.stringify(transaction, null, 2)}</pre></details>
    </section>
  );
}
