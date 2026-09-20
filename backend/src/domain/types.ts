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

export type IdentityLifecycleEventType = "Registered" | "Updated" | "Revoked" | "Reactivated";

export interface IdentityLifecycleEvent {
  type: IdentityLifecycleEventType;
  agentId: string;
  owner: string;
  timestamp: string;
  blockNumber: number;
  logIndex: number;
  transactionHash: string;
}

export interface IdentityContractConfig {
  network: string;
  chainId: number;
  registryAddress: string;
  abi: readonly unknown[];
}

export type IdentityOperation = "REGISTER" | "UPDATE" | "REVOKE" | "REACTIVATE";

export interface IdentityTransactionResult {
  transactionHash: string;
  blockNumber: number;
  status: "CONFIRMED";
  operation: IdentityOperation;
  agentId: string;
  ownerWallet: string;
  from: string;
  to: string;
  chainId: number;
}

export interface RegistryReader {
  getAgent(agentId: string): Promise<AgentRecord | null>;
  getAgentByWallet(wallet: string): Promise<AgentRecord | null>;
  listAgents(): Promise<AgentRecord[]>;
}
