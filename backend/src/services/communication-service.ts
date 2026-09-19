import type { AuthenticationService } from "../auth/authentication-service.js";
import { agentRequestSchema } from "../auth/request-schema.js";
import type { DemoAgentRouter } from "../agents/demo-agents.js";
import type { InteractionStore } from "../persistence/types.js";

export class CommunicationService {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly router: DemoAgentRouter,
    private readonly interactionStore: InteractionStore,
  ) {}

  async send(request: unknown, signature: string) {
    const startedAt = performance.now();
    const verification = await this.authentication.authenticate(request, signature);
    if (!verification.verified) return { delivered: false, verification };

    const validatedRequest = agentRequestSchema.parse(request);
    const response = await this.router.route(validatedRequest);
    const operationalWarnings: string[] = [];
    try {
      await this.interactionStore.record({
        requestId: validatedRequest.requestId,
        senderAgentId: validatedRequest.senderAgentId,
        receiverAgentId: validatedRequest.receiverAgentId,
        action: validatedRequest.action,
        requestPayload: validatedRequest.payload,
        responsePayload: {
          success: response.success,
          source: response.source,
          receiverAgentId: response.receiverAgentId,
          action: response.action,
          data: response.data,
        },
        authenticationCode: verification.code,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    } catch {
      console.error("Interaction persistence failed; the verified agent response was preserved.");
      operationalWarnings.push("INTERACTION_PERSISTENCE_FAILED");
    }
    return {
      delivered: true,
      verification,
      response,
      ...(operationalWarnings.length > 0 ? { operationalWarnings } : {}),
    };
  }
}
