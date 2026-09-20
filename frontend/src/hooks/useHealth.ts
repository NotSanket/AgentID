import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import type { HealthResponse } from "../types/api";

export type HealthState =
  | { phase: "loading"; data: null; error: null }
  | { phase: "online"; data: HealthResponse; error: null }
  | { phase: "offline"; data: HealthResponse | null; error: string };

export function useHealth(pollIntervalMs = 20_000) {
  const [state, setState] = useState<HealthState>({ phase: "loading", data: null, error: null });

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await apiClient.health(signal);
      setState(data.blockchain.connected
        ? { phase: "online", data, error: null }
        : { phase: "offline", data, error: data.blockchain.error ?? "Blockchain unavailable." });
    } catch (error) {
      if (signal?.aborted) return;
      setState({ phase: "offline", data: null, error: error instanceof Error ? error.message : "System unavailable." });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const intervalId = window.setInterval(() => void refresh(controller.signal), pollIntervalMs);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs, refresh]);

  return { ...state, refresh: () => refresh() };
}
