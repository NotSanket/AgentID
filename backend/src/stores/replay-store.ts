export interface ReplayStore {
  has(nonce: string): boolean;
  consume(nonce: string): boolean;
  clear(): void;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly nonces = new Set<string>();

  has(nonce: string): boolean {
    return this.nonces.has(nonce);
  }

  consume(nonce: string): boolean {
    if (this.nonces.has(nonce)) return false;
    this.nonces.add(nonce);
    return true;
  }

  clear(): void {
    this.nonces.clear();
  }
}
