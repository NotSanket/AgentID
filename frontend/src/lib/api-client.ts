import type { ApiErrorBody, HealthResponse } from "../types/api";

const DEFAULT_TIMEOUT_MS = 5_000;
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
    return this.request<HealthResponse>("/api/health", { signal });
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
