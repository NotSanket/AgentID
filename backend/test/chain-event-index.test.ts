import { describe, expect, it, vi } from "vitest";
import { CachedEventScanner, type ScannableEvent } from "../src/blockchain/event-scanner.js";
import type { IdentityLifecycleEvent } from "../src/domain/types.js";
import type { ChainEventIndexStore, ChainEventNamespace } from "../src/persistence/types.js";
import { InMemoryChainEventIndexStore } from "../src/stores/chain-event-index-store.js";

interface TestEvent extends ScannableEvent { agentId: string }

const namespace: ChainEventNamespace = {
  chainId: 11155111,
  contractAddress: "0xA8fC4db5eFD8F6a316fbAB81Fb4cb83A8826d42a",
};

function identityEvent(blockNumber: number, logIndex = 0, agentId = "AGT-TRAVEL-001"): IdentityLifecycleEvent {
  return {
    type: "Registered",
    agentId,
    owner: "0x77eEeCC3C47dAB02c8ba237AE52Be203CE454f86",
    timestamp: String(2_000_000_000 + blockNumber),
    blockNumber,
    logIndex,
    transactionHash: `0x${blockNumber.toString(16).padStart(62, "0")}${logIndex.toString(16).padStart(2, "0")}`,
  };
}

function testEvent(blockNumber: number, index = 0, agentId = "AGT"): TestEvent {
  const event = identityEvent(blockNumber, index, agentId);
  return { blockNumber, index, agentId, transactionHash: event.transactionHash };
}

function scanner(overrides: Partial<ConstructorParameters<typeof CachedEventScanner<TestEvent>>[0]> = {}) {
  return new CachedEventScanner<TestEvent>({
    deploymentBlock: 100,
    chunkSize: 10,
    requestDelayMs: 0,
    getLatestBlock: async () => 100,
    queryRange: async () => [],
    ...overrides,
  });
}

describe("persistent AgentRegistry event index", () => {
  it("scans from the deployment block on first boot when no index exists", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    await scanner({
      getLatestBlock: async () => 105,
      queryRange,
      loadInitialState: async () => ({ events: [], lastScannedBlock: null }),
    }).scan();
    expect(queryRange).toHaveBeenCalledWith(100, 105);
  });

  it("starts with an empty namespaced index", async () => {
    await expect(new InMemoryChainEventIndexStore().load(namespace)).resolves.toEqual({
      events: [], lastScannedBlock: null,
    });
  });

  it("stores decoded events and their completed checkpoint", async () => {
    const store = new InMemoryChainEventIndexStore();
    await store.persistChunk(namespace, [identityEvent(100)], 109);
    const state = await store.load(namespace);
    expect(state.events).toEqual([identityEvent(100)]);
    expect(state.lastScannedBlock).toBe(109);
  });

  it("deduplicates replayed transaction hash and log index pairs", async () => {
    const store = new InMemoryChainEventIndexStore();
    const event = identityEvent(100);
    await store.persistChunk(namespace, [event], 109);
    await store.persistChunk(namespace, [event], 109);
    expect((await store.load(namespace)).events).toHaveLength(1);
  });

  it("isolates indexes by chain ID", async () => {
    const store = new InMemoryChainEventIndexStore();
    await store.persistChunk(namespace, [identityEvent(100)], 109);
    await expect(store.load({ ...namespace, chainId: 31337 })).resolves.toEqual({ events: [], lastScannedBlock: null });
  });

  it("isolates indexes by contract address", async () => {
    const store = new InMemoryChainEventIndexStore();
    await store.persistChunk(namespace, [identityEvent(100)], 109);
    await expect(store.load({ ...namespace, contractAddress: "0x0000000000000000000000000000000000000001" }))
      .resolves.toEqual({ events: [], lastScannedBlock: null });
  });

  it("normalizes contract address casing within a namespace", async () => {
    const store = new InMemoryChainEventIndexStore();
    await store.persistChunk(namespace, [identityEvent(100)], 109);
    expect((await store.load({ ...namespace, contractAddress: namespace.contractAddress.toLowerCase() })).events).toHaveLength(1);
  });

  it("never moves an existing checkpoint backwards", async () => {
    const store = new InMemoryChainEventIndexStore();
    await store.persistChunk(namespace, [], 119);
    await store.persistChunk(namespace, [], 109);
    expect((await store.load(namespace)).lastScannedBlock).toBe(119);
  });

  it("hydrates memory from persistence before checking for new blocks", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    const subject = scanner({
      getLatestBlock: async () => 109,
      queryRange,
      loadInitialState: async () => ({ events: [testEvent(100)], lastScannedBlock: 109 }),
    });
    expect((await subject.scan()).map((event) => event.agentId)).toEqual(["AGT"]);
    expect(queryRange).not.toHaveBeenCalled();
  });

  it("continues at checkpoint plus one after a cold start", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    await scanner({
      getLatestBlock: async () => 125,
      queryRange,
      loadInitialState: async () => ({ events: [], lastScannedBlock: 109 }),
    }).scan();
    expect(queryRange.mock.calls).toEqual([[110, 119], [120, 125]]);
  });

  it("persists each decoded chunk before starting the next range", async () => {
    const operations: string[] = [];
    await scanner({
      getLatestBlock: async () => 115,
      queryRange: async (from, to) => { operations.push(`query:${from}-${to}`); return [testEvent(from)]; },
      persistChunk: async (_events, checkpoint) => { operations.push(`persist:${checkpoint}`); },
    }).scan();
    expect(operations).toEqual(["query:100-109", "persist:109", "query:110-115", "persist:115"]);
  });

  it("persists a zero-event checkpoint", async () => {
    const persistChunk = vi.fn(async () => undefined);
    await scanner({ getLatestBlock: async () => 105, persistChunk }).scan();
    expect(persistChunk).toHaveBeenCalledWith([], 105);
  });

  it("does not advance the in-memory cursor when persistence fails", async () => {
    const subject = scanner({
      getLatestBlock: async () => 105,
      queryRange: async () => [testEvent(100)],
      persistChunk: async () => { throw new Error("storage unavailable"); },
    });
    await expect(subject.scan()).rejects.toThrow("storage unavailable");
    expect(subject.metrics()).toMatchObject({ lastScannedBlock: null, cachedEventCount: 0 });
  });

  it("recovers idempotently when events were saved but cursor advancement failed", async () => {
    let storedEvents: TestEvent[] = [];
    let checkpoint: number | null = null;
    let failCursor = true;
    const loadInitialState = async () => ({ events: storedEvents, lastScannedBlock: checkpoint });
    const persistChunk = async (events: readonly TestEvent[], nextCheckpoint: number) => {
      storedEvents = [...new Map([...storedEvents, ...events].map((event) => [event.transactionHash + event.index, event])).values()];
      if (failCursor) { failCursor = false; throw new Error("checkpoint unavailable"); }
      checkpoint = nextCheckpoint;
    };
    const first = scanner({ queryRange: async () => [testEvent(100)], loadInitialState, persistChunk });
    await expect(first.scan()).rejects.toThrow("checkpoint unavailable");
    const restarted = scanner({ queryRange: async () => [testEvent(100)], loadInitialState, persistChunk });
    await expect(restarted.scan()).resolves.toHaveLength(1);
    expect(storedEvents).toHaveLength(1);
    expect(checkpoint).toBe(100);
  });

  it("keeps persisted events in deterministic block and log order", async () => {
    const result = await scanner({
      getLatestBlock: async () => 105,
      loadInitialState: async () => ({
        events: [testEvent(105, 2, "B"), testEvent(100, 1, "A")],
        lastScannedBlock: 105,
      }),
    }).scan();
    expect(result.map((event) => event.agentId)).toEqual(["A", "B"]);
  });

  it("does not rewrite persistence when the chain has not advanced", async () => {
    const persistChunk = vi.fn(async () => undefined);
    const subject = scanner({ getLatestBlock: async () => 109, persistChunk });
    await subject.scan();
    await subject.scan();
    expect(persistChunk).toHaveBeenCalledOnce();
  });

  it("performs zero log requests on a subsequent no-new-block read", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    const subject = scanner({ getLatestBlock: async () => 109, queryRange });
    await subject.scan();
    queryRange.mockClear();
    await subject.scan();
    expect(queryRange).not.toHaveBeenCalled();
  });

  it("appends events found in incremental blocks without losing hydrated history", async () => {
    let latest = 109;
    const subject = scanner({
      getLatestBlock: async () => latest,
      loadInitialState: async () => ({ events: [testEvent(100, 0, "A")], lastScannedBlock: 109 }),
      queryRange: async (from) => [testEvent(from, 0, "B")],
    });
    expect((await subject.scan()).map((event) => event.agentId)).toEqual(["A"]);
    latest = 115;
    expect((await subject.scan()).map((event) => event.agentId)).toEqual(["A", "B"]);
  });

  it("coalesces concurrent cold-start scans into one persistence sequence", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const queryRange = vi.fn(async () => { await pending; return [] as TestEvent[]; });
    const subject = scanner({ queryRange });
    const first = subject.scan();
    const second = subject.scan();
    release();
    await Promise.all([first, second]);
    expect(queryRange).toHaveBeenCalledOnce();
  });

  it("rejects an invalid persisted checkpoint without querying the provider", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    const subject = scanner({
      queryRange,
      loadInitialState: async () => ({ events: [], lastScannedBlock: -1 }),
    });
    await expect(subject.scan()).rejects.toThrow("persisted event scan checkpoint");
    expect(queryRange).not.toHaveBeenCalled();
  });

  it("supports a shared repository across scanner instances to model process restart", async () => {
    const store = new InMemoryChainEventIndexStore();
    const adapter = (subjectStore: ChainEventIndexStore) => ({
      loadInitialState: async () => {
        const state = await subjectStore.load(namespace);
        return { events: state.events.map((event) => ({ ...event, index: event.logIndex })), lastScannedBlock: state.lastScannedBlock };
      },
      persistChunk: (events: readonly (TestEvent & Partial<IdentityLifecycleEvent>)[], block: number) =>
        subjectStore.persistChunk(namespace, events.map((event) => ({ ...identityEvent(event.blockNumber, event.index, event.agentId), transactionHash: event.transactionHash })), block),
    });
    const firstQuery = vi.fn(async () => [testEvent(100)]);
    await scanner({ queryRange: firstQuery, ...adapter(store) }).scan();
    const restartQuery = vi.fn(async () => [] as TestEvent[]);
    const result = await scanner({ queryRange: restartQuery, ...adapter(store) }).scan();
    expect(result).toHaveLength(1);
    expect(restartQuery).not.toHaveBeenCalled();
  });
});
