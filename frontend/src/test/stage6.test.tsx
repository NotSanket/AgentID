import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routes } from "../app/router";
import { onlineHealth } from "./fixtures";

const addresses = {
  travel: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  hotel: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  payment: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
};
const signature = `0x${"ab".repeat(65)}`;
const agents = [
  { label: "TravelAI local signer", agentId: "AGT-TRAVEL-001", name: "TravelAI", organization: "AgentID Travel", address: addresses.travel, status: "Active", supportedActions: ["PLAN_TRIP", "BUILD_ITINERARY"] },
  { label: "HotelAI local signer", agentId: "AGT-HOTEL-001", name: "HotelAI", organization: "AgentID Hotels", address: addresses.hotel, status: "Active", supportedActions: ["SEARCH_HOTELS", "CHECK_AVAILABILITY"] },
  { label: "PaymentAI local signer", agentId: "AGT-PAYMENT-001", name: "PaymentAI", organization: "AgentID Payments", address: addresses.payment, status: "Active", supportedActions: ["AUTHORIZE_PAYMENT", "MOCK_PAYMENT"] },
];

function testFetch(options: { offline?: boolean; revoked?: boolean; history?: boolean } = {}) {
  let sequence = 0;
  const interactions = options.history ? [{ id: "int-history", requestId: "REQ-HISTORY", senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", requestPayload: { city: "Chennai" }, responsePayload: { success: true }, authenticationCode: "VERIFIED", durationMs: 4, createdAt: "2026-09-20T00:00:00.000Z" }] : [];
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input); const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    if (url.endsWith("/api/health")) return options.offline ? Promise.reject(new TypeError("offline")) : json(onlineHealth);
    if (url.endsWith("/api/identity/config")) return json({ network: "localhost", chainId: 31337, registryAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", abi: [] });
    if (url.endsWith("/api/demo/wallets")) return json({ wallets: [] });
    if (url.endsWith("/api/registry")) return json({ agents: agents.map((agent) => ({ ...agent, owner: agent.address, displayName: agent.name, metadataURI: "agentid://demo", registeredAt: "1", updatedAt: "1", blockchainStatus: agent.status, description: null, category: "Demo", capabilities: agent.supportedActions, avatarKey: null, accentTheme: null })), metadataAvailable: true });
    if (url.includes("/events")) return json({ events: [] });
    if (url.endsWith("/api/communication/capabilities")) return json({ handlers: { "AGT-TRAVEL-001": ["PLAN_TRIP", "BUILD_ITINERARY"], "AGT-HOTEL-001": ["SEARCH_HOTELS", "CHECK_AVAILABILITY"], "AGT-PAYMENT-001": ["AUTHORIZE_PAYMENT", "MOCK_PAYMENT"] }, source: "DETERMINISTIC_DEMO_HANDLERS" });
    if (url.endsWith("/api/demo/communication/agents")) return json({ agents: agents.map((agent) => agent.agentId === "AGT-TRAVEL-001" && options.revoked ? { ...agent, status: "Revoked" } : agent), developmentOnly: true });
    if (url.endsWith("/api/communication/prepare")) { const draft = JSON.parse(String(init?.body)); sequence += 1; const request = { requestId: `REQ-STAGE6-${sequence}`, ...draft, timestamp: 2_000_000_000, nonce: `0x${String(sequence).padStart(64, "0")}` }; return json({ request, typedData: { domain: { name: "AgentID", version: "1", chainId: 31337, verifyingContract: "0x5FbDB2315678afecb367f032d93F642f64180aa3" }, types: { AgentRequest: [] }, primaryType: "AgentRequest", message: request, payloadHash: `0x${"c".repeat(64)}` } }, 201); }
    if (url.endsWith("/api/demo/communication/send")) { const body = JSON.parse(String(init?.body)); const blocked = Boolean(options.revoked && body.request.senderAgentId === "AGT-TRAVEL-001"); return json(communication(body.request, blocked ? "AGENT_REVOKED" : "VERIFIED", blocked), blocked ? 403 : 200); }
    if (url.endsWith("/api/communication/send")) { const body = JSON.parse(String(init?.body)); return json(communication(body.request, "NONCE_REUSED", true), 403); }
    if (url.includes("/api/interactions/REQ-HISTORY")) return json({ interaction: interactions[0] });
    if (url.includes("/api/interactions")) return json({ interactions, pagination: { total: interactions.length, limit: 60, offset: 0 } });
    if (url.includes("/api/audit")) return json({ events: options.history ? [{ id: "audit-history", requestId: "REQ-HISTORY", timestamp: "2026-09-20T00:00:00.000Z", type: "REQUEST_VERIFIED", senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", result: "VERIFIED", code: "VERIFIED", reason: "Verified", recoveredWallet: addresses.travel }] : [], pagination: { total: options.history ? 1 : 0, limit: 100, offset: 0 } });
    if (url.endsWith("/api/analytics/summary")) return json({ totalVerificationAttempts: 12, verifiedRequests: 9, blockedRequests: 3, successRate: 75, totalInteractions: 9, uniqueActiveAgentsInInteractions: 3, blockedByReason: { NONCE_REUSED: 1 } });
    return json({ code: "NOT_FOUND", reason: url }, 404);
  });
}

function communication(request: Record<string, unknown>, code: string, blocked: boolean) {
  const checks = { signatureValid: true, senderExists: true, receiverExists: true, receiverActive: true, walletMatches: true, identityActive: !blocked || code === "NONCE_REUSED", timestampValid: true, nonceUnused: !blocked };
  return { request, signature, ...request, delivered: !blocked, receiverExecuted: !blocked, verification: { verified: !blocked, code, reason: blocked ? "Request blocked before receiver execution." : "Agent identity and EIP-712 signature verified.", recoveredWallet: addresses.travel, registeredWallet: addresses.travel, checks }, ...(!blocked ? { response: { success: true, source: "SIMULATED_DEMO_DATA", receiverAgentId: request.receiverAgentId, action: request.action, data: { options: [{ hotel: "Marina View", nightlyRate: 4200 }] } } } : {}) };
}

function renderRoute(path = "/app/communication") { const router = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={router} />); return router; }
afterEach(() => vi.restoreAllMocks());

describe("Stage 6 authenticated communication", () => {
  it("renders the communication workspace and ten-stage trust pipeline", async () => { testFetch(); renderRoute(); expect(await screen.findByRole("heading", { name: "Agent Communication" })).toBeInTheDocument(); expect(screen.getAllByRole("listitem")).toHaveLength(10); });
  it("loads real local demo sender identities", async () => { testFetch(); renderRoute(); expect(await screen.findByText("TravelAI", { selector: "strong" })).toBeInTheDocument(); expect(screen.getAllByText(/AGT-TRAVEL-001/).length).toBeGreaterThan(0); });
  it("allows a different active receiver to be selected", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); const receiver = await screen.findByLabelText("Receiver Agent"); await user.selectOptions(receiver, "AGT-PAYMENT-001"); expect(receiver).toHaveValue("AGT-PAYMENT-001"); expect(screen.getByLabelText("Action")).toHaveValue("AUTHORIZE_PAYMENT"); });
  it("edits the friendly payload that will be signed", async () => { testFetch(); renderRoute(); const city = await screen.findByLabelText("City"); fireEvent.change(city, { target: { value: "Mumbai" } }); expect(city).toHaveValue("Mumbai"); });
  it("supports advanced exact JSON payload editing", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await screen.findByLabelText("City"); await user.click(screen.getByRole("button", { name: /Advanced JSON/i })); fireEvent.change(screen.getByLabelText("Exact signed payload"), { target: { value: '{"city":"Delhi"}' } }); expect(screen.getByLabelText("Exact signed payload")).toHaveValue('{"city":"Delhi"}'); });
  it("uses the guarded demo signer and renders verified delivery", async () => { const spy = testFetch(); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); expect(await screen.findByRole("heading", { name: "REQUEST VERIFIED" })).toBeInTheDocument(); expect(spy.mock.calls.some(([url]) => String(url).endsWith("/api/demo/communication/send"))).toBe(true); });
  it("shows all trust checks passing after a valid response", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); await screen.findByRole("heading", { name: "REQUEST VERIFIED" }); expect(screen.getAllByText("PASS")).toHaveLength(10); });
  it("renders the deterministic receiver response without LLM claims", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); expect(await screen.findByText(/Marina View/)).toBeInTheDocument(); expect(screen.getByText(/deterministic response/i)).toBeInTheDocument(); });
  it("exposes the signed request inspector without private keys", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); expect(await screen.findByText("Signed Request Inspector")).toBeInTheDocument(); expect(screen.getByText(/Private keys are never exposed/i)).toBeInTheDocument(); });
  it("blocks an exact replay and reports receiver not executed", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); await user.click(await screen.findByRole("button", { name: "Replay Previous Request" })); expect(await screen.findByRole("heading", { name: "REQUEST BLOCKED" })).toBeInTheDocument(); expect(screen.getAllByText(/NONCE_REUSED/).length).toBeGreaterThan(0); expect(screen.getByText("NOT EXECUTED")).toBeInTheDocument(); });
  it("shows a revoked-sender lifecycle failure and no receiver response", async () => { testFetch({ revoked: true }); const user = userEvent.setup(); renderRoute(); await user.click(await screen.findByRole("button", { name: "Sign & Send Request" })); expect((await screen.findAllByText(/AGENT_REVOKED/)).length).toBeGreaterThan(0); expect(screen.getByText("NOT EXECUTED")).toBeInTheDocument(); expect(screen.queryByText(/Marina View/)).not.toBeInTheDocument(); });
  it("shows browser-wallet unavailable clearly", async () => { testFetch(); const user = userEvent.setup(); renderRoute(); await screen.findByLabelText("Sender Agent"); await user.click(screen.getByRole("button", { name: /Browser wallet/i })); expect(screen.getByRole("button", { name: "Browser wallet unavailable" })).toBeDisabled(); });
  it("renders persistent interaction history", async () => { testFetch({ history: true }); renderRoute(); expect(await screen.findByTitle(/REQ-HISTORY/)).toBeInTheDocument(); expect(screen.getAllByText("SEARCH_HOTELS").length).toBeGreaterThan(0); });
  it("filters persistent history by result", async () => { testFetch({ history: true }); const user = userEvent.setup(); renderRoute(); await screen.findByTitle(/REQ-HISTORY/); await user.selectOptions(screen.getByLabelText("Filter by result"), "BLOCKED"); expect(screen.getByText("No communication records")).toBeInTheDocument(); });
  it("opens an interaction detail drawer with payload and recovered signer", async () => { testFetch({ history: true }); const user = userEvent.setup(); renderRoute(); const item = await screen.findByTitle(/REQ-HISTORY/); await user.click(item); const dialog = screen.getByRole("dialog"); expect(within(dialog).getByText("Interaction details")).toBeInTheDocument(); expect(within(dialog).getByText("Request payload")).toBeInTheDocument(); expect(within(dialog).getByLabelText(`wallet address: ${addresses.travel}`)).toBeInTheDocument(); });
  it("fails closed while the backend or blockchain is offline", async () => { testFetch({ offline: true }); renderRoute(); expect(await screen.findByText("VERIFICATION SERVICE UNAVAILABLE")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Sign & Send Request" })).toBeDisabled(); });
  it("runs two independently authenticated travel workflow requests", async () => { const spy = testFetch(); const user = userEvent.setup(); renderRoute(); await screen.findByLabelText("Sender Agent"); await user.click(screen.getByRole("button", { name: "Run Travel Workflow" })); expect(await screen.findByText("TravelAI → HotelAI")).toBeInTheDocument(); expect(screen.getByText("TravelAI → PaymentAI")).toBeInTheDocument(); expect(spy.mock.calls.filter(([url]) => String(url).endsWith("/api/demo/communication/send"))).toHaveLength(2); });
  it("shows Stage 6 metrics and real recent activity on Command Center", async () => { testFetch({ history: true }); renderRoute("/app"); expect(await screen.findByText("Verified Interactions")).toBeInTheDocument(); expect(screen.getByText("Blocked Communications")).toBeInTheDocument(); expect(screen.getByText(/AGT-TRAVEL-001 → AGT-HOTEL-001/)).toBeInTheDocument(); });
});
