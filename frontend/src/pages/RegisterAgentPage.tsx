import { Check, ChevronLeft, ChevronRight, Fingerprint, KeyRound, Laptop, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentitySession } from "../components/identity/IdentitySessionProvider";
import { TransactionReceiptPanel } from "../components/identity/TransactionReceiptPanel";
import { useNotifications } from "../components/system/NotificationCenter";
import { Button } from "../components/ui/Button";
import { FormField, Select, Textarea, TextInput } from "../components/ui/FormControls";
import { StatusBadge } from "../components/ui/StatusBadge";
import { WalletAddress } from "../components/ui/TechnicalValue";
import { ApiError, apiClient } from "../lib/api-client";
import type { IdentityTransactionResult } from "../types/api";
import type { TransactionStage } from "../services/identity-writers";

const categories = ["General", "Travel", "Hospitality", "Payments", "Healthcare", "Research"];
const stepLabels = ["Identity Profile", "AgentID", "Ownership", "Review", "Issue Identity"];

export function generateAgentId(name: string, sequence = 1) {
  const stem = name.toUpperCase().replace(/\bAI\b/g, "").replace(/AI$/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "AGENT";
  return `AGT-${stem}-${String(sequence).padStart(3, "0")}`;
}

export function RegisterAgentPage() {
  const session = useIdentitySession();
  const { notify } = useNotifications();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [capabilityText, setCapabilityText] = useState("");
  const [agentId, setAgentId] = useState("");
  const [manualId, setManualId] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<TransactionStage | null>(null);
  const [transaction, setTransaction] = useState<IdentityTransactionResult | null>(null);
  const [metadataWarning, setMetadataWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const capabilities = useMemo(() => capabilityText.split(",").map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")).filter(Boolean), [capabilityText]);

  useEffect(() => {
    if (!manualId) setAgentId(generateAgentId(name));
  }, [manualId, name]);

  useEffect(() => {
    if (step !== 1 || !agentId) return;
    const controller = new AbortController();
    setChecking(true); setAvailable(null);
    apiClient.availability(agentId, controller.signal).then((result) => setAvailable(result.available)).catch(() => setAvailable(null)).finally(() => setChecking(false));
    return () => controller.abort();
  }, [agentId, step]);

  const profileValid = name.trim().length > 0 && organization.trim().length > 0;
  const idValid = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(agentId) && available === true;
  const ownershipValid = Boolean(session.address && session.mode && session.chainId === session.config?.chainId);
  const identityInput = () => ({
    wallet: session.address!, agentId, name: name.trim(), organization: organization.trim(), metadataURI: `agentid://metadata/${agentId}`,
    metadata: { displayName: name.trim(), description: description.trim() || null, category, capabilities },
  });

  const issue = async () => {
    if (!session.address) return;
    setStep(4); setError(null); setTransaction(null); setMetadataWarning(null);
    try {
      const result = await session.writer().register(identityInput(), setStage);
      setTransaction(result.transaction); setMetadataWarning(result.metadataWarning ?? null);
      await session.refreshDemoWallets();
      notify({ type: "success", title: "Identity registered successfully", message: `${agentId} is ACTIVE on chain ${session.config?.chainId}.` });
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Identity registration failed.";
      setError(message); notify({ type: "error", title: "Identity registration failed", message });
    }
  };

  const retryMetadata = async () => {
    if (!session.address) return;
    try {
      const result = await session.writer().update(identityInput(), setStage, false);
      setMetadataWarning(result.metadataSynced ? null : result.metadataWarning ?? "Metadata synchronization requires attention.");
      if (result.metadataSynced) notify({ type: "success", title: "Metadata synchronized" });
    } catch (reason) {
      setMetadataWarning(reason instanceof Error ? reason.message : "Metadata synchronization requires attention.");
    }
  };

  return (
    <div className="page-stack stage5-page registration-page">
      <header className="product-page-header"><div><p className="eyebrow"><Fingerprint size={13} /> Blockchain identity issuance</p><h2>Register Agent</h2><p>Issue a wallet-bound digital identity backed by the live AgentRegistry contract.</p></div><StatusBadge tone="active" label="REAL TRANSACTION" /></header>
      <ol className="wizard-steps" aria-label="Registration progress">{stepLabels.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}><span>{index < step ? <Check /> : index + 1}</span><small>{label}</small></li>)}</ol>
      <section className="wizard-panel">
        {step === 0 && <div className="wizard-content"><div className="section-heading"><Sparkles /><div><h3>Identity profile</h3><p>Describe the agent without claiming safety, intelligence, or reputation.</p></div></div><div className="form-grid"><FormField label="Agent Name" htmlFor="agent-name"><TextInput id="agent-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ResearchAI" /></FormField><FormField label="Organization" htmlFor="organization"><TextInput id="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="AgentID Labs" /></FormField><FormField label="Category" htmlFor="category"><Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</Select></FormField><FormField label="Capabilities" htmlFor="capabilities" hint="Comma separated"><TextInput id="capabilities" value={capabilityText} onChange={(e) => setCapabilityText(e.target.value)} placeholder="RESEARCH, SUMMARIZE" /></FormField><FormField label="Description" htmlFor="description"><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this agent is designed to do." /></FormField></div>{capabilities.length > 0 && <div className="capability-list">{capabilities.map((item) => <span key={item}>{item}</span>)}</div>}</div>}
        {step === 1 && <div className="wizard-content"><div className="section-heading"><KeyRound /><div><h3>Choose the AgentID</h3><p>Readable, unique, and finalized by the smart contract.</p></div></div><div className="mode-switch"><button className={!manualId ? "is-active" : ""} onClick={() => setManualId(false)} type="button">Auto generate</button><button className={manualId ? "is-active" : ""} onClick={() => setManualId(true)} type="button">Manual entry</button></div><FormField label="AgentID" htmlFor="agent-id" error={available === false ? "This AgentID is already registered." : undefined}><TextInput id="agent-id" value={agentId} readOnly={!manualId} onChange={(e) => setAgentId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} /></FormField><div className="availability-line">{checking ? <StatusBadge tone="pending" label="CHECKING REGISTRY" /> : available === true ? <StatusBadge tone="verified" label="AVAILABLE" /> : available === false ? <StatusBadge tone="blocked" label="IN USE" /> : <span>Enter a valid uppercase AgentID.</span>}</div></div>}
        {step === 2 && <div className="wizard-content">
          <div className="section-heading"><WalletCards /><div><h3>Choose controlling wallet</h3><p>The transaction sender becomes the permanent controlling wallet. Each wallet can control only one AgentID.</p></div></div>
          <div className="ownership-grid">
            <button type="button" className={`ownership-card ${session.mode === "browser" ? "is-selected" : ""}`} onClick={() => session.connectBrowserWallet().catch(() => setError(session.browserWalletAvailable ? "Unable to connect the browser wallet." : "No browser wallet was detected."))}><WalletCards /><strong>Connect Wallet</strong><small>{session.browserWalletAvailable ? "Browser wallet signs directly" : "Browser wallet unavailable"}</small></button>
            <div className="ownership-card local-wallet-card"><Laptop /><strong>Local Demo Wallet</strong><small>Development only · Hardhat 31337</small><div className="demo-wallet-list">{session.demoWallets.length ? session.demoWallets.map((wallet) => <button key={wallet.address} type="button" disabled={!wallet.available} className={session.address === wallet.address ? "is-selected" : ""} onClick={() => session.selectDemoWallet(wallet)}><span><strong>{wallet.label}</strong><small>{wallet.available ? "AVAILABLE" : `IN USE · ${wallet.assignedAgentId}`}</small></span><code>{`${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`}</code></button>) : <small>Unavailable in this environment. Public registration requires MetaMask.</small>}</div></div>
          </div>
          {session.address && <div className="selected-wallet"><StatusBadge tone="active" label={session.mode === "demo" ? "LOCAL DEMO WALLET" : "CONNECTED WALLET"} /><WalletAddress value={session.address} /><span>Chain {session.chainId}</span></div>}
          {session.chainId && session.config && session.chainId !== session.config.chainId && <p className="validation-message">Wrong network. Switch to chain {session.config.chainId}.</p>}{error && <p className="validation-message">{error}</p>}
        </div>}
        {step === 3 && <div className="wizard-content"><div className="section-heading"><ShieldCheck /><div><h3>Review identity</h3><p>Registration creates an on-chain identity record.</p></div></div><dl className="review-grid"><div><dt>Agent Name</dt><dd>{name}</dd></div><div><dt>AgentID</dt><dd>{agentId}</dd></div><div><dt>Organization</dt><dd>{organization}</dd></div><div><dt>Category</dt><dd>{category}</dd></div><div><dt>Capabilities</dt><dd>{capabilities.join(", ") || "None declared"}</dd></div><div><dt>Wallet</dt><dd>{session.address}</dd></div><div><dt>Network</dt><dd>{session.config?.network}</dd></div><div><dt>Chain ID</dt><dd>{session.config?.chainId}</dd></div></dl><div className="security-note"><ShieldCheck /><span><strong>Wallet-bound ownership</strong><small>The smart contract uses msg.sender. Another wallet cannot modify this identity.</small></span></div></div>}
        {step === 4 && <div className="wizard-content issue-state">{transaction ? <><div className="issued-mark"><Fingerprint /><p className="eyebrow">Blockchain registration confirmed</p><h3>IDENTITY ISSUED</h3><strong>{agentId}</strong><StatusBadge tone="active" label="ACTIVE" /></div><TransactionReceiptPanel transaction={transaction} />{metadataWarning && <div className="metadata-warning">{metadataWarning}</div>}<div className="wizard-actions"><Link className="button button-primary" to={`/app/registry/${agentId}`}>View Agent Passport</Link><Link className="button button-secondary" to="/app/registry">View in Registry</Link></div></> : <><div className="transaction-progress"><span className="pulse-ring"><Fingerprint /></span><h3>{error ? "Identity issuance stopped" : labelForStage(stage)}</h3><p>{error ?? "Progress advances only when the real transaction changes state."}</p>{stage && !error && <StatusBadge tone="pending" label={stage.replace("-", " ").toUpperCase()} />}</div>{error && <Button onClick={() => { setStep(3); setError(null); }}>Return to review</Button>}</>}</div>}
        {step === 4 && transaction && metadataWarning && <div className="metadata-retry"><Button variant="technical" onClick={retryMetadata}>Retry metadata sync</Button></div>}
        {step < 4 && <footer className="wizard-actions"><Button variant="ghost" icon={ChevronLeft} disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Back</Button>{step < 3 ? <Button icon={ChevronRight} disabled={step === 0 ? !profileValid : step === 1 ? !idValid : !ownershipValid} onClick={() => { setError(null); setStep((value) => value + 1); }}>Continue</Button> : <Button icon={Fingerprint} onClick={issue}>Issue Identity</Button>}</footer>}
      </section>
    </div>
  );
}

function labelForStage(stage: TransactionStage | null) {
  if (!stage) return "Preparing identity";
  return ({ preparing: "Preparing identity", "awaiting-signature": "Awaiting wallet signature", submitting: "Submitting transaction", pending: "Transaction pending", confirmed: "Block confirmed" })[stage];
}
