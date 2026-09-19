import { Check, CircleDashed, ShieldX } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge";
import type { CommunicationResult, PreparedCommunication } from "../../types/api";

type State = "WAITING" | "PROCESSING" | "PASS" | "FAIL";

export function TrustPipeline({ prepared, signature, result, busy }: { prepared: PreparedCommunication | null; signature: string | null; result: CommunicationResult | null; busy: boolean }) {
  const checks = result?.verification.checks;
  const rows: { label: string; explanation: string; state: State; value?: string }[] = [
    { label: "Request created", explanation: "Canonical request envelope prepared by AgentID.", state: status(Boolean(prepared), false), value: prepared?.request.requestId },
    { label: "Signature received", explanation: "EIP-712 signature binds sender, receiver, payload, time, and nonce.", state: status(Boolean(signature), false) },
    { label: "Signer recovered", explanation: "Wallet recovered cryptographically from the signed envelope.", state: checkState(checks?.signatureValid, ["INVALID_SIGNATURE"]), value: result?.verification.recoveredWallet },
    { label: "Agent lookup", explanation: "Sender and receiver exist in AgentRegistry.", state: checkState(checks && checks.senderExists && checks.receiverExists, ["UNKNOWN_WALLET", "UNKNOWN_AGENT", "UNKNOWN_RECEIVER"]) },
    { label: "Wallet match", explanation: "Recovered wallet controls the claimed sender AgentID.", state: checkState(checks?.walletMatches, ["WALLET_MISMATCH"]), value: result?.verification.registeredWallet },
    { label: "Identity active", explanation: "Both identities are active before delivery.", state: checkState(checks && checks.identityActive && checks.receiverActive, ["AGENT_REVOKED", "RECEIVER_REVOKED"]) },
    { label: "Timestamp valid", explanation: "Request falls inside the allowed freshness window.", state: checkState(checks?.timestampValid, ["REQUEST_EXPIRED"]) },
    { label: "Nonce unused", explanation: "Persistent replay protection accepted this nonce once.", state: checkState(checks?.nonceUnused, ["NONCE_REUSED"]) },
    { label: "Request verified", explanation: "Every authentication gate passed.", state: result ? (result.verification.verified ? "PASS" : "FAIL") : busy ? "PROCESSING" : "WAITING" },
    { label: "Receiver executed", explanation: "The deterministic handler runs only after verification.", state: result ? (result.receiverExecuted ? "PASS" : "FAIL") : busy ? "PROCESSING" : "WAITING" },
  ];
  function status(pass: boolean, failed: boolean): State { return pass ? "PASS" : failed ? "FAIL" : busy ? "PROCESSING" : "WAITING"; }
  function checkState(value: boolean | undefined, failureCodes: string[]): State {
    if (value) return "PASS";
    if (!result) return busy ? "PROCESSING" : "WAITING";
    return failureCodes.includes(result.verification.code) ? "FAIL" : "WAITING";
  }
  return <section className="trust-pipeline panel" aria-label="Live trust verification pipeline"><header><div><p className="eyebrow">Authentication before routing</p><h3>Trust pipeline</h3></div><StatusBadge tone={result ? result.delivered ? "verified" : "blocked" : busy ? "pending" : "offline"} label={result?.verification.code ?? (busy ? "PROCESSING" : "AWAITING REQUEST")} /></header><ol>{rows.map((row, index) => <li key={row.label} className={`pipeline-${row.state.toLowerCase()}`} title={row.explanation}><span>{row.state === "PASS" ? <Check /> : row.state === "FAIL" ? <ShieldX /> : <CircleDashed />}</span><div><small>{String(index + 1).padStart(2, "0")}</small><strong>{row.label}</strong><p>{row.explanation}</p>{row.value && <code>{row.value}</code>}</div><b>{row.state}</b></li>)}</ol></section>;
}
