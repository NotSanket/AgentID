import { getAddress, type Interface, type Log } from "ethers";
import type { IdentityLifecycleEvent, IdentityLifecycleEventType } from "../domain/types.js";
import type { ChainEventIndexStore, ChainEventNamespace } from "../persistence/types.js";
import {
  CachedEventScanner,
  type CachedEventScannerOptions,
  type EventScannerMetrics,
  type ScannableEvent,
} from "./event-scanner.js";

export interface DecodedAgentRegistryEvent extends IdentityLifecycleEvent, ScannableEvent {
  logIndex: number;
}

export interface RegistryLogProvider {
  getBlockNumber(): Promise<number>;
  getLogs(filter: { address: string; fromBlock: number; toBlock: number }): Promise<Log[]>;
}

export interface AgentRegistryEventReaderOptions {
  provider: RegistryLogProvider;
  contractAddress: string;
  contractInterface: Interface;
  chainId?: number;
  eventIndexStore?: ChainEventIndexStore;
  deploymentBlock: number;
  chunkSize?: number;
  requestDelayMs?: number;
  maxAttempts?: number;
  retryDelaysMs?: readonly number[];
  sleep?: CachedEventScannerOptions<DecodedAgentRegistryEvent>["sleep"];
}

const lifecycleTypes: Readonly<Record<string, IdentityLifecycleEventType>> = {
  AgentRegistered: "Registered",
  AgentUpdated: "Updated",
  AgentRevoked: "Revoked",
  AgentReactivated: "Reactivated",
};

export class AgentRegistryEventReader {
  private readonly scanner: CachedEventScanner<DecodedAgentRegistryEvent>;

  constructor(private readonly options: AgentRegistryEventReaderOptions) {
    const namespace: ChainEventNamespace | undefined = options.eventIndexStore && options.chainId !== undefined
      ? { chainId: options.chainId, contractAddress: getAddress(options.contractAddress) }
      : undefined;
    this.scanner = new CachedEventScanner({
      deploymentBlock: options.deploymentBlock,
      chunkSize: options.chunkSize,
      requestDelayMs: options.requestDelayMs,
      maxAttempts: options.maxAttempts,
      retryDelaysMs: options.retryDelaysMs,
      sleep: options.sleep,
      getLatestBlock: () => options.provider.getBlockNumber(),
      queryRange: (fromBlock, toBlock) => this.readRange(fromBlock, toBlock),
      loadInitialState: namespace
        ? async () => {
          const state = await options.eventIndexStore!.load(namespace);
          return {
            lastScannedBlock: state.lastScannedBlock,
            events: state.events.map((event) => ({ ...event, index: event.logIndex })),
          };
        }
        : undefined,
      persistChunk: namespace
        ? (events, lastScannedBlock) => options.eventIndexStore!.persistChunk(namespace, events, lastScannedBlock)
        : undefined,
    });
  }

  scan(): Promise<DecodedAgentRegistryEvent[]> {
    return this.scanner.scan();
  }

  metrics(): EventScannerMetrics {
    return this.scanner.metrics();
  }

  private async readRange(fromBlock: number, toBlock: number) {
    const logs = await this.options.provider.getLogs({
      address: getAddress(this.options.contractAddress),
      fromBlock,
      toBlock,
    });
    return logs.flatMap((log): DecodedAgentRegistryEvent[] => {
      try {
        const parsed = this.options.contractInterface.parseLog({ topics: log.topics, data: log.data });
        const type = parsed ? lifecycleTypes[parsed.name] : undefined;
        if (!parsed || !type || typeof parsed.args.agentId !== "string") return [];
        return [{
          type,
          agentId: parsed.args.agentId,
          owner: getAddress(parsed.args.owner),
          timestamp: parsed.args.timestamp.toString(),
          blockNumber: log.blockNumber,
          logIndex: log.index,
          index: log.index,
          transactionHash: log.transactionHash,
        }];
      } catch {
        return [];
      }
    });
  }
}
