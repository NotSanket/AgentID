import express, { type NextFunction, type Request, type Response } from "express";
import { isAddress } from "ethers";
import { z } from "zod";
import type { AuthenticationService } from "./auth/authentication-service.js";
import { signedRequestSchema } from "./auth/request-schema.js";
import type { CommunicationService } from "./services/communication-service.js";
import type { AuditStore } from "./stores/audit-store.js";
import type { RegistryReader } from "./domain/types.js";
import type { BlockchainHealth } from "./blockchain/blockchain-service.js";
import type { InteractionStore, PersistenceStatus } from "./persistence/types.js";
import type { AnalyticsService } from "./services/analytics-service.js";
import type { MetadataService } from "./services/metadata-service.js";

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

export interface ApiBlockchain extends RegistryReader {
  health(): Promise<BlockchainHealth>;
}

export interface AppDependencies {
  blockchain: ApiBlockchain;
  authentication: AuthenticationService;
  communication: CommunicationService;
  auditStore: AuditStore;
  interactionStore: InteractionStore;
  analytics: AnalyticsService;
  metadata: MetadataService;
  persistenceStatus: PersistenceStatus;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", async (_request, response) => {
    const blockchain = await dependencies.blockchain.health();
    response.status(blockchain.connected ? 200 : 503).json({
      status: blockchain.connected ? "ok" : "degraded",
      backend: "ok",
      blockchain,
      persistenceMode: dependencies.persistenceStatus.mode,
      supabaseConnected: dependencies.persistenceStatus.supabaseConnected,
      ...(dependencies.persistenceStatus.warning ? { persistenceWarning: dependencies.persistenceStatus.warning } : {}),
    });
  });

  app.get("/api/network", async (_request, response) => {
    response.json(await dependencies.blockchain.health());
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
    const reason = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(503).json({ code: "SERVICE_UNAVAILABLE", reason });
  });

  return app;
}
