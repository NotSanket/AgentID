import { Database, RadioTower, RefreshCw } from "lucide-react";
import { useSystemHealth } from "./HealthProvider";

export function NetworkStatus({ compact = false }: { compact?: boolean }) {
  const health = useSystemHealth();
  const data = health.phase === "online" ? health.data : null;
  const online = data !== null;
  const loading = health.phase === "loading";
  const label = loading ? "CHECKING SYSTEM" : online ? "SYSTEM ONLINE" : "SYSTEM OFFLINE";

  return (
    <button className={`network-status ${online ? "is-online" : loading ? "is-loading" : "is-offline"}`} type="button" onClick={health.refresh} title={online ? "Refresh system status" : health.error ?? "Refresh system status"} aria-label={`${label}. Refresh system status`}>
      <span className="status-orb">{loading ? <RefreshCw className="spin" /> : <RadioTower />}</span>
      {!compact && <span className="network-copy"><strong>{label}</strong><small>{data ? `${data.blockchain.network.toUpperCase()} · CHAIN ${data.blockchain.chainId}` : "BACKEND UNREACHABLE"}</small></span>}
      {data && !compact && <span className="persistence-chip"><Database size={11} />{data.persistenceMode}</span>}
    </button>
  );
}
