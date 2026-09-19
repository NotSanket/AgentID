import { randomBytes, randomUUID } from "node:crypto";
import { AGENT_REQUEST_TYPES, buildDomain, hashPayload, toTypedMessage, type Eip712Settings } from "../auth/eip712.js";
import type { AgentRequest, JsonValue } from "../domain/types.js";

export interface CommunicationDraft {
  senderAgentId: string;
  receiverAgentId: string;
  action: string;
  payload: JsonValue;
}

export class CommunicationPreparationService {
  constructor(
    private readonly settings: Eip712Settings,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  prepare(draft: CommunicationDraft) {
    const request: AgentRequest = {
      requestId: `REQ-${randomUUID()}`,
      ...draft,
      timestamp: this.now(),
      nonce: `0x${randomBytes(32).toString("hex")}`,
    };
    return {
      request,
      typedData: {
        domain: buildDomain(this.settings),
        types: AGENT_REQUEST_TYPES,
        primaryType: "AgentRequest" as const,
        message: toTypedMessage(request),
        payloadHash: hashPayload(request.payload),
      },
    };
  }
}
