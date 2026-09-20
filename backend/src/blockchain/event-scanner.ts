export const DEFAULT_EVENT_SCAN_BLOCK_CHUNK = 10;
export const DEFAULT_EVENT_SCAN_REQUEST_DELAY_MS = 175;
export const DEFAULT_EVENT_SCAN_MAX_ATTEMPTS = 3;
export const DEFAULT_EVENT_SCAN_RETRY_DELAYS_MS = [300, 700] as const;

export interface ScannableEvent {
  blockNumber: number;
  transactionHash: string;
  index: number;
}

export type ProviderFailureCategory = "RATE_LIMITED" | "TRANSIENT_UNAVAILABLE" | "NON_TRANSIENT";

export interface EventScannerMetrics {
  lastScannedBlock: number | null;
  cachedEventCount: number;
  totalLogRequests: number;
}

export interface EventScannerState<TEvent extends ScannableEvent> {
  events: readonly TEvent[];
  lastScannedBlock: number | null;
}

export interface CachedEventScannerOptions<TEvent extends ScannableEvent> {
  deploymentBlock: number;
  chunkSize?: number;
  requestDelayMs?: number;
  maxAttempts?: number;
  retryDelaysMs?: readonly number[];
  getLatestBlock: () => Promise<number>;
  queryRange: (fromBlock: number, toBlock: number) => Promise<readonly TEvent[]>;
  loadInitialState?: () => Promise<EventScannerState<TEvent>>;
  persistChunk?: (events: readonly TEvent[], lastScannedBlock: number) => Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class EventScanUnavailableError extends Error {
  readonly code = "SERVICE_UNAVAILABLE";
  readonly status = 503;

  constructor(
    message: string,
    readonly category: ProviderFailureCategory,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "EventScanUnavailableError";
  }
}

export class CachedEventScanner<TEvent extends ScannableEvent> {
  private readonly chunkSize: number;
  private readonly requestDelayMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private cachedEvents = new Map<string, TEvent>();
  private lastScannedBlock: number | null = null;
  private totalLogRequests = 0;
  private inFlight?: Promise<TEvent[]>;
  private hydrated = false;

  constructor(private readonly options: CachedEventScannerOptions<TEvent>) {
    this.chunkSize = options.chunkSize ?? DEFAULT_EVENT_SCAN_BLOCK_CHUNK;
    this.requestDelayMs = options.requestDelayMs ?? DEFAULT_EVENT_SCAN_REQUEST_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_EVENT_SCAN_MAX_ATTEMPTS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_EVENT_SCAN_RETRY_DELAYS_MS;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    if (!Number.isSafeInteger(options.deploymentBlock) || options.deploymentBlock < 0) {
      throw new RangeError("The event scan deployment block must be a non-negative safe integer.");
    }
    if (!Number.isSafeInteger(this.chunkSize) || this.chunkSize < 1) {
      throw new RangeError("The event scan chunk size must be a positive safe integer.");
    }
    if (!Number.isSafeInteger(this.requestDelayMs) || this.requestDelayMs < 0) {
      throw new RangeError("The event scan request delay must be a non-negative safe integer.");
    }
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new RangeError("The event scan attempt limit must be a positive safe integer.");
    }
  }

  async scan(): Promise<TEvent[]> {
    if (this.inFlight) return this.inFlight;
    const operation = this.performScan();
    this.inFlight = operation;
    try {
      return await operation;
    } finally {
      if (this.inFlight === operation) this.inFlight = undefined;
    }
  }

  metrics(): EventScannerMetrics {
    return {
      lastScannedBlock: this.lastScannedBlock,
      cachedEventCount: this.cachedEvents.size,
      totalLogRequests: this.totalLogRequests,
    };
  }

  private async performScan(): Promise<TEvent[]> {
    await this.hydrate();
    const latestBlock = await this.latestBlockWithRetries();

    const startBlock = this.lastScannedBlock === null
      ? this.options.deploymentBlock
      : Math.max(this.options.deploymentBlock, this.lastScannedBlock + 1);
    if (!Number.isSafeInteger(latestBlock) || latestBlock < startBlock) return this.sortedEvents(this.cachedEvents);

    const stagedEvents = new Map(this.cachedEvents);
    let chunkIndex = 0;
    for (let start = startBlock; start <= latestBlock; start += this.chunkSize) {
      const end = Math.min(start + this.chunkSize - 1, latestBlock);
      if (chunkIndex > 0 && this.requestDelayMs > 0) await this.sleep(this.requestDelayMs);
      const chunk = await this.queryWithRetries(start, end);
      await this.options.persistChunk?.(chunk, end);
      for (const event of chunk) {
        const key = `${event.blockNumber}:${event.transactionHash.toLowerCase()}:${event.index}`;
        if (!stagedEvents.has(key)) stagedEvents.set(key, event);
      }
      chunkIndex += 1;
    }

    this.cachedEvents = stagedEvents;
    this.lastScannedBlock = latestBlock;
    return this.sortedEvents(this.cachedEvents);
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (!this.options.loadInitialState) {
      this.hydrated = true;
      return;
    }
    const state = await this.options.loadInitialState();
    if (state.lastScannedBlock !== null
      && (!Number.isSafeInteger(state.lastScannedBlock) || state.lastScannedBlock < 0)) {
      throw new RangeError("The persisted event scan checkpoint must be a non-negative safe integer.");
    }
    const hydratedEvents = new Map<string, TEvent>();
    for (const event of state.events) {
      const key = `${event.blockNumber}:${event.transactionHash.toLowerCase()}:${event.index}`;
      hydratedEvents.set(key, event);
    }
    this.cachedEvents = hydratedEvents;
    this.lastScannedBlock = state.lastScannedBlock;
    this.hydrated = true;
  }

  private async queryWithRetries(fromBlock: number, toBlock: number): Promise<readonly TEvent[]> {
    let category: ProviderFailureCategory = "NON_TRANSIENT";
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      this.totalLogRequests += 1;
      try {
        return await this.options.queryRange(fromBlock, toBlock);
      } catch (error) {
        category = classifyProviderFailure(error);
        if (category === "NON_TRANSIENT" || attempt === this.maxAttempts) {
          throw new EventScanUnavailableError(
            `AgentRegistry event history is temporarily unavailable for blocks ${fromBlock}-${toBlock}.`,
            category,
            attempt,
          );
        }
        const fallbackDelay = DEFAULT_EVENT_SCAN_RETRY_DELAYS_MS.at(-1) ?? 700;
        await this.sleep(this.retryDelaysMs[attempt - 1] ?? fallbackDelay * attempt);
      }
    }
    throw new EventScanUnavailableError(
      `AgentRegistry event history is temporarily unavailable for blocks ${fromBlock}-${toBlock}.`,
      category,
      this.maxAttempts,
    );
  }

  private async latestBlockWithRetries(): Promise<number> {
    let category: ProviderFailureCategory = "NON_TRANSIENT";
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.options.getLatestBlock();
      } catch (error) {
        category = classifyProviderFailure(error);
        if (category === "NON_TRANSIENT" || attempt === this.maxAttempts) {
          throw new EventScanUnavailableError(
            "AgentRegistry latest block is temporarily unavailable.",
            category,
            attempt,
          );
        }
        const fallbackDelay = DEFAULT_EVENT_SCAN_RETRY_DELAYS_MS.at(-1) ?? 700;
        await this.sleep(this.retryDelaysMs[attempt - 1] ?? fallbackDelay * attempt);
      }
    }
    throw new EventScanUnavailableError(
      "AgentRegistry latest block is temporarily unavailable.",
      category,
      this.maxAttempts,
    );
  }

  private sortedEvents(events: Map<string, TEvent>) {
    return [...events.values()].sort((left, right) =>
      left.blockNumber - right.blockNumber
      || left.index - right.index
      || left.transactionHash.localeCompare(right.transactionHash));
  }
}

export function classifyProviderFailure(error: unknown): ProviderFailureCategory {
  const strings: string[] = [];
  const numbers: number[] = [];
  const queue: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const seen = new Set<unknown>();
  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (value === null || value === undefined || depth > 4 || seen.has(value)) continue;
    if (typeof value === "string") { strings.push(value); continue; }
    if (typeof value === "number") { numbers.push(value); continue; }
    if (typeof value !== "object") continue;
    seen.add(value);
    const record = value as Record<string, unknown>;
    for (const key of ["message", "shortMessage", "reason", "code", "status", "statusCode"]) {
      const nested = record[key];
      if (typeof nested === "string") strings.push(nested);
      if (typeof nested === "number") numbers.push(nested);
    }
    for (const key of ["error", "info", "cause", "response"]) {
      if (record[key] !== undefined) queue.push({ value: record[key], depth: depth + 1 });
    }
  }

  const text = strings.join(" ").toLowerCase();
  if (numbers.includes(429) || numbers.includes(-32005)
    || /rate.?limit|too many requests|throughput|compute units?|capacity exceeded/.test(text)) {
    return "RATE_LIMITED";
  }
  if (/unauthori[sz]ed|forbidden|invalid (api|access) key|authentication failed|invalid params?/.test(text)
    || numbers.some((value) => value === 401 || value === 403 || value === -32600 || value === -32602)) {
    return "NON_TRANSIENT";
  }
  if (numbers.some((value) => value >= 500 && value <= 599)
    || /timeout|timed out|temporar|network error|socket|econnreset|etimedout|gateway|service unavailable|server error/.test(text)
    || strings.some((value) => ["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT"].includes(value.toUpperCase()))) {
    return "TRANSIENT_UNAVAILABLE";
  }
  return "NON_TRANSIENT";
}
