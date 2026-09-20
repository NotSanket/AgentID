import request from "supertest";
import { Wallet } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import { DemoAgentRouter, type AgentHandler } from "../src/agents/demo-agents.js";
import { AuthenticationService } from "../src/auth/authentication-service.js";
import { CommunicationPreparationService } from "../src/services/communication-preparation-service.js";
import { CommunicationService } from "../src/services/communication-service.js";
import { DemoCommunicationService } from "../src/services/demo-communication-service.js";
import { MetadataService } from "../src/services/metadata-service.js";
import { AnalyticsService } from "../src/services/analytics-service.js";
import type { RuntimeConfig } from "../src/config/runtime.js";
import { InMemoryAgentMetadataStore } from "../src/stores/agent-metadata-store.js";
import { InMemoryAuditStore } from "../src/stores/audit-store.js";
import { InMemoryInteractionStore } from "../src/stores/interaction-store.js";
import { InMemoryReplayStore } from "../src/stores/replay-store.js";
import { FakeBlockchain, NOW, REGISTRY_ADDRESS, hotelWallet, makeRequest, paymentWallet, record, signRequest, strangerWallet, travelWallet } from "./helpers.js";

function runtime(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return { port: 4000, rpcUrl: "http://127.0.0.1:8545", registryAddress: REGISTRY_ADDRESS, expectedChainId: 31337, networkName: "localhost", manifestPath: "", artifactPath: "", deploymentBlock: 1, eventScanBlockChunk: 10, requestMaxAgeSeconds: 300, clockSkewSeconds: 30, supabaseEnabled: false, nodeEnv: "development", enableDemoSigning: true, ...overrides };
}

function setup() {
  const blockchain = new FakeBlockchain();
  const auditStore = new InMemoryAuditStore();
  const interactionStore = new InMemoryInteractionStore();
  const replayStore = new InMemoryReplayStore();
  const authentication = new AuthenticationService(blockchain, replayStore, auditStore, { chainId: 31337, verifyingContract: REGISTRY_ADDRESS, maxAgeSeconds: 300, clockSkewSeconds: 30, now: () => NOW });
  const handle = vi.fn<AgentHandler["handle"]>(async (value) => ({ success: true, source: "SIMULATED_DEMO_DATA", receiverAgentId: value.receiverAgentId, action: value.action, data: { options: ["Marina View"] } }));
  const router = new DemoAgentRouter();
  router.register("AGT-HOTEL-001", { handle });
  const communication = new CommunicationService(authentication, router, interactionStore);
  const preparation = new CommunicationPreparationService({ chainId: 31337, verifyingContract: REGISTRY_ADDRESS }, () => NOW);
  const metadata = new MetadataService(blockchain, new InMemoryAgentMetadataStore());
  const app = createApp({ blockchain, authentication, communication, communicationPreparation: preparation, auditStore, interactionStore, analytics: new AnalyticsService(auditStore, interactionStore, blockchain), metadata, persistenceStatus: { mode: "IN_MEMORY", supabaseConnected: false } });
  return { app, blockchain, auditStore, interactionStore, handle, communication, preparation };
}

describe("Stage 6 communication preparation", () => {
  it("creates a fresh EIP-712 request with strong unique nonce material", () => {
    const service = new CommunicationPreparationService({ chainId: 31337, verifyingContract: REGISTRY_ADDRESS }, () => NOW);
    const draft = { senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", payload: { city: "Chennai" } };
    const first = service.prepare(draft); const second = service.prepare(draft);
    expect(first.request.requestId).toMatch(/^REQ-[0-9a-f-]{36}$/);
    expect(first.request.nonce).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.request.nonce).not.toBe(second.request.nonce);
    expect(first.typedData).toMatchObject({ domain: { name: "AgentID", chainId: 31337, verifyingContract: REGISTRY_ADDRESS }, primaryType: "AgentRequest" });
    expect(first.typedData.message.payloadHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("exposes preparation and deterministic handler capabilities through REST", async () => {
    const { app } = setup();
    const prepared = await request(app).post("/api/communication/prepare").send({ senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", payload: { city: "Chennai" } });
    expect(prepared.status).toBe(201);
    expect(prepared.body.request).toMatchObject({ senderAgentId: "AGT-TRAVEL-001", timestamp: NOW });
    const capabilities = await request(app).get("/api/communication/capabilities");
    expect(capabilities.body.handlers["AGT-HOTEL-001"]).toContain("SEARCH_HOTELS");
    expect(capabilities.body.source).toBe("DETERMINISTIC_DEMO_HANDLERS");
  });
});

describe("Stage 6 authenticated delivery", () => {
  it("returns a structured verified result and persists the successful interaction", async () => {
    const { app, handle, interactionStore } = setup(); const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ requestId: value.requestId, delivered: true, receiverExecuted: true, senderAgentId: value.senderAgentId, receiverAgentId: value.receiverAgentId, verification: { code: "VERIFIED", recoveredWallet: travelWallet.address }, response: { success: true }, interaction: { requestId: value.requestId } });
    expect(handle).toHaveBeenCalledOnce();
    expect((await interactionStore.getByRequestId(value.requestId))?.requestPayload).toEqual(value.payload);
  });

  it.each([
    ["unknown wallet", strangerWallet, {}, "UNKNOWN_WALLET"],
    ["wallet mismatch", paymentWallet, {}, "WALLET_MISMATCH"],
    ["expired request", travelWallet, { timestamp: NOW - 999 }, "REQUEST_EXPIRED"],
  ])("blocks %s before receiver execution", async (_label, signer, overrides, code) => {
    const { app, handle } = setup(); const value = makeRequest(overrides);
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value, signer) });
    expect(response.status).toBe(403); expect(response.body).toMatchObject({ delivered: false, receiverExecuted: false, verification: { code } }); expect(handle).not.toHaveBeenCalled();
  });

  it("blocks malformed signatures safely without receiver execution", async () => {
    const { app, handle } = setup(); const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: "0xbroken" });
    expect(response.body.verification.code).toBe("INVALID_SIGNATURE"); expect(response.body.receiverExecuted).toBe(false); expect(handle).not.toHaveBeenCalled();
  });

  it("blocks a revoked sender and persists the blocked audit", async () => {
    const { app, blockchain, handle, auditStore } = setup(); blockchain.records.set("AGT-TRAVEL-001", record("AGT-TRAVEL-001", travelWallet.address, "Revoked")); const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    expect(response.body.verification.code).toBe("AGENT_REVOKED"); expect(handle).not.toHaveBeenCalled();
    expect((await auditStore.list({ limit: 5, offset: 0, requestId: value.requestId })).events[0]).toMatchObject({ result: "BLOCKED", code: "AGENT_REVOKED" });
  });

  it("blocks a revoked receiver before execution", async () => {
    const { app, blockchain, handle } = setup(); blockchain.records.set("AGT-HOTEL-001", record("AGT-HOTEL-001", hotelWallet.address, "Revoked")); const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    expect(response.body.verification).toMatchObject({ code: "RECEIVER_REVOKED", checks: { receiverExists: true, receiverActive: false } }); expect(handle).not.toHaveBeenCalled();
  });

  it("blocks exact replay with NONCE_REUSED and never executes twice", async () => {
    const { app, handle } = setup(); const value = makeRequest(); const signature = await signRequest(value);
    expect((await request(app).post("/api/communication/send").send({ request: value, signature })).status).toBe(200);
    const replay = await request(app).post("/api/communication/send").send({ request: value, signature });
    expect(replay.body).toMatchObject({ delivered: false, receiverExecuted: false, verification: { code: "NONCE_REUSED" } }); expect(handle).toHaveBeenCalledOnce();
  });

  it("retrieves filtered communication history, details, and matching audit", async () => {
    const { app } = setup(); const value = makeRequest(); await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    const history = await request(app).get("/api/interactions?senderAgentId=AGT-TRAVEL-001&receiverAgentId=AGT-HOTEL-001");
    expect(history.body.interactions).toHaveLength(1);
    expect((await request(app).get(`/api/interactions/${value.requestId}`)).body.interaction.requestId).toBe(value.requestId);
    const audit = await request(app).get(`/api/audit?requestId=${value.requestId}`);
    expect(audit.body.events).toHaveLength(1); expect(audit.body.events[0].code).toBe("VERIFIED");
  });
});

function demoService(nodeEnv: RuntimeConfig["nodeEnv"] = "development") {
  const accounts = [Wallet.createRandom(), travelWallet, hotelWallet, paymentWallet, ...Array.from({ length: 6 }, () => Wallet.createRandom())];
  const base = new FakeBlockchain();
  const blockchain = Object.assign(base, {
    provider: {
      getNetwork: async () => ({ chainId: 31337n }),
      send: async () => accounts.map((wallet) => wallet.address),
      getSigner: async (address: string) => accounts.find((wallet) => wallet.address.toLowerCase() === address.toLowerCase())!,
    },
  });
  const auditStore = new InMemoryAuditStore(); const interactions = new InMemoryInteractionStore();
  const auth = new AuthenticationService(blockchain, new InMemoryReplayStore(), auditStore, { chainId: 31337, verifyingContract: REGISTRY_ADDRESS, maxAgeSeconds: 300, clockSkewSeconds: 30, now: () => NOW });
  const communication = new CommunicationService(auth, new DemoAgentRouter(), interactions);
  return { service: new DemoCommunicationService(blockchain as never, communication, runtime({ nodeEnv })), communication, blockchain, auditStore, interactions };
}

describe("Stage 6 guarded local communication signing", () => {
  it("lists only predefined demo agent identities without secret material", async () => {
    const result = await demoService().service.listAgents();
    expect(result.map((agent) => agent.agentId)).toEqual(["AGT-TRAVEL-001", "AGT-HOTEL-001", "AGT-PAYMENT-001"]);
    expect(JSON.stringify(result)).not.toMatch(/private|mnemonic|secret/i);
  });

  it("signs and authenticates the narrow AgentRequest envelope", async () => {
    const { service } = demoService(); const value = makeRequest();
    const result = await service.signAndSend(travelWallet.address, value);
    expect(result).toMatchObject({ request: value, delivered: true, receiverExecuted: true, verification: { code: "VERIFIED", recoveredWallet: travelWallet.address } });
    expect(result.signature).toMatch(/^0x[0-9a-f]+$/i);
    expect(JSON.stringify(result)).not.toMatch(/privateKey|mnemonic/i);
  });

  it("rejects production use and wallet impersonation", async () => {
    await expect(demoService("production").service.listAgents()).rejects.toMatchObject({ code: "DEMO_SIGNING_PRODUCTION_DISABLED" });
    await expect(demoService().service.signAndSend(paymentWallet.address, makeRequest())).rejects.toMatchObject({ code: "NOT_IDENTITY_OWNER" });
  });
});
