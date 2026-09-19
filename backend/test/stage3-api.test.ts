import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { DemoAgentRouter } from "../src/agents/demo-agents.js";
import { AuthenticationService } from "../src/auth/authentication-service.js";
import { DEMO_AGENT_METADATA } from "../src/persistence/demo-metadata.js";
import { AnalyticsService } from "../src/services/analytics-service.js";
import { CommunicationService } from "../src/services/communication-service.js";
import { MetadataService } from "../src/services/metadata-service.js";
import { InMemoryAgentMetadataStore } from "../src/stores/agent-metadata-store.js";
import { InMemoryAuditStore, type AuditStore } from "../src/stores/audit-store.js";
import { InMemoryInteractionStore, } from "../src/stores/interaction-store.js";
import { InMemoryReplayStore, type ReplayStore } from "../src/stores/replay-store.js";
import type { InteractionStore } from "../src/persistence/types.js";
import { FakeBlockchain, NOW, REGISTRY_ADDRESS, makeRequest, paymentWallet, record, signRequest, travelWallet } from "./helpers.js";

function setup() {
  const blockchain = new FakeBlockchain();
  const auditStore = new InMemoryAuditStore();
  const replayStore = new InMemoryReplayStore();
  const interactionStore = new InMemoryInteractionStore();
  const metadataStore = new InMemoryAgentMetadataStore(DEMO_AGENT_METADATA);
  const authentication = new AuthenticationService(blockchain, replayStore, auditStore, {
    chainId: 31337,
    verifyingContract: REGISTRY_ADDRESS,
    maxAgeSeconds: 300,
    clockSkewSeconds: 30,
    now: () => NOW,
  });
  const communication = new CommunicationService(authentication, new DemoAgentRouter(), interactionStore);
  const analytics = new AnalyticsService(auditStore, interactionStore, blockchain);
  const metadata = new MetadataService(blockchain, metadataStore);
  const app = createApp({
    blockchain, authentication, communication, auditStore, interactionStore, analytics, metadata,
    persistenceStatus: { mode: "IN_MEMORY", supabaseConnected: false },
  });
  return { app, blockchain, auditStore, replayStore, interactionStore, metadataStore, authentication };
}

describe("Stage 3 APIs and persistence integration", () => {
  it("records an interaction only after successful authentication", async () => {
    const { app, interactionStore } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/communication/send")
      .send({ request: value, signature: await signRequest(value) });
    expect(response.status).toBe(200);
    expect(await interactionStore.count()).toBe(1);
    expect((await interactionStore.getByRequestId(value.requestId))?.authenticationCode).toBe("VERIFIED");
  });

  it("does not record an interaction for blocked communication", async () => {
    const { app, interactionStore } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/communication/send")
      .send({ request: value, signature: await signRequest(value, paymentWallet) });
    expect(response.status).toBe(403);
    expect(await interactionStore.count()).toBe(0);
  });

  it("filters and paginates audit events through the API", async () => {
    const { app, auditStore } = setup();
    await auditStore.record("REQUEST_VERIFIED", { result: "VERIFIED", code: "VERIFIED", reason: "ok", senderAgentId: "A" });
    await auditStore.record("REPLAY_BLOCKED", { result: "BLOCKED", code: "NONCE_REUSED", reason: "replay", senderAgentId: "A" });
    const response = await request(app).get("/api/audit?limit=1&offset=0&result=BLOCKED&code=NONCE_REUSED&senderAgentId=A");
    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(1);
    expect(response.body.pagination).toEqual({ total: 1, limit: 1, offset: 0 });
  });

  it("rejects invalid audit and interaction pagination", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/audit?limit=101")).body.code).toBe("INVALID_QUERY");
    expect((await request(app).get("/api/interactions?offset=-1")).body.code).toBe("INVALID_QUERY");
  });

  it("lists interactions and retrieves one by request ID", async () => {
    const { app } = setup();
    const value = makeRequest();
    await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    const list = await request(app).get("/api/interactions?limit=20&offset=0");
    const one = await request(app).get(`/api/interactions/${value.requestId}`);
    expect(list.body.pagination.total).toBe(1);
    expect(one.body.interaction.requestId).toBe(value.requestId);
  });

  it("calculates analytics from stored authentication events and interactions", async () => {
    const { app } = setup();
    const valid = makeRequest();
    await request(app).post("/api/communication/send").send({ request: valid, signature: await signRequest(valid) });
    const blocked = makeRequest();
    await request(app).post("/api/communication/send").send({ request: blocked, signature: await signRequest(blocked, paymentWallet) });
    const response = await request(app).get("/api/analytics/summary");
    expect(response.body).toMatchObject({
      totalVerificationAttempts: 2,
      verifiedRequests: 1,
      blockedRequests: 1,
      successRate: 50,
      totalInteractions: 1,
      uniqueActiveAgentsInInteractions: 2,
      blockedByReason: { WALLET_MISMATCH: 1 },
    });
  });

  it("returns a focused security analytics breakdown", async () => {
    const { app } = setup();
    const value = makeRequest();
    await request(app).post("/api/verify").send({ request: value, signature: "bad" });
    const response = await request(app).get("/api/analytics/security");
    expect(response.body).toEqual({ blockedRequests: 1, blockedByReason: { INVALID_SIGNATURE: 1 } });
  });

  it("merges metadata while preserving live blockchain ownership and status", async () => {
    const { app, blockchain, metadataStore } = setup();
    blockchain.records.set("AGT-TRAVEL-001", record("AGT-TRAVEL-001", travelWallet.address, "Revoked"));
    await metadataStore.upsert({
      agentId: "AGT-TRAVEL-001", displayName: "Custom Travel Label", description: "Off-chain description",
      capabilities: ["PLAN_TRIP"],
    });
    const response = await request(app).get("/api/metadata/agents/AGT-TRAVEL-001");
    expect(response.body.agent).toMatchObject({
      agentId: "AGT-TRAVEL-001",
      name: "TravelAI",
      owner: travelWallet.address,
      status: "Revoked",
      blockchainStatus: "Revoked",
      displayName: "Custom Travel Label",
      description: "Off-chain description",
    });
  });

  it("reports fallback persistence without exposing credentials", async () => {
    const response = await request(setup().app).get("/api/health");
    expect(response.body).toMatchObject({ persistenceMode: "IN_MEMORY", supabaseConnected: false });
    expect(JSON.stringify(response.body)).not.toContain("SERVICE_ROLE");
  });

  it("preserves an authentication decision when audit persistence fails", async () => {
    const blockchain = new FakeBlockchain();
    const audit: AuditStore = {
      record: vi.fn().mockRejectedValue(new Error("database unavailable")),
      list: vi.fn(), count: vi.fn(), clear: vi.fn(),
    };
    const authentication = new AuthenticationService(blockchain, new InMemoryReplayStore(), audit, {
      chainId: 31337, verifyingContract: REGISTRY_ADDRESS, maxAgeSeconds: 300, clockSkewSeconds: 30, now: () => NOW,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const value = makeRequest();
    const result = await authentication.authenticate(value, await signRequest(value));
    expect(result).toMatchObject({ verified: true, code: "VERIFIED", operationalWarnings: ["AUDIT_PERSISTENCE_FAILED"] });
    vi.restoreAllMocks();
  });

  it("blocks authentication when replay persistence fails", async () => {
    const replay: ReplayStore = {
      consume: vi.fn().mockRejectedValue(new Error("database unavailable")),
      isConsumed: vi.fn(), clear: vi.fn(),
    };
    const authentication = new AuthenticationService(new FakeBlockchain(), replay, new InMemoryAuditStore(), {
      chainId: 31337, verifyingContract: REGISTRY_ADDRESS, maxAgeSeconds: 300, clockSkewSeconds: 30, now: () => NOW,
    });
    const value = makeRequest();
    expect(await authentication.authenticate(value, await signRequest(value)))
      .toMatchObject({ verified: false, code: "SERVICE_UNAVAILABLE" });
  });

  it("preserves verified delivery when interaction persistence fails", async () => {
    const blockchain = new FakeBlockchain();
    const authentication = new AuthenticationService(blockchain, new InMemoryReplayStore(), new InMemoryAuditStore(), {
      chainId: 31337, verifyingContract: REGISTRY_ADDRESS, maxAgeSeconds: 300, clockSkewSeconds: 30, now: () => NOW,
    });
    const failingStore: InteractionStore = {
      record: vi.fn().mockRejectedValue(new Error("database unavailable")),
      list: vi.fn(), getByRequestId: vi.fn(), count: vi.fn(), uniqueAgentIds: vi.fn(), clear: vi.fn(),
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const communication = new CommunicationService(authentication, new DemoAgentRouter(), failingStore);
    const value = makeRequest();
    expect(await communication.send(value, await signRequest(value))).toMatchObject({
      delivered: true,
      verification: { code: "VERIFIED" },
      operationalWarnings: ["INTERACTION_PERSISTENCE_FAILED"],
    });
    vi.restoreAllMocks();
  });
});
