import type { ReplayNonceInput } from "../persistence/types.js";

export interface ReplayStore {
  consume(input: ReplayNonceInput): Promise<boolean>;
  isConsumed(senderAgentId: string, nonce: string): Promise<boolean>;
  clear(): Promise<void>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly nonces = new Set<string>();

  private key(senderAgentId: string, nonce: string): string {
    return `${senderAgentId}\u0000${nonce}`;
  }

  async consume(input: ReplayNonceInput): Promise<boolean> {
    const key = this.key(input.senderAgentId, input.nonce);
    if (this.nonces.has(key)) return false;
    this.nonces.add(key);
    return true;
  }

  async isConsumed(senderAgentId: string, nonce: string): Promise<boolean> {
    return this.nonces.has(this.key(senderAgentId, nonce));
  }

  async clear(): Promise<void> {
    this.nonces.clear();
  }
}
