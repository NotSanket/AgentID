import type { BlockchainService } from "../blockchain/blockchain-service.js";
import type { InteractionRecord, InteractionStore } from "../persistence/types.js";
import type { AuditEvent, AuditStore } from "../stores/audit-store.js";
import type { MetadataService } from "./metadata-service.js";

const PAGE_SIZE = 100;

export type AnalyticsRange = "1h" | "24h" | "7d" | "all";

export class Stage7InsightsService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly metadata: MetadataService,
    private readonly auditStore: AuditStore,
    private readonly interactionStore: InteractionStore,
  ) {}

  async trustGraph() {
    const [{ data: agents, metadataAvailable, warning }, audits, interactions] = await Promise.all([
      this.metadata.listWithStatus(), this.allAudits(), this.allInteractions(),
    ]);
    const known = new Set(agents.map((agent) => agent.agentId));
    const edgeMap = new Map<string, { source: string; target: string; verified: number; blocked: number; actions: Set<string>; lastActivity: string }>();
    const add = (source: string | undefined, target: string | undefined, verified: number, blocked: number, action: string | undefined, at: string) => {
      if (!source || !target || !known.has(source) || !known.has(target)) return;
      const key = `${source}\u0000${target}`;
      const edge = edgeMap.get(key) ?? { source, target, verified: 0, blocked: 0, actions: new Set<string>(), lastActivity: at };
      edge.verified += verified; edge.blocked += blocked;
      if (action) edge.actions.add(action);
      if (at > edge.lastActivity) edge.lastActivity = at;
      edgeMap.set(key, edge);
    };
    interactions.forEach((item) => add(item.senderAgentId, item.receiverAgentId, 1, 0, item.action, item.createdAt));
    audits.filter((item) => item.result === "BLOCKED").forEach((item) => add(item.senderAgentId, item.receiverAgentId, 0, 1, item.action, item.timestamp));
    const lifecycle = await Promise.all(agents.map((agent) => this.blockchain.getLifecycleEvents(agent.agentId)));
    return {
      nodes: agents.map((agent, index) => ({ ...agent, registrationBlock: lifecycle[index]?.find((event) => event.type === "Registered")?.blockNumber ?? null })),
      edges: [...edgeMap.values()].map((edge) => ({ ...edge, actions: [...edge.actions] })),
      metadataAvailable,
      ...(warning ? { warning } : {}),
      source: "ON_CHAIN_REGISTRY_AND_PERSISTED_AUTHENTICATION_ACTIVITY",
    };
  }

  async analytics(range: AnalyticsRange) {
    const [agents, audits, interactions] = await Promise.all([
      this.blockchain.listAgents(), this.allAudits(), this.allInteractions(),
    ]);
    const cutoff = range === "all" ? 0 : Date.now() - ({ "1h": 3_600_000, "24h": 86_400_000, "7d": 604_800_000 }[range]);
    const filteredAudits = audits.filter((item) => Date.parse(item.timestamp) >= cutoff);
    const filteredInteractions = interactions.filter((item) => Date.parse(item.createdAt) >= cutoff);
    const activeIdentityIds = new Set(agents.filter((agent) => agent.status === "Active").map((agent) => agent.agentId));
    const participatingActiveIds = new Set(filteredInteractions.flatMap((item) => [item.senderAgentId, item.receiverAgentId]).filter((agentId) => activeIdentityIds.has(agentId)));
    const verified = filteredAudits.filter((item) => item.result === "VERIFIED").length;
    const blocked = filteredAudits.length - verified;
    const blockedReasons = countBy(filteredAudits.filter((item) => item.result === "BLOCKED"), (item) => item.code);
    const activeAgents = countBy(filteredInteractions.flatMap((item) => [item.senderAgentId, item.receiverAgentId]), (item) => item);
    const pairs = countBy(filteredInteractions, (item) => `${item.senderAgentId} → ${item.receiverAgentId}`);
    const lifecycle = (await Promise.all(agents.map((agent) => this.blockchain.getLifecycleEvents(agent.agentId)))).flat();
    const filteredLifecycle = lifecycle.filter((item) => Number(item.timestamp) * 1000 >= cutoff);
    return {
      range,
      generatedAt: new Date().toISOString(),
      metrics: {
        identities: agents.length,
        activeIdentities: agents.filter((agent) => agent.status === "Active").length,
        revokedIdentities: agents.filter((agent) => agent.status === "Revoked").length,
        verificationAttempts: filteredAudits.length,
        verifiedRequests: verified,
        blockedRequests: blocked,
        successRate: filteredAudits.length ? Number((verified / filteredAudits.length * 100).toFixed(2)) : 0,
        interactions: filteredInteractions.length,
        uniqueActiveAgents: participatingActiveIds.size,
      },
      verificationSeries: timeSeries(filteredAudits, (item) => item.timestamp, (item) => item.result),
      interactionSeries: timeSeries(filteredInteractions, (item) => item.createdAt, () => "INTERACTION"),
      blockedReasons: entries(blockedReasons),
      activeAgents: entries(activeAgents),
      communicationPairs: entries(pairs),
      lifecycleActivity: entries(countBy(filteredLifecycle, (item) => item.type)),
      source: "REGISTRY_AUDIT_INTERACTIONS_AND_BLOCKCHAIN_EVENTS",
    };
  }

  async explorer(limit = 8, query = "") {
    const health = await this.blockchain.health();
    const agents = await this.blockchain.listAgents();
    const events = (await Promise.all(agents.map((agent) => this.blockchain.getLifecycleEvents(agent.agentId))))
      .flat().sort((a, b) => b.blockNumber - a.blockNumber);
    const latest = health.latestBlock ?? 0;
    const blockNumbers = Array.from({ length: Math.min(limit, latest + 1) }, (_, index) => latest - index);
    const blocks = (await Promise.all(blockNumbers.map(async (number) => {
      const block = await this.blockchain.provider.getBlock(number);
      return block ? { number: block.number, hash: block.hash, parentHash: block.parentHash, timestamp: block.timestamp, transactionCount: block.transactions.length } : null;
    }))).filter((block): block is NonNullable<typeof block> => block !== null);
    const transactions = (await Promise.all(events.slice(0, 100).map(async (event) => {
      const [tx, receipt, block] = await Promise.all([
        this.blockchain.provider.getTransaction(event.transactionHash),
        this.blockchain.provider.getTransactionReceipt(event.transactionHash),
        this.blockchain.provider.getBlock(event.blockNumber),
      ]);
      return { hash: event.transactionHash, blockNumber: event.blockNumber, from: tx?.from ?? event.owner, to: tx?.to ?? this.blockchain.address, operation: event.type, status: receipt?.status === 1 ? "CONFIRMED" : "FAILED", gasUsed: receipt?.gasUsed.toString() ?? "0", timestamp: block?.timestamp ?? Number(event.timestamp), agentId: event.agentId, owner: event.owner };
    }))).filter((item, index, all) => all.findIndex((candidate) => candidate.hash === item.hash) === index);
    const needle = query.trim().toLowerCase();
    const matches = !needle ? { agents: [], events: [], transactions: [], blocks: [] } : {
      agents: agents.filter((item) => `${item.agentId} ${item.owner} ${item.name} ${item.organization}`.toLowerCase().includes(needle)),
      events: events.filter((item) => `${item.agentId} ${item.owner} ${item.transactionHash} ${item.blockNumber}`.toLowerCase().includes(needle)),
      transactions: transactions.filter((item) => `${item.hash} ${item.agentId} ${item.from} ${item.to} ${item.blockNumber}`.toLowerCase().includes(needle)),
      blocks: blocks.filter((item) => `${item.number} ${item.hash}`.toLowerCase().includes(needle)),
    };
    const gasByOperation = [...new Set(transactions.map((item) => item.operation))].map((operation) => {
      const rows = transactions.filter((item) => item.operation === operation);
      const total = rows.reduce((sum, item) => sum + BigInt(item.gasUsed), 0n);
      return { operation, count: rows.length, averageGasUsed: rows.length ? (total / BigInt(rows.length)).toString() : "0" };
    });
    return { network: health, contractAddress: this.blockchain.address, blocks, events: events.slice(0, limit * 4), transactions: transactions.slice(0, limit * 4), gasByOperation, matches, source: "LOCAL_ETHEREUM_RPC" };
  }

  private async allAudits() {
    const items: AuditEvent[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.auditStore.list({ limit: PAGE_SIZE, offset }); items.push(...page.events);
      if (items.length >= page.total) return items;
    }
  }
  private async allInteractions() {
    const items: InteractionRecord[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.interactionStore.list({ limit: PAGE_SIZE, offset }); items.push(...page.items);
      if (items.length >= page.total) return items;
    }
  }
}

function countBy<T>(items: T[], key: (item: T) => string) { const out: Record<string, number> = {}; items.forEach((item) => { const value = key(item); out[value] = (out[value] ?? 0) + 1; }); return out; }
function entries(values: Record<string, number>) { return Object.entries(values).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }
function timeSeries<T>(items: T[], at: (item: T) => string, category: (item: T) => string) {
  const grouped = new Map<string, Record<string, number>>();
  items.forEach((item) => { const bucket = new Date(at(item)).toISOString().slice(0, 13) + ":00:00.000Z"; const row = grouped.get(bucket) ?? {}; const key = category(item); row[key] = (row[key] ?? 0) + 1; grouped.set(bucket, row); });
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([timestamp, values]) => ({ timestamp, ...values }));
}
