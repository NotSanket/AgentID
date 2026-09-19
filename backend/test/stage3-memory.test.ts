import { describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime.js";
import { seedDemoMetadata } from "../src/persistence/demo-metadata.js";
import { createPersistence } from "../src/persistence/factory.js";
import { InMemoryAgentMetadataStore } from "../src/stores/agent-metadata-store.js";
import { InMemoryAuditStore } from "../src/stores/audit-store.js";
import { InMemoryInteractionStore } from "../src/stores/interaction-store.js";
import { InMemoryReplayStore } from "../src/stores/replay-store.js";

function config(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    port: 4000,
    rpcUrl: "http://127.0.0.1:8545",
    registryAddress: "0x0000000000000000000000000000000000000001",
    expectedChainId: 31337,
    networkName: "localhost",
    manifestPath: "manifest.json",
    artifactPath: "artifact.json",
    requestMaxAgeSeconds: 300,
    clockSkewSeconds: 30,
    supabaseEnabled: false,
    nodeEnv: "test",
    ...overrides,
  };
}

describe("Stage 3 in-memory repositories", () => {
  it("keeps audit events for the process lifetime", async () => {
    const store = new InMemoryAuditStore();
    await store.record("REQUEST_VERIFIED", { result: "VERIFIED", code: "VERIFIED", reason: "ok" });
    expect((await store.list({ limit: 20, offset: 0 })).events).toHaveLength(1);
    expect(await store.count()).toBe(1);
  });

  it("filters audit events by result, code, sender, and receiver", async () => {
    const store = new InMemoryAuditStore();
    await store.record("REQUEST_VERIFIED", {
      result: "VERIFIED", code: "VERIFIED", reason: "ok",
      senderAgentId: "A", receiverAgentId: "B",
    });
    await store.record("REPLAY_BLOCKED", {
      result: "BLOCKED", code: "NONCE_REUSED", reason: "replay",
      senderAgentId: "A", receiverAgentId: "C",
    });
    const page = await store.list({
      limit: 20, offset: 0, result: "BLOCKED", code: "NONCE_REUSED",
      senderAgentId: "A", receiverAgentId: "C",
    });
    expect(page.total).toBe(1);
    expect(page.events[0]?.type).toBe("REPLAY_BLOCKED");
  });

  it("paginates audit events newest first", async () => {
    const store = new InMemoryAuditStore();
    for (let index = 1; index <= 5; index += 1) {
      await store.record("REQUEST_BLOCKED", { result: "BLOCKED", code: `CODE_${index}`, reason: "test" });
    }
    const page = await store.list({ limit: 2, offset: 1 });
    expect(page).toMatchObject({ total: 5, limit: 2, offset: 1 });
    expect(page.events.map((event) => event.code)).toEqual(["CODE_4", "CODE_3"]);
  });

  it("atomically rejects a repeated sender and nonce pair", async () => {
    const store = new InMemoryReplayStore();
    const input = { senderAgentId: "AGT-A", nonce: "same", requestId: "REQ-1" };
    const [first, second] = await Promise.all([store.consume(input), store.consume(input)]);
    expect([first, second].sort()).toEqual([false, true]);
    expect(await store.isConsumed("AGT-A", "same")).toBe(true);
  });

  it("scopes identical nonce text to the sender AgentID", async () => {
    const store = new InMemoryReplayStore();
    expect(await store.consume({ senderAgentId: "AGT-A", nonce: "n", requestId: "1" })).toBe(true);
    expect(await store.consume({ senderAgentId: "AGT-B", nonce: "n", requestId: "2" })).toBe(true);
  });

  it("records and retrieves interaction history", async () => {
    const store = new InMemoryInteractionStore();
    await store.record({
      requestId: "REQ-1", senderAgentId: "A", receiverAgentId: "B", action: "DO",
      requestPayload: { input: 1 }, responsePayload: { output: 2 }, authenticationCode: "VERIFIED", durationMs: 4,
    });
    expect((await store.getByRequestId("REQ-1"))?.responsePayload).toEqual({ output: 2 });
    expect((await store.list({ limit: 20, offset: 0 })).total).toBe(1);
    expect(await store.uniqueAgentIds()).toEqual(["A", "B"]);
  });

  it("seeds demo metadata idempotently", async () => {
    const store = new InMemoryAgentMetadataStore();
    const first = await seedDemoMetadata(store);
    const second = await seedDemoMetadata(store);
    expect(await store.list()).toHaveLength(3);
    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });

  it("uses complete in-memory fallback when Supabase is disabled", async () => {
    const messages: string[] = [];
    const persistence = await createPersistence(config(), { log: (message) => messages.push(message) });
    expect(persistence.status).toEqual({ mode: "IN_MEMORY", supabaseConnected: false });
    expect(await persistence.metadataStore.list()).toHaveLength(3);
    expect(messages).toEqual(["Persistence mode: IN_MEMORY"]);
  });

  it("falls back safely when Supabase configuration is incomplete", async () => {
    const persistence = await createPersistence(config({ supabaseEnabled: true }), { log: () => undefined });
    expect(persistence.status.mode).toBe("IN_MEMORY");
    expect(persistence.status.warning).toContain("server key is missing");
  });
});
