import { describe, expect, it } from "vitest";
import { recoverRequestSigner, buildDomain, canonicalizeJson, hashPayload, typedDataDigest } from "../src/auth/eip712.js";
import { AuthenticationService } from "../src/auth/authentication-service.js";
import { InMemoryAuditStore } from "../src/stores/audit-store.js";
import { InMemoryReplayStore } from "../src/stores/replay-store.js";
import { FakeBlockchain, NOW, REGISTRY_ADDRESS, makeRequest, paymentWallet, record, signRequest, strangerWallet, travelWallet } from "./helpers.js";

function setup() {
  const registry = new FakeBlockchain();
  const replay = new InMemoryReplayStore();
  const audit = new InMemoryAuditStore();
  const authentication = new AuthenticationService(registry, replay, audit, {
    chainId: 31337,
    verifyingContract: REGISTRY_ADDRESS,
    maxAgeSeconds: 300,
    clockSkewSeconds: 30,
    now: () => NOW,
  });
  return { registry, replay, audit, authentication };
}

describe("EIP-712 request data", () => {
  it("builds the expected domain", () => {
    expect(buildDomain({ chainId: 31337, verifyingContract: REGISTRY_ADDRESS })).toEqual({
      name: "AgentID", version: "1", chainId: 31337, verifyingContract: REGISTRY_ADDRESS,
    });
  });

  it("canonicalizes object keys deterministically", () => {
    expect(canonicalizeJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });

  it("produces the same payload hash for different key insertion order", () => {
    expect(hashPayload({ city: "Chennai", guests: 2 })).toBe(hashPayload({ guests: 2, city: "Chennai" }));
  });

  it("changes the digest when a meaningful field changes", () => {
    const value = makeRequest();
    expect(typedDataDigest(value, { chainId: 31337, verifyingContract: REGISTRY_ADDRESS }))
      .not.toBe(typedDataDigest({ ...value, receiverAgentId: "AGT-PAYMENT-001" }, { chainId: 31337, verifyingContract: REGISTRY_ADDRESS }));
  });

  it("recovers a valid signer", async () => {
    const value = makeRequest();
    expect(recoverRequestSigner(value, await signRequest(value), { chainId: 31337, verifyingContract: REGISTRY_ADDRESS }))
      .toBe(travelWallet.address);
  });
});

describe("AuthenticationService", () => {
  it("verifies an active registered wallet", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    const result = await authentication.authenticate(value, await signRequest(value));
    expect(result).toMatchObject({ verified: true, code: "VERIFIED", registeredWallet: travelWallet.address });
    expect(result.checks).toEqual({
      signatureValid: true, senderExists: true, receiverExists: true, receiverActive: true, walletMatches: true,
      identityActive: true, timestampValid: true, nonceUnused: true,
    });
  });

  it("blocks an unknown sender", async () => {
    const { authentication } = setup();
    const value = makeRequest({ senderAgentId: "AGT-UNKNOWN-001" });
    expect(await authentication.authenticate(value, await signRequest(value, travelWallet)))
      .toMatchObject({ verified: false, code: "UNKNOWN_AGENT" });
  });

  it("blocks an unknown signer wallet", async () => {
    const { authentication, audit } = setup();
    const value = makeRequest();
    expect(await authentication.authenticate(value, await signRequest(value, strangerWallet)))
      .toMatchObject({ verified: false, code: "UNKNOWN_WALLET" });
    expect((await audit.list({ limit: 20, offset: 0 })).events[0])
      .toMatchObject({ type: "UNKNOWN_WALLET_BLOCKED", code: "UNKNOWN_WALLET" });
  });

  it("blocks wallet impersonation", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    expect(await authentication.authenticate(value, await signRequest(value, paymentWallet)))
      .toMatchObject({ verified: false, code: "WALLET_MISMATCH" });
  });

  it("blocks a revoked agent with the correct wallet", async () => {
    const { authentication, registry } = setup();
    registry.records.set("AGT-TRAVEL-001", record("AGT-TRAVEL-001", travelWallet.address, "Revoked"));
    const value = makeRequest();
    expect(await authentication.authenticate(value, await signRequest(value)))
      .toMatchObject({ verified: false, code: "AGENT_REVOKED" });
  });

  it("blocks an expired request", async () => {
    const { authentication } = setup();
    const value = makeRequest({ timestamp: NOW - 301 });
    expect(await authentication.authenticate(value, await signRequest(value)))
      .toMatchObject({ verified: false, code: "REQUEST_EXPIRED" });
  });

  it("blocks a timestamp too far in the future", async () => {
    const { authentication } = setup();
    const value = makeRequest({ timestamp: NOW + 31 });
    expect(await authentication.authenticate(value, await signRequest(value)))
      .toMatchObject({ verified: false, code: "REQUEST_EXPIRED" });
  });

  it("blocks replay of an accepted nonce", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    const signature = await signRequest(value);
    expect((await authentication.authenticate(value, signature)).code).toBe("VERIFIED");
    expect((await authentication.authenticate(value, signature)).code).toBe("NONCE_REUSED");
  });

  it("does not consume a nonce when authentication fails", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    expect((await authentication.authenticate(value, await signRequest(value, paymentWallet))).code).toBe("WALLET_MISMATCH");
    expect((await authentication.authenticate(value, await signRequest(value))).code).toBe("VERIFIED");
  });

  it("blocks payload modification after signing", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    const signature = await signRequest(value);
    expect(await authentication.authenticate({ ...value, payload: { city: "Delhi" } }, signature))
      .toMatchObject({ verified: false, code: "UNKNOWN_WALLET" });
  });

  it("blocks receiver modification after signing", async () => {
    const { authentication } = setup();
    const value = makeRequest();
    const signature = await signRequest(value);
    expect(await authentication.authenticate({ ...value, receiverAgentId: "AGT-PAYMENT-001" }, signature))
      .toMatchObject({ verified: false, code: "UNKNOWN_WALLET" });
  });

  it("handles a malformed signature without throwing", async () => {
    const { authentication } = setup();
    expect(await authentication.authenticate(makeRequest(), "not-a-signature"))
      .toMatchObject({ verified: false, code: "INVALID_SIGNATURE" });
  });

  it("rejects a malformed request", async () => {
    const { authentication } = setup();
    expect(await authentication.authenticate({ action: "lowercase action" }, "0x"))
      .toMatchObject({ verified: false, code: "INVALID_REQUEST" });
  });

  it("rejects an unknown receiver before delivery", async () => {
    const { authentication, audit } = setup();
    const value = makeRequest({ receiverAgentId: "AGT-NOBODY-001" });
    expect(await authentication.authenticate(value, await signRequest(value)))
      .toMatchObject({ verified: false, code: "UNKNOWN_RECEIVER" });
    expect((await audit.list({ limit: 20, offset: 0 })).events[0])
      .toMatchObject({ type: "UNKNOWN_RECEIVER_BLOCKED", code: "UNKNOWN_RECEIVER" });
  });

  it("records the correct verification audit event", async () => {
    const { authentication, audit } = setup();
    const value = makeRequest();
    await authentication.authenticate(value, await signRequest(value));
    expect((await audit.list({ limit: 20, offset: 0 })).events[0])
      .toMatchObject({ type: "REQUEST_VERIFIED", code: "VERIFIED", result: "VERIFIED" });
  });

  it("records the correct impersonation audit event", async () => {
    const { authentication, audit } = setup();
    const value = makeRequest();
    await authentication.authenticate(value, await signRequest(value, paymentWallet));
    expect((await audit.list({ limit: 20, offset: 0 })).events[0])
      .toMatchObject({ type: "IMPERSONATION_BLOCKED", code: "WALLET_MISMATCH", result: "BLOCKED" });
  });
});
