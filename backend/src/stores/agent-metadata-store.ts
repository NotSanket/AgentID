import { randomUUID } from "node:crypto";
import type { AgentMetadata, AgentMetadataInput, AgentMetadataStore } from "../persistence/types.js";

export class InMemoryAgentMetadataStore implements AgentMetadataStore {
  private readonly records = new Map<string, AgentMetadata>();

  constructor(initial: readonly AgentMetadataInput[] = []) {
    const now = new Date().toISOString();
    for (const input of initial) {
      this.records.set(input.agentId, this.create(input, now));
    }
  }

  async upsert(input: AgentMetadataInput): Promise<AgentMetadata> {
    const existing = this.records.get(input.agentId);
    const now = new Date().toISOString();
    const record: AgentMetadata = {
      ...input,
      displayName: input.displayName ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      avatarKey: input.avatarKey ?? null,
      accentTheme: input.accentTheme ?? null,
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(input.agentId, record);
    return record;
  }

  async getByAgentId(agentId: string): Promise<AgentMetadata | null> {
    return this.records.get(agentId) ?? null;
  }

  async list(): Promise<AgentMetadata[]> {
    return [...this.records.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  private create(input: AgentMetadataInput, now: string): AgentMetadata {
    return {
      ...input,
      displayName: input.displayName ?? null,
      description: input.description ?? null,
      category: input.category ?? null,
      avatarKey: input.avatarKey ?? null,
      accentTheme: input.accentTheme ?? null,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
  }
}
