import { Blocks, Database, Server } from "lucide-react";
import { useSystemHealth } from "../system/HealthProvider";

export function GlobalStatusBar() {
  const health = useSystemHealth();
  const online = health.phase === "online";
  const backendConnected = health.data?.backend === "ok";
  return (
    <footer className="global-status-bar">
      <span className={online ? "online" : "offline"}><i />{online ? "All identity systems operational" : backendConnected ? "Backend connected · blockchain unavailable" : "Console ready · backend offline"}</span>
      <div>
        <span><Server /> Backend {backendConnected ? "connected" : "offline"}</span>
        <span><Blocks /> {online ? `Block ${health.data.blockchain.latestBlock ?? "—"}` : "Blockchain unavailable"}</span>
        <span><Database /> {online ? health.data.persistenceMode : "Persistence unavailable"}</span>
      </div>
    </footer>
  );
}
