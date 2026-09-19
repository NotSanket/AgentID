import { Fingerprint } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link className={cn("logo", compact && "logo-compact")} to={to} aria-label="AgentID home">
      <span className="logo-mark"><Fingerprint aria-hidden="true" /></span>
      {!compact && <span className="logo-wordmark">Agent<span>ID</span><small>IDENTITY LAYER</small></span>}
    </Link>
  );
}
