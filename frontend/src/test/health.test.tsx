import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthProvider } from "../components/system/HealthProvider";
import { NetworkStatus } from "../components/system/NetworkStatus";
import { apiTimeoutForEnvironment } from "../lib/api-client";
import { mockHealthResponse } from "./fixtures";

describe("NetworkStatus", () => {
  it("allows a Render cold start in production without slowing local feedback", () => {
    expect(apiTimeoutForEnvironment(true)).toBe(75_000);
    expect(apiTimeoutForEnvironment(false)).toBe(12_000);
  });

  it("recovers from a delayed health response", async () => {
    let resolveHealth!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { resolveHealth = resolve; }));
    render(<HealthProvider><NetworkStatus /></HealthProvider>);
    expect(screen.getByText("CHECKING SYSTEM")).toBeInTheDocument();
    resolveHealth(new Response(JSON.stringify({
      status: "ok", backend: "ok", persistenceMode: "SUPABASE", supabaseConnected: true, demoSigningEnabled: false,
      blockchain: { connected: true, network: "Sepolia", chainId: 11155111, expectedChainId: 11155111, latestBlock: 11745089, registryAddress: "0xA8fC4db5eFD8F6a316fbAB81Fb4cb83A8826d42a", contractReachable: true },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(await screen.findByText("SYSTEM ONLINE")).toBeInTheDocument();
    expect(screen.getByText(/SEPOLIA.*CHAIN 11155111/i)).toBeInTheDocument();
  });

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
