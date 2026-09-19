import { Braces, Check, Fingerprint, Search, ShieldCheck, ShieldX } from "lucide-react";
import { isAddress } from "ethers";
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { FormField, Textarea, TextInput } from "../components/ui/FormControls";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TechnicalValue, WalletAddress } from "../components/ui/TechnicalValue";
import { ApiError, apiClient } from "../lib/api-client";
import type { AgentRecord } from "../types/api";
import { useIdentitySession } from "../components/identity/IdentitySessionProvider";

interface SignedResult { verified?: boolean; code?: string; reason?: string; recoveredWallet?: string; registeredWallet?: string; checks?: Record<string, boolean> }

export function VerificationPage() {
  const session = useIdentitySession();
  const [mode, setMode] = useState<"registry" | "signed">("registry");
  const [query, setQuery] = useState("");
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "active" | "revoked" | "unknown" | "error">("idle");
  const [requestJson, setRequestJson] = useState("");
  const [signature, setSignature] = useState("");
  const [signedResult, setSignedResult] = useState<SignedResult | null>(null);
  const [signedError, setSignedError] = useState<string | null>(null);
  const [signedLoading, setSignedLoading] = useState(false);

  const verifyRegistry = async () => {
    setRegistryState("loading"); setAgent(null);
    try {
      const result = isAddress(query.trim()) ? await apiClient.agentByWallet(query.trim()) : await apiClient.agent(query.trim().toUpperCase());
      setAgent(result.agent); setRegistryState(result.agent.status === "Active" ? "active" : "revoked");
    } catch (error) { setRegistryState(error instanceof ApiError && error.status === 404 ? "unknown" : "error"); }
  };

  const verifySigned = async () => {
    setSignedLoading(true); setSignedError(null); setSignedResult(null);
    try {
      const request = JSON.parse(requestJson);
      setSignedResult(await apiClient.verifySigned({ request, signature }) as SignedResult);
    } catch (error) { setSignedError(error instanceof SyntaxError ? "Structured request must be valid JSON." : error instanceof Error ? error.message : "Verification failed."); }
    finally { setSignedLoading(false); }
  };

  return (
    <div className="page-stack stage5-page verification-page">
      <header className="product-page-header"><div><p className="eyebrow"><ShieldCheck size={13} /> Authoritative identity checks</p><h2>Identity Verification</h2><p>Verify registry state or inspect every control in an EIP-712 signed request.</p></div><StatusBadge tone="verified" label="AGENTREGISTRY" /></header>
      <div className="mode-switch verification-mode"><button className={mode === "registry" ? "is-active" : ""} onClick={() => setMode("registry")} type="button"><Fingerprint /> Registry verification</button><button className={mode === "signed" ? "is-active" : ""} onClick={() => setMode("signed")} type="button"><Braces /> Advanced signed request</button></div>
      {mode === "registry" && <section className="verification-workspace"><div className="panel verification-input"><p className="eyebrow">AgentID or wallet</p><h3>Query the blockchain</h3><p>Active means the identity exists and is not revoked. It does not certify safety or reputation.</p><FormField label="AgentID or wallet address" htmlFor="verify-query"><TextInput id="verify-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="AGT-TRAVEL-001 or 0x…" /></FormField><Button icon={Search} loading={registryState === "loading"} disabled={!query.trim()} onClick={verifyRegistry}>Verify Identity</Button></div><VerificationResult state={registryState} agent={agent} network={session.config?.network} chainId={session.config?.chainId} contract={session.config?.registryAddress} /> </section>}
      {mode === "signed" && <section className="signed-verifier"><div className="panel"><p className="eyebrow">Existing Stage 2 authentication engine</p><h3>Paste signed request</h3><FormField label="Structured request" htmlFor="signed-request"><Textarea id="signed-request" className="code-textarea" value={requestJson} onChange={(e) => setRequestJson(e.target.value)} placeholder={'{"requestId":"REQ-..."}'} /></FormField><FormField label="EIP-712 signature" htmlFor="signature"><Textarea id="signature" className="code-textarea signature-input" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="0x…" /></FormField><Button icon={ShieldCheck} loading={signedLoading} disabled={!requestJson || !signature} onClick={verifySigned}>Run Authentication</Button>{signedError && <p className="validation-message">{signedError}</p>}</div><div className="panel signed-result"><p className="eyebrow">Authentication pipeline</p><h3>{signedResult ? signedResult.verified ? "VERIFIED" : "BLOCKED" : "Awaiting signed request"}</h3>{signedResult ? <><StatusBadge tone={signedResult.verified ? "verified" : "blocked"} label={signedResult.code} /><p>{signedResult.reason}</p><div className="check-list">{Object.entries(signedResult.checks ?? {}).map(([name, passed]) => <span key={name} className={passed ? "is-passed" : "is-blocked"}>{passed ? <Check /> : <ShieldX />}<span>{humanize(name)}</span></span>)}</div>{signedResult.recoveredWallet && <div><small>RECOVERED SIGNER</small><WalletAddress value={signedResult.recoveredWallet} /></div>}</> : <div className="verification-pipeline">{["Parsing Request", "Recovering Signer", "Registry Lookup", "Wallet Match", "Status Check", "Timestamp Check", "Replay Check"].map((item) => <span key={item}>{item}</span>)}</div>}</div></section>}
    </div>
  );
}

function VerificationResult({ state, agent, network, chainId, contract }: { state: "idle" | "loading" | "active" | "revoked" | "unknown" | "error"; agent: AgentRecord | null; network?: string; chainId?: number; contract?: string }) {
  if (state === "idle" || state === "loading") return <div className="panel registry-verification-result"><span className="result-orb"><Fingerprint /></span><h3>{state === "loading" ? "Querying AgentRegistry" : "Ready to verify"}</h3><p>{state === "loading" ? "Reading the real on-chain identity state." : "Enter an AgentID or wallet to begin."}</p></div>;
  if (state === "unknown" || state === "error") return <div className="panel registry-verification-result is-blocked"><span className="result-orb"><ShieldX /></span><h3>{state === "unknown" ? "IDENTITY NOT FOUND" : "VERIFICATION UNAVAILABLE"}</h3><p>{state === "unknown" ? "No identity is registered for that value on the current chain." : "The blockchain or backend could not complete the check."}</p></div>;
  return <div className={`panel registry-verification-result ${state === "active" ? "is-verified" : "is-blocked"}`}><span className="result-orb">{state === "active" ? <ShieldCheck /> : <ShieldX />}</span><h3>{state === "active" ? "IDENTITY VERIFIED" : "IDENTITY REVOKED"}</h3>{agent && <dl><div><dt>Agent</dt><dd>{agent.name}</dd></div><div><dt>AgentID</dt><dd>{agent.agentId}</dd></div><div><dt>Wallet</dt><dd><WalletAddress value={agent.owner} /></dd></div><div><dt>Status</dt><dd><StatusBadge tone={state === "active" ? "active" : "revoked"} /></dd></div><div><dt>Network</dt><dd>{network ?? "Unavailable"} · Chain {chainId ?? "?"}</dd></div>{contract && <div><dt>Contract</dt><dd><TechnicalValue label="contract address" value={contract} /></dd></div>}<div><dt>Verification Source</dt><dd>AgentRegistry</dd></div></dl>}</div>;
}

function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
