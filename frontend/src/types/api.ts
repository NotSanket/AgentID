import type { InterfaceAbi } from "ethers";

export type PersistenceMode = "IN_MEMORY" | "SUPABASE";

export interface BlockchainHealth {
  connected: boolean;
  network: string;
  chainId: number | null;
  expectedChainId: number;
  latestBlock: number | null;
  registryAddress: string | null;
  contractReachable: boolean;
  error?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  backend: "ok";
  blockchain: BlockchainHealth;
  persistenceMode: PersistenceMode;
  supabaseConnected: boolean;
  persistenceWarning?: string;
  demoSigningEnabled?: boolean;
}

export interface ApiErrorBody {
  code?: string;
  reason?: string;
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

export interface EnrichedAgent extends AgentRecord {
  displayName: string;
  description: string | null;
  category: string | null;
  capabilities: string[];
  avatarKey: string | null;
  accentTheme: string | null;
  blockchainStatus: AgentStatus;
}

export interface IdentityLifecycleEvent {
  type: "Registered" | "Updated" | "Revoked" | "Reactivated";
  agentId: string;
  owner: string;
  timestamp: string;
  blockNumber: number;
  transactionHash: string;
}

export interface IdentityContractConfig {
  network: string;
  chainId: number;
  registryAddress: string;
  abi: InterfaceAbi;
}

export interface IdentityTransactionResult {
  transactionHash: string;
  blockNumber: number;
  status: "CONFIRMED";
  operation: "REGISTER" | "UPDATE" | "REVOKE" | "REACTIVATE";
  agentId: string;
  ownerWallet: string;
  from: string;
  to: string;
  chainId: number;
}

export interface AgentMetadataInput {
  displayName?: string | null;
  description?: string | null;
  category?: string | null;
  capabilities: string[];
  avatarKey?: string | null;
  accentTheme?: string | null;
}

export interface IdentityProfileInput {
  wallet: string;
  agentId: string;
  name: string;
  organization: string;
  metadataURI?: string;
  metadata?: AgentMetadataInput;
}

export interface IdentityWriteResponse {
  transaction: IdentityTransactionResult | null;
  metadataSynced: boolean;
  metadataWarning?: string;
}

export interface DemoWallet {
  label: string;
  address: string;
  available: boolean;
  assignedAgentId: string | null;
}

export interface AnalyticsSummary {
  totalVerificationAttempts: number;
  verifiedRequests: number;
  blockedRequests: number;
  successRate: number;
  totalInteractions: number;
  uniqueActiveAgentsInInteractions: number;
  blockedByReason: Record<string, number>;
  recentActivity?: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: string;
  senderAgentId?: string;
  receiverAgentId?: string;
  result: "VERIFIED" | "BLOCKED";
  code: string;
  reason: string;
}
