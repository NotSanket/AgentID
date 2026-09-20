import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EVENT_SCAN_BLOCK_CHUNK,
  EventScanUnavailableError,
  scanEventsInChunks,
  type ScannableEvent,
} from "../src/blockchain/event-scanner.js";

interface TestEvent extends ScannableEvent {
  agentId: string;
}

function event(blockNumber: number, index: number, agentId: string): TestEvent {
  return {
    blockNumber,
    index,
    agentId,
    transactionHash: `0x${blockNumber.toString(16).padStart(62, "0")}${index.toString(16).padStart(2, "0")}`,
  };
}

describe("bounded AgentRegistry event scanning", () => {
  it("uses the deployment block as the first queried block", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    await scanEventsInChunks({
      deploymentBlock: 11743199,
      getLatestBlock: async () => 11743199,
      queryRange,
    });
    expect(queryRange).toHaveBeenCalledWith(11743199, 11743199);
  });

  it("splits history into conservative inclusive ranges", async () => {
    const queryRange = vi.fn(async () => [] as TestEvent[]);
    await scanEventsInChunks({
      deploymentBlock: 100,
      chunkSize: 10,
      getLatestBlock: async () => 125,
      queryRange,
    });
    expect(queryRange.mock.calls).toEqual([[100, 109], [110, 119], [120, 125]]);
    expect(DEFAULT_EVENT_SCAN_BLOCK_CHUNK).toBe(10);
  });

  it("returns an empty successful result when no events exist", async () => {
    await expect(scanEventsInChunks({
      deploymentBlock: 100,
      getLatestBlock: async () => 105,
      queryRange: async () => [],
    })).resolves.toEqual([]);
  });

  it("merges multi-chunk results in deterministic blockchain order", async () => {
    const result = await scanEventsInChunks({
      deploymentBlock: 100,
      chunkSize: 10,
      getLatestBlock: async () => 125,
      queryRange: async (fromBlock) => fromBlock === 100
        ? [event(109, 3, "C"), event(100, 2, "A")]
        : fromBlock === 110 ? [event(110, 1, "B")] : [event(125, 0, "D")],
    });
    expect(result.map((item) => item.agentId)).toEqual(["A", "C", "B", "D"]);
  });

  it("deduplicates the same log identity without losing distinct logs", async () => {
    const duplicate = event(105, 1, "A");
    const distinct = event(105, 2, "B");
    const result = await scanEventsInChunks({
      deploymentBlock: 100,
      getLatestBlock: async () => 105,
      queryRange: async () => [duplicate, duplicate, distinct],
    });
    expect(result).toEqual([duplicate, distinct]);
  });

  it("fails the complete scan with a sanitized service error when a chunk fails", async () => {
    const sensitive = "sensitive-provider-token";
    const scan = scanEventsInChunks({
      deploymentBlock: 100,
      chunkSize: 10,
      getLatestBlock: async () => 125,
      queryRange: async (fromBlock) => {
        if (fromBlock === 110) throw new Error(sensitive);
        return [event(fromBlock, 0, String(fromBlock))];
      },
    });
    await expect(scan).rejects.toBeInstanceOf(EventScanUnavailableError);
    await expect(scan).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
    await expect(scan).rejects.not.toHaveProperty("message", expect.stringContaining(sensitive));
  });
});
