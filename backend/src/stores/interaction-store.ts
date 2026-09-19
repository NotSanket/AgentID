import { randomUUID } from "node:crypto";
import type {
  InteractionInput,
  InteractionListQuery,
  InteractionRecord,
  InteractionStore,
  PaginatedResult,
} from "../persistence/types.js";

export class InMemoryInteractionStore implements InteractionStore {
  private readonly interactions: InteractionRecord[] = [];

  async record(input: InteractionInput): Promise<InteractionRecord> {
    if (this.interactions.some((item) => item.requestId === input.requestId)) {
      throw new Error("An interaction already exists for this request ID.");
    }
    const interaction = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.interactions.push(interaction);
    return interaction;
  }

  async list(query: InteractionListQuery): Promise<PaginatedResult<InteractionRecord>> {
    const filtered = [...this.interactions].reverse().filter((interaction) =>
      (!query.senderAgentId || interaction.senderAgentId === query.senderAgentId) &&
      (!query.receiverAgentId || interaction.receiverAgentId === query.receiverAgentId) &&
      (!query.action || interaction.action === query.action));
    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getByRequestId(requestId: string): Promise<InteractionRecord | null> {
    return this.interactions.find((item) => item.requestId === requestId) ?? null;
  }

  async count(): Promise<number> {
    return this.interactions.length;
  }

  async uniqueAgentIds(): Promise<string[]> {
    return [...new Set(this.interactions.flatMap((item) => [item.senderAgentId, item.receiverAgentId]))];
  }

  async clear(): Promise<void> {
    this.interactions.length = 0;
  }
}
