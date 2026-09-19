import { randomUUID } from "node:crypto";

export type AuditEventType =
  | "REQUEST_VERIFIED"
  | "REQUEST_BLOCKED"
  | "UNKNOWN_WALLET_BLOCKED"
  | "UNKNOWN_AGENT_BLOCKED"
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

export interface AuditStore {
  record(type: AuditEventType, event: AuditEventInput): AuditEvent;
  list(): AuditEvent[];
  clear(): void;
}

export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  record(type: AuditEventType, input: AuditEventInput): AuditEvent {
    const event = { id: randomUUID(), timestamp: new Date().toISOString(), type, ...input };
    this.events.push(event);
    return event;
  }

  list(): AuditEvent[] {
    return [...this.events].reverse();
  }

  clear(): void {
    this.events.length = 0;
  }
}
