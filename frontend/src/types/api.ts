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
}

export interface ApiErrorBody {
  code?: string;
  reason?: string;
}
