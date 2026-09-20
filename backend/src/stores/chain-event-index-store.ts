import type {
  ChainEventIndexSnapshot,
  ChainEventIndexStore,
  ChainEventNamespace,
} from "../persistence/types.js";
import type { IdentityLifecycleEvent } from "../domain/types.js";

interface StoredIndex {
  events: Map<string, IdentityLifecycleEvent>;
  lastScannedBlock: number | null;
}

function namespaceKey(namespace: ChainEventNamespace): string {
  return `${namespace.chainId}:${namespace.contractAddress.toLowerCase()}`;
}

function eventKey(event: IdentityLifecycleEvent): string {
  return `${event.transactionHash.toLowerCase()}:${event.logIndex}`;
}

export class InMemoryChainEventIndexStore implements ChainEventIndexStore {
  private readonly indexes = new Map<string, StoredIndex>();

  async load(namespace: ChainEventNamespace): Promise<ChainEventIndexSnapshot> {
    const index = this.indexes.get(namespaceKey(namespace));
    if (!index) return { events: [], lastScannedBlock: null };
    return {
      events: [...index.events.values()].map((event) => ({ ...event })),
      lastScannedBlock: index.lastScannedBlock,
    };
  }

  async persistChunk(
    namespace: ChainEventNamespace,
    events: readonly IdentityLifecycleEvent[],
    lastScannedBlock: number,
  ): Promise<void> {
    const key = namespaceKey(namespace);
    const current = this.indexes.get(key) ?? { events: new Map(), lastScannedBlock: null };
    for (const event of events) current.events.set(eventKey(event), { ...event });
    current.lastScannedBlock = Math.max(current.lastScannedBlock ?? -1, lastScannedBlock);
    this.indexes.set(key, current);
  }
}
