import { ArrowRight, Fingerprint, RadioTower, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import type { AuditEvent, IdentityLifecycleEvent, InteractionRecord } from "../../types/api";
import { EmptyState } from "../ui/Feedback";
import { StatusBadge } from "../ui/StatusBadge";

type ActivityItem =
  | { kind: "audit"; data: AuditEvent }
  | { kind: "interaction"; data: InteractionRecord }
  | { kind: "lifecycle"; data: IdentityLifecycleEvent };

export function ActivityFeed({ items, limit = 8 }: { items: ActivityItem[]; limit?: number }) {
  const sorted = [...items].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, limit);
  if (!sorted.length) return <EmptyState title="No activity yet" description="Verified, blocked, and blockchain lifecycle events will appear here." kind="activity" />;
  return <div className="activity-feed stage7-activity-feed">{sorted.map((item) => {
    if (item.kind === "audit") return <Link key={`audit-${item.data.id}`} to="/app/security"><span className="activity-icon"><ShieldAlert /></span><span><strong>{item.data.senderAgentId ?? "Unknown wallet"} · {item.data.code}</strong><small>{item.data.receiverAgentId ?? "No receiver"} · {new Date(item.data.timestamp).toLocaleString()}</small></span><StatusBadge tone={item.data.result === "VERIFIED" ? "verified" : "blocked"} label={item.data.result} /></Link>;
    if (item.kind === "interaction") return <Link key={`interaction-${item.data.id}`} to="/app/communication"><span className="activity-icon"><RadioTower /></span><span><strong>{item.data.senderAgentId} → {item.data.receiverAgentId}</strong><small>{item.data.action} · {new Date(item.data.createdAt).toLocaleString()}</small></span><ArrowRight /></Link>;
    return <Link key={`lifecycle-${item.data.transactionHash}-${item.data.type}`} to={`/app/registry/${item.data.agentId}`}><span className="activity-icon"><Fingerprint /></span><span><strong>{item.data.agentId} {item.data.type.toLowerCase()}</strong><small>Block {item.data.blockNumber} · {new Date(Number(item.data.timestamp) * 1000).toLocaleString()}</small></span><ArrowRight /></Link>;
  })}</div>;
}
function timeOf(item: ActivityItem) { return item.kind === "audit" ? Date.parse(item.data.timestamp) : item.kind === "interaction" ? Date.parse(item.data.createdAt) : Number(item.data.timestamp) * 1000; }
