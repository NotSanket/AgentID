import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  RPC_URL: z.url().default("http://127.0.0.1:8545"),
  AGENT_REGISTRY_ADDRESS: z.string().optional(),
  CHAIN_ID: z.coerce.number().int().positive().optional(),
  REQUEST_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  CLOCK_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(30),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const manifestSchema = z.object({
  network: z.string(),
  chainId: z.number().int().positive(),
  contractName: z.literal("AgentRegistry"),
  address: z.string(),
  deployedAtBlock: z.number().int().nonnegative(),
  abiArtifact: z.string().optional(),
});

export interface RuntimeConfig {
  port: number;
  rpcUrl: string;
  registryAddress: string;
  expectedChainId: number;
  networkName: string;
  manifestPath: string;
  artifactPath: string;
  requestMaxAgeSeconds: number;
  clockSkewSeconds: number;
  nodeEnv: "development" | "test" | "production";
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const env = environmentSchema.parse(environment);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(here, "../../..");
  const manifestPath = path.resolve(
    environment.DEPLOYMENT_MANIFEST_PATH ??
      path.join(workspaceRoot, "blockchain/deployments/localhost.json"),
  );
  const defaultArtifactPath = path.join(
    workspaceRoot,
    "blockchain/artifacts/contracts/AgentRegistry.sol/AgentRegistry.json",
  );

  let manifest: z.infer<typeof manifestSchema> | undefined;
  if (existsSync(manifestPath)) {
    manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  }

  return {
    port: env.PORT,
    rpcUrl: env.RPC_URL,
    registryAddress: env.AGENT_REGISTRY_ADDRESS || manifest?.address || "",
    expectedChainId: env.CHAIN_ID ?? manifest?.chainId ?? 31337,
    networkName: manifest?.network ?? "localhost",
    manifestPath,
    artifactPath: manifest?.abiArtifact
      ? path.resolve(path.dirname(manifestPath), manifest.abiArtifact)
      : defaultArtifactPath,
    requestMaxAgeSeconds: env.REQUEST_MAX_AGE_SECONDS,
    clockSkewSeconds: env.CLOCK_SKEW_SECONDS,
    nodeEnv: env.NODE_ENV,
  };
}
