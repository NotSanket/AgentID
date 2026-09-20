import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../src/config/runtime.js";
import { REGISTRY_ADDRESS } from "./helpers.js";

const publicEnvironment = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  ENABLE_DEMO_SIGNING: "false",
  PORT: "4000",
  RPC_URL: "https://rpc.public-test.invalid",
  AGENT_REGISTRY_ADDRESS: REGISTRY_ADDRESS,
  CHAIN_ID: "11155111",
  NETWORK_NAME: "public-testnet",
  FRONTEND_ORIGINS: "https://agentid.example",
  SUPABASE_ENABLED: "true",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-server-key-placeholder",
  DEPLOYMENT_MANIFEST_PATH: "C:\\nonexistent-agentid-manifest.json",
});

describe("Stage 8 production configuration readiness", () => {
  it("accepts an explicit public RPC, chain, registry, network name, and origin", () => {
    const config = loadRuntimeConfig(publicEnvironment());
    expect(config).toMatchObject({
      nodeEnv: "production",
      enableDemoSigning: false,
      rpcUrl: "https://rpc.public-test.invalid",
      registryAddress: REGISTRY_ADDRESS,
      expectedChainId: 11155111,
      networkName: "public-testnet",
      frontendOrigins: ["https://agentid.example"],
      supabaseEnabled: true,
    });
  });

  it("rejects demo signing outside development before the server starts", () => {
    expect(() => loadRuntimeConfig({ ...publicEnvironment(), ENABLE_DEMO_SIGNING: "true" }))
      .toThrow("ENABLE_DEMO_SIGNING must be false outside development.");
  });

  it("requires a registry address or deployment manifest", () => {
    expect(() => loadRuntimeConfig({ ...publicEnvironment(), AGENT_REGISTRY_ADDRESS: "" }))
      .toThrow("AGENT_REGISTRY_ADDRESS or a valid deployment manifest is required.");
  });
});
