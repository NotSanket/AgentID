import { ArrowRight, ShieldCheck, ShieldX } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import type { CommunicationResult } from "../../types/api";

export function TrustEnvelope({ result }: { result: CommunicationResult }) {
  return <article className={`trust-envelope ${result.delivered ? "is-verified" : "is-blocked"}`}><div><small>FROM</small><strong>{result.senderAgentId}</strong></div><ArrowRight /><div><small>TO</small><strong>{result.receiverAgentId}</strong></div><span>{result.delivered ? <ShieldCheck /> : <ShieldX />}<StatusBadge tone={result.delivered ? "verified" : "blocked"} label={result.delivered ? "DELIVERY ALLOWED" : "DELIVERY BLOCKED"} /></span></article>;
}
