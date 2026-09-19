import { describe, expect, it } from "vitest";
import { DemoAgentRouter } from "../src/agents/demo-agents.js";
import { makeRequest } from "./helpers.js";

describe("deterministic demo agents", () => {
  const router = new DemoAgentRouter();

  it("routes a deterministic itinerary to TravelAI", async () => {
    const request = makeRequest({
      receiverAgentId: "AGT-TRAVEL-001",
      action: "PLAN_TRIP",
      payload: { city: "Jaipur" },
    });
    const first = await router.route(request);
    const second = await router.route(request);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      success: true,
      source: "SIMULATED_DEMO_DATA",
      data: { destination: "Jaipur" },
    });
  });

  it("returns deterministic HotelAI search results", async () => {
    const request = makeRequest();
    const first = await router.route(request);
    const second = await router.route(request);
    expect(first).toEqual(second);
    expect(first).toEqual({
      success: true,
      source: "SIMULATED_DEMO_DATA",
      receiverAgentId: "AGT-HOTEL-001",
      action: "SEARCH_HOTELS",
      data: {
        options: [
          { hotel: "Marina View", city: "Chennai", nightlyRate: 4200, currency: "INR" },
          { hotel: "Coromandel Stay", city: "Chennai", nightlyRate: 5100, currency: "INR" },
        ],
      },
    });
  });

  it("returns a deterministic PaymentAI authorization", async () => {
    const request = makeRequest({
      requestId: "REQ-PAYMENT-DEMO",
      receiverAgentId: "AGT-PAYMENT-001",
      action: "AUTHORIZE_PAYMENT",
      payload: { amount: 4200, currency: "INR" },
    });
    expect(await router.route(request)).toMatchObject({
      success: true,
      source: "SIMULATED_DEMO_DATA",
      data: { authorization: "DEMO-REQ-PAYMENT-DEMO", status: "APPROVED_SIMULATION" },
    });
  });

  it("rejects unsupported actions deterministically", async () => {
    const request = makeRequest({ receiverAgentId: "AGT-TRAVEL-001", action: "SEARCH_HOTELS" });
    expect(await router.route(request)).toMatchObject({ success: false, data: { error: "UNSUPPORTED_ACTION" } });
  });
});
