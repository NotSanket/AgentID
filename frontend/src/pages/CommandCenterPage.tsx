import { ArrowRight, Bot, KeyRound, RadioTower, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useSystemHealth } from "../components/system/HealthProvider";
import { CardSkeleton, ComponentSlot, EmptyState } from "../components/ui/Feedback";
import { StatusBadge } from "../components/ui/StatusBadge";

export function CommandCenterPage() {
  const health = useSystemHealth();
  return (
    <div className="page-stack command-center-page">
      <section className="console-hero"><div><p className="eyebrow"><Sparkles size={13} /> Identity operations</p><h2>Command Center</h2><p>Your control surface for issuing, verifying, and monitoring agent identities. Live product modules connect in Stage 5.</p></div><div className="console-hero-mark"><ShieldCheck /><span>TRUST<br />BOUNDARY</span></div></section>

      <section className="metric-grid" aria-label="System status">
        {health.phase === "loading" ? <><CardSkeleton /><CardSkeleton /><CardSkeleton /></> : <>
          <MetricStatus icon={RadioTower} label="Backend" value={health.phase === "online" ? "Connected" : "Offline"} tone={health.phase === "online" ? "active" : "offline"} detail={health.phase === "online" ? "Health endpoint responding" : "Start the backend to connect"} />
          <MetricStatus icon={ShieldCheck} label="Blockchain" value={health.phase === "online" ? `Chain ${health.data.blockchain.chainId}` : "Unavailable"} tone={health.phase === "online" ? "verified" : "offline"} detail={health.phase === "online" ? health.data.blockchain.network : "No live values shown"} />
          <MetricStatus icon={Bot} label="Persistence" value={health.phase === "online" ? health.data.persistenceMode : "Unavailable"} tone={health.phase === "online" ? "active" : "offline"} detail={health.phase === "online" ? "Reported by backend" : "Waiting for system health"} />
        </>}
      </section>

      <section className="dashboard-grid">
        <ComponentSlot eyebrow="Verified operations" title="Recent activity">
          <EmptyState title={health.phase === "online" ? "No activity loaded yet" : "Network unavailable"} description={health.phase === "online" ? "The activity feed will connect to verified backend records in Stage 5." : "Start the local blockchain and backend to restore live system status."} kind={health.phase === "online" ? "activity" : "network"} />
        </ComponentSlot>
        <ComponentSlot eyebrow="Safe next actions" title="Quick actions">
          <div className="quick-actions"><QuickAction to="/app/register" icon={KeyRound} title="Register an agent" label="Stage 5 module" /><QuickAction to="/app/verification" icon={ShieldCheck} title="Verify identity" label="Stage 5 module" /><QuickAction to="/app/communication" icon={RadioTower} title="Send verified request" label="Stage 5 module" /></div>
        </ComponentSlot>
        <ComponentSlot eyebrow="Enforced controls" title="Security foundation">
          <div className="security-status-list"><span><ShieldCheck /><span><strong>EIP-712 request binding</strong><small>Implemented in the backend</small></span><StatusBadge tone="verified" label="READY" /></span><span><ShieldCheck /><span><strong>Atomic nonce protection</strong><small>Persistent replay defense</small></span><StatusBadge tone="verified" label="READY" /></span><span><ShieldCheck /><span><strong>On-chain lifecycle checks</strong><small>Active and Revoked enforcement</small></span><StatusBadge tone="verified" label="READY" /></span></div>
        </ComponentSlot>
      </section>
    </div>
  );
}

function MetricStatus({ icon: Icon, label, value, detail, tone }: { icon: typeof Bot; label: string; value: string; detail: string; tone: "active" | "verified" | "offline" }) {
  return <article className="metric-card"><header><span><Icon /></span><StatusBadge tone={tone} label={tone === "offline" ? "OFFLINE" : "LIVE"} /></header><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
function QuickAction({ to, icon: Icon, title, label }: { to: string; icon: typeof Bot; title: string; label: string }) { return <Link to={to}><span><Icon /></span><span><strong>{title}</strong><small>{label}</small></span><ArrowRight /></Link>; }
