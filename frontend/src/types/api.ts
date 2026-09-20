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
  requestId?: string;
  action?: string;
  recoveredWallet?: string;
  registeredWallet?: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AgentRequest {
  requestId: string;
  senderAgentId: string;
  receiverAgentId: string;
  action: string;
  payload: JsonValue;
  timestamp: number;
  nonce: string;
}

export interface PreparedCommunication {
  request: AgentRequest;
  typedData: {
    domain: { name: string; version: string; chainId: number; verifyingContract: string };
    types: Record<string, { name: string; type: string }[]>;
    primaryType: "AgentRequest";
    message: Record<string, string | number>;
    payloadHash: string;
  };
}

export interface AuthenticationChecks {
  signatureValid: boolean;
  senderExists: boolean;
  receiverExists: boolean;
  receiverActive: boolean;
  walletMatches: boolean;
  identityActive: boolean;
  timestampValid: boolean;
  nonceUnused: boolean;
}

export interface AuthenticationResult {
  verified: boolean;
  code: string;
  reason: string;
  senderAgentId?: string;
  receiverAgentId?: string;
  recoveredWallet?: string;
  registeredWallet?: string;
  operationalWarnings?: string[];
  checks: AuthenticationChecks;
}

export interface AgentResponse {
  success: boolean;
  source: string;
  receiverAgentId: string;
  action: string;
  data: JsonValue;
}

export interface InteractionRecord {
  id: string;
  requestId: string;
  senderAgentId: string;
  receiverAgentId: string;
  action: string;
  requestPayload: JsonValue;
  responsePayload: JsonValue;
  authenticationCode: string;
  durationMs: number;
  createdAt: string;
}

export interface CommunicationResult {
  request?: AgentRequest;
  signature?: string;
  requestId?: string;
  senderAgentId?: string;
  receiverAgentId?: string;
  action?: string;
  timestamp?: number;
  nonce?: string;
  delivered: boolean;
  receiverExecuted: boolean;
  verification: AuthenticationResult;
  response?: AgentResponse;
  interaction?: InteractionRecord;
  operationalWarnings?: string[];
}

export interface DemoCommunicationAgent {
  label: string;
  agentId: string;
  name: string;
  organization: string;
  address: string;
  status: AgentStatus;
  supportedActions: string[];
}

export interface CommunicationCapabilities {
  handlers: Record<string, string[]>;
  source: "DETERMINISTIC_DEMO_HANDLERS";
}

export interface Pagination { total: number; limit: number; offset: number }

export interface TrustGraphEdge { source: string; target: string; verified: number; blocked: number; actions: string[]; lastActivity: string }
export interface TrustGraphResponse { nodes: (EnrichedAgent & { registrationBlock: number | null })[]; edges: TrustGraphEdge[]; metadataAvailable: boolean; warning?: string; source: string }
export type AnalyticsRange = "1h" | "24h" | "7d" | "all";
export interface AdvancedAnalytics {
  range: AnalyticsRange; generatedAt: string;
  metrics: { identities: number; activeIdentities: number; revokedIdentities: number; verificationAttempts: number; verifiedRequests: number; blockedRequests: number; successRate: number; interactions: number; uniqueActiveAgents: number };
  verificationSeries: Array<{ timestamp: string; VERIFIED?: number; BLOCKED?: number }>;
  interactionSeries: Array<{ timestamp: string; INTERACTION?: number }>;
  blockedReasons: Array<{ label: string; value: number }>;
  activeAgents: Array<{ label: string; value: number }>;
  communicationPairs: Array<{ label: string; value: number }>;
  lifecycleActivity: Array<{ label: string; value: number }>;
  source: string;
}
export interface ExplorerResponse {
  network: BlockchainHealth; contractAddress: string;
  blocks: Array<{ number: number; hash: string; parentHash: string; timestamp: number; transactionCount: number }>;
  events: IdentityLifecycleEvent[];
  transactions: Array<{ hash: string; blockNumber: number; from: string; to: string; operation: IdentityLifecycleEvent["type"]; status: "CONFIRMED" | "FAILED"; gasUsed: string; timestamp: number; agentId: string; owner: string }>;
  gasByOperation: Array<{ operation: string; count: number; averageGasUsed: string }>;
  matches: { agents: AgentRecord[]; events: IdentityLifecycleEvent[]; transactions: ExplorerResponse["transactions"]; blocks: ExplorerResponse["blocks"] };
  source: string;
}
export type SecurityScenarioId = "VALID" | "UNKNOWN_WALLET" | "IMPERSONATION" | "REVOKED_AGENT" | "REPLAY" | "EXPIRED" | "PAYLOAD_TAMPER" | "RECEIVER_TAMPER";
export interface SecurityScenarioInfo { id: SecurityScenarioId; expectedCode: string; description: string }
export interface SecurityScenarioResult extends SecurityScenarioInfo {
  scenario: SecurityScenarioId; protectedAsExpected: boolean; durationMs: number; request: AgentRequest;
  result: CommunicationResult; firstAttempt?: CommunicationResult;
  checkpoints: Array<{ label: string; status: "PASS" | "BLOCKED" | "INFO"; detail: string }>;
  guardrails: { developmentOnly: true; chainId: 31337; loopbackRpcOnly: true; arbitrarySigningDisabled: true };
}
