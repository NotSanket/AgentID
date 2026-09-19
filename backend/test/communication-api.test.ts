import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { DemoAgentRouter, type AgentHandler } from "../src/agents/demo-agents.js";
import { AuthenticationService } from "../src/auth/authentication-service.js";
import { CommunicationService } from "../src/services/communication-service.js";
import { InMemoryAuditStore } from "../src/stores/audit-store.js";
import { InMemoryReplayStore } from "../src/stores/replay-store.js";
import { FakeBlockchain, NOW, REGISTRY_ADDRESS, makeRequest, paymentWallet, signRequest, strangerWallet, travelWallet } from "./helpers.js";

function setup() {
  const blockchain = new FakeBlockchain();
  const auditStore = new InMemoryAuditStore();
  const authentication = new AuthenticationService(blockchain, new InMemoryReplayStore(), auditStore, {
    chainId: 31337,
    verifyingContract: REGISTRY_ADDRESS,
    maxAgeSeconds: 300,
    clockSkewSeconds: 30,
    now: () => NOW,
  });
  const handle = vi.fn<AgentHandler["handle"]>(async (value) => ({
    success: true,
    source: "SIMULATED_DEMO_DATA",
    receiverAgentId: value.receiverAgentId,
    action: value.action,
    data: { options: ["demo"] },
  }));
  const router = new DemoAgentRouter();
  router.register("AGT-HOTEL-001", { handle });
  const communication = new CommunicationService(authentication, router);
  const app = createApp({ blockchain, authentication, communication, auditStore });
  return { app, handle, auditStore };
}

describe("communication routing", () => {
  it("executes the receiver only after successful verification", async () => {
    const { app, handle } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value) });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ delivered: true, verification: { code: "VERIFIED" }, response: { source: "SIMULATED_DEMO_DATA" } });
    expect(handle).toHaveBeenCalledOnce();
  });

  it("never executes the receiver for impersonation", async () => {
    const { app, handle } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value, paymentWallet) });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ delivered: false, verification: { code: "WALLET_MISMATCH" } });
    expect(handle).not.toHaveBeenCalled();
  });

  it("never executes the receiver for an unknown wallet", async () => {
    const { app, handle } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/communication/send").send({ request: value, signature: await signRequest(value, strangerWallet) });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ delivered: false, verification: { code: "UNKNOWN_WALLET" } });
    expect(handle).not.toHaveBeenCalled();
  });

  it("never executes the receiver for malformed input", async () => {
    const { app, handle } = setup();
    const response = await request(app).post("/api/communication/send").send({ request: { nope: true }, signature: "0x" });
    expect(response.status).toBe(403);
    expect(response.body.verification.code).toBe("INVALID_REQUEST");
    expect(handle).not.toHaveBeenCalled();
  });
});

describe("REST API", () => {
  it("returns backend and blockchain health", async () => {
    const response = await request(setup().app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", backend: "ok", blockchain: { connected: true, chainId: 31337 } });
  });

  it("returns network and contract information", async () => {
    const response = await request(setup().app).get("/api/network");
    expect(response.body).toMatchObject({ network: "localhost", chainId: 31337, registryAddress: REGISTRY_ADDRESS });
  });

  it("lists registry agents", async () => {
    const response = await request(setup().app).get("/api/agents");
    expect(response.body.agents).toHaveLength(3);
  });

  it("looks up an agent by AgentID", async () => {
    const response = await request(setup().app).get("/api/agents/AGT-TRAVEL-001");
    expect(response.status).toBe(200);
    expect(response.body.agent).toMatchObject({ agentId: "AGT-TRAVEL-001", owner: travelWallet.address });
  });

  it("looks up an agent by wallet", async () => {
    const response = await request(setup().app).get(`/api/agents/wallet/${travelWallet.address}`);
    expect(response.status).toBe(200);
    expect(response.body.agent.agentId).toBe("AGT-TRAVEL-001");
  });

  it("rejects an invalid wallet address cleanly", async () => {
    const response = await request(setup().app).get("/api/agents/wallet/not-an-address");
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_ADDRESS");
  });

  it("verifies without executing receiver behavior", async () => {
    const { app, handle } = setup();
    const value = makeRequest();
    const response = await request(app).post("/api/verify").send({ request: value, signature: await signRequest(value) });
    expect(response.status).toBe(200);
    expect(response.body.code).toBe("VERIFIED");
    expect(handle).not.toHaveBeenCalled();
  });

  it("returns off-chain audit events", async () => {
    const { app } = setup();
    const value = makeRequest();
    await request(app).post("/api/verify").send({ request: value, signature: await signRequest(value) });
    const response = await request(app).get("/api/audit");
    expect(response.body).toMatchObject({ storage: "OFF_CHAIN_MEMORY" });
    expect(response.body.events[0].type).toBe("REQUEST_VERIFIED");
  });

  it("returns documented security scenarios", async () => {
    const response = await request(setup().app).get("/api/security/scenarios");
    expect(response.body.scenarios).toHaveLength(9);
    expect(response.body.scenarios.map((item: { id: string }) => item.id)).toEqual([
      "VALID",
      "UNKNOWN_WALLET",
      "IMPERSONATION",
      "REVOKED_AGENT",
      "EXPIRED_REQUEST",
      "REPLAY_ATTACK",
      "MODIFIED_PAYLOAD",
      "MODIFIED_RECEIVER",
      "MALFORMED_SIGNATURE",
    ]);
  });

  it("handles malformed JSON without crashing", async () => {
    const response = await request(setup().app)
      .post("/api/verify")
      .set("Content-Type", "application/json")
      .send('{"request":');
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body.code).toBeDefined();
  });
});
