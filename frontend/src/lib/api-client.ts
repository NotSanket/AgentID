import type { AgentMetadataInput, AgentRecord, AnalyticsSummary, AuditEvent, DemoWallet, EnrichedAgent, HealthResponse, IdentityContractConfig, IdentityLifecycleEvent, IdentityProfileInput, IdentityWriteResponse, ApiErrorBody, AgentRequest, CommunicationCapabilities, CommunicationResult, DemoCommunicationAgent, InteractionRecord, JsonValue, Pagination, PreparedCommunication, TrustGraphResponse, AdvancedAnalytics, AnalyticsRange, ExplorerResponse, SecurityScenarioInfo, SecurityScenarioId, SecurityScenarioResult } from "../types/api";

// Live registry scans and Supabase analytics can overlap on first load.
// Keep the UI bounded, while allowing those independent local calls to settle.
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_API_BASE_URL = "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  health(signal?: AbortSignal) {
    // Degraded health uses HTTP 503 but still carries useful, non-secret diagnostics.
    return this.request<HealthResponse>("/api/health", { signal }, true);
  }

  registry(signal?: AbortSignal) { return this.request<{ agents: EnrichedAgent[]; metadataAvailable: boolean; warning?: string }>("/api/registry", { signal }); }
  registryAgent(agentId: string, signal?: AbortSignal) { return this.request<{ agent: EnrichedAgent; metadataAvailable: boolean; warning?: string }>(`/api/registry/${encodeURIComponent(agentId)}`, { signal }); }
  agent(agentId: string, signal?: AbortSignal) { return this.request<{ agent: AgentRecord }>(`/api/agents/${encodeURIComponent(agentId)}`, { signal }); }
  agentByWallet(wallet: string, signal?: AbortSignal) { return this.request<{ agent: AgentRecord }>(`/api/agents/wallet/${encodeURIComponent(wallet)}`, { signal }); }
  availability(agentId: string, signal?: AbortSignal) { return this.request<{ agentId: string; available: boolean }>(`/api/agents/${encodeURIComponent(agentId)}/availability`, { signal }); }
  lifecycle(agentId: string, signal?: AbortSignal) { return this.request<{ events: IdentityLifecycleEvent[] }>(`/api/agents/${encodeURIComponent(agentId)}/events`, { signal }); }
  identityConfig(signal?: AbortSignal) { return this.request<IdentityContractConfig>("/api/identity/config", { signal }); }
  demoWallets(signal?: AbortSignal) { return this.request<{ wallets: DemoWallet[]; developmentOnly: true }>("/api/demo/wallets", { signal }); }
  demoRegister(input: IdentityProfileInput) { return this.request<IdentityWriteResponse>("/api/demo/identities", { method: "POST", body: JSON.stringify(input) }); }
  demoUpdate(input: IdentityProfileInput) { return this.request<IdentityWriteResponse>(`/api/demo/identities/${encodeURIComponent(input.agentId)}`, { method: "PUT", body: JSON.stringify(input) }); }
  demoLifecycle(agentId: string, wallet: string, action: "revoke" | "reactivate") { return this.request<IdentityWriteResponse>(`/api/demo/identities/${encodeURIComponent(agentId)}/${action}`, { method: "POST", body: JSON.stringify({ wallet }) }); }
  updateMetadata(agentId: string, metadata: AgentMetadataInput, authorization: { wallet: string; signature: string; issuedAt: number }) { return this.request(`/api/metadata/agents/${encodeURIComponent(agentId)}`, { method: "PUT", body: JSON.stringify({ metadata, authorization }) }); }
  analytics(signal?: AbortSignal) { return this.request<AnalyticsSummary>("/api/analytics/summary", { signal }); }
  audit(signal?: AbortSignal, query: Record<string, string | number | undefined> = { limit: 8, offset: 0 }) { return this.request<{ events: AuditEvent[]; pagination: Pagination }>(`/api/audit?${toQuery(query)}`, { signal }); }
  communicationCapabilities(signal?: AbortSignal) { return this.request<CommunicationCapabilities>("/api/communication/capabilities", { signal }); }
  prepareCommunication(input: { senderAgentId: string; receiverAgentId: string; action: string; payload: JsonValue }) { return this.request<PreparedCommunication>("/api/communication/prepare", { method: "POST", body: JSON.stringify(input) }); }
  sendCommunication(request: AgentRequest, signature: string) { return this.request<CommunicationResult>("/api/communication/send", { method: "POST", body: JSON.stringify({ request, signature }) }, true); }
  demoCommunicationAgents(signal?: AbortSignal) { return this.request<{ agents: DemoCommunicationAgent[]; developmentOnly: true }>("/api/demo/communication/agents", { signal }); }
  demoCommunicationSend(wallet: string, request: AgentRequest) { return this.request<CommunicationResult>("/api/demo/communication/send", { method: "POST", body: JSON.stringify({ wallet, request }) }, true); }
  interactions(query: Record<string, string | number | undefined> = { limit: 50, offset: 0 }, signal?: AbortSignal) { return this.request<{ interactions: InteractionRecord[]; pagination: Pagination }>(`/api/interactions?${toQuery(query)}`, { signal }); }
  interaction(requestId: string, signal?: AbortSignal) { return this.request<{ interaction: InteractionRecord }>(`/api/interactions/${encodeURIComponent(requestId)}`, { signal }); }
  verifySigned(input: unknown) { return this.request<Record<string, unknown>>("/api/verify", { method: "POST", body: JSON.stringify(input) }, true); }
  trustGraph(signal?: AbortSignal) { return this.request<TrustGraphResponse>("/api/stage7/trust-graph", { signal }); }
  advancedAnalytics(range: AnalyticsRange, signal?: AbortSignal) { return this.request<AdvancedAnalytics>(`/api/stage7/analytics?range=${range}`, { signal }); }
  explorer(query = "", signal?: AbortSignal) { return this.request<ExplorerResponse>(`/api/stage7/explorer?${toQuery({ limit: 10, query })}`, { signal }); }
  securityScenarios(signal?: AbortSignal) { return this.request<{ scenarios: SecurityScenarioInfo[] }>("/api/security/scenarios", { signal }); }
  runSecurityScenario(scenario: SecurityScenarioId) { return this.request<SecurityScenarioResult>(`/api/security/scenarios/${scenario}`, { method: "POST", body: "{}" }); }

  async request<T>(path: string, init: RequestInit = {}, acceptErrorBody = false): Promise<T> {
    const timeoutController = new AbortController();
    const timeoutId = window.setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as ApiErrorBody;
        if (acceptErrorBody) return body as T;
        throw new ApiError(body.reason || `Request failed with status ${response.status}.`, response.status, body.code);
      }

      try {
        return await response.json() as T;
      } catch {
        throw new ApiError("The AgentID backend returned an invalid JSON response.", response.status, "INVALID_RESPONSE");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("The AgentID backend did not respond in time.", null, "TIMEOUT");
      }
      throw new ApiError("The AgentID backend is unavailable.", null, "OFFLINE");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

export const apiClient = new ApiClient();

function toQuery(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== "") query.set(key, String(value)); });
  return query.toString();
}
