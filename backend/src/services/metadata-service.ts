import type { AgentRecord, RegistryReader } from "../domain/types.js";
import type { AgentMetadata, AgentMetadataStore, EnrichedAgent } from "../persistence/types.js";

export class MetadataService {
  constructor(
    private readonly registry: RegistryReader,
    private readonly metadataStore: AgentMetadataStore,
  ) {}

  async getByAgentId(agentId: string): Promise<EnrichedAgent | null> {
    const [agent, metadata] = await Promise.all([
      this.registry.getAgent(agentId),
      this.metadataStore.getByAgentId(agentId),
    ]);
    return agent ? this.merge(agent, metadata) : null;
  }

  async list(): Promise<EnrichedAgent[]> {
    const [agents, metadata] = await Promise.all([
      this.registry.listAgents(),
      this.metadataStore.list(),
    ]);
    const byAgentId = new Map(metadata.map((record) => [record.agentId, record]));
    return agents.map((agent) => this.merge(agent, byAgentId.get(agent.agentId) ?? null));
  }

  private merge(agent: AgentRecord, metadata: AgentMetadata | null): EnrichedAgent {
    return {
      ...agent,
      displayName: metadata?.displayName ?? agent.name,
      description: metadata?.description ?? null,
      category: metadata?.category ?? null,
      capabilities: metadata?.capabilities ?? [],
      avatarKey: metadata?.avatarKey ?? null,
      accentTheme: metadata?.accentTheme ?? null,
      blockchainStatus: agent.status,
    };
  }
}
