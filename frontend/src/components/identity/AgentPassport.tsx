import { Bot, Fingerprint, Radio, ShieldCheck } from "lucide-react";
import { AgentIdText, BlockNumber, TransactionHash, WalletAddress } from "../ui/TechnicalValue";
import { StatusBadge, type StatusTone } from "../ui/StatusBadge";

export interface AgentPassportData {
  name: string;
  agentId: string;
  organization: string;
  wallet: string;
  blockchainStatus: StatusTone;
  registrationBlock?: string | number;
  transactionHash?: string;
  capabilities: string[];
}

export function AgentPassport({ agent }: { agent: AgentPassportData }) {
  return (
    <article className="agent-passport">
      <div className="passport-scan" aria-hidden="true" />
      <header><div className="passport-brand"><Fingerprint aria-hidden="true" /><span>AGENTID <small>DIGITAL CREDENTIAL</small></span></div><StatusBadge tone={agent.blockchainStatus} /></header>
      <div className="passport-identity"><span className="passport-avatar"><Bot aria-hidden="true" /></span><div><p className="eyebrow">Autonomous agent identity</p><h2>{agent.name}</h2><p>{agent.organization}</p></div></div>
      <div className="passport-grid">
        <div><small>AGENT IDENTIFIER</small><AgentIdText value={agent.agentId} /></div>
        <div><small>WALLET BINDING</small><WalletAddress value={agent.wallet} /></div>
        {agent.registrationBlock !== undefined && <div><small>REGISTRATION BLOCK</small><BlockNumber value={agent.registrationBlock} /></div>}
        {agent.transactionHash && <div><small>TRANSACTION PROOF</small><TransactionHash value={agent.transactionHash} /></div>}
      </div>
      <footer><div className="capability-list">{agent.capabilities.map((item) => <span key={item}>{item}</span>)}</div><span className="credential-mark"><Radio size={14} /><ShieldCheck size={14} /> wallet-bound</span></footer>
    </article>
  );
}
