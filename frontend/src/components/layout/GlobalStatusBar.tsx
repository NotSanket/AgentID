import { Blocks, Database, Server } from "lucide-react";
import { useSystemHealth } from "../system/HealthProvider";

export function GlobalStatusBar() {
  const health = useSystemHealth();
  const online = health.phase === "online";
  return (
    <footer className="global-status-bar">
      <span className={online ? "online" : "offline"}><i />{online ? "All identity systems operational" : "Console ready · backend offline"}</span>
      <div>
        <span><Server /> Backend {online ? "connected" : "offline"}</span>
        <span><Blocks /> {online ? `Block ${health.data.blockchain.latestBlock ?? "—"}` : "Blockchain unavailable"}</span>
        <span><Database /> {online ? health.data.persistenceMode : "Persistence unavailable"}</span>
      </div>
    </footer>
  );
}
