import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/router";
import { generateAgentId } from "../pages/RegisterAgentPage";
import { onlineHealth } from "./fixtures";
import { NotificationProvider } from "../components/system/NotificationCenter";

const owner = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const hash = `0x${"a".repeat(64)}`;
const activeAgent = { agentId: "AGT-RESEARCH-001", name: "ResearchAI", displayName: "ResearchAI", organization: "AgentID Labs", owner, metadataURI: "agentid://metadata/AGT-RESEARCH-001", registeredAt: "2000000000", updatedAt: "2000000000", status: "Active", blockchainStatus: "Active", description: "Research assistant", category: "Research", capabilities: ["RESEARCH", "SUMMARIZE"], avatarKey: null, accentTheme: null };
const config = { network: "localhost", chainId: 31337, registryAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", abi: [] };
const transaction = { transactionHash: hash, blockNumber: 42, status: "CONFIRMED", operation: "REGISTER", agentId: activeAgent.agentId, ownerWallet: owner, from: owner, to: config.registryAddress, chainId: 31337 };

function stage5Fetch(options: { agent?: typeof activeAgent; unavailable?: boolean; metadataWarning?: boolean; registrationFails?: boolean; walletAvailable?: boolean } = {}) {
  const agent = options.agent ?? activeAgent;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    if (url.endsWith("/api/health")) return json(onlineHealth);
    if (url.endsWith("/api/identity/config")) return json(config);
    if (url.endsWith("/api/demo/wallets")) return json({ wallets: [{ label: "Demo Wallet 4", address: owner, available: options.walletAvailable ?? false, assignedAgentId: options.walletAvailable ? null : agent.agentId }] });
    if (url.includes("/availability")) return json({ agentId: "AGT-RESEARCH-001", available: !options.unavailable });
    if (url.endsWith("/api/registry")) return json({ agents: [agent], metadataAvailable: !options.metadataWarning, ...(options.metadataWarning ? { warning: "Blockchain identities are available, but metadata enrichment is offline." } : {}) });
    if (url.includes(`/api/registry/${agent.agentId}`)) return json({ agent, metadataAvailable: !options.metadataWarning, ...(options.metadataWarning ? { warning: "On-chain identity loaded, but metadata is temporarily unavailable." } : {}) });
    if (url.includes(`/api/agents/${agent.agentId}/events`)) return json({ events: [{ type: "Registered", agentId: agent.agentId, owner, timestamp: "2000000000", blockNumber: 42, transactionHash: hash }] });
    if (url.includes("/api/agents/wallet/")) return options.unavailable ? json({ code: "UNKNOWN_WALLET" }, 404) : json({ agent });
    if (url.endsWith(`/api/agents/${agent.agentId}`)) return json({ agent });
    if (url.endsWith("/api/analytics/summary")) return json({ totalVerificationAttempts: 7, verifiedRequests: 5, blockedRequests: 2, successRate: 71.43, totalInteractions: 3, uniqueActiveAgentsInInteractions: 2, blockedByReason: { NONCE_REUSED: 1 } });
    if (url.includes("/api/audit")) return json({ events: [{ id: "1", timestamp: new Date().toISOString(), type: "REQUEST_VERIFIED", senderAgentId: agent.agentId, result: "VERIFIED", code: "VERIFIED", reason: "ok" }] });
    if (url.endsWith("/api/demo/identities") && init?.method === "POST") return options.registrationFails ? json({ code: "TRANSACTION_FAILED", reason: "Registration failed." }, 502) : json({ transaction, metadataSynced: true }, 201);
    if (url.includes("/revoke")) return json({ transaction: { ...transaction, operation: "REVOKE" }, metadataSynced: true });
    if (url.includes("/reactivate")) return json({ transaction: { ...transaction, operation: "REACTIVATE" }, metadataSynced: true });
    if (url.endsWith("/api/verify")) return json({ verified: false, code: "NONCE_REUSED", reason: "Request nonce has already been accepted.", checks: { signatureValid: true, walletMatches: true, identityActive: true, timestampValid: true, nonceUnused: false } }, 403);
    return json({ code: "NOT_FOUND", reason: url }, 404);
  });
}

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<NotificationProvider><RouterProvider router={router} /></NotificationProvider>);
  return router;
}

afterEach(() => { vi.restoreAllMocks(); });

describe("Stage 5 registration", () => {
  it("generates readable AgentIDs", () => {
    expect(generateAgentId("ResearchAI")).toBe("AGT-RESEARCH-001");
    expect(generateAgentId("Security Research AI", 2)).toBe("AGT-SECURITY-RESEARCH-002");
  });

  it("validates profile fields before advancing", () => {
    stage5Fetch(); renderRoute("/app/register");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("checks AgentID availability and reports collisions", async () => {
    stage5Fetch({ unavailable: true }); const user = userEvent.setup(); renderRoute("/app/register");
    await user.type(screen.getByLabelText("Agent Name"), "ResearchAI"); await user.type(screen.getByLabelText("Organization"), "AgentID Labs"); await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("IN USE")).toBeInTheDocument();
  });

  it("shows browser-wallet unavailable and local demo ownership choices", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute("/app/register");
    await user.type(screen.getByLabelText("Agent Name"), "ResearchAI"); await user.type(screen.getByLabelText("Organization"), "AgentID Labs"); await user.click(screen.getByRole("button", { name: "Continue" })); await screen.findByText("AVAILABLE"); await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Browser wallet unavailable")).toBeInTheDocument(); expect(screen.getByText("Local Demo Wallet")).toBeInTheDocument();
  });

  it("issues an identity through an available local demo wallet", async () => {
    stage5Fetch({ walletAvailable: true }); const user = userEvent.setup(); renderRoute("/app/register");
    await user.type(screen.getByLabelText("Agent Name"), "ResearchAI"); await user.type(screen.getByLabelText("Organization"), "AgentID Labs"); await user.type(screen.getByLabelText("Capabilities"), "RESEARCH, SUMMARIZE"); await user.click(screen.getByRole("button", { name: "Continue" })); await screen.findByText("AVAILABLE"); await user.click(screen.getByRole("button", { name: "Continue" }));
    const walletButton = (await screen.findByText("Demo Wallet 4")).closest("button")!; await user.click(walletButton); await user.click(screen.getByRole("button", { name: "Continue" })); await user.click(screen.getByRole("button", { name: "Issue Identity" }));
    expect(await screen.findByText("IDENTITY ISSUED")).toBeInTheDocument(); expect(screen.getByText("REGISTER CONFIRMED")).toBeInTheDocument();
  });

  it("shows a human-readable registration failure", async () => {
    stage5Fetch({ walletAvailable: true, registrationFails: true }); const user = userEvent.setup(); renderRoute("/app/register");
    await user.type(screen.getByLabelText("Agent Name"), "ResearchAI"); await user.type(screen.getByLabelText("Organization"), "AgentID Labs"); await user.click(screen.getByRole("button", { name: "Continue" })); await screen.findByText("AVAILABLE"); await user.click(screen.getByRole("button", { name: "Continue" })); await user.click((await screen.findByText("Demo Wallet 4")).closest("button")!); await user.click(screen.getByRole("button", { name: "Continue" })); await user.click(screen.getByRole("button", { name: "Issue Identity" }));
    expect(await screen.findAllByText("Registration failed.")).not.toHaveLength(0);
  });
});

describe("Stage 5 registry and Passport", () => {
  it("loads real registry data and supports search", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute("/app/registry");
    expect(await screen.findByText("ResearchAI")).toBeInTheDocument(); await user.type(screen.getByLabelText("Search registry"), "missing"); expect(screen.getByText("No matching identities")).toBeInTheDocument();
  });

  it("filters registry by lifecycle status", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute("/app/registry"); await screen.findByText("ResearchAI"); await user.selectOptions(screen.getByLabelText("Filter status"), "Revoked"); expect(screen.getByText("No matching identities")).toBeInTheDocument();
  });

  it("keeps blockchain identities visible with a metadata warning", async () => {
    stage5Fetch({ metadataWarning: true }); renderRoute("/app/registry"); expect(await screen.findByText(/metadata enrichment is offline/i)).toBeInTheDocument(); expect(screen.getByText("ResearchAI")).toBeInTheDocument();
  });

  it("loads a real Passport and lifecycle transaction", async () => {
    stage5Fetch(); renderRoute(`/app/registry/${activeAgent.agentId}`); expect(await screen.findAllByText("ResearchAI")).not.toHaveLength(0); expect(screen.getByText("IDENTITY REGISTERED")).toBeInTheDocument(); expect(screen.getAllByLabelText(`transaction hash: ${hash}`)).not.toHaveLength(0);
  });

  it("exports safe Passport JSON", async () => {
    stage5Fetch(); const user = userEvent.setup(); const create = vi.fn(() => "blob:test"); Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create }); Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() }); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined); renderRoute(`/app/registry/${activeAgent.agentId}`); await screen.findByText("Export JSON"); await user.click(screen.getByRole("button", { name: /Export JSON/i })); expect(create).toHaveBeenCalled();
  });

  it("shows deliberate owner gating when no controlling wallet is selected", async () => {
    stage5Fetch(); renderRoute(`/app/registry/${activeAgent.agentId}`); expect(await screen.findByText(/Only the controlling wallet can modify/i)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Revoke Identity" })).not.toBeInTheDocument();
  });

  it("requires typed owner confirmation before revocation", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute(`/app/registry/${activeAgent.agentId}`); await screen.findByText(/Only the controlling wallet/i); await user.click(screen.getByRole("button", { name: "Use Demo Wallet 4" })); await user.click(await screen.findByRole("button", { name: "Revoke Identity" }));
    const confirm = screen.getByLabelText(`Type REVOKE ${activeAgent.agentId}`); expect(screen.getByRole("button", { name: "Confirm revocation" })).toBeDisabled(); fireEvent.change(confirm, { target: { value: `REVOKE ${activeAgent.agentId}` } }); expect(screen.getByRole("button", { name: "Confirm revocation" })).toBeEnabled();
  });

  it("allows the owner to reactivate a revoked identity", async () => {
    const revoked = { ...activeAgent, status: "Revoked" as const, blockchainStatus: "Revoked" as const }; stage5Fetch({ agent: revoked }); const user = userEvent.setup(); renderRoute(`/app/registry/${activeAgent.agentId}`); await screen.findByText(/Only the controlling wallet/i); await user.click(screen.getByRole("button", { name: "Use Demo Wallet 4" })); await user.click(await screen.findByRole("button", { name: "Reactivate Identity" })); expect(await screen.findByText("REACTIVATE CONFIRMED")).toBeInTheDocument();
  });
});

describe("Stage 5 verification and dashboard", () => {
  it("renders ACTIVE registry verification", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute("/app/verification"); await user.type(screen.getByLabelText("AgentID or wallet address"), activeAgent.agentId); await user.click(screen.getByRole("button", { name: "Verify Identity" })); expect(await screen.findByText("IDENTITY VERIFIED")).toBeInTheDocument();
  });

  it("renders REVOKED without calling it verified", async () => {
    stage5Fetch({ agent: { ...activeAgent, status: "Revoked", blockchainStatus: "Revoked" } }); const user = userEvent.setup(); renderRoute("/app/verification"); await user.type(screen.getByLabelText("AgentID or wallet address"), activeAgent.agentId); await user.click(screen.getByRole("button", { name: "Verify Identity" })); expect(await screen.findByText("IDENTITY REVOKED")).toBeInTheDocument();
  });

  it("renders UNKNOWN identity", async () => {
    stage5Fetch({ unavailable: true }); const user = userEvent.setup(); renderRoute("/app/verification"); await user.type(screen.getByLabelText("AgentID or wallet address"), owner); await user.click(screen.getByRole("button", { name: "Verify Identity" })); expect(await screen.findByText("IDENTITY NOT FOUND")).toBeInTheDocument();
  });

  it("renders actual signed-request result codes and checks", async () => {
    stage5Fetch(); const user = userEvent.setup(); renderRoute("/app/verification"); await user.click(screen.getByRole("button", { name: /Advanced signed request/i })); fireEvent.change(screen.getByLabelText("Structured request"), { target: { value: JSON.stringify({ requestId: "REQ-1" }) } }); await user.type(screen.getByLabelText("EIP-712 signature"), "0x1234"); await user.click(screen.getByRole("button", { name: "Run Authentication" })); expect(await screen.findByText("NONCE_REUSED")).toBeInTheDocument(); expect(screen.getByText("Nonce Unused")).toBeInTheDocument();
  });

  it("renders Command Center metrics from APIs", async () => {
    stage5Fetch(); renderRoute("/app"); expect(await screen.findByText("7")).toBeInTheDocument(); expect(screen.getByText(/5 verified · 2 blocked/i)).toBeInTheDocument(); expect(screen.getByText(/AGT-RESEARCH-001 registered/i)).toBeInTheDocument();
  });
});
