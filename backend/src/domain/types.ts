export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface AgentRequest {
  requestId: string;
  senderAgentId: string;
  receiverAgentId: string;
  action: string;
  payload: JsonValue;
  timestamp: number;
  nonce: string;
}

export type AgentStatus = "Active" | "Revoked";

export interface AgentRecord {
  agentId: string;
  name: string;
  organization: string;
  owner: string;
  metadataURI: string;
  registeredAt: string;
  updatedAt: string;
  status: AgentStatus;
}

export interface RegistryReader {
  getAgent(agentId: string): Promise<AgentRecord | null>;
  getAgentByWallet(wallet: string): Promise<AgentRecord | null>;
  listAgents(): Promise<AgentRecord[]>;
}
