import { randomUUID } from "node:crypto";

export type AuditEventType =
  | "REQUEST_VERIFIED"
  | "REQUEST_BLOCKED"
  | "UNKNOWN_WALLET_BLOCKED"
  | "UNKNOWN_AGENT_BLOCKED"
  | "UNKNOWN_RECEIVER_BLOCKED"
  | "IMPERSONATION_BLOCKED"
  | "REVOKED_AGENT_BLOCKED"
  | "REPLAY_BLOCKED"
  | "EXPIRED_REQUEST_BLOCKED"
  | "INVALID_SIGNATURE_BLOCKED";

export interface AuditEventInput {
  requestId?: string;
  senderAgentId?: string;
  receiverAgentId?: string;
  action?: string;
  result: "VERIFIED" | "BLOCKED";
  code: string;
  reason: string;
  recoveredWallet?: string;
  registeredWallet?: string;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  timestamp: string;
  type: AuditEventType;
}

export interface AuditListQuery {
  limit: number;
  offset: number;
  result?: "VERIFIED" | "BLOCKED";
  code?: string;
  senderAgentId?: string;
  receiverAgentId?: string;
}

export interface AuditCountQuery {
  result?: "VERIFIED" | "BLOCKED";
  code?: string;
}

export interface AuditPage {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditStore {
  record(type: AuditEventType, event: AuditEventInput): Promise<AuditEvent>;
  list(query: AuditListQuery): Promise<AuditPage>;
  count(query?: AuditCountQuery): Promise<number>;
  clear(): Promise<void>;
}

export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  async record(type: AuditEventType, input: AuditEventInput): Promise<AuditEvent> {
    const event = { id: randomUUID(), timestamp: new Date().toISOString(), type, ...input };
    this.events.push(event);
    return event;
  }

  async list(query: AuditListQuery): Promise<AuditPage> {
    const filtered = [...this.events].reverse().filter((event) =>
      (!query.result || event.result === query.result) &&
      (!query.code || event.code === query.code) &&
      (!query.senderAgentId || event.senderAgentId === query.senderAgentId) &&
      (!query.receiverAgentId || event.receiverAgentId === query.receiverAgentId));
    return {
      events: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async count(query: AuditCountQuery = {}): Promise<number> {
    return this.events.filter((event) =>
      (!query.result || event.result === query.result) &&
      (!query.code || event.code === query.code)).length;
  }

  async clear(): Promise<void> {
    this.events.length = 0;
  }
}
