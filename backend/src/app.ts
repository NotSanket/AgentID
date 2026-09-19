import express, { type NextFunction, type Request, type Response } from "express";
import { isAddress } from "ethers";
import { z } from "zod";
import type { AuthenticationService } from "./auth/authentication-service.js";
import { signedRequestSchema } from "./auth/request-schema.js";
import type { CommunicationService } from "./services/communication-service.js";
import type { AuditStore } from "./stores/audit-store.js";
import type { RegistryReader } from "./domain/types.js";
import type { BlockchainHealth } from "./blockchain/blockchain-service.js";
import type { IdentityContractConfig, IdentityLifecycleEvent } from "./domain/types.js";
import type { InteractionStore, PersistenceStatus } from "./persistence/types.js";
import type { AnalyticsService } from "./services/analytics-service.js";
import { MetadataAuthorizationError, type MetadataService } from "./services/metadata-service.js";
import { DemoIdentityWriteService, IdentityWriteError } from "./services/identity-write-service.js";

const paginationFields = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

const auditQuerySchema = z.object({
  ...paginationFields,
  result: z.enum(["VERIFIED", "BLOCKED"]).optional(),
  code: z.string().trim().min(1).max(64).optional(),
  senderAgentId: z.string().trim().min(1).max(64).optional(),
  receiverAgentId: z.string().trim().min(1).max(64).optional(),
});

const interactionQuerySchema = z.object({
  ...paginationFields,
  senderAgentId: z.string().trim().min(1).max(64).optional(),
  receiverAgentId: z.string().trim().min(1).max(64).optional(),
  action: z.string().trim().min(1).max(64).optional(),
});

const agentIdSchema = z.string().trim().min(3).max(64).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
const metadataSchema = z.object({
  displayName: z.string().trim().max(128).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(64).nullable().optional(),
  capabilities: z.array(z.string().trim().min(1).max(64).regex(/^[A-Z0-9_]+$/)).max(24),
  avatarKey: z.string().trim().max(64).nullable().optional(),
  accentTheme: z.string().trim().max(64).nullable().optional(),
});
const identityProfileSchema = z.object({
  wallet: z.string().refine(isAddress),
  agentId: agentIdSchema,
  name: z.string().trim().min(1).max(128),
  organization: z.string().trim().min(1).max(128),
  metadataURI: z.string().trim().max(512).optional(),
  metadata: metadataSchema.optional(),
});
const lifecycleSchema = z.object({ wallet: z.string().refine(isAddress) });
const authorizedMetadataSchema = z.object({
  metadata: metadataSchema,
  authorization: z.object({
    wallet: z.string().refine(isAddress),
    signature: z.string().min(1).max(1024),
    issuedAt: z.number().int().positive(),
  }),
});

export interface ApiBlockchain extends RegistryReader {
  health(): Promise<BlockchainHealth>;
  contractConfig(): Promise<IdentityContractConfig>;
  getLifecycleEvents(agentId: string): Promise<IdentityLifecycleEvent[]>;
}

export interface AppDependencies {
  blockchain: ApiBlockchain;
  authentication: AuthenticationService;
  communication: CommunicationService;
  auditStore: AuditStore;
  interactionStore: InteractionStore;
  analytics: AnalyticsService;
  metadata: MetadataService;
  demoWrites?: DemoIdentityWriteService;
  persistenceStatus: PersistenceStatus;
  frontendOrigins?: readonly string[];
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const trustedOrigins = new Set(dependencies.frontendOrigins ?? ["http://localhost:5173", "http://127.0.0.1:5173"]);
    const requestOrigin = request.headers.origin;
    if (requestOrigin && trustedOrigins.has(requestOrigin)) {
      response.setHeader("Access-Control-Allow-Origin", requestOrigin);
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", async (_request, response) => {
    const blockchain = await dependencies.blockchain.health();
    response.status(blockchain.connected ? 200 : 503).json({
      status: blockchain.connected ? "ok" : "degraded",
      backend: "ok",
      blockchain,
      persistenceMode: dependencies.persistenceStatus.mode,
      supabaseConnected: dependencies.persistenceStatus.supabaseConnected,
      demoSigningEnabled: dependencies.demoWrites?.isEnabled() ?? false,
      ...(dependencies.persistenceStatus.warning ? { persistenceWarning: dependencies.persistenceStatus.warning } : {}),
    });
  });

  app.get("/api/network", async (_request, response) => {
    response.json(await dependencies.blockchain.health());
  });

  app.get("/api/identity/config", async (_request, response) => {
    response.json(await dependencies.blockchain.contractConfig());
  });

  app.get("/api/registry", async (_request, response) => {
    const result = await dependencies.metadata.listWithStatus();
    response.json({ agents: result.data, metadataAvailable: result.metadataAvailable, ...(result.warning ? { warning: result.warning } : {}) });
  });

  app.get("/api/registry/:agentId", async (request, response) => {
    const result = await dependencies.metadata.getByAgentIdWithStatus(request.params.agentId);
    response.status(result.data ? 200 : 404).json(result.data
      ? { agent: result.data, metadataAvailable: result.metadataAvailable, ...(result.warning ? { warning: result.warning } : {}) }
      : { code: "UNKNOWN_AGENT", reason: "No on-chain identity exists for that AgentID." });
  });

  app.get("/api/agents", async (_request, response) => {
    response.json({ agents: await dependencies.blockchain.listAgents() });
  });

  app.get("/api/agents/wallet/:address", async (request, response) => {
    if (!isAddress(request.params.address)) {
      response.status(400).json({ code: "INVALID_ADDRESS", reason: "A valid Ethereum address is required." });
      return;
    }
    const agent = await dependencies.blockchain.getAgentByWallet(request.params.address);
    response.status(agent ? 200 : 404).json(agent ? { agent } : { code: "UNKNOWN_WALLET" });
  });

  app.get("/api/agents/:agentId/availability", async (request, response) => {
    const parsed = agentIdSchema.safeParse(request.params.agentId);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_AGENT_ID", reason: "Use uppercase letters, numbers, and hyphens." });
      return;
    }
    const agent = await dependencies.blockchain.getAgent(parsed.data);
    response.json({ agentId: parsed.data, available: !agent });
  });

  app.get("/api/agents/:agentId/events", async (request, response) => {
    const agent = await dependencies.blockchain.getAgent(request.params.agentId);
    if (!agent) {
      response.status(404).json({ code: "UNKNOWN_AGENT", reason: "No on-chain identity exists for that AgentID." });
      return;
    }
    response.json({ events: await dependencies.blockchain.getLifecycleEvents(request.params.agentId) });
  });

  app.get("/api/agents/:agentId", async (request, response) => {
    const agent = await dependencies.blockchain.getAgent(request.params.agentId);
    response.status(agent ? 200 : 404).json(agent ? { agent } : { code: "UNKNOWN_AGENT" });
  });

  app.post("/api/verify", async (request, response) => {
    const parsed = signedRequestSchema.safeParse(request.body);
    const result = parsed.success
      ? await dependencies.authentication.authenticate(parsed.data.request, parsed.data.signature)
      : await dependencies.authentication.authenticate(request.body?.request, request.body?.signature ?? "");
    response.status(result.verified ? 200 : 403).json(result);
  });

  app.post("/api/communication/send", async (request, response) => {
    const parsed = signedRequestSchema.safeParse(request.body);
    const result = parsed.success
      ? await dependencies.communication.send(parsed.data.request, parsed.data.signature)
      : await dependencies.communication.send(request.body?.request, request.body?.signature ?? "");
    response.status(result.delivered ? 200 : 403).json(result);
  });

  app.get("/api/audit", async (request, response) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_QUERY", reason: "Audit query parameters are invalid." });
      return;
    }
    const page = await dependencies.auditStore.list(parsed.data);
    response.json({
      storage: dependencies.persistenceStatus.mode === "SUPABASE" ? "SUPABASE" : "OFF_CHAIN_MEMORY",
      events: page.events,
      pagination: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  app.get("/api/interactions", async (request, response) => {
    const parsed = interactionQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_QUERY", reason: "Interaction query parameters are invalid." });
      return;
    }
    const page = await dependencies.interactionStore.list(parsed.data);
    response.json({
      interactions: page.items,
      pagination: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  app.get("/api/interactions/:requestId", async (request, response) => {
    const interaction = await dependencies.interactionStore.getByRequestId(request.params.requestId);
    response.status(interaction ? 200 : 404).json(interaction ? { interaction } : { code: "INTERACTION_NOT_FOUND" });
  });

  app.get("/api/analytics/summary", async (_request, response) => {
    response.json(await dependencies.analytics.summary());
  });

  app.get("/api/analytics/security", async (_request, response) => {
    response.json(await dependencies.analytics.security());
  });

  app.get("/api/metadata/agents", async (_request, response) => {
    response.json({ agents: await dependencies.metadata.list() });
  });

  app.get("/api/metadata/agents/:agentId", async (request, response) => {
    const agent = await dependencies.metadata.getByAgentId(request.params.agentId);
    response.status(agent ? 200 : 404).json(agent ? { agent } : { code: "UNKNOWN_AGENT" });
  });

  app.put("/api/metadata/agents/:agentId", async (request, response) => {
    const parsed = authorizedMetadataSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_METADATA", reason: "Metadata or owner authorization is invalid." });
      return;
    }
    const metadata = await dependencies.metadata.authorizedUpsert({ agentId: request.params.agentId, ...parsed.data.metadata }, parsed.data.authorization);
    response.json({ metadata });
  });

  app.get("/api/demo/wallets", async (_request, response) => {
    if (!dependencies.demoWrites) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not configured.", 403);
    response.json({ wallets: await dependencies.demoWrites.listWallets(), developmentOnly: true });
  });

  app.post("/api/demo/identities", async (request, response) => {
    if (!dependencies.demoWrites) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not configured.", 403);
    const parsed = identityProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_IDENTITY", reason: "Identity registration fields are invalid." });
      return;
    }
    response.status(201).json(await dependencies.demoWrites.register(parsed.data.wallet, parsed.data));
  });

  app.put("/api/demo/identities/:agentId", async (request, response) => {
    if (!dependencies.demoWrites) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not configured.", 403);
    const parsed = identityProfileSchema.safeParse({ ...request.body, agentId: request.params.agentId });
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_IDENTITY", reason: "Identity update fields are invalid." });
      return;
    }
    response.json(await dependencies.demoWrites.update(parsed.data.wallet, parsed.data));
  });

  app.post("/api/demo/identities/:agentId/revoke", async (request, response) => {
    if (!dependencies.demoWrites) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not configured.", 403);
    const parsed = lifecycleSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_ADDRESS", reason: "A valid demo wallet address is required." });
      return;
    }
    response.json(await dependencies.demoWrites.revoke(parsed.data.wallet, request.params.agentId));
  });

  app.post("/api/demo/identities/:agentId/reactivate", async (request, response) => {
    if (!dependencies.demoWrites) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not configured.", 403);
    const parsed = lifecycleSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ code: "INVALID_ADDRESS", reason: "A valid demo wallet address is required." });
      return;
    }
    response.json(await dependencies.demoWrites.reactivate(parsed.data.wallet, request.params.agentId));
  });

  app.get("/api/security/scenarios", (_request, response) => {
    response.json({ scenarios: [
      { id: "VALID", expectedCode: "VERIFIED", description: "Registered active wallet signs an unchanged request." },
      { id: "UNKNOWN_WALLET", expectedCode: "UNKNOWN_WALLET", description: "An unregistered wallet signs the request." },
      { id: "IMPERSONATION", expectedCode: "WALLET_MISMATCH", description: "A registered wallet for another agent claims TravelAI's AgentID." },
      { id: "REVOKED_AGENT", expectedCode: "AGENT_REVOKED", description: "Correct wallet signs after its on-chain identity is revoked." },
      { id: "EXPIRED_REQUEST", expectedCode: "REQUEST_EXPIRED", description: "A valid signature carries an old timestamp." },
      { id: "REPLAY_ATTACK", expectedCode: "NONCE_REUSED", description: "An already accepted nonce is submitted again." },
      { id: "MODIFIED_PAYLOAD", expectedCode: "UNKNOWN_WALLET", description: "The payload is changed after the request is signed, so recovery no longer yields the registered signer." },
      { id: "MODIFIED_RECEIVER", expectedCode: "UNKNOWN_WALLET", description: "The receiver AgentID is changed after signing, so recovery no longer yields the registered signer." },
      { id: "MALFORMED_SIGNATURE", expectedCode: "INVALID_SIGNATURE", description: "The signature cannot be decoded safely." },
    ] });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ code: "INVALID_JSON", reason: "Request body contains malformed JSON." });
      return;
    }
    if (error instanceof IdentityWriteError || error instanceof MetadataAuthorizationError) {
      response.status(error.status).json({ code: error.code, reason: error.message });
      return;
    }
    const reason = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(503).json({ code: "SERVICE_UNAVAILABLE", reason });
  });

  return app;
}
