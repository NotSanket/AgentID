import { Interface, Wallet, type Log } from "ethers";
import { describe, expect, it, vi } from "vitest";
import { AgentRegistryEventReader } from "../src/blockchain/agent-registry-event-reader.js";

const registry = Wallet.createRandom().address;
const owner = Wallet.createRandom().address;
const contractInterface = new Interface([
  "event AgentRegistered(bytes32 indexed agentKey,string agentId,address indexed owner,uint256 timestamp)",
  "event AgentUpdated(bytes32 indexed agentKey,string agentId,address indexed owner,uint256 timestamp)",
  "event AgentRevoked(bytes32 indexed agentKey,string agentId,address indexed owner,uint256 timestamp)",
  "event AgentReactivated(bytes32 indexed agentKey,string agentId,address indexed owner,uint256 timestamp)",
]);

function lifecycleLog(name: string, blockNumber: number, index: number): Log {
  const fragment = contractInterface.getEvent(name)!;
  const encoded = contractInterface.encodeEventLog(fragment, [
    `0x${"1".repeat(64)}`,
    "AGT-TRAVEL-001",
    owner,
    2_000_000_000n + BigInt(blockNumber),
  ]);
  return {
    address: registry,
    blockHash: `0x${"2".repeat(64)}`,
    blockNumber,
    data: encoded.data,
    index,
    removed: false,
    topics: encoded.topics,
    transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
    transactionIndex: 0,
  } as unknown as Log;
}

describe("AgentRegistry raw lifecycle event reader", () => {
  it("uses one unfiltered address getLogs request per chunk and decodes all lifecycle types locally", async () => {
    const getLogs = vi.fn(async ({ fromBlock }: { fromBlock: number }) => fromBlock === 100
      ? [
        lifecycleLog("AgentRegistered", 100, 0),
        lifecycleLog("AgentUpdated", 101, 1),
        lifecycleLog("AgentRevoked", 102, 2),
        lifecycleLog("AgentReactivated", 103, 3),
      ]
      : []);
    const reader = new AgentRegistryEventReader({
      provider: { getBlockNumber: async () => 125, getLogs },
      contractAddress: registry,
      contractInterface,
      deploymentBlock: 100,
      chunkSize: 10,
      requestDelayMs: 0,
    });
    const events = await reader.scan();
    expect(getLogs.mock.calls.map(([filter]) => filter)).toEqual([
      { address: registry, fromBlock: 100, toBlock: 109 },
      { address: registry, fromBlock: 110, toBlock: 119 },
      { address: registry, fromBlock: 120, toBlock: 125 },
    ]);
    expect(events.map((event) => event.type)).toEqual(["Registered", "Updated", "Revoked", "Reactivated"]);
    expect(events[0]).toMatchObject({ agentId: "AGT-TRAVEL-001", owner, blockNumber: 100, logIndex: 0, index: 0 });
  });

  it("ignores unrelated or unparseable logs without corrupting known events", async () => {
    const unknown = { ...lifecycleLog("AgentRegistered", 100, 0), topics: [`0x${"f".repeat(64)}`] } as unknown as Log;
    const reader = new AgentRegistryEventReader({
      provider: { getBlockNumber: async () => 100, getLogs: async () => [unknown, lifecycleLog("AgentRegistered", 100, 1)] },
      contractAddress: registry,
      contractInterface,
      deploymentBlock: 100,
      requestDelayMs: 0,
    });
    expect((await reader.scan()).map((event) => event.logIndex)).toEqual([1]);
  });
});
