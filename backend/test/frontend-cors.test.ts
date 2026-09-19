import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type AppDependencies } from "../src/app.js";
import { FakeBlockchain } from "./helpers.js";

function app() {
  return createApp({
    blockchain: new FakeBlockchain(),
    authentication: {} as AppDependencies["authentication"],
    communication: {} as AppDependencies["communication"],
    auditStore: {} as AppDependencies["auditStore"],
    interactionStore: {} as AppDependencies["interactionStore"],
    analytics: {} as AppDependencies["analytics"],
    metadata: {} as AppDependencies["metadata"],
    persistenceStatus: { mode: "IN_MEMORY", supabaseConnected: false },
    frontendOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  });
}

describe("Stage 4 trusted frontend origins", () => {
  it.each(["http://localhost:5173", "http://127.0.0.1:5173"])("allows configured local origin %s", async (origin) => {
    const response = await request(app()).get("/api/health").set("Origin", origin);
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers.vary).toContain("Origin");
  });

  it("does not grant cross-origin access to an untrusted origin", async () => {
    const response = await request(app()).get("/api/health").set("Origin", "https://untrusted.example");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers trusted preflight requests with the narrow method set", async () => {
    const response = await request(app()).options("/api/health").set("Origin", "http://127.0.0.1:5173");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
    expect(response.headers["access-control-allow-methods"]).toBe("GET,POST,OPTIONS");
  });
});
