import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthProvider } from "../components/system/HealthProvider";
import { NetworkStatus } from "../components/system/NetworkStatus";
import { mockHealthResponse } from "./fixtures";

describe("NetworkStatus", () => {
  it("renders live backend, blockchain, chain, and persistence state", async () => {
    mockHealthResponse();
    render(<HealthProvider><NetworkStatus /></HealthProvider>);
    expect(await screen.findByText("SYSTEM ONLINE")).toBeInTheDocument();
    expect(screen.getByText(/LOCALHOST · CHAIN 31337/i)).toBeInTheDocument();
    expect(screen.getByText("SUPABASE")).toBeInTheDocument();
  });

  it("fails gracefully when the backend is offline", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("connection refused"));
    render(<HealthProvider><NetworkStatus /></HealthProvider>);
    expect(await screen.findByText("SYSTEM OFFLINE")).toBeInTheDocument();
    expect(screen.getByText("BACKEND UNREACHABLE")).toBeInTheDocument();
  });

  it("distinguishes a connected backend from an unavailable blockchain", async () => {
    const degraded = {
      status: "degraded", backend: "ok", persistenceMode: "IN_MEMORY", supabaseConnected: false, demoSigningEnabled: false,
      blockchain: { connected: false, network: "localhost", chainId: null, expectedChainId: 31337, latestBlock: null, registryAddress: null, contractReachable: false, error: "RPC unavailable." },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(degraded), { status: 503, headers: { "Content-Type": "application/json" } }));
    render(<HealthProvider><NetworkStatus /></HealthProvider>);
    expect(await screen.findByText("SYSTEM DEGRADED")).toBeInTheDocument();
    expect(screen.getByText("BACKEND CONNECTED · BLOCKCHAIN UNAVAILABLE")).toBeInTheDocument();
  });
});
