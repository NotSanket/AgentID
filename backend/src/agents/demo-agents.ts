import type { AgentRequest, JsonValue } from "../domain/types.js";

export interface AgentResponse {
  success: boolean;
  source: "SIMULATED_DEMO_DATA";
  receiverAgentId: string;
  action: string;
  data: JsonValue;
}

export interface AgentHandler {
  handle(request: AgentRequest): Promise<AgentResponse>;
}

export class TravelAgent implements AgentHandler {
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const supported = new Set(["PLAN_TRIP", "BUILD_ITINERARY"]).has(request.action);
    const city = this.city(request.payload);
    return {
      success: supported,
      source: "SIMULATED_DEMO_DATA",
      receiverAgentId: request.receiverAgentId,
      action: request.action,
      data: supported
        ? {
            destination: city,
            itinerary: [
              { day: 1, activity: `Arrive in ${city}` },
              { day: 2, activity: `${city} city tour` },
            ],
          }
        : { error: "UNSUPPORTED_ACTION" },
    };
  }

  private city(payload: JsonValue): string {
    return typeof payload === "object" && payload !== null && !Array.isArray(payload) &&
      typeof payload.city === "string" ? payload.city : "Chennai";
  }
}

export class HotelAgent implements AgentHandler {
  async handle(request: AgentRequest): Promise<AgentResponse> {
    if (!new Set(["SEARCH_HOTELS", "CHECK_AVAILABILITY"]).has(request.action)) {
      return this.response(request, false, { error: "UNSUPPORTED_ACTION" });
    }
    return this.response(request, true, {
      options: [
        { hotel: "Marina View", city: this.city(request.payload), nightlyRate: 4200, currency: "INR" },
        { hotel: "Coromandel Stay", city: this.city(request.payload), nightlyRate: 5100, currency: "INR" },
      ],
    });
  }

  private city(payload: JsonValue): string {
    return typeof payload === "object" && payload !== null && !Array.isArray(payload) &&
      typeof payload.city === "string" ? payload.city : "Chennai";
  }

  private response(request: AgentRequest, success: boolean, data: JsonValue): AgentResponse {
    return { success, source: "SIMULATED_DEMO_DATA", receiverAgentId: request.receiverAgentId, action: request.action, data };
  }
}

export class PaymentAgent implements AgentHandler {
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const supported = new Set(["MOCK_PAYMENT", "AUTHORIZE_PAYMENT"]).has(request.action);
    return {
      success: supported,
      source: "SIMULATED_DEMO_DATA",
      receiverAgentId: request.receiverAgentId,
      action: request.action,
      data: supported
        ? { authorization: `DEMO-${request.requestId}`, status: "APPROVED_SIMULATION" }
        : { error: "UNSUPPORTED_ACTION" },
    };
  }
}

export class DemoAgentRouter {
  private readonly handlers = new Map<string, AgentHandler>([
    ["AGT-TRAVEL-001", new TravelAgent()],
    ["AGT-HOTEL-001", new HotelAgent()],
    ["AGT-PAYMENT-001", new PaymentAgent()],
  ]);

  register(agentId: string, handler: AgentHandler): void {
    this.handlers.set(agentId, handler);
  }

  async route(request: AgentRequest): Promise<AgentResponse> {
    const handler = this.handlers.get(request.receiverAgentId);
    if (!handler) {
      return {
        success: false,
        source: "SIMULATED_DEMO_DATA",
        receiverAgentId: request.receiverAgentId,
        action: request.action,
        data: { error: "NO_DEMO_HANDLER" },
      };
    }
    return handler.handle(request);
  }
}
