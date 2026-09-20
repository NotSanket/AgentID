import request from "supertest";
import { Wallet } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import { MetadataService, buildMetadataAuthorizationMessage } from "../src/services/metadata-service.js";
import { InMemoryAgentMetadataStore } from "../src/stores/agent-metadata-store.js";
import { DemoIdentityWriteService, IdentityWriteError } from "../src/services/identity-write-service.js";
import { EventScanUnavailableError } from "../src/blockchain/event-scanner.js";
import type { RuntimeConfig } from "../src/config/runtime.js";
import type { AgentRecord } from "../src/domain/types.js";
import { FakeBlockchain, REGISTRY_ADDRESS, record, travelWallet } from "./helpers.js";

function app(blockchain = new FakeBlockchain(), metadataStore = new InMemoryAgentMetadataStore()) {
  const metadata = new MetadataService(blockchain, metadataStore);
  return createApp({
    blockchain, metadata,
    authentication: {} as AppDependencies["authentication"], communication: {} as AppDependencies["communication"],
    auditStore: {} as AppDependencies["auditStore"], interactionStore: {} as AppDependencies["interactionStore"], analytics: {} as AppDependencies["analytics"],
    persistenceStatus: { mode: "IN_MEMORY", supabaseConnected: false },
  });
}

describe("Stage 5 identity portal APIs", () => {
  it("lists blockchain identities through the enriched registry", async () => {
    const response = await request(app()).get("/api/registry");
    expect(response.status).toBe(200);
    expect(response.body.agents).toHaveLength(3);
    expect(response.body.agents[0]).toHaveProperty("owner");
  });

  it("returns HTTP 200 with an empty registry when no identities are registered", async () => {
    const blockchain = new FakeBlockchain();
    blockchain.records.clear();
    const response = await request(app(blockchain)).get("/api/registry");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ agents: [], metadataAvailable: true });
  });

  it("returns a sanitized service-unavailable response when an event chunk fails", async () => {
    const blockchain = new FakeBlockchain();
    vi.spyOn(blockchain, "listAgents").mockRejectedValue(
      new EventScanUnavailableError("AgentRegistry event history is temporarily unavailable.", "RATE_LIMITED", 3),
    );
    const response = await request(app(blockchain)).get("/api/registry");
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("sensitive-provider-token");
  });

  it("returns an individual Agent Passport record", async () => {
    const response = await request(app()).get("/api/registry/AGT-TRAVEL-001");
    expect(response.body.agent).toMatchObject({ agentId: "AGT-TRAVEL-001", blockchainStatus: "Active" });
  });

  it("reports AgentID availability without weakening contract uniqueness", async () => {
    expect((await request(app()).get("/api/agents/AGT-TRAVEL-001/availability")).body.available).toBe(false);
    expect((await request(app()).get("/api/agents/AGT-RESEARCH-001/availability")).body.available).toBe(true);
  });

  it("rejects malformed AgentIDs during availability checks", async () => {
    const response = await request(app()).get("/api/agents/not_valid/availability");
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_AGENT_ID");
  });

  it("returns lifecycle events reconstructed by the blockchain reader", async () => {
    const response = await request(app()).get("/api/agents/AGT-TRAVEL-001/events");
    expect(response.body.events[0]).toMatchObject({ type: "Registered", blockNumber: 1 });
  });

  it("returns safe contract configuration for browser wallet writes", async () => {
    const response = await request(app()).get("/api/identity/config");
    expect(response.body).toMatchObject({ chainId: 31337, registryAddress: REGISTRY_ADDRESS });
    expect(JSON.stringify(response.body)).not.toMatch(/privateKey|service_role/i);
  });

  it("allows the on-chain owner to authorize a metadata update", async () => {
    const metadata = { displayName: "Travel Research", description: "Updated metadata", category: "Travel", capabilities: ["PLAN_TRIP"] };
    const issuedAt = 2_000_000_000;
    const signature = await travelWallet.signMessage(buildMetadataAuthorizationMessage({ agentId: "AGT-TRAVEL-001", ...metadata }, issuedAt));
    const service = new MetadataService(new FakeBlockchain(), new InMemoryAgentMetadataStore());
    const result = await service.authorizedUpsert({ agentId: "AGT-TRAVEL-001", ...metadata }, { wallet: travelWallet.address, signature, issuedAt }, issuedAt);
    expect(result.description).toBe("Updated metadata");
  });

  it("rejects metadata authorization from a non-owner", async () => {
    const stranger = Wallet.createRandom();
    const input = { agentId: "AGT-TRAVEL-001", capabilities: [] };
    const signature = await stranger.signMessage(buildMetadataAuthorizationMessage(input, 2_000_000_000));
    await expect(new MetadataService(new FakeBlockchain(), new InMemoryAgentMetadataStore()).authorizedUpsert(input, { wallet: stranger.address, signature, issuedAt: 2_000_000_000 }, 2_000_000_000)).rejects.toMatchObject({ code: "NOT_IDENTITY_OWNER" });
  });

  it("preserves blockchain registry results when metadata storage fails", async () => {
    const store = new InMemoryAgentMetadataStore();
    vi.spyOn(store, "list").mockRejectedValue(new Error("offline"));
    const response = await request(app(new FakeBlockchain(), store)).get("/api/registry");
    expect(response.body.metadataAvailable).toBe(false);
    expect(response.body.agents).toHaveLength(3);
  });
});

const demoAccounts = Array.from({ length: 10 }, () => Wallet.createRandom().address);
function runtime(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return { port: 4000, rpcUrl: "http://127.0.0.1:8545", registryAddress: REGISTRY_ADDRESS, expectedChainId: 31337, networkName: "localhost", manifestPath: "", artifactPath: "", deploymentBlock: 1, eventScanBlockChunk: 10, eventScanRequestDelayMs: 175, requestMaxAgeSeconds: 300, clockSkewSeconds: 30, supabaseEnabled: false, nodeEnv: "development", enableDemoSigning: true, ...overrides };
}
function demoHarness(options: { assigned?: AgentRecord; chainId?: number; nodeEnv?: RuntimeConfig["nodeEnv"]; enabled?: boolean } = {}) {
  const chainId = options.chainId ?? 31337;
  const receipt = { status: 1, hash: `0x${"a".repeat(64)}`, blockNumber: 42, from: demoAccounts[3], to: REGISTRY_ADDRESS };
  const contract = { connect: () => ({
    registerAgent: vi.fn(async () => ({ wait: async () => receipt })),
    updateAgent: vi.fn(async () => ({ wait: async () => receipt })),
    revokeAgent: vi.fn(async () => ({ wait: async () => receipt })),
    reactivateAgent: vi.fn(async () => ({ wait: async () => receipt })),
  }) };
  const blockchain = {
    address: REGISTRY_ADDRESS,
    provider: { getNetwork: async () => ({ chainId: BigInt(chainId) }), send: async () => demoAccounts, getSigner: async () => ({}) },
    health: async () => ({ connected: true }), getContract: async () => contract,
    getAgentByWallet: async (wallet: string) => wallet.toLowerCase() === demoAccounts[3].toLowerCase() ? options.assigned ?? null : null,
    getAgent: async () => options.assigned ?? null,
  };
  const metadata = { upsert: vi.fn(async (input) => input) };
  const service = new DemoIdentityWriteService(blockchain as never, metadata as never, runtime({ nodeEnv: options.nodeEnv ?? "development", enableDemoSigning: options.enabled ?? true, expectedChainId: chainId }));
  return { service, metadata };
}

describe("Stage 5 local demo signing guards", () => {
  it("lists only safe wallet labels and addresses without private keys", async () => {
    const wallets = await demoHarness().service.listWallets();
    expect(wallets).toHaveLength(7);
    expect(wallets[0]).toMatchObject({ label: "Demo Wallet 4", available: true });
    expect(JSON.stringify(wallets)).not.toMatch(/private|mnemonic/i);
  });

  it("rejects demo signing in production", async () => {
    await expect(demoHarness({ nodeEnv: "production" }).service.listWallets()).rejects.toMatchObject({ code: "DEMO_SIGNING_PRODUCTION_DISABLED" });
  });

  it("rejects demo signing when the feature flag is disabled", async () => {
    await expect(demoHarness({ enabled: false }).service.listWallets()).rejects.toMatchObject({ code: "DEMO_SIGNING_DISABLED" });
  });

  it("rejects a non-31337 chain", async () => {
    await expect(demoHarness({ chainId: 1 }).service.listWallets()).rejects.toMatchObject({ code: "WRONG_NETWORK" });
  });

  it("rejects a demo wallet already assigned to an identity", async () => {
    const assigned = record("AGT-EXISTING-001", demoAccounts[3]);
    await expect(demoHarness({ assigned }).service.register(demoAccounts[3], { agentId: "AGT-NEW-001", name: "NewAI", organization: "Labs" })).rejects.toMatchObject({ code: "WALLET_ALREADY_REGISTERED" });
  });

  it("maps a confirmed registration receipt and syncs metadata", async () => {
    const { service, metadata } = demoHarness();
    const result = await service.register(demoAccounts[3], { agentId: "AGT-RESEARCH-001", name: "ResearchAI", organization: "AgentID Labs", metadata: { capabilities: ["RESEARCH"] } });
    expect(result.transaction).toMatchObject({ operation: "REGISTER", blockNumber: 42, chainId: 31337, ownerWallet: demoAccounts[3] });
    expect(metadata.upsert).toHaveBeenCalled();
  });

  it("enforces current ownership for update, revoke, and reactivate", async () => {
    const assigned = record("AGT-OTHER-001", demoAccounts[3]);
    const service = demoHarness({ assigned }).service;
    await expect(service.update(demoAccounts[3], { agentId: "AGT-RESEARCH-001", name: "ResearchAI", organization: "Labs" })).rejects.toMatchObject({ code: "NOT_IDENTITY_OWNER" });
    await expect(service.revoke(demoAccounts[3], "AGT-RESEARCH-001")).rejects.toMatchObject({ code: "NOT_IDENTITY_OWNER" });
    await expect(service.reactivate(demoAccounts[3], "AGT-RESEARCH-001")).rejects.toMatchObject({ code: "NOT_IDENTITY_OWNER" });
  });
});
