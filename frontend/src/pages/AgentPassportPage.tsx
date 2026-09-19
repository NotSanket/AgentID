import { Activity, Clock3, Download, Edit3, Fingerprint, Link2, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AgentPassport } from "../components/identity/AgentPassport";
import { useIdentitySession } from "../components/identity/IdentitySessionProvider";
import { TransactionReceiptPanel } from "../components/identity/TransactionReceiptPanel";
import { useNotifications } from "../components/system/NotificationCenter";
import { Button } from "../components/ui/Button";
import { EmptyState, CardSkeleton } from "../components/ui/Feedback";
import { FormField, Textarea, TextInput } from "../components/ui/FormControls";
import { Modal, SideDrawer } from "../components/ui/Overlays";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TechnicalValue, TransactionHash, WalletAddress } from "../components/ui/TechnicalValue";
import { apiClient } from "../lib/api-client";
import type { EnrichedAgent, IdentityLifecycleEvent, IdentityTransactionResult } from "../types/api";

export function AgentPassportPage() {
  const { agentId = "" } = useParams();
  const session = useIdentitySession();
  const { notify } = useNotifications();
  const [agent, setAgent] = useState<EnrichedAgent | null>(null);
  const [events, setEvents] = useState<IdentityLifecycleEvent[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [warning, setWarning] = useState<string | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [transaction, setTransaction] = useState<IdentityTransactionResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [organization, setOrganization] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState(""); const [capabilities, setCapabilities] = useState("");

  const load = () => {
    setPhase("loading");
    Promise.all([apiClient.registryAgent(agentId), apiClient.lifecycle(agentId)])
      .then(([profile, history]) => {
        setAgent(profile.agent); setEvents(history.events); setWarning(profile.warning ?? null); setPhase("ready");
        setName(profile.agent.name); setOrganization(profile.agent.organization); setDescription(profile.agent.description ?? ""); setCategory(profile.agent.category ?? ""); setCapabilities(profile.agent.capabilities.join(", "));
      })
      .catch((error) => setPhase(error?.status === 404 ? "missing" : "error"));
  };
  useEffect(load, [agentId]);

  const owner = Boolean(agent && session.address && agent.owner.toLowerCase() === session.address.toLowerCase());
  const registration = events.find((event) => event.type === "Registered");
  const metadata = useMemo(() => ({ displayName: name.trim() || null, description: description.trim() || null, category: category.trim() || null, capabilities: capabilities.split(",").map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")).filter(Boolean) }), [capabilities, category, description, name]);

  const runLifecycle = async (action: "revoke" | "reactivate") => {
    if (!agent || !owner) return;
    setBusy(true); setActionError(null); setTransaction(null);
    try {
      const result = action === "revoke" ? await session.writer().revoke(agent.agentId, () => undefined) : await session.writer().reactivate(agent.agentId, () => undefined);
      setTransaction(result.transaction); setRevokeOpen(false); setConfirmation("");
      notify({ type: "success", title: action === "revoke" ? "Identity revoked" : "Identity reactivated", message: result.transaction ? `Confirmed in block ${result.transaction.blockNumber}.` : undefined });
      load();
    } catch (error) { const message = error instanceof Error ? error.message : "Lifecycle transaction failed."; setActionError(message); notify({ type: "error", title: "Transaction failed", message }); }
    finally { setBusy(false); }
  };

  const saveUpdate = async () => {
    if (!agent || !owner) return;
    setBusy(true); setActionError(null); setTransaction(null);
    const onChain = name.trim() !== agent.name || organization.trim() !== agent.organization;
    try {
      const result = await session.writer().update({ wallet: agent.owner, agentId: agent.agentId, name: name.trim(), organization: organization.trim(), metadataURI: agent.metadataURI, metadata }, () => undefined, onChain);
      setTransaction(result.transaction); setUpdateOpen(false);
      notify({ type: result.metadataSynced ? "success" : "warning", title: result.metadataSynced ? "Identity updated" : "On-chain update confirmed", message: result.metadataWarning });
      load();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Update failed."); }
    finally { setBusy(false); }
  };

  const exportJson = () => {
    if (!agent) return;
    const payload = { agentId: agent.agentId, name: agent.name, organization: agent.organization, description: agent.description, wallet: agent.owner, status: agent.status, network: session.config?.network, chainId: session.config?.chainId, contractAddress: session.config?.registryAddress, capabilities: agent.capabilities, registration };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${agent.agentId}-passport.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (phase === "loading") return <div className="page-stack"><CardSkeleton /><CardSkeleton /></div>;
  if (phase === "missing") return <EmptyState kind="agents" title="Identity not found" description="The AgentID is not registered on the current blockchain." action="Open registry" onAction={() => { window.location.href = "/app/registry"; }} />;
  if (phase === "error" || !agent) return <EmptyState kind="network" title="Passport unavailable" description="The blockchain or backend could not load this identity." action="Retry" onAction={load} />;

  return (
    <div className="page-stack stage5-page passport-page">
      <header className="passport-actions"><Link to="/app/registry">← Registry</Link><div><Button variant="ghost" icon={Link2} onClick={() => navigator.clipboard.writeText(window.location.href)}>Share verification link</Button><Button variant="technical" icon={Download} onClick={exportJson}>Export JSON</Button><Button variant="technical" icon={RefreshCw} onClick={load}>Refresh</Button></div></header>
      {warning && <div className="metadata-warning">{warning}</div>}
      <AgentPassport agent={{ name: agent.displayName, agentId: agent.agentId, organization: agent.organization, wallet: agent.owner, blockchainStatus: agent.status === "Active" ? "active" : "revoked", registrationBlock: registration?.blockNumber, transactionHash: registration?.transactionHash, capabilities: agent.capabilities }} />
      <section className="passport-detail-grid"><article className="panel identity-details"><header><div><p className="eyebrow">Authoritative registry record</p><h3>On-chain identity</h3></div><StatusBadge tone={agent.status === "Active" ? "active" : "revoked"} /></header><dl><div><dt>Owner wallet</dt><dd><WalletAddress value={agent.owner} /></dd></div><div><dt>Contract</dt><dd>{session.config ? <TechnicalValue label="contract address" value={session.config.registryAddress} /> : "Unavailable"}</dd></div><div><dt>Network</dt><dd>{session.config?.network ?? "Unavailable"}</dd></div><div><dt>Chain ID</dt><dd>{session.config?.chainId ?? "Unavailable"}</dd></div><div><dt>Registered</dt><dd>{formatTimestamp(agent.registeredAt)}</dd></div><div><dt>Last updated</dt><dd>{formatTimestamp(agent.updatedAt)}</dd></div>{registration && <div><dt>Registration transaction</dt><dd><TransactionHash value={registration.transactionHash} /></dd></div>}</dl><p className="identity-description">{agent.description ?? "Metadata unavailable"}</p></article>
        <article className="panel lifecycle-panel"><header><div><p className="eyebrow">Immutable event history</p><h3>Identity lifecycle</h3></div><Activity /></header><ol className="lifecycle-list">{events.map((event) => <li key={`${event.transactionHash}-${event.type}`}><span className={`event-dot event-${event.type.toLowerCase()}`} /><div><strong>IDENTITY {event.type.toUpperCase()}</strong><small><Clock3 /> {formatTimestamp(event.timestamp)} · Block {event.blockNumber}</small><TransactionHash value={event.transactionHash} /></div></li>)}</ol></article></section>
      <section className="panel owner-controls"><header><div><p className="eyebrow"><WalletCards size={13} /> Controlling wallet actions</p><h3>Identity lifecycle controls</h3></div>{owner && <StatusBadge tone="verified" label="OWNER VERIFIED" />}</header>{!owner && <div className="owner-gate"><ShieldCheck /><div><strong>Only the controlling wallet can modify this identity.</strong><p>Connect the registered browser wallet or select its assigned local demo wallet.</p></div><div>{session.browserWalletAvailable && <Button variant="secondary" onClick={() => session.connectBrowserWallet().catch(() => undefined)}>Connect wallet</Button>}{session.demoWallets.filter((wallet) => wallet.assignedAgentId === agent.agentId).map((wallet) => <Button key={wallet.address} variant="technical" onClick={() => session.selectDemoWallet(wallet)}>Use {wallet.label}</Button>)}</div></div>}{owner && <div className="owner-action-row"><Button variant="secondary" icon={Edit3} onClick={() => setUpdateOpen(true)}>Update Identity</Button>{agent.status === "Active" ? <Button variant="danger" icon={ShieldAlert} onClick={() => setRevokeOpen(true)}>Revoke Identity</Button> : <Button variant="success" icon={RotateCcw} loading={busy} onClick={() => runLifecycle("reactivate")}>Reactivate Identity</Button>}</div>}{actionError && <p className="validation-message">{actionError}</p>}</section>
      {transaction && <TransactionReceiptPanel transaction={transaction} />}
      <SideDrawer open={updateOpen} onClose={() => setUpdateOpen(false)} title="Update Identity"><div className="drawer-form"><FormField label="Agent Name" htmlFor="update-name"><TextInput id="update-name" value={name} onChange={(e) => setName(e.target.value)} /></FormField><FormField label="Organization" htmlFor="update-organization"><TextInput id="update-organization" value={organization} onChange={(e) => setOrganization(e.target.value)} /></FormField><FormField label="Description" htmlFor="update-description"><Textarea id="update-description" value={description} onChange={(e) => setDescription(e.target.value)} /></FormField><FormField label="Category" htmlFor="update-category"><TextInput id="update-category" value={category} onChange={(e) => setCategory(e.target.value)} /></FormField><FormField label="Capabilities" htmlFor="update-capabilities"><TextInput id="update-capabilities" value={capabilities} onChange={(e) => setCapabilities(e.target.value)} /></FormField><p className="field-note">Name and organization changes require a blockchain transaction. Profile-only metadata changes require an owner signature but no transaction.</p><Button loading={busy} onClick={saveUpdate}>Save Identity</Button></div></SideDrawer>
      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke AgentID"><div className="danger-confirm"><ShieldAlert /><p>Revoking this AgentID will cause authenticated requests from this identity to be rejected.</p><FormField label={`Type REVOKE ${agent.agentId}`} htmlFor="revoke-confirm"><TextInput id="revoke-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></FormField><div className="dialog-actions"><Button variant="ghost" onClick={() => setRevokeOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} disabled={confirmation !== `REVOKE ${agent.agentId}`} onClick={() => runLifecycle("revoke")}>Confirm revocation</Button></div></div></Modal>
    </div>
  );
}

function formatTimestamp(value: string) { const number = Number(value); return Number.isFinite(number) ? new Date(number * 1000).toLocaleString() : "Unavailable"; }
