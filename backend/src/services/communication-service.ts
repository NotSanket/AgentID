import type { AuthenticationService } from "../auth/authentication-service.js";
import { agentRequestSchema } from "../auth/request-schema.js";
import type { DemoAgentRouter } from "../agents/demo-agents.js";

export class CommunicationService {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly router: DemoAgentRouter,
  ) {}

  async send(request: unknown, signature: string) {
    const verification = await this.authentication.authenticate(request, signature);
    if (!verification.verified) return { delivered: false, verification };

    const validatedRequest = agentRequestSchema.parse(request);
    const response = await this.router.route(validatedRequest);
    return { delivered: true, verification, response };
  }
}
