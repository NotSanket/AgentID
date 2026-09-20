import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RuntimeConfig } from "../config/runtime.js";
import { InMemoryAgentMetadataStore } from "../stores/agent-metadata-store.js";
import { InMemoryChainEventIndexStore } from "../stores/chain-event-index-store.js";
import { InMemoryAuditStore, type AuditStore } from "../stores/audit-store.js";
import { InMemoryInteractionStore } from "../stores/interaction-store.js";
import { InMemoryReplayStore, type ReplayStore } from "../stores/replay-store.js";
import { DEMO_AGENT_METADATA } from "./demo-metadata.js";
import type { Database } from "./database.types.js";
import {
  SupabaseAgentMetadataStore,
  SupabaseAuditStore,
  SupabaseChainEventIndexStore,
  SupabaseInteractionStore,
  SupabaseReplayStore,
} from "./supabase-stores.js";
import type {
  AgentMetadataStore,
  ChainEventIndexStore,
  InteractionStore,
  PersistenceStatus,
} from "./types.js";

export interface PersistenceBundle {
  auditStore: AuditStore;
  replayStore: ReplayStore;
  interactionStore: InteractionStore;
  metadataStore: AgentMetadataStore;
  chainEventStore: ChainEventIndexStore;
  status: PersistenceStatus;
}

export interface PersistenceFactoryOptions {
  client?: SupabaseClient<Database>;
  log?: (message: string) => void;
}

function inMemoryBundle(warning?: string): PersistenceBundle {
  return {
    auditStore: new InMemoryAuditStore(),
    replayStore: new InMemoryReplayStore(),
    interactionStore: new InMemoryInteractionStore(),
    metadataStore: new InMemoryAgentMetadataStore(DEMO_AGENT_METADATA),
    chainEventStore: new InMemoryChainEventIndexStore(),
    status: { mode: "IN_MEMORY", supabaseConnected: false, warning },
  };
}

export async function createPersistence(
  config: RuntimeConfig,
  options: PersistenceFactoryOptions = {},
): Promise<PersistenceBundle> {
  const log = options.log ?? console.log;
  if (!config.supabaseEnabled) {
    log("Persistence mode: IN_MEMORY");
    return inMemoryBundle();
  }

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    const warning = "Supabase is enabled but its URL or server key is missing; using in-memory persistence.";
    log(`Persistence mode: IN_MEMORY (${warning})`);
    return inMemoryBundle(warning);
  }

  const client = options.client ?? createClient<Database>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  try {
    const { error } = await client.from("agent_metadata").select("id", { count: "exact", head: true });
    if (error) throw error;
    const { error: chainIndexError } = await client.from("chain_indexer_state").select("chain_id", { count: "exact", head: true });
    if (chainIndexError) throw chainIndexError;
    log("Persistence mode: SUPABASE");
    return {
      auditStore: new SupabaseAuditStore(client),
      replayStore: new SupabaseReplayStore(client),
      interactionStore: new SupabaseInteractionStore(client),
      metadataStore: new SupabaseAgentMetadataStore(client),
      chainEventStore: new SupabaseChainEventIndexStore(client),
      status: { mode: "SUPABASE", supabaseConnected: true },
    };
  } catch {
    const warning = "Supabase health check failed; using in-memory persistence.";
    log(`Persistence mode: IN_MEMORY (${warning})`);
    return inMemoryBundle(warning);
  }
}
