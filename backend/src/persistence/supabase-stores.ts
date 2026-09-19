import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JsonValue } from "../domain/types.js";
import type {
  AuditCountQuery,
  AuditEvent,
  AuditEventInput,
  AuditEventType,
  AuditListQuery,
  AuditPage,
  AuditStore,
} from "../stores/audit-store.js";
import type { ReplayStore } from "../stores/replay-store.js";
import { persistenceError } from "./errors.js";
import type { Database } from "./database.types.js";
import type {
  AgentMetadata,
  AgentMetadataInput,
  AgentMetadataStore,
  InteractionInput,
  InteractionListQuery,
  InteractionRecord,
  InteractionStore,
  PaginatedResult,
  ReplayNonceInput,
} from "./types.js";

type Client = SupabaseClient<Database>;
type AuditRow = Database["public"]["Tables"]["audit_events"]["Row"];
type InteractionRow = Database["public"]["Tables"]["interactions"]["Row"];
type MetadataRow = Database["public"]["Tables"]["agent_metadata"]["Row"];

export class SupabaseAuditStore implements AuditStore {
  constructor(private readonly client: Client) {}

  async record(type: AuditEventType, input: AuditEventInput): Promise<AuditEvent> {
    const row: Database["public"]["Tables"]["audit_events"]["Insert"] = {
      id: randomUUID(),
      event_type: type,
      request_id: input.requestId ?? null,
      sender_agent_id: input.senderAgentId ?? null,
      receiver_agent_id: input.receiverAgentId ?? null,
      action: input.action ?? null,
      result: input.result,
      code: input.code,
      reason: input.reason,
      recovered_wallet: input.recoveredWallet ?? null,
      registered_wallet: input.registeredWallet ?? null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    const { error } = await this.client.from("audit_events").insert(row);
    if (error) throw persistenceError("record audit event", error);
    return this.map(row as AuditRow);
  }

  async list(query: AuditListQuery): Promise<AuditPage> {
    let request = this.client
      .from("audit_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);
    if (query.result) request = request.eq("result", query.result);
    if (query.code) request = request.eq("code", query.code);
    if (query.senderAgentId) request = request.eq("sender_agent_id", query.senderAgentId);
    if (query.receiverAgentId) request = request.eq("receiver_agent_id", query.receiverAgentId);
    const { data, error, count } = await request;
    if (error) throw persistenceError("list audit events", error);
    return {
      events: (data ?? []).map((row) => this.map(row)),
      total: count ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async count(query: AuditCountQuery = {}): Promise<number> {
    let request = this.client.from("audit_events").select("id", { count: "exact", head: true });
    if (query.result) request = request.eq("result", query.result);
    if (query.code) request = request.eq("code", query.code);
    const { error, count } = await request;
    if (error) throw persistenceError("count audit events", error);
    return count ?? 0;
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from("audit_events").delete().not("id", "is", null);
    if (error) throw persistenceError("clear audit events", error);
  }

  private map(row: AuditRow): AuditEvent {
    return {
      id: row.id,
      timestamp: row.created_at,
      type: row.event_type as AuditEventType,
      requestId: row.request_id ?? undefined,
      senderAgentId: row.sender_agent_id ?? undefined,
      receiverAgentId: row.receiver_agent_id ?? undefined,
      action: row.action ?? undefined,
      result: row.result as "VERIFIED" | "BLOCKED",
      code: row.code,
      reason: row.reason,
      recoveredWallet: row.recovered_wallet ?? undefined,
      registeredWallet: row.registered_wallet ?? undefined,
    };
  }
}

export class SupabaseReplayStore implements ReplayStore {
  constructor(private readonly client: Client) {}

  async consume(input: ReplayNonceInput): Promise<boolean> {
    const { error } = await this.client.from("replay_nonces").insert({
      id: randomUUID(),
      sender_agent_id: input.senderAgentId,
      nonce: input.nonce,
      request_id: input.requestId,
      consumed_at: new Date().toISOString(),
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw persistenceError("consume replay nonce", error);
  }

  async isConsumed(senderAgentId: string, nonce: string): Promise<boolean> {
    const { count, error } = await this.client
      .from("replay_nonces")
      .select("id", { count: "exact", head: true })
      .eq("sender_agent_id", senderAgentId)
      .eq("nonce", nonce);
    if (error) throw persistenceError("check replay nonce", error);
    return (count ?? 0) > 0;
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from("replay_nonces").delete().not("id", "is", null);
    if (error) throw persistenceError("clear replay nonces", error);
  }
}

export class SupabaseInteractionStore implements InteractionStore {
  constructor(private readonly client: Client) {}

  async record(input: InteractionInput): Promise<InteractionRecord> {
    const row: Database["public"]["Tables"]["interactions"]["Insert"] = {
      id: randomUUID(),
      request_id: input.requestId,
      sender_agent_id: input.senderAgentId,
      receiver_agent_id: input.receiverAgentId,
      action: input.action,
      request_payload: input.requestPayload,
      response_payload: input.responsePayload,
      authentication_code: input.authenticationCode,
      duration_ms: input.durationMs,
      created_at: new Date().toISOString(),
    };
    const { error } = await this.client.from("interactions").insert(row);
    if (error) throw persistenceError("record interaction", error);
    return this.map(row as InteractionRow);
  }

  async list(query: InteractionListQuery): Promise<PaginatedResult<InteractionRecord>> {
    let request = this.client
      .from("interactions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);
    if (query.senderAgentId) request = request.eq("sender_agent_id", query.senderAgentId);
    if (query.receiverAgentId) request = request.eq("receiver_agent_id", query.receiverAgentId);
    if (query.action) request = request.eq("action", query.action);
    const { data, error, count } = await request;
    if (error) throw persistenceError("list interactions", error);
    return {
      items: (data ?? []).map((row) => this.map(row)),
      total: count ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getByRequestId(requestId: string): Promise<InteractionRecord | null> {
    const { data, error } = await this.client
      .from("interactions")
      .select("*")
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) throw persistenceError("get interaction", error);
    return data ? this.map(data) : null;
  }

  async count(): Promise<number> {
    const { count, error } = await this.client.from("interactions").select("id", { count: "exact", head: true });
    if (error) throw persistenceError("count interactions", error);
    return count ?? 0;
  }

  async uniqueAgentIds(): Promise<string[]> {
    const { data, error } = await this.client.from("interactions").select("sender_agent_id,receiver_agent_id");
    if (error) throw persistenceError("list interaction agents", error);
    return [...new Set((data ?? []).flatMap((row) => [row.sender_agent_id, row.receiver_agent_id]))];
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from("interactions").delete().not("id", "is", null);
    if (error) throw persistenceError("clear interactions", error);
  }

  private map(row: InteractionRow): InteractionRecord {
    return {
      id: row.id,
      requestId: row.request_id,
      senderAgentId: row.sender_agent_id,
      receiverAgentId: row.receiver_agent_id,
      action: row.action,
      requestPayload: row.request_payload as JsonValue,
      responsePayload: row.response_payload as JsonValue,
      authenticationCode: row.authentication_code,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    };
  }
}

export class SupabaseAgentMetadataStore implements AgentMetadataStore {
  constructor(private readonly client: Client) {}

  async upsert(input: AgentMetadataInput): Promise<AgentMetadata> {
    const now = new Date().toISOString();
    const { data, error } = await this.client.from("agent_metadata").upsert({
      agent_id: input.agentId,
      display_name: input.displayName ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      capabilities: input.capabilities,
      avatar_key: input.avatarKey ?? null,
      accent_theme: input.accentTheme ?? null,
      updated_at: now,
    }, { onConflict: "agent_id" }).select("*").single();
    if (error || !data) throw persistenceError("upsert agent metadata", error);
    return this.map(data);
  }

  async getByAgentId(agentId: string): Promise<AgentMetadata | null> {
    const { data, error } = await this.client.from("agent_metadata").select("*").eq("agent_id", agentId).maybeSingle();
    if (error) throw persistenceError("get agent metadata", error);
    return data ? this.map(data) : null;
  }

  async list(): Promise<AgentMetadata[]> {
    const { data, error } = await this.client.from("agent_metadata").select("*").order("agent_id");
    if (error) throw persistenceError("list agent metadata", error);
    return (data ?? []).map((row) => this.map(row));
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from("agent_metadata").delete().not("id", "is", null);
    if (error) throw persistenceError("clear agent metadata", error);
  }

  private map(row: MetadataRow): AgentMetadata {
    return {
      id: row.id,
      agentId: row.agent_id,
      displayName: row.display_name,
      description: row.description,
      category: row.category,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((value): value is string => typeof value === "string") : [],
      avatarKey: row.avatar_key,
      accentTheme: row.accent_theme,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
