export const DEFAULT_EVENT_SCAN_BLOCK_CHUNK = 10;

export interface ScannableEvent {
  blockNumber: number;
  transactionHash: string;
  index: number;
}

export interface EventScanOptions<TEvent extends ScannableEvent> {
  deploymentBlock: number;
  chunkSize?: number;
  getLatestBlock: () => Promise<number>;
  queryRange: (fromBlock: number, toBlock: number) => Promise<readonly TEvent[]>;
}

export class EventScanUnavailableError extends Error {
  readonly code = "SERVICE_UNAVAILABLE";
  readonly status = 503;

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "EventScanUnavailableError";
  }
}

export async function scanEventsInChunks<TEvent extends ScannableEvent>({
  deploymentBlock,
  chunkSize = DEFAULT_EVENT_SCAN_BLOCK_CHUNK,
  getLatestBlock,
  queryRange,
}: EventScanOptions<TEvent>): Promise<TEvent[]> {
  if (!Number.isSafeInteger(deploymentBlock) || deploymentBlock < 0) {
    throw new RangeError("The event scan deployment block must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError("The event scan chunk size must be a positive safe integer.");
  }

  let latestBlock: number;
  try {
    latestBlock = await getLatestBlock();
  } catch (error) {
    throw new EventScanUnavailableError("AgentRegistry latest block is temporarily unavailable.", error);
  }

  if (!Number.isSafeInteger(latestBlock) || latestBlock < deploymentBlock) return [];

  const events = new Map<string, TEvent>();
  for (let start = deploymentBlock; start <= latestBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, latestBlock);
    let chunk: readonly TEvent[];
    try {
      chunk = await queryRange(start, end);
    } catch (error) {
      throw new EventScanUnavailableError(
        `AgentRegistry event history is temporarily unavailable for blocks ${start}-${end}.`,
        error,
      );
    }

    for (const event of chunk) {
      const key = `${event.blockNumber}:${event.transactionHash.toLowerCase()}:${event.index}`;
      if (!events.has(key)) events.set(key, event);
    }
  }

  return [...events.values()].sort((left, right) =>
    left.blockNumber - right.blockNumber
    || left.index - right.index
    || left.transactionHash.localeCompare(right.transactionHash));
}
