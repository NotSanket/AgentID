import type { AgentRecord, JsonValue } from "../domain/types.js";

export type PersistenceMode = "IN_MEMORY" | "SUPABASE";

export interface PaginationQuery {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> extends PaginationQuery {
  items: T[];
  total: number;
}

export interface ReplayNonceInput {
  senderAgentId: string;
  nonce: string;
  requestId: string;
}

export interface InteractionInput {
  requestId: string;
  senderAgentId: string;
  receiverAgentId: string;
  action: string;
  requestPayload: JsonValue;
  responsePayload: JsonValue;
  authenticationCode: string;
  durationMs: number;
}

export interface InteractionRecord extends InteractionInput {
  id: string;
  createdAt: string;
}

export interface InteractionListQuery extends PaginationQuery {
  senderAgentId?: string;
  receiverAgentId?: string;
  action?: string;
}

export interface InteractionStore {
  record(input: InteractionInput): Promise<InteractionRecord>;
  list(query: InteractionListQuery): Promise<PaginatedResult<InteractionRecord>>;
  getByRequestId(requestId: string): Promise<InteractionRecord | null>;
  count(): Promise<number>;
  uniqueAgentIds(): Promise<string[]>;
  clear(): Promise<void>;
}

export interface AgentMetadataInput {
  agentId: string;
  displayName?: string | null;
  description?: string | null;
  category?: string | null;
  capabilities: string[];
  avatarKey?: string | null;
  accentTheme?: string | null;
}

export interface AgentMetadata extends AgentMetadataInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMetadataStore {
  upsert(input: AgentMetadataInput): Promise<AgentMetadata>;
  getByAgentId(agentId: string): Promise<AgentMetadata | null>;
  list(): Promise<AgentMetadata[]>;
  clear(): Promise<void>;
}

export interface EnrichedAgent extends AgentRecord {
  displayName: string;
  description: string | null;
  category: string | null;
  capabilities: string[];
  avatarKey: string | null;
  accentTheme: string | null;
  blockchainStatus: AgentRecord["status"];
}

export interface PersistenceStatus {
  mode: PersistenceMode;
  supabaseConnected: boolean;
  warning?: string;
}
