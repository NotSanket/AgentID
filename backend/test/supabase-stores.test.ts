import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime.js";
import type { Database } from "../src/persistence/database.types.js";
import { createPersistence } from "../src/persistence/factory.js";
import { PersistenceError } from "../src/persistence/errors.js";
import { SupabaseAuditStore, SupabaseReplayStore } from "../src/persistence/supabase-stores.js";

function clientWithInsert(error: { code?: string } | null) {
  const insert = vi.fn().mockResolvedValue({ error });
  return {
    client: { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>,
    insert,
  };
}

describe("Stage 3 Supabase repositories with mocked clients", () => {
  it("maps a successful atomic nonce insert to first use", async () => {
    const { client, insert } = clientWithInsert(null);
    const store = new SupabaseReplayStore(client);
    expect(await store.consume({ senderAgentId: "AGT-A", nonce: "n", requestId: "r" })).toBe(true);
    expect(insert).toHaveBeenCalledOnce();
  });

  it("maps PostgreSQL unique violations to NONCE_REUSED behavior", async () => {
    const { client } = clientWithInsert({ code: "23505" });
    const store = new SupabaseReplayStore(client);
    expect(await store.consume({ senderAgentId: "AGT-A", nonce: "n", requestId: "r" })).toBe(false);
  });

  it("retains nonce state across Supabase repository instances", async () => {
    const rows = new Set<string>();
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(async (row: { sender_agent_id: string; nonce: string }) => {
          const key = `${row.sender_agent_id}:${row.nonce}`;
          if (rows.has(key)) return { error: { code: "23505" } };
          rows.add(key);
          return { error: null };
        }),
      })),
    } as unknown as SupabaseClient<Database>;
    const beforeRestart = new SupabaseReplayStore(client);
    const afterRestart = new SupabaseReplayStore(client);
    const input = { senderAgentId: "AGT-A", nonce: "persistent", requestId: "r" };
    expect(await beforeRestart.consume(input)).toBe(true);
    expect(await afterRestart.consume(input)).toBe(false);
  });

  it("wraps other database failures without exposing raw errors", async () => {
    const { client } = clientWithInsert({ code: "08006" });
    const store = new SupabaseReplayStore(client);
    await expect(store.consume({ senderAgentId: "AGT-A", nonce: "n", requestId: "r" }))
      .rejects.toEqual(expect.objectContaining({ name: "PersistenceError", errorCode: "08006" }));
  });

  it("writes an audit event using database row names", async () => {
    const { client, insert } = clientWithInsert(null);
    const store = new SupabaseAuditStore(client);
    const event = await store.record("REQUEST_VERIFIED", {
      result: "VERIFIED", code: "VERIFIED", reason: "ok", senderAgentId: "AGT-A",
    });
    expect(event).toMatchObject({ type: "REQUEST_VERIFIED", senderAgentId: "AGT-A" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sender_agent_id: "AGT-A", event_type: "REQUEST_VERIFIED" }));
  });

  it("selects Supabase mode after a successful startup health check", async () => {
    const select = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient<Database>;
    const config = {
      port: 4000, rpcUrl: "http://localhost:8545", registryAddress: "0x0000000000000000000000000000000000000001",
      expectedChainId: 31337, networkName: "localhost", manifestPath: "manifest", artifactPath: "artifact",
      requestMaxAgeSeconds: 300, clockSkewSeconds: 30, nodeEnv: "test",
      supabaseEnabled: true, supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "server-only-test-key",
    } satisfies RuntimeConfig;
    const persistence = await createPersistence(config, { client, log: () => undefined });
    expect(persistence.status).toEqual({ mode: "SUPABASE", supabaseConnected: true });
  });

  it("falls back when configured Supabase fails its startup health check", async () => {
    const select = vi.fn().mockResolvedValue({ error: { code: "NETWORK" } });
    const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient<Database>;
    const config = {
      port: 4000, rpcUrl: "http://localhost:8545", registryAddress: "0x0000000000000000000000000000000000000001",
      expectedChainId: 31337, networkName: "localhost", manifestPath: "manifest", artifactPath: "artifact",
      requestMaxAgeSeconds: 300, clockSkewSeconds: 30, nodeEnv: "test",
      supabaseEnabled: true, supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "server-only-test-key",
    } satisfies RuntimeConfig;
    const persistence = await createPersistence(config, { client, log: () => undefined });
    expect(persistence.status).toMatchObject({
      mode: "IN_MEMORY",
      supabaseConnected: false,
      warning: "Supabase health check failed; using in-memory persistence.",
    });
  });

  it("uses a sanitized persistence error type", () => {
    const error = new PersistenceError("test", "CODE");
    expect(error.message).toBe("Persistence operation failed: test.");
    expect(error.message).not.toContain("server-only-test-key");
  });
});
