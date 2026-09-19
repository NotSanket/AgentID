import { ArrowUpRight, Bot, Building2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { AgentIdText, WalletAddress } from "../ui/TechnicalValue";
import { StatusBadge, type StatusTone } from "../ui/StatusBadge";

export interface AgentCardData {
  name: string;
  agentId: string;
  organization: string;
  capabilities: string[];
  wallet: string;
  status: StatusTone;
  avatarLabel?: string;
}

export function AgentCard({ agent, onOpen }: { agent: AgentCardData; onOpen?: () => void }) {
  return (
    <motion.article className="agent-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <header><span className="agent-avatar"><Bot aria-hidden="true" /><small>{agent.avatarLabel ?? "AI"}</small></span><StatusBadge tone={agent.status} /></header>
      <div className="agent-card-main"><p className="eyebrow"><ShieldCheck size={12} /> Digital identity</p><h3>{agent.name}</h3><AgentIdText value={agent.agentId} /></div>
      <p className="agent-org"><Building2 size={14} /> {agent.organization}</p>
      <div className="capability-list">{agent.capabilities.map((item) => <span key={item}>{item}</span>)}</div>
      <div className="agent-technical"><WalletAddress value={agent.wallet} />{onOpen && <button type="button" onClick={onOpen}>Open profile <ArrowUpRight size={14} /></button>}</div>
    </motion.article>
  );
}
