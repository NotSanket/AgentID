import { Activity, ArrowRight, BarChart3, Bot, Fingerprint, GitBranch, KeyRound, RadioTower, SearchCode, ShieldAlert, ShieldCheck, ShieldX, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSystemHealth } from "../components/system/HealthProvider";
import { CardSkeleton, ComponentSlot, EmptyState } from "../components/ui/Feedback";
import { StatusBadge } from "../components/ui/StatusBadge";
import { apiClient } from "../lib/api-client";
import type { AnalyticsSummary, AuditEvent, EnrichedAgent, IdentityLifecycleEvent, InteractionRecord } from "../types/api";
import { ActivityFeed } from "../components/system/ActivityFeed";

export function CommandCenterPage() {
  const health = useSystemHealth();
  const [agents, setAgents] = useState<EnrichedAgent[]>([]); const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null); const [audit, setAudit] = useState<AuditEvent[]>([]); const [lifecycle, setLifecycle] = useState<IdentityLifecycleEvent[]>([]); const [interactions, setInteractions] = useState<InteractionRecord[]>([]); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const registry = await apiClient.registry(controller.signal); setAgents(registry.agents); setFailed(false); setLoading(false);
        const history = await Promise.all(registry.agents.map((agent) => apiClient.lifecycle(agent.agentId, controller.signal).then((result) => result.events).catch(() => []))); setLifecycle(history.flat().sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 6));
        const [analyticsResult, auditResult, interactionResult] = await Promise.allSettled([apiClient.analytics(controller.signal), apiClient.audit(controller.signal), apiClient.interactions({ limit: 5, offset: 0 }, controller.signal)]);
        if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value); if (auditResult.status === "fulfilled") setAudit(auditResult.value.events); if (interactionResult.status === "fulfilled") setInteractions(interactionResult.value.interactions);
      } catch { if (!controller.signal.aborted) setFailed(true); } finally { setLoading(false); }
    })(); return () => controller.abort();
  }, []);
  const active = agents.filter((agent) => agent.status === "Active").length; const revoked = agents.length - active;
  return <div className="page-stack command-center-page stage5-page">
    <section className="console-hero"><div><p className="eyebrow"><Sparkles size={13} /> Live identity operations</p><h2>Command Center</h2><p>Real AgentRegistry state, authenticated communication, and persisted security activity.</p></div><div className="console-hero-mark"><ShieldCheck /><span>TRUST<br />BOUNDARY</span></div></section>
    <DemoReadiness health={health} />
    <section className="metric-grid identity-metrics" aria-label="Live identity metrics">{loading ? <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></> : <><MetricStatus icon={Fingerprint} label="Registered Identities" value={String(agents.length)} tone="active" detail="Discovered from AgentRegistered events" /><MetricStatus icon={ShieldCheck} label="Active Identities" value={String(active)} tone="verified" detail="Current on-chain lifecycle state" /><MetricStatus icon={ShieldX} label="Revoked Identities" value={String(revoked)} tone={revoked ? "revoked" : "active"} detail="Rejected by authentication" /><MetricStatus icon={Activity} label="Verification Attempts" value={String(analytics?.totalVerificationAttempts ?? 0)} tone="verified" detail={`${analytics?.verifiedRequests ?? 0} verified · ${analytics?.blockedRequests ?? 0} blocked`} /><MetricStatus icon={RadioTower} label="Verified Interactions" value={String(analytics?.totalInteractions ?? 0)} tone="verified" detail="Authenticated receiver executions" /><MetricStatus icon={ShieldX} label="Blocked Communications" value={String(analytics?.blockedRequests ?? 0)} tone={analytics?.blockedRequests ? "revoked" : "active"} detail="Stopped before receiver execution" /><MetricStatus icon={TrendingUp} label="Authentication Success" value={`${analytics?.successRate ?? 0}%`} tone="verified" detail="Calculated from persistent audit records" /></>}</section>
    <section className="dashboard-grid">
      <ComponentSlot eyebrow="Unified real-time evidence" title="Recent platform activity">{failed ? <EmptyState kind="network" title="Activity unavailable" description="Start the local blockchain and backend to restore live records." /> : <ActivityFeed items={[...lifecycle.map((data) => ({ kind: "lifecycle" as const, data })), ...audit.map((data) => ({ kind: "audit" as const, data }))]} />}</ComponentSlot>
      <ComponentSlot eyebrow="Safe next actions" title="Quick actions"><div className="quick-actions"><QuickAction to="/app/register" icon={KeyRound} title="Register an agent" label="Issue on-chain identity" /><QuickAction to="/app/communication" icon={RadioTower} title="Send authenticated request" label="Open communication" /><QuickAction to="/app/security" icon={ShieldAlert} title="Run Security Lab" label="Controlled local scenarios" /><QuickAction to="/app/trust-graph" icon={GitBranch} title="Open Trust Graph" label="Observed identity relationships" /><QuickAction to="/app/explorer" icon={SearchCode} title="Inspect Explorer" label="Blocks, events, and receipts" /><QuickAction to="/app/analytics" icon={BarChart3} title="View Analytics" label="Persistent real metrics" /></div></ComponentSlot>
      <ComponentSlot eyebrow="Persisted authentication audit" title="Recent security activity">{audit.length ? <div className="security-feed">{audit.map((event) => <div key={event.id}><StatusBadge tone={event.result === "VERIFIED" ? "verified" : "blocked"} label={event.code} /><span><strong>{event.senderAgentId ?? "Unknown sender"}</strong><small>{new Date(event.timestamp).toLocaleString()} · {event.reason}</small></span></div>)}</div> : <EmptyState title="No verification activity" description="Signed-request verification events will appear here from persistent audit storage." kind="activity" />}</ComponentSlot>
      <ComponentSlot eyebrow="Authenticated delivery" title="Recent Agent-to-Agent activity">{interactions.length ? <div className="activity-feed">{interactions.map((item) => <Link key={item.id} to="/app/communication"><span className="activity-icon"><RadioTower /></span><span><strong>{item.senderAgentId} → {item.receiverAgentId}</strong><small>{item.action} · {new Date(item.createdAt).toLocaleString()}</small></span><ArrowRight /></Link>)}</div> : <EmptyState title="No verified interactions" description="Authenticated agent deliveries will appear here." kind="activity" />}</ComponentSlot>
      <ComponentSlot eyebrow="Identity relationships" title="Trust Graph preview"><Link className="trust-preview" to="/app/trust-graph"><div>{agents.slice(0, 4).map((agent) => <span className={agent.status === "Active" ? "is-active" : "is-revoked"} key={agent.agentId}><Bot /><small>{agent.displayName}</small></span>)}</div><p><strong>{agents.length} real identities</strong><small>{interactions.length} recent verified interaction{interactions.length === 1 ? "" : "s"}. Open the graph for persisted blocked edges and filters.</small></p><ArrowRight /></Link></ComponentSlot>
      <ComponentSlot eyebrow="Current chain" title="Network health"><div className="health-detail-list"><span><RadioTower /><strong>Backend</strong><StatusBadge tone={health.phase === "online" ? "active" : "offline"} /></span><span><ShieldCheck /><strong>Blockchain</strong><code>{health.phase === "online" ? `Chain ${health.data.blockchain.chainId}` : "Unavailable"}</code></span><span><Bot /><strong>AgentRegistry</strong><code>{health.phase === "online" ? health.data.blockchain.registryAddress : "Unavailable"}</code></span><span><Activity /><strong>Persistence</strong><code>{health.phase === "online" ? health.data.persistenceMode : "Unavailable"}</code></span></div></ComponentSlot>
      <ComponentSlot eyebrow="Lifecycle distribution" title="Identity status breakdown"><div className="status-breakdown"><div><span style={{ width: agents.length ? `${(active / agents.length) * 100}%` : "0%" }} /></div><p><span><i className="active-dot" /> Active <strong>{active}</strong></span><span><i className="revoked-dot" /> Revoked <strong>{revoked}</strong></span></p></div></ComponentSlot>
    </section>
  </div>;
}

function MetricStatus({ icon: Icon, label, value, detail, tone }: { icon: typeof Bot; label: string; value: string; detail: string; tone: "active" | "verified" | "revoked" }) { return <article className="metric-card"><header><span><Icon /></span><StatusBadge tone={tone} label="LIVE" /></header><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
function QuickAction({ to, icon: Icon, title, label }: { to: string; icon: typeof Bot; title: string; label: string }) { return <Link to={to}><span><Icon /></span><span><strong>{title}</strong><small>{label}</small></span><ArrowRight /></Link>; }

function DemoReadiness({ health }: { health: ReturnType<typeof useSystemHealth> }) {
  const data = health.data;
  const backend = data?.backend === "ok";
  const blockchain = Boolean(data?.blockchain.connected && data.blockchain.chainId === 31337);
  const contract = Boolean(data?.blockchain.contractReachable && data.blockchain.registryAddress);
  const persistence = Boolean(data && (data.persistenceMode === "IN_MEMORY" || data.supabaseConnected));
  const signing = Boolean(data?.demoSigningEnabled);
  const ready = backend && blockchain && contract && persistence && signing;
  const checking = health.phase === "loading";
  return <section className={`demo-readiness panel ${ready ? "is-ready" : "is-not-ready"}`} aria-label="Local demo readiness">
    <header><div><p className="eyebrow">Teacher presentation check</p><h3>{checking ? "CHECKING DEMO" : ready ? "DEMO READY" : "DEMO NOT READY"}</h3><p>{ready ? "All dependencies required for the guarded local demonstration are healthy." : checking ? "Checking backend and local dependencies." : health.error ?? "One or more local dependencies need attention."}</p></div><StatusBadge tone={checking ? "pending" : ready ? "verified" : "blocked"} label={checking ? "CHECKING" : ready ? "READY" : "ATTENTION"} /></header>
    <div className="demo-readiness-grid">
      <ReadinessItem label="Backend" ready={backend} detail={backend ? "CONNECTED" : "UNAVAILABLE"} />
      <ReadinessItem label="Blockchain" ready={blockchain} detail={data?.blockchain.chainId ? `CHAIN ${data.blockchain.chainId}` : "UNAVAILABLE"} />
      <ReadinessItem label="AgentRegistry" ready={contract} detail={contract ? "REACHABLE" : "UNAVAILABLE"} />
      <ReadinessItem label="Persistence" ready={persistence} detail={data ? data.persistenceMode === "SUPABASE" ? data.supabaseConnected ? "SUPABASE CONNECTED" : "SUPABASE UNAVAILABLE" : "IN-MEMORY READY" : "UNAVAILABLE"} />
      <ReadinessItem label="Demo signing" ready={signing} detail={signing ? "LOCAL ONLY" : "DISABLED"} />
    </div>
  </section>;
}

function ReadinessItem({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return <span><i className={ready ? "is-ready" : "is-unavailable"} /><strong>{label}</strong><small>{detail}</small></span>;
}
