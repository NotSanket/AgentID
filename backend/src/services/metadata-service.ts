import type { AgentRecord, RegistryReader } from "../domain/types.js";
import type { AgentMetadata, AgentMetadataInput, AgentMetadataStore, EnrichedAgent } from "../persistence/types.js";
import { getAddress, verifyMessage } from "ethers";

export interface MetadataMergeResult<T> {
  data: T;
  metadataAvailable: boolean;
  warning?: string;
}

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

  async getByAgentIdWithStatus(agentId: string): Promise<MetadataMergeResult<EnrichedAgent | null>> {
    const agent = await this.registry.getAgent(agentId);
    if (!agent) return { data: null, metadataAvailable: true };
    try {
      return { data: this.merge(agent, await this.metadataStore.getByAgentId(agentId)), metadataAvailable: true };
    } catch {
      return {
        data: this.merge(agent, null),
        metadataAvailable: false,
        warning: "On-chain identity loaded, but metadata is temporarily unavailable.",
      };
    }
  }

  async listWithStatus(): Promise<MetadataMergeResult<EnrichedAgent[]>> {
    const agents = await this.registry.listAgents();
    try {
      const metadata = await this.metadataStore.list();
      const byAgentId = new Map(metadata.map((record) => [record.agentId, record]));
      return { data: agents.map((agent) => this.merge(agent, byAgentId.get(agent.agentId) ?? null)), metadataAvailable: true };
    } catch {
      return {
        data: agents.map((agent) => this.merge(agent, null)),
        metadataAvailable: false,
        warning: "Blockchain identities are available, but metadata enrichment is offline.",
      };
    }
  }

  upsert(input: AgentMetadataInput): Promise<AgentMetadata> {
    return this.metadataStore.upsert(input);
  }

  async authorizedUpsert(
    input: AgentMetadataInput,
    authorization: { wallet: string; signature: string; issuedAt: number },
    now = Math.floor(Date.now() / 1000),
  ): Promise<AgentMetadata> {
    const agent = await this.registry.getAgent(input.agentId);
    if (!agent) throw new MetadataAuthorizationError("AGENT_NOT_FOUND", "The requested AgentID does not exist.", 404);
    if (Math.abs(now - authorization.issuedAt) > 300) {
      throw new MetadataAuthorizationError("AUTHORIZATION_EXPIRED", "The metadata authorization has expired.", 403);
    }
    let recovered: string;
    try {
      recovered = getAddress(verifyMessage(buildMetadataAuthorizationMessage(input, authorization.issuedAt), authorization.signature));
    } catch {
      throw new MetadataAuthorizationError("INVALID_SIGNATURE", "The metadata authorization signature is invalid.", 403);
    }
    if (recovered !== getAddress(agent.owner) || recovered !== getAddress(authorization.wallet)) {
      throw new MetadataAuthorizationError("NOT_IDENTITY_OWNER", "Only the controlling wallet can update metadata.", 403);
    }
    return this.metadataStore.upsert(input);
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

export class MetadataAuthorizationError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "MetadataAuthorizationError";
  }
}

export function buildMetadataAuthorizationMessage(input: AgentMetadataInput, issuedAt: number): string {
  return [
    "AgentID Metadata Update",
    `AgentID: ${input.agentId}`,
    `Display Name: ${input.displayName ?? ""}`,
    `Description: ${input.description ?? ""}`,
    `Category: ${input.category ?? ""}`,
    `Capabilities: ${input.capabilities.join(",")}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
