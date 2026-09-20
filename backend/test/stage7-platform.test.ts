import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import type { BlockchainService } from "../src/blockchain/blockchain-service.js";
import { DEMO_AGENT_METADATA } from "../src/persistence/demo-metadata.js";
import { MetadataService } from "../src/services/metadata-service.js";
import { SECURITY_SCENARIOS } from "../src/services/security-scenario-service.js";
import { Stage7InsightsService } from "../src/services/stage7-insights-service.js";
import { InMemoryAgentMetadataStore } from "../src/stores/agent-metadata-store.js";
import { InMemoryAuditStore } from "../src/stores/audit-store.js";
import { InMemoryInteractionStore } from "../src/stores/interaction-store.js";
import { FakeBlockchain } from "./helpers.js";

async function insightsHarness() {
  const source = new FakeBlockchain();
  const blockchain = Object.assign(source, {
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    provider: {
      getBlock: vi.fn(async (number: number) => ({ number, hash: `0x${String(number).padStart(64, "0")}`, parentHash: `0x${String(Math.max(0, number - 1)).padStart(64, "0")}`, timestamp: 2_000_000_000 + number, transactions: number === 1 ? [`0x${"1".repeat(64)}`] : [] })),
      getTransaction: vi.fn(async () => ({ from: source.records.get("AGT-TRAVEL-001")!.owner, to: "0x5FbDB2315678afecb367f032d93F642f64180aa3" })),
      getTransactionReceipt: vi.fn(async () => ({ status: 1, gasUsed: 88_321n })),
    },
  }) as unknown as BlockchainService;
  const audit = new InMemoryAuditStore(); const interactions = new InMemoryInteractionStore();
  await audit.record("REQUEST_VERIFIED", { requestId: "REQ-7-V", senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", result: "VERIFIED", code: "VERIFIED", reason: "Verified" });
  await audit.record("REPLAY_BLOCKED", { requestId: "REQ-7-B", senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", result: "BLOCKED", code: "NONCE_REUSED", reason: "Blocked" });
  await interactions.record({ requestId: "REQ-7-V", senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", requestPayload: { city: "Chennai" }, responsePayload: { options: [] }, authenticationCode: "VERIFIED", durationMs: 4 });
  const metadata = new MetadataService(blockchain, new InMemoryAgentMetadataStore(DEMO_AGENT_METADATA));
  return { service: new Stage7InsightsService(blockchain, metadata, audit, interactions), audit, interactions };
}

describe("Stage 7 read models", () => {
  it("builds graph nodes only from registered on-chain identities", async () => { const { service } = await insightsHarness(); const graph = await service.trustGraph(); expect(graph.nodes).toHaveLength(3); expect(graph.nodes.every((node) => node.registrationBlock === 1)).toBe(true); expect(graph.source).toContain("ON_CHAIN"); });
  it("aggregates real verified and blocked edges without inventing scores", async () => { const { service } = await insightsHarness(); const graph = await service.trustGraph(); expect(graph.edges).toContainEqual(expect.objectContaining({ source: "AGT-TRAVEL-001", target: "AGT-HOTEL-001", verified: 1, blocked: 1 })); expect(JSON.stringify(graph)).not.toMatch(/trustScore|reputation/i); });
  it("calculates advanced metrics from stores and registry state", async () => { const { service } = await insightsHarness(); const value = await service.analytics("all"); expect(value.metrics).toMatchObject({ identities: 3, activeIdentities: 3, verificationAttempts: 2, verifiedRequests: 1, blockedRequests: 1, successRate: 50, interactions: 1 }); });
  it("reports blocked reasons, active agents, pairs, and lifecycle activity", async () => { const { service } = await insightsHarness(); const value = await service.analytics("all"); expect(value.blockedReasons).toContainEqual({ label: "NONCE_REUSED", value: 1 }); expect(value.activeAgents).toContainEqual({ label: "AGT-TRAVEL-001", value: 1 }); expect(value.communicationPairs[0].label).toContain("AGT-HOTEL-001"); expect(value.lifecycleActivity).toContainEqual({ label: "Registered", value: 3 }); });
  it("honors a time range rather than returning all-time counts", async () => { const { service } = await insightsHarness(); const value = await service.analytics("1h"); expect(value.metrics.verificationAttempts).toBe(2); expect(value.range).toBe("1h"); });
  it("returns real recent blocks, receipts, events, and gas aggregates", async () => { const { service } = await insightsHarness(); const value = await service.explorer(3); expect(value.blocks.map((block) => block.number)).toEqual([12, 11, 10]); expect(value.transactions[0]).toMatchObject({ status: "CONFIRMED", gasUsed: "88321", operation: "Registered" }); expect(value.gasByOperation[0].averageGasUsed).toBe("88321"); });
  it("searches AgentIDs, wallet data, hashes, and block numbers", async () => { const { service } = await insightsHarness(); expect((await service.explorer(12, "AGT-TRAVEL-001")).matches.agents).toHaveLength(1); expect((await service.explorer(12, "12")).matches.blocks[0].number).toBe(12); expect((await service.explorer(12, "not-real")).matches.agents).toHaveLength(0); });
});

function routeApp() {
  const blockchain = new FakeBlockchain(); const metadata = new MetadataService(blockchain, new InMemoryAgentMetadataStore());
  const stage7Insights = { trustGraph: vi.fn(async () => ({ nodes: [], edges: [] })), analytics: vi.fn(async (range: string) => ({ range })), explorer: vi.fn(async (limit: number, query: string) => ({ limit, query })) };
  const securityScenarios = { list: vi.fn(() => SECURITY_SCENARIOS.map((id) => ({ id, expectedCode: id === "VALID" ? "VERIFIED" : "BLOCKED", description: id }))), run: vi.fn(async (scenario: string) => ({ scenario, protectedAsExpected: true })) };
  const app = createApp({ blockchain, metadata, stage7Insights, securityScenarios, authentication: {} as AppDependencies["authentication"], communication: {} as AppDependencies["communication"], auditStore: {} as AppDependencies["auditStore"], interactionStore: {} as AppDependencies["interactionStore"], analytics: {} as AppDependencies["analytics"], persistenceStatus: { mode: "IN_MEMORY", supabaseConnected: false } } as unknown as AppDependencies);
  return { app, stage7Insights, securityScenarios };
}

describe("Stage 7 APIs", () => {
  it("exposes the trust graph endpoint", async () => { const { app, stage7Insights } = routeApp(); expect((await request(app).get("/api/stage7/trust-graph")).status).toBe(200); expect(stage7Insights.trustGraph).toHaveBeenCalledOnce(); });
  it("validates analytics time ranges", async () => { const { app } = routeApp(); expect((await request(app).get("/api/stage7/analytics?range=7d")).body.range).toBe("7d"); expect((await request(app).get("/api/stage7/analytics?range=year")).status).toBe(400); });
  it("bounds explorer limits and query length", async () => { const { app } = routeApp(); expect((await request(app).get("/api/stage7/explorer?limit=10&query=Travel")).body).toMatchObject({ limit: 10, query: "Travel" }); expect((await request(app).get("/api/stage7/explorer?limit=1000")).status).toBe(400); });
  it("lists exactly the eight whitelisted security scenarios", async () => { const { app } = routeApp(); const response = await request(app).get("/api/security/scenarios"); expect(response.body.scenarios.map((item: { id: string }) => item.id)).toEqual(SECURITY_SCENARIOS); });
  it("runs a whitelisted scenario and rejects arbitrary names", async () => { const { app, securityScenarios } = routeApp(); expect((await request(app).post("/api/security/scenarios/REPLAY").send({ arbitrary: "ignored" })).body.protectedAsExpected).toBe(true); expect(securityScenarios.run).toHaveBeenCalledWith("REPLAY"); expect((await request(app).post("/api/security/scenarios/SIGN_ANYTHING")).status).toBe(404); });
  it("does not expose arbitrary signing inputs in the scenario catalog", async () => { const { app } = routeApp(); const body = (await request(app).get("/api/security/scenarios")).body; expect(JSON.stringify(body)).not.toMatch(/privateKey|mnemonic|contractAddress|rpcUrl/); });
});
