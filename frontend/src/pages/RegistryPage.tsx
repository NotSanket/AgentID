import { ArrowDownAZ, Grid2X2, List, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentCard } from "../components/identity/AgentCard";
import { Button } from "../components/ui/Button";
import { EmptyState, CardSkeleton } from "../components/ui/Feedback";
import { SearchInput, Select } from "../components/ui/FormControls";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WalletAddress } from "../components/ui/TechnicalValue";
import { apiClient } from "../lib/api-client";
import type { EnrichedAgent } from "../types/api";

type Sort = "recent" | "name" | "agentId" | "status";

export function RegistryPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [warning, setWarning] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"cards" | "table">("cards");

  const load = () => {
    setPhase("loading");
    apiClient.registry().then((result) => { setAgents(result.agents); setWarning(result.warning ?? null); setPhase("ready"); }).catch(() => setPhase("error"));
  };
  useEffect(load, []);

  const categories = useMemo(() => [...new Set(agents.map((agent) => agent.category).filter(Boolean))] as string[], [agents]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return agents.filter((agent) => (!value || [agent.agentId, agent.name, agent.displayName, agent.organization, agent.owner, ...agent.capabilities].some((field) => field.toLowerCase().includes(value)))
      && (status === "all" || agent.status === status)
      && (category === "all" || agent.category === category))
      .sort((a, b) => sort === "name" ? a.displayName.localeCompare(b.displayName) : sort === "agentId" ? a.agentId.localeCompare(b.agentId) : sort === "status" ? a.status.localeCompare(b.status) : Number(b.registeredAt) - Number(a.registeredAt));
  }, [agents, category, query, sort, status]);

  return (
    <div className="page-stack stage5-page registry-page">
      <header className="product-page-header"><div><p className="eyebrow"><ShieldCheck size={13} /> On-chain identity directory</p><h2>Agent Registry</h2><p>Blockchain identities enriched with off-chain profile metadata where available.</p></div><div className="header-actions"><StatusBadge tone={phase === "error" ? "offline" : "active"} label={`${agents.length} IDENTITIES`} /><Button variant="technical" icon={RefreshCw} onClick={load}>Refresh</Button></div></header>
      {warning && <div className="metadata-warning">{warning} On-chain records remain authoritative.</div>}
      <section className="registry-toolbar"><SearchInput aria-label="Search registry" placeholder="Search AgentID, name, organization, wallet…" value={query} onChange={(e) => setQuery(e.target.value)} /><Select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="Active">Active</option><option value="Revoked">Revoked</option></Select><Select aria-label="Filter category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</Select><Select aria-label="Sort registry" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="recent">Recently registered</option><option value="name">Name</option><option value="agentId">AgentID</option><option value="status">Status</option></Select><div className="view-toggle"><button className={view === "cards" ? "is-active" : ""} onClick={() => setView("cards")} aria-label="Card view"><Grid2X2 /></button><button className={view === "table" ? "is-active" : ""} onClick={() => setView("table")} aria-label="Table view"><List /></button></div></section>
      {phase === "loading" && <div className="agent-grid"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}
      {phase === "error" && <EmptyState kind="network" title="Registry unavailable" description="The backend or blockchain is offline. No placeholder identities are shown." action="Retry" onAction={load} />}
      {phase === "ready" && agents.length === 0 && <EmptyState kind="agents" title="No identities registered" description="Issue the first identity to populate this blockchain registry." action="Register agent" onAction={() => navigate("/app/register")} />}
      {phase === "ready" && agents.length > 0 && filtered.length === 0 && <EmptyState kind="agents" title="No matching identities" description="Adjust the search or filters. The underlying registry remains unchanged." />}
      {phase === "ready" && filtered.length > 0 && view === "cards" && <div className="agent-grid">{filtered.map((agent) => <AgentCard key={agent.agentId} agent={{ name: agent.displayName, agentId: agent.agentId, organization: agent.organization, capabilities: agent.capabilities, wallet: agent.owner, status: agent.status === "Active" ? "active" : "revoked" }} onOpen={() => navigate(`/app/registry/${agent.agentId}`)} />)}</div>}
      {phase === "ready" && filtered.length > 0 && view === "table" && <div className="registry-table-wrap"><table className="registry-table"><thead><tr><th><ArrowDownAZ /> Agent</th><th>AgentID</th><th>Organization</th><th>Wallet</th><th>Status</th></tr></thead><tbody>{filtered.map((agent) => <tr key={agent.agentId} onClick={() => navigate(`/app/registry/${agent.agentId}`)}><td><strong>{agent.displayName}</strong><small>{agent.category ?? "Metadata unavailable"}</small></td><td><code>{agent.agentId}</code></td><td>{agent.organization}</td><td><WalletAddress value={agent.owner} /></td><td><StatusBadge tone={agent.status === "Active" ? "active" : "revoked"} /></td></tr>)}</tbody></table></div>}
      <span className="registry-result-count"><Search size={13} /> {filtered.length} of {agents.length} identities</span>
    </div>
  );
}
