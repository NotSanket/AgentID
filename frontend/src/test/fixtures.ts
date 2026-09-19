import type { HealthResponse } from "../types/api";

export const onlineHealth: HealthResponse = {
  status: "ok",
  backend: "ok",
  blockchain: {
    connected: true,
    network: "localhost",
    chainId: 31337,
    expectedChainId: 31337,
    latestBlock: 12,
    registryAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    contractReachable: true,
  },
  persistenceMode: "SUPABASE",
  supabaseConnected: true,
};

export function mockHealthResponse(data = onlineHealth) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
}
