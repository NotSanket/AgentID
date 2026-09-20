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
  NETWORK_NAME: z.string().trim().min(1).optional(),
  REQUEST_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  CLOCK_SKEW_SECONDS: z.coerce.number().int().nonnegative().default(30),
  EVENT_SCAN_BLOCK_CHUNK: z.coerce.number().int().positive().default(10),
  FRONTEND_ORIGINS: z.string()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.url()).min(1)),
  SUPABASE_ENABLED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SUPABASE_URL: z.string().trim().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ENABLE_DEMO_SIGNING: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
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
  deploymentBlock: number;
  eventScanBlockChunk: number;
  requestMaxAgeSeconds: number;
  clockSkewSeconds: number;
  frontendOrigins?: string[];
  supabaseEnabled: boolean;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  nodeEnv: "development" | "test" | "production";
  enableDemoSigning?: boolean;
}

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const env = environmentSchema.parse(environment);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(here, "../../..");
  const defaultManifestFile = env.CHAIN_ID === 11155111 || env.NETWORK_NAME?.toLowerCase() === "sepolia"
    ? "sepolia.json"
    : "localhost.json";
  const manifestPath = path.resolve(
    environment.DEPLOYMENT_MANIFEST_PATH ??
      path.join(workspaceRoot, "blockchain/deployments", defaultManifestFile),
  );
  const defaultArtifactPath = path.join(
    workspaceRoot,
    "blockchain/artifacts/contracts/AgentRegistry.sol/AgentRegistry.json",
  );

  let manifest: z.infer<typeof manifestSchema> | undefined;
  if (existsSync(manifestPath)) {
    manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  }

  const registryAddress = env.AGENT_REGISTRY_ADDRESS || manifest?.address || "";
  const expectedChainId = env.CHAIN_ID ?? manifest?.chainId ?? 31337;
  if (env.NODE_ENV !== "development" && env.ENABLE_DEMO_SIGNING) {
    throw new Error("ENABLE_DEMO_SIGNING must be false outside development.");
  }
  if (!registryAddress) {
    throw new Error("AGENT_REGISTRY_ADDRESS or a valid deployment manifest is required.");
  }

  return {
    port: env.PORT,
    rpcUrl: env.RPC_URL,
    registryAddress,
    expectedChainId,
    networkName: env.NETWORK_NAME ?? manifest?.network ?? (expectedChainId === 31337 ? "localhost" : "configured-network"),
    manifestPath,
    artifactPath: manifest?.abiArtifact
      ? path.resolve(path.dirname(manifestPath), manifest.abiArtifact)
      : defaultArtifactPath,
    deploymentBlock: manifest?.deployedAtBlock ?? 0,
    eventScanBlockChunk: env.EVENT_SCAN_BLOCK_CHUNK,
    requestMaxAgeSeconds: env.REQUEST_MAX_AGE_SECONDS,
    clockSkewSeconds: env.CLOCK_SKEW_SECONDS,
    frontendOrigins: env.FRONTEND_ORIGINS,
    supabaseEnabled: env.SUPABASE_ENABLED,
    supabaseUrl: env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    nodeEnv: env.NODE_ENV,
    enableDemoSigning: env.ENABLE_DEMO_SIGNING,
  };
}
