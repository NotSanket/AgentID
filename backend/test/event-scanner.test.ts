import { describe, expect, it, vi } from "vitest";
import {
  CachedEventScanner,
  DEFAULT_EVENT_SCAN_BLOCK_CHUNK,
  DEFAULT_EVENT_SCAN_REQUEST_DELAY_MS,
  EventScanUnavailableError,
  classifyProviderFailure,
  type ScannableEvent,
} from "../src/blockchain/event-scanner.js";

interface TestEvent extends ScannableEvent { agentId: string }

function event(blockNumber: number, index: number, agentId: string): TestEvent {
  return {
    blockNumber,
    index,
    agentId,
    transactionHash: `0x${blockNumber.toString(16).padStart(62, "0")}${index.toString(16).padStart(2, "0")}`,
  };
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

describe("bounded cached AgentRegistry event scanning", () => {
  it("starts at deployment and splits history into inclusive chunks", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    await scanner({ deploymentBlock: 100, getLatestBlock: async () => 125, queryRange }).scan();
    expect(queryRange.mock.calls).toEqual([[100, 109], [110, 119], [120, 125]]);
    expect(DEFAULT_EVENT_SCAN_BLOCK_CHUNK).toBe(10);
  });

  it("processes chunks sequentially without parallel requests", async () => {
    let active = 0; let maximum = 0;
    const order: number[] = [];
    await scanner({
      getLatestBlock: async () => 125,
      queryRange: async (fromBlock) => {
        active += 1; maximum = Math.max(maximum, active); order.push(fromBlock);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1; return [];
      },
    }).scan();
    expect(maximum).toBe(1);
    expect(order).toEqual([100, 110, 120]);
  });

  it("applies the configured pacing delay between chunk requests", async () => {
    const sleep = vi.fn(async () => undefined);
    await scanner({
      getLatestBlock: async () => 125,
      requestDelayMs: 175,
      sleep,
    }).scan();
    expect(sleep.mock.calls).toEqual([[175], [175]]);
    expect(DEFAULT_EVENT_SCAN_REQUEST_DELAY_MS).toBe(175);
  });

  it("retries transient rate limits with bounded backoff", async () => {
    const sleep = vi.fn(async () => undefined);
    const queryRange = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ info: { error: { code: -32600, message: "compute units per second capacity exceeded" } } })
      .mockResolvedValue([event(100, 0, "A")]);
    const result = await scanner({ queryRange, sleep }).scan();
    expect(result).toHaveLength(1);
    expect(queryRange).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[300], [700]]);
  });

  it("enforces the maximum of three attempts", async () => {
    const queryRange = vi.fn(async () => { throw { status: 503 }; });
    const operation = scanner({ queryRange, sleep: async () => undefined }).scan();
    await expect(operation).rejects.toMatchObject({
      name: "EventScanUnavailableError",
      category: "TRANSIENT_UNAVAILABLE",
      attempts: 3,
    });
    expect(queryRange).toHaveBeenCalledTimes(3);
  });

  it("does not retry deterministic invalid requests", async () => {
    const sleep = vi.fn(async () => undefined);
    const queryRange = vi.fn(async () => { throw { code: -32602, message: "invalid params" }; });
    await expect(scanner({ queryRange, sleep }).scan()).rejects.toMatchObject({ category: "NON_TRANSIENT", attempts: 1 });
    expect(queryRange).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("caches a successful history when the latest block has not advanced", async () => {
    const queryRange = vi.fn(async () => [event(100, 0, "A")]);
    const subject = scanner({ getLatestBlock: async () => 109, queryRange });
    expect(await subject.scan()).toHaveLength(1);
    expect(await subject.scan()).toHaveLength(1);
    expect(queryRange).toHaveBeenCalledOnce();
    expect(subject.metrics()).toEqual({ lastScannedBlock: 109, cachedEventCount: 1, totalLogRequests: 1 });
  });

  it("scans only blocks after the last successfully scanned block", async () => {
    let latest = 109;
    const queryRange = vi.fn(async (fromBlock: number) => [event(fromBlock, 0, String(fromBlock))]);
    const subject = scanner({ getLatestBlock: async () => latest, queryRange });
    await subject.scan();
    latest = 125;
    await subject.scan();
    expect(queryRange.mock.calls).toEqual([[100, 109], [110, 119], [120, 125]]);
  });

  it("does not corrupt the previous cache after a failed incremental scan", async () => {
    let latest = 109;
    let failIncremental = false;
    const subject = scanner({
      getLatestBlock: async () => latest,
      sleep: async () => undefined,
      queryRange: async (fromBlock) => {
        if (failIncremental && fromBlock === 120) throw { status: 503 };
        return [event(fromBlock, 0, String(fromBlock))];
      },
    });
    await subject.scan();
    latest = 129; failIncremental = true;
    await expect(subject.scan()).rejects.toBeInstanceOf(EventScanUnavailableError);
    expect(subject.metrics()).toMatchObject({ lastScannedBlock: 109, cachedEventCount: 1 });
    latest = 109;
    expect((await subject.scan()).map((item) => item.agentId)).toEqual(["100"]);
  });

  it("returns a successful empty cached history", async () => {
    const subject = scanner({ getLatestBlock: async () => 105 });
    await expect(subject.scan()).resolves.toEqual([]);
    await expect(subject.scan()).resolves.toEqual([]);
    expect(subject.metrics()).toMatchObject({ lastScannedBlock: 105, cachedEventCount: 0, totalLogRequests: 1 });
  });

  it("deduplicates logs and preserves deterministic blockchain order", async () => {
    const duplicate = event(105, 1, "A");
    const result = await scanner({
      getLatestBlock: async () => 105,
      queryRange: async () => [event(105, 2, "B"), duplicate, duplicate, event(100, 0, "C")],
    }).scan();
    expect(result.map((item) => item.agentId)).toEqual(["C", "A", "B"]);
  });

  it("sanitizes provider failures and never exposes credentials", async () => {
    const sensitive = "sensitive-provider-token";
    const operation = scanner({
      queryRange: async () => { throw { status: 429, message: sensitive }; },
      sleep: async () => undefined,
    }).scan();
    await expect(operation).rejects.toMatchObject({ category: "RATE_LIMITED", attempts: 3 });
    await expect(operation).rejects.not.toHaveProperty("message", expect.stringContaining(sensitive));
    await expect(operation).rejects.not.toHaveProperty("cause");
    expect(classifyProviderFailure({ info: { error: { code: -32600, message: "throughput exceeded" } } })).toBe("RATE_LIMITED");
  });
});
