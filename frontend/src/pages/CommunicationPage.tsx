import { Activity, ArrowRight, Bot, Braces, History, KeyRound, Play, RadioTower, RotateCcw, Send, ShieldAlert, ShieldCheck, WalletCards, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TrustEnvelope } from "../components/communication/TrustEnvelope";
import { TrustPipeline } from "../components/communication/TrustPipeline";
import { useIdentitySession } from "../components/identity/IdentitySessionProvider";
import { useSystemHealth } from "../components/system/HealthProvider";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { FormField, Select, Textarea, TextInput } from "../components/ui/FormControls";
import { SideDrawer } from "../components/ui/Overlays";
import { StatusBadge } from "../components/ui/StatusBadge";
import { TechnicalValue, WalletAddress } from "../components/ui/TechnicalValue";
import { apiClient } from "../lib/api-client";
import { signPreparedCommunication } from "../services/communication-signing";
import type { AuditEvent, CommunicationResult, DemoCommunicationAgent, EnrichedAgent, InteractionRecord, JsonValue, PreparedCommunication } from "../types/api";

type SigningMode = "demo" | "browser";
type HistoryItem = { requestId: string; senderAgentId: string; receiverAgentId: string; action: string; result: "VERIFIED" | "BLOCKED"; timestamp: string; interaction?: InteractionRecord; audit?: AuditEvent };
type WorkflowStep = { label: string; requestId?: string; result?: CommunicationResult };

const DEFAULT_PAYLOADS: Record<string, Record<string, JsonValue>> = {
  SEARCH_HOTELS: { city: "Chennai", checkIn: "2026-09-25", checkOut: "2026-09-27", guests: 2 },
  CHECK_AVAILABILITY: { city: "Chennai", guests: 2 },
  AUTHORIZE_PAYMENT: { amount: 4200, currency: "INR", reference: "HOTEL-DEMO" },
  MOCK_PAYMENT: { amount: 4200, currency: "INR", reference: "HOTEL-DEMO" },
  PLAN_TRIP: { city: "Chennai", days: 2 }, BUILD_ITINERARY: { city: "Chennai", days: 2 },
};

export function CommunicationPage() {
  const health = useSystemHealth();
  const session = useIdentitySession();
  const [registry, setRegistry] = useState<EnrichedAgent[]>([]);
  const [agents, setAgents] = useState<DemoCommunicationAgent[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, string[]>>({});
  const [mode, setMode] = useState<SigningMode>("demo");
  const [senderId, setSenderId] = useState(""); const [receiverId, setReceiverId] = useState(""); const [action, setAction] = useState("");
  const [payloadMode, setPayloadMode] = useState<"friendly" | "json">("friendly");
  const [payload, setPayload] = useState<Record<string, JsonValue>>(DEFAULT_PAYLOADS.SEARCH_HOTELS);
  const [payloadText, setPayloadText] = useState(JSON.stringify(DEFAULT_PAYLOADS.SEARCH_HOTELS, null, 2));
  const [prepared, setPrepared] = useState<PreparedCommunication | null>(null); const [signature, setSignature] = useState<string | null>(null); const [result, setResult] = useState<CommunicationResult | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySender, setHistorySender] = useState(""); const [historyReceiver, setHistoryReceiver] = useState(""); const [historyResult, setHistoryResult] = useState("");
  const [detail, setDetail] = useState<HistoryItem | null>(null); const [workflow, setWorkflow] = useState<WorkflowStep[]>([]); const [workflowBusy, setWorkflowBusy] = useState(false);
  const demoSigningEnabled = Boolean(health.data?.demoSigningEnabled && health.data.blockchain.chainId === 31337);

  const loadHistory = async () => {
    const [interactions, audit] = await Promise.all([apiClient.interactions({ limit: 60, offset: 0 }), apiClient.audit(undefined, { limit: 100, offset: 0 })]);
    const verified = interactions.interactions.map((item): HistoryItem => ({ requestId: item.requestId, senderAgentId: item.senderAgentId, receiverAgentId: item.receiverAgentId, action: item.action, result: "VERIFIED", timestamp: item.createdAt, interaction: item, audit: audit.events.find((event) => event.requestId === item.requestId) }));
    const seen = new Set(verified.map((item) => item.requestId));
    const blocked = audit.events.filter((item) => item.result === "BLOCKED" && item.requestId && !seen.has(item.requestId)).map((item): HistoryItem => ({ requestId: item.requestId!, senderAgentId: item.senderAgentId ?? "UNKNOWN", receiverAgentId: item.receiverAgentId ?? "UNKNOWN", action: item.action ?? "UNKNOWN", result: "BLOCKED", timestamp: item.timestamp, audit: item }));
    setHistory([...verified, ...blocked].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
  };

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([apiClient.registry(controller.signal), apiClient.communicationCapabilities(controller.signal), apiClient.demoCommunicationAgents(controller.signal)]).then(([registryResult, capsResult, agentsResult]) => {
      if (registryResult.status === "fulfilled") setRegistry(registryResult.value.agents);
      if (capsResult.status === "fulfilled") setCapabilities(capsResult.value.handlers);
      if (agentsResult.status === "fulfilled") {
        setAgents(agentsResult.value.agents);
        const travel = agentsResult.value.agents.find((item) => item.agentId === "AGT-TRAVEL-001") ?? agentsResult.value.agents[0];
        const hotel = agentsResult.value.agents.find((item) => item.agentId === "AGT-HOTEL-001") ?? agentsResult.value.agents.find((item) => item.agentId !== travel?.agentId);
        setSenderId((current) => current || travel?.agentId || ""); setReceiverId((current) => current || hotel?.agentId || "");
      }
    });
    loadHistory().catch(() => undefined);
    return () => controller.abort();
  }, []);

  const browserAgents = useMemo(() => registry.filter((item) => item.status === "Active" && session.address && item.owner.toLowerCase() === session.address.toLowerCase()), [registry, session.address]);
  const publicAgents = useMemo(() => registry.map((item): DemoCommunicationAgent => ({ label: `${item.displayName} browser identity`, agentId: item.agentId, name: item.displayName, organization: item.organization, address: item.owner, status: item.status, supportedActions: capabilities[item.agentId] ?? [] })), [registry, capabilities]);
  const senders = mode === "demo" ? agents : browserAgents.map((item): DemoCommunicationAgent => ({ label: item.name, agentId: item.agentId, name: item.displayName, organization: item.organization, address: item.owner, status: item.status, supportedActions: capabilities[item.agentId] ?? [] }));
  const selectableAgents = mode === "demo" ? agents : publicAgents;
  const receivers = selectableAgents.filter((item) => item.agentId !== senderId && item.status === "Active");
  const selectedSender = senders.find((item) => item.agentId === senderId); const selectedReceiver = selectableAgents.find((item) => item.agentId === receiverId);
  const actions = capabilities[receiverId] ?? selectedReceiver?.supportedActions ?? [];

  useEffect(() => { if (!actions.includes(action)) setAction(actions[0] ?? ""); }, [action, receiverId, actions.join("|")]);
  useEffect(() => { if (!action) return; const next = DEFAULT_PAYLOADS[action] ?? {}; setPayload(next); setPayloadText(JSON.stringify(next, null, 2)); setPrepared(null); setResult(null); setSignature(null); }, [action]);
  useEffect(() => { if (health.data && !demoSigningEnabled) setMode("browser"); }, [health.data, demoSigningEnabled]);
  useEffect(() => { if (mode === "browser") setSenderId(browserAgents[0]?.agentId ?? ""); else if (!agents.some((item) => item.agentId === senderId)) setSenderId(agents[0]?.agentId ?? ""); }, [mode, agents.length, browserAgents.length]);
  useEffect(() => { if (!receivers.some((item) => item.agentId === receiverId)) setReceiverId(receivers[0]?.agentId ?? ""); }, [senderId, receivers.length]);

  const currentPayload = (): JsonValue => {
    if (payloadMode === "friendly") return payload;
    const parsed = JSON.parse(payloadText) as JsonValue;
    if (parsed === undefined) throw new Error("Payload must be valid JSON.");
    return parsed;
  };

  const send = async () => {
    if (health.phase !== "online") { setError("VERIFICATION SERVICE UNAVAILABLE. Delivery is disabled and the receiver will not execute."); return; }
    if (!selectedSender || !selectedReceiver || !action) { setError("Select a sender, receiver, and supported action."); return; }
    setBusy(true); setError(null); setPrepared(null); setSignature(null); setResult(null);
    try {
      const next = await apiClient.prepareCommunication({ senderAgentId: selectedSender.agentId, receiverAgentId: selectedReceiver.agentId, action, payload: currentPayload() });
      setPrepared(next);
      const sent = mode === "demo" ? await apiClient.demoCommunicationSend(selectedSender.address, next.request) : await sendFromBrowser(next, selectedSender.address);
      setSignature(sent.signature ?? null); setResult(sent); await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Communication failed safely."); }
    finally { setBusy(false); }
  };

  const sendFromBrowser = async (next: PreparedCommunication, wallet: string) => {
    const signed = await signPreparedCommunication(next, wallet); setSignature(signed); return apiClient.sendCommunication(next.request, signed);
  };

  const replay = async () => {
    if (!prepared || !signature) return;
    setBusy(true); setError(null);
    try { const replayResult = await apiClient.sendCommunication(prepared.request, signature); setResult(replayResult); await loadHistory(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Replay test failed safely."); }
    finally { setBusy(false); }
  };

  const runWorkflow = async () => {
    const travel = agents.find((item) => item.agentId === "AGT-TRAVEL-001"); if (!travel) { setError("TravelAI local signer is unavailable."); return; }
    setWorkflowBusy(true); setWorkflow([]); setError(null);
    try {
      const hotel = await runDemoStep(travel, "AGT-HOTEL-001", "SEARCH_HOTELS", DEFAULT_PAYLOADS.SEARCH_HOTELS); setWorkflow([{ label: "TravelAI → HotelAI", requestId: hotel.requestId, result: hotel }]);
      if (!hotel.delivered) return;
      const paymentPayload = { ...DEFAULT_PAYLOADS.AUTHORIZE_PAYMENT, reference: hotel.requestId ?? "HOTEL-DEMO" };
      const payment = await runDemoStep(travel, "AGT-PAYMENT-001", "AUTHORIZE_PAYMENT", paymentPayload); setWorkflow((steps) => [...steps, { label: "TravelAI → PaymentAI", requestId: payment.requestId, result: payment }]);
      await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Workflow failed safely."); }
    finally { setWorkflowBusy(false); }
  };

  const runDemoStep = async (sender: DemoCommunicationAgent, receiverAgentId: string, stepAction: string, stepPayload: JsonValue) => {
    const next = await apiClient.prepareCommunication({ senderAgentId: sender.agentId, receiverAgentId, action: stepAction, payload: stepPayload });
    return apiClient.demoCommunicationSend(sender.address, next.request);
  };

  const filteredHistory = history.filter((item) => (!historySender || item.senderAgentId === historySender) && (!historyReceiver || item.receiverAgentId === historyReceiver) && (!historyResult || item.result === historyResult));
  const updatePayload = (key: string, value: string) => { const numeric = key === "guests" || key === "amount" || key === "days"; const next = { ...payload, [key]: numeric ? Number(value) : value }; setPayload(next); setPayloadText(JSON.stringify(next, null, 2)); };

  return <div className="page-stack stage5-page communication-page">
    <header className="product-page-header communication-header"><div><p className="eyebrow"><RadioTower size={13} /> Authenticated agent network</p><h2>Agent Communication</h2><p>Sign, verify, and deliver deterministic agent requests through the AgentID trust boundary.</p></div><div className="header-actions"><StatusBadge tone={health.phase === "online" ? "active" : health.phase === "loading" ? "pending" : "offline"} label={health.phase === "online" ? "VERIFICATION ONLINE" : "FAIL CLOSED"} /><Button variant="technical" icon={Workflow} loading={workflowBusy} disabled={health.phase !== "online" || !demoSigningEnabled} onClick={runWorkflow}>Run Travel Workflow</Button></div></header>
    {health.phase !== "online" && <div className="communication-offline"><ShieldAlert /><div><strong>VERIFICATION SERVICE UNAVAILABLE</strong><p>Authentication requires the blockchain. Delivery is disabled and no receiver will execute.</p></div></div>}
    <section className="communication-workspace">
      <aside className="agent-selector panel"><header><p className="eyebrow">01 · Identities</p><h3>Agent selection</h3></header><div className="mode-switch"><button className={mode === "demo" ? "is-active" : ""} disabled={!demoSigningEnabled} onClick={() => setMode("demo")}><Bot /> Local demo</button><button className={mode === "browser" ? "is-active" : ""} onClick={() => setMode("browser")}><WalletCards /> Browser wallet</button></div>{!demoSigningEnabled && <p className="field-note">Production uses browser-wallet signatures only. Local demo signing is disabled.</p>}{mode === "browser" && !session.address && <Button variant="secondary" disabled={!session.browserWalletAvailable} onClick={() => session.connectBrowserWallet().catch((cause) => setError(cause instanceof Error ? cause.message : "Wallet unavailable."))}>{session.browserWalletAvailable ? "Connect browser wallet" : "Browser wallet unavailable"}</Button>}<FormField label="Sender Agent" htmlFor="communication-sender"><Select id="communication-sender" value={senderId} onChange={(event) => setSenderId(event.target.value)}><option value="">Select sender</option>{senders.map((item) => <option key={item.agentId} value={item.agentId}>{item.name} · {item.agentId}{item.status === "Revoked" ? " · REVOKED FAILURE DEMO" : ""}</option>)}</Select></FormField>{selectedSender && <AgentSummary agent={selectedSender} />}{mode === "browser" && session.address && !selectedSender && <p className="field-note">This connected wallet does not control an active public AgentID.</p>}<div className="agent-route-arrow"><ArrowRight /><span>signed trust envelope</span></div><FormField label="Receiver Agent" htmlFor="communication-receiver"><Select id="communication-receiver" value={receiverId} onChange={(event) => setReceiverId(event.target.value)}><option value="">Select receiver</option>{receivers.map((item) => <option key={item.agentId} value={item.agentId}>{item.name} · {item.agentId}</option>)}</Select></FormField>{selectedReceiver && <AgentSummary agent={selectedReceiver} />}{mode === "browser" && receivers.length === 0 && <p className="field-note">A second active public AgentID must be registered from a different wallet before communication can be demonstrated.</p>}</aside>
      <main className="communication-composer panel"><header><div><p className="eyebrow">02 · Signed request</p><h3>Request composer</h3></div><StatusBadge tone="active" label="DETERMINISTIC HANDLER" /></header><FormField label="Action" htmlFor="communication-action"><Select id="communication-action" value={action} onChange={(event) => setAction(event.target.value)}>{actions.map((item) => <option key={item}>{item}</option>)}</Select></FormField>{action && <><div className="mode-switch payload-switch"><button className={payloadMode === "friendly" ? "is-active" : ""} onClick={() => setPayloadMode("friendly")}><Bot /> Friendly form</button><button className={payloadMode === "json" ? "is-active" : ""} onClick={() => setPayloadMode("json")}><Braces /> Advanced JSON</button></div>{payloadMode === "friendly" ? <div className="payload-fields">{Object.entries(payload).map(([key, value]) => <FormField key={key} label={friendlyLabel(key)} htmlFor={`payload-${key}`}><TextInput id={`payload-${key}`} type={typeof value === "number" ? "number" : key.toLowerCase().includes("date") ? "date" : "text"} value={String(value)} onChange={(event) => updatePayload(key, event.target.value)} /></FormField>)}</div> : <FormField label="Exact signed payload" htmlFor="payload-json"><Textarea id="payload-json" className="code-textarea" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} spellCheck={false} /></FormField>}</>}<Button icon={Send} loading={busy} disabled={health.phase !== "online" || !selectedSender || !selectedReceiver || !action} onClick={send}>Sign &amp; Send Request</Button>{error && <p className="communication-error" role="alert"><ShieldAlert /> {error}</p>}{result && <CommunicationOutcome result={result} />}{result?.delivered && <div className="replay-action"><Button variant="danger" icon={RotateCcw} loading={busy} onClick={replay}>Replay Previous Request</Button><small>Replay Test reuses the accepted signed envelope exactly. Expected: NONCE_REUSED.</small></div>}</main>
      <TrustPipeline prepared={prepared} signature={signature} result={result} busy={busy} />
    </section>
    {workflow.length > 0 && <section className="panel workflow-visual"><header><div><p className="eyebrow">Real multi-agent demonstration</p><h3>Travel workflow</h3></div><StatusBadge tone={workflow.every((item) => item.result?.delivered) ? "verified" : "blocked"} /></header><div>{workflow.map((step, index) => <article key={step.label} className={step.result?.delivered ? "is-complete" : "is-blocked"}><Bot /><strong>{step.label}</strong><span>{step.result?.delivered ? "VERIFIED" : step.result?.verification.code}</span><TechnicalValue label="workflow request ID" value={step.requestId ?? "Unavailable"} truncate={false} />{index < workflow.length - 1 && <ArrowRight />}</article>)}</div></section>}
    {(prepared || signature) && <details className="panel signed-inspector"><summary><KeyRound /> Signed Request Inspector</summary><div className="inspector-grid">{prepared && <><Inspector label="Request ID" value={prepared.request.requestId} /><Inspector label="Payload hash" value={prepared.typedData.payloadHash} /><Inspector label="Nonce" value={prepared.request.nonce} /><Inspector label="EIP-712 domain" value={JSON.stringify(prepared.typedData.domain, null, 2)} /><Inspector label="Exact request" value={JSON.stringify(prepared.request, null, 2)} /></>}{signature && <Inspector label="Signature" value={signature} />}</div><p>Private keys are never exposed. Signatures and nonces are visible for the current session; persistent history retains the interaction and audit record, not signing secrets.</p></details>}
    <section className="panel communication-history"><header><div><p className="eyebrow"><History size={13} /> Persistent records</p><h3>Communication history</h3></div><Button variant="ghost" icon={Activity} onClick={() => loadHistory().catch(() => undefined)}>Refresh</Button></header><div className="history-filters"><Select aria-label="Filter by sender" value={historySender} onChange={(event) => setHistorySender(event.target.value)}><option value="">All senders</option>{unique(history.map((item) => item.senderAgentId)).map((item) => <option key={item}>{item}</option>)}</Select><Select aria-label="Filter by receiver" value={historyReceiver} onChange={(event) => setHistoryReceiver(event.target.value)}><option value="">All receivers</option>{unique(history.map((item) => item.receiverAgentId)).map((item) => <option key={item}>{item}</option>)}</Select><Select aria-label="Filter by result" value={historyResult} onChange={(event) => setHistoryResult(event.target.value)}><option value="">All results</option><option>VERIFIED</option><option>BLOCKED</option></Select></div>{filteredHistory.length ? <div className="history-list">{filteredHistory.map((item) => <button key={`${item.requestId}-${item.result}`} onClick={() => setDetail(item)} title={`${item.requestId} · ${item.action} · ${item.result}`}><span><Bot /><strong>{item.senderAgentId}</strong><ArrowRight /><strong>{item.receiverAgentId}</strong></span><span><code>{item.action}</code><StatusBadge tone={item.result === "VERIFIED" ? "verified" : "blocked"} /><small>{new Date(item.timestamp).toLocaleString()}</small></span></button>)}</div> : <EmptyState title="No communication records" description="Verified interactions and blocked audit attempts will appear here." kind="activity" />}</section>
    <SideDrawer open={Boolean(detail)} onClose={() => setDetail(null)} title="Interaction details">{detail && <InteractionDetail item={detail} />}</SideDrawer>
  </div>;
}

function AgentSummary({ agent }: { agent: DemoCommunicationAgent }) { return <article className={`agent-summary ${agent.status === "Revoked" ? "is-revoked" : ""}`}><span><Bot /><div><strong>{agent.name}</strong><small>{agent.agentId} · {agent.organization}</small></div><StatusBadge tone={agent.status === "Active" ? "active" : "revoked"} /></span><WalletAddress value={agent.address} /><p>{agent.supportedActions.join(" · ")}</p></article>; }
function CommunicationOutcome({ result }: { result: CommunicationResult }) {
  const warnings = [...(result.verification.operationalWarnings ?? []), ...(result.operationalWarnings ?? [])];
  return <section className={`communication-outcome ${result.delivered ? "is-verified" : "is-blocked"}`}><TrustEnvelope result={result} /><header>{result.delivered ? <ShieldCheck /> : <ShieldAlert />}<div><h3>{result.delivered ? "REQUEST VERIFIED" : "REQUEST BLOCKED"}</h3><p>{result.verification.code} · {result.verification.reason}</p></div></header>{warnings.length > 0 && <div className="persistence-degraded" role="status"><ShieldAlert /><div><strong>PERSISTENCE DEGRADED</strong>{warnings.map((warning) => <p key={warning}>{warning === "AUDIT_PERSISTENCE_FAILED" ? "The authentication decision was preserved, but its audit event could not be stored." : warning === "INTERACTION_PERSISTENCE_FAILED" ? "The receiver executed after verification, but interaction history could not be stored." : warning}</p>)}</div></div>}<dl><div><dt>Request ID</dt><dd>{result.requestId && <TechnicalValue label="request ID" value={result.requestId} truncate={false} />}</dd></div><div><dt>Receiver</dt><dd>{result.receiverExecuted ? "EXECUTED AFTER VERIFICATION" : "NOT EXECUTED"}</dd></div>{result.verification.recoveredWallet && <div><dt>Recovered signer</dt><dd><WalletAddress value={result.verification.recoveredWallet} /></dd></div>}</dl>{result.delivered && result.response && <div className="agent-conversation"><article><small>{result.senderAgentId} · {result.action}</small><p>Authenticated structured request</p></article><span><ShieldCheck /> VERIFIED REQUEST</span><article><small>{result.receiverAgentId} · deterministic response</small><pre>{JSON.stringify(result.response.data, null, 2)}</pre></article></div>}</section>;
}
function Inspector({ label, value }: { label: string; value: string }) { return <div><span><small>{label}</small><TechnicalValue label={label} value={value} /></span><pre>{value}</pre></div>; }
function InteractionDetail({ item }: { item: HistoryItem }) { return <div className="interaction-detail"><StatusBadge tone={item.result === "VERIFIED" ? "verified" : "blocked"} /><dl><div><dt>Request ID</dt><dd><TechnicalValue label="request ID" value={item.requestId} truncate={false} /></dd></div><div><dt>Route</dt><dd>{item.senderAgentId} → {item.receiverAgentId}</dd></div><div><dt>Action</dt><dd>{item.action}</dd></div><div><dt>Time</dt><dd>{new Date(item.timestamp).toLocaleString()}</dd></div><div><dt>Audit result</dt><dd>{item.audit?.code ?? item.interaction?.authenticationCode ?? item.result}</dd></div>{item.audit?.recoveredWallet && <div><dt>Recovered signer</dt><dd><WalletAddress value={item.audit.recoveredWallet} /></dd></div>}</dl>{item.interaction && <><h4>Request payload</h4><pre>{JSON.stringify(item.interaction.requestPayload, null, 2)}</pre><h4>Receiver response</h4><pre>{JSON.stringify(item.interaction.responsePayload, null, 2)}</pre></>}<p className="field-note">Persistent records intentionally do not retain signatures or nonce values. The audit record proves the authentication decision without storing reusable signing material.</p></div>; }
function friendlyLabel(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()); }
function unique(values: string[]) { return [...new Set(values)].filter(Boolean).sort(); }
