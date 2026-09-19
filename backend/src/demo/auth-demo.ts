import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Contract, type JsonRpcSigner } from "ethers";
import { AGENT_REQUEST_TYPES, buildDomain, toTypedMessage } from "../auth/eip712.js";
import type { AgentRequest } from "../domain/types.js";
import { bootstrap } from "../bootstrap.js";

const line = "=".repeat(64);

function request(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    requestId: `REQ-${randomUUID()}`,
    senderAgentId: "AGT-TRAVEL-001",
    receiverAgentId: "AGT-HOTEL-001",
    action: "SEARCH_HOTELS",
    payload: { city: "Chennai", guests: 2, nights: 2 },
    timestamp: Math.floor(Date.now() / 1000),
    nonce: randomUUID(),
    ...overrides,
  };
}

async function sign(value: AgentRequest, signer: JsonRpcSigner, chainId: number, address: string) {
  return signer.signTypedData(buildDomain({ chainId, verifyingContract: address }), AGENT_REQUEST_TYPES, toTypedMessage(value));
}

function printResult(title: string, result: any): void {
  console.log(`\n${"-".repeat(64)}\n${title}`);
  console.log(`Claimed:           ${result.verification?.senderAgentId ?? result.senderAgentId ?? "n/a"}`);
  console.log(`Recovered signer:  ${result.verification?.recoveredWallet ?? result.recoveredWallet ?? "n/a"}`);
  console.log(`Registry wallet:   ${result.verification?.registeredWallet ?? result.registeredWallet ?? "n/a"}`);
  const verification = result.verification ?? result;
  console.log(`Signature:         ${verification.checks.signatureValid ? "VALID" : "NOT VALID"}`);
  console.log(`Wallet match:      ${verification.checks.walletMatches ? "YES" : "NO"}`);
  console.log(`Identity active:   ${verification.checks.identityActive ? "YES" : "NO"}`);
  console.log(`Timestamp fresh:   ${verification.checks.timestampValid ? "YES" : "NO"}`);
  console.log(`Nonce unused:      ${verification.checks.nonceUnused ? "YES" : "NO"}`);
  console.log(`RESULT:            ${verification.verified ? "VERIFIED" : "BLOCKED"} (${verification.code})`);
  if (result.response) console.log(`Agent response:    ${JSON.stringify(result.response.data)}`);
}

async function main() {
  const runtime = bootstrap();
  const health = await runtime.blockchain.health();
  if (!health.connected) throw new Error(`Blockchain pre-flight failed: ${health.error}`);

  const travelSigner = await runtime.blockchain.provider.getSigner(1);
  const hotelSigner = await runtime.blockchain.provider.getSigner(2);
  const unregisteredSigner = await runtime.blockchain.provider.getSigner(4);
  const artifact = JSON.parse(readFileSync(runtime.config.artifactPath, "utf8"));
  const registry = new Contract(runtime.config.registryAddress, artifact.abi, travelSigner);
  const existing = await runtime.blockchain.getAgent("AGT-TRAVEL-001");
  if (existing?.status === "Revoked") await (await registry.reactivateAgent("AGT-TRAVEL-001")).wait();

  console.log(`\n${line}\n             AGENTID AUTHENTICATION DEMO\n${line}`);
  console.log(`Chain ID: ${health.chainId} | Block: ${health.latestBlock}`);
  console.log(`Registry: ${health.registryAddress}`);

  const valid = request();
  const validSignature = await sign(valid, travelSigner, runtime.config.expectedChainId, runtime.config.registryAddress);
  const validResult = await runtime.communication.send(valid, validSignature);
  printResult("SCENARIO 1 — VALID AGENT: TravelAI → HotelAI", validResult);

  const unknown = request({ senderAgentId: "AGT-UNKNOWN-001" });
  printResult("SCENARIO 2 — UNKNOWN WALLET", await runtime.authentication.authenticate(
    unknown,
    await sign(unknown, unregisteredSigner, runtime.config.expectedChainId, runtime.config.registryAddress),
  ));

  const impersonation = request();
  printResult("SCENARIO 3 — IMPERSONATION", await runtime.authentication.authenticate(
    impersonation,
    await sign(impersonation, hotelSigner, runtime.config.expectedChainId, runtime.config.registryAddress),
  ));

  await (await registry.revokeAgent("AGT-TRAVEL-001")).wait();
  try {
    const revoked = request();
    printResult("SCENARIO 4 — REVOKED AGENT", await runtime.authentication.authenticate(
      revoked,
      await sign(revoked, travelSigner, runtime.config.expectedChainId, runtime.config.registryAddress),
    ));
  } finally {
    await (await registry.reactivateAgent("AGT-TRAVEL-001")).wait();
  }

  const expired = request({ timestamp: Math.floor(Date.now() / 1000) - runtime.config.requestMaxAgeSeconds - 10 });
  printResult("SCENARIO 5 — EXPIRED REQUEST", await runtime.authentication.authenticate(
    expired,
    await sign(expired, travelSigner, runtime.config.expectedChainId, runtime.config.registryAddress),
  ));

  printResult("SCENARIO 6 — REPLAY OF VALID REQUEST", await runtime.authentication.authenticate(valid, validSignature));

  const originalPayload = request();
  const payloadSignature = await sign(originalPayload, travelSigner, runtime.config.expectedChainId, runtime.config.registryAddress);
  printResult("SCENARIO 7 — PAYLOAD TAMPERING", await runtime.authentication.authenticate(
    { ...originalPayload, payload: { city: "Mumbai", guests: 9, nights: 20 } },
    payloadSignature,
  ));

  const originalReceiver = request();
  const receiverSignature = await sign(originalReceiver, travelSigner, runtime.config.expectedChainId, runtime.config.registryAddress);
  printResult("SCENARIO 8 — RECEIVER TAMPERING", await runtime.authentication.authenticate(
    { ...originalReceiver, receiverAgentId: "AGT-PAYMENT-001" },
    receiverSignature,
  ));

  printResult("SCENARIO 9 — MALFORMED SIGNATURE", await runtime.authentication.authenticate(
    request(),
    "not-a-signature",
  ));

  console.log(`\n${line}\nDemo complete. TravelAI was left Active. Audit events: ${runtime.auditStore.list().length}\n${line}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
