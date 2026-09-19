import type { RegistryReader } from "../domain/types.js";
import type { AuditEvent, AuditStore } from "../stores/audit-store.js";
import type { InteractionStore } from "../persistence/types.js";

const BLOCKED_CODES = [
  "INVALID_REQUEST",
  "INVALID_SIGNATURE",
  "UNKNOWN_WALLET",
  "UNKNOWN_AGENT",
  "UNKNOWN_RECEIVER",
  "RECEIVER_REVOKED",
  "WALLET_MISMATCH",
  "AGENT_REVOKED",
  "REQUEST_EXPIRED",
  "NONCE_REUSED",
  "SERVICE_UNAVAILABLE",
] as const;

export interface AnalyticsSummary {
  totalVerificationAttempts: number;
  verifiedRequests: number;
  blockedRequests: number;
  successRate: number;
  totalInteractions: number;
  uniqueActiveAgentsInInteractions: number;
  blockedByReason: Record<string, number>;
  recentActivity: AuditEvent[];
}

export class AnalyticsService {
  constructor(
    private readonly auditStore: AuditStore,
    private readonly interactionStore: InteractionStore,
    private readonly registry: RegistryReader,
  ) {}

  async summary(): Promise<AnalyticsSummary> {
    const [verifiedRequests, blockedRequests, totalInteractions, agentIds, recent, blockedByReason] =
      await Promise.all([
        this.auditStore.count({ result: "VERIFIED" }),
        this.auditStore.count({ result: "BLOCKED" }),
        this.interactionStore.count(),
        this.interactionStore.uniqueAgentIds(),
        this.auditStore.list({ limit: 10, offset: 0 }),
        this.securityBreakdown(),
      ]);
    const activeRecords = await Promise.all(agentIds.map((agentId) => this.registry.getAgent(agentId)));
    const totalVerificationAttempts = verifiedRequests + blockedRequests;
    return {
      totalVerificationAttempts,
      verifiedRequests,
      blockedRequests,
      successRate: totalVerificationAttempts === 0
        ? 0
        : Number(((verifiedRequests / totalVerificationAttempts) * 100).toFixed(2)),
      totalInteractions,
      uniqueActiveAgentsInInteractions: activeRecords.filter((record) => record?.status === "Active").length,
      blockedByReason,
      recentActivity: recent.events,
    };
  }

  async security() {
    const [blockedRequests, blockedByReason] = await Promise.all([
      this.auditStore.count({ result: "BLOCKED" }),
      this.securityBreakdown(),
    ]);
    return { blockedRequests, blockedByReason };
  }

  private async securityBreakdown(): Promise<Record<string, number>> {
    const counts = await Promise.all(BLOCKED_CODES.map(async (code) => [
      code,
      await this.auditStore.count({ result: "BLOCKED", code }),
    ] as const));
    return Object.fromEntries(counts.filter(([, count]) => count > 0));
  }
}
