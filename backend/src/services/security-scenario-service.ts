import { randomUUID } from "node:crypto";
import { Contract, getAddress, type JsonRpcSigner } from "ethers";
import { AGENT_REQUEST_TYPES, buildDomain, toTypedMessage } from "../auth/eip712.js";
import type { BlockchainService } from "../blockchain/blockchain-service.js";
import type { RuntimeConfig } from "../config/runtime.js";
import type { AgentRequest } from "../domain/types.js";
import type { CommunicationService } from "./communication-service.js";
import { IdentityWriteError } from "./identity-write-service.js";

export const SECURITY_SCENARIOS = [
  "VALID", "UNKNOWN_WALLET", "IMPERSONATION", "REVOKED_AGENT", "REPLAY", "EXPIRED", "PAYLOAD_TAMPER", "RECEIVER_TAMPER",
] as const;
export type SecurityScenarioId = typeof SECURITY_SCENARIOS[number];

const DESCRIPTIONS: Record<SecurityScenarioId, { expectedCode: string; description: string }> = {
  VALID: { expectedCode: "VERIFIED", description: "TravelAI signs an unchanged request for HotelAI." },
  UNKNOWN_WALLET: { expectedCode: "UNKNOWN_WALLET", description: "An unregistered local wallet signs the request." },
  IMPERSONATION: { expectedCode: "WALLET_MISMATCH", description: "HotelAI's wallet claims TravelAI's AgentID." },
  REVOKED_AGENT: { expectedCode: "AGENT_REVOKED", description: "TravelAI signs while its on-chain identity is revoked." },
  REPLAY: { expectedCode: "NONCE_REUSED", description: "A previously accepted signed request is submitted again." },
  EXPIRED: { expectedCode: "REQUEST_EXPIRED", description: "TravelAI signs a request outside the freshness window." },
  PAYLOAD_TAMPER: { expectedCode: "UNKNOWN_WALLET", description: "The payload is modified after EIP-712 signing." },
  RECEIVER_TAMPER: { expectedCode: "UNKNOWN_WALLET", description: "The receiver AgentID is modified after EIP-712 signing." },
};

export class SecurityScenarioService {
  constructor(private readonly blockchain: BlockchainService, private readonly communication: CommunicationService, private readonly config: RuntimeConfig) {}

  list() { return SECURITY_SCENARIOS.map((id) => ({ id, ...DESCRIPTIONS[id] })); }

  async run(scenario: SecurityScenarioId) {
    const started = performance.now();
    await this.assertSafeRuntime();
    const accounts = (await this.blockchain.provider.send("eth_accounts", []) as string[]).map(getAddress);
    if (accounts.length < 5) throw new IdentityWriteError("DEMO_WALLET_UNAVAILABLE", "The local Hardhat demo accounts are unavailable.", 503);
    const travelAgent = await this.blockchain.getAgent("AGT-TRAVEL-001");
    const hotelAgent = await this.blockchain.getAgent("AGT-HOTEL-001");
    if (!travelAgent || !hotelAgent) throw new IdentityWriteError("DEMO_IDENTITIES_MISSING", "TravelAI and HotelAI must be seeded before running Security Lab.", 409);
    const travel = await this.blockchain.provider.getSigner(travelAgent.owner);
    const hotel = await this.blockchain.provider.getSigner(hotelAgent.owner);
    const unregistered = (await Promise.all(accounts.slice(4).map(async (address) => ({ address, agent: await this.blockchain.getAgentByWallet(address) })))).find((item) => !item.agent);
    if (!unregistered) throw new IdentityWriteError("UNKNOWN_WALLET_UNAVAILABLE", "No unregistered local Hardhat wallet is available for this controlled scenario.", 409);
    const stranger = await this.blockchain.provider.getSigner(unregistered.address);
    const checkpoints: Array<{ label: string; status: "PASS" | "BLOCKED" | "INFO"; detail: string }> = [];
    const base = this.request();
    let result;
    let firstAttempt: Awaited<ReturnType<CommunicationService["send"]>> | undefined;

    if (scenario === "UNKNOWN_WALLET") result = await this.signedSend(base, stranger);
    else if (scenario === "IMPERSONATION") result = await this.signedSend(base, hotel);
    else if (scenario === "EXPIRED") result = await this.signedSend({ ...base, timestamp: Math.floor(Date.now() / 1000) - this.config.requestMaxAgeSeconds - this.config.clockSkewSeconds - 5 }, travel);
    else if (scenario === "PAYLOAD_TAMPER") {
      const signature = await this.sign(base, travel);
      result = await this.communication.send({ ...base, payload: { city: "Modified after signing", guests: 99 } }, signature);
    } else if (scenario === "RECEIVER_TAMPER") {
      const signature = await this.sign(base, travel);
      result = await this.communication.send({ ...base, receiverAgentId: "AGT-PAYMENT-001" }, signature);
    } else if (scenario === "REPLAY") {
      const signature = await this.sign(base, travel);
      firstAttempt = await this.communication.send(base, signature);
      checkpoints.push({ label: "First delivery accepted", status: firstAttempt.delivered ? "PASS" : "BLOCKED", detail: firstAttempt.verification.code });
      result = await this.communication.send(base, signature);
    } else if (scenario === "REVOKED_AGENT") {
      const agent = await this.blockchain.getAgent("AGT-TRAVEL-001");
      if (!agent) throw new IdentityWriteError("UNKNOWN_AGENT", "TravelAI is not seeded on the local registry.", 409);
      const contract = (await this.blockchain.getContract()).connect(travel) as Contract;
      if (agent.status === "Revoked") await (await contract.reactivateAgent(agent.agentId)).wait();
      await (await contract.revokeAgent(agent.agentId)).wait();
      checkpoints.push({ label: "TravelAI revoked on-chain", status: "INFO", detail: "A real AgentRevoked transaction was confirmed." });
      try { result = await this.signedSend(base, travel); }
      finally { await (await contract.reactivateAgent(agent.agentId)).wait(); }
      checkpoints.push({ label: "TravelAI restored", status: "PASS", detail: "The controlled demo identity was reactivated after the test." });
    } else result = await this.signedSend(base, travel);

    const expected = DESCRIPTIONS[scenario].expectedCode;
    const actual = result.verification.code;
    const protectedAsExpected = actual === expected && (scenario === "VALID" ? result.receiverExecuted : !result.receiverExecuted);
    checkpoints.push(
      { label: "EIP-712 signer recovery", status: result.verification.checks.signatureValid ? "PASS" : "BLOCKED", detail: actual },
      { label: "Authentication decision", status: result.verification.verified ? "PASS" : "BLOCKED", detail: result.verification.reason },
      { label: "Receiver execution gate", status: result.receiverExecuted ? "PASS" : "BLOCKED", detail: result.receiverExecuted ? "Receiver executed only after verification." : "Receiver execution was prevented." },
    );
    return {
      scenario, ...DESCRIPTIONS[scenario], protectedAsExpected, durationMs: Math.round(performance.now() - started),
      request: base, firstAttempt, result, checkpoints,
      guardrails: { developmentOnly: true, chainId: 31337, loopbackRpcOnly: true, arbitrarySigningDisabled: true },
    };
  }

  private request(): AgentRequest {
    const id = randomUUID();
    return { requestId: `LAB-${id}`, senderAgentId: "AGT-TRAVEL-001", receiverAgentId: "AGT-HOTEL-001", action: "SEARCH_HOTELS", payload: { city: "Chennai", guests: 2, nights: 2 }, timestamp: Math.floor(Date.now() / 1000), nonce: `lab-${id}` };
  }
  private sign(request: AgentRequest, signer: JsonRpcSigner) { return signer.signTypedData(buildDomain({ chainId: 31337, verifyingContract: this.blockchain.address }), AGENT_REQUEST_TYPES, toTypedMessage(request)); }
  private async signedSend(request: AgentRequest, signer: JsonRpcSigner) { return this.communication.send(request, await this.sign(request, signer)); }
  private async assertSafeRuntime() {
    if (this.config.nodeEnv !== "development" || !this.config.enableDemoSigning) throw new IdentityWriteError("SECURITY_LAB_DISABLED", "Security Lab execution is available only in an explicitly enabled development runtime.", 403);
    let local = false; try { local = ["127.0.0.1", "localhost", "::1"].includes(new URL(this.config.rpcUrl).hostname); } catch { local = false; }
    if (!local) throw new IdentityWriteError("SECURITY_LAB_NON_LOCAL_RPC", "Security Lab requires a loopback RPC endpoint.", 403);
    const health = await this.blockchain.health();
    if (!health.connected || health.chainId !== 31337 || this.config.expectedChainId !== 31337) throw new IdentityWriteError("WRONG_NETWORK", "Security Lab is restricted to the local Hardhat chain 31337.", 409);
  }
}
