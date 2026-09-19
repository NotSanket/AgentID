import { Wallet, type Signer } from "ethers";
import type { ApiBlockchain } from "../src/app.js";
import { AGENT_REQUEST_TYPES, buildDomain, toTypedMessage } from "../src/auth/eip712.js";
import type { AgentRecord, AgentRequest } from "../src/domain/types.js";

export const NOW = 2_000_000_000;
export const REGISTRY_ADDRESS = Wallet.createRandom().address;
export const travelWallet = Wallet.createRandom();
export const hotelWallet = Wallet.createRandom();
export const paymentWallet = Wallet.createRandom();
export const strangerWallet = Wallet.createRandom();

export function record(agentId: string, owner: string, status: "Active" | "Revoked" = "Active"): AgentRecord {
  return {
    agentId,
    name: agentId === "AGT-TRAVEL-001" ? "TravelAI" : agentId === "AGT-HOTEL-001" ? "HotelAI" : "PaymentAI",
    organization: "Demo Organization",
    owner,
    metadataURI: "ipfs://demo",
    registeredAt: "1",
    updatedAt: "1",
    status,
  };
}

export class FakeBlockchain implements ApiBlockchain {
  readonly records = new Map<string, AgentRecord>([
    ["AGT-TRAVEL-001", record("AGT-TRAVEL-001", travelWallet.address)],
    ["AGT-HOTEL-001", record("AGT-HOTEL-001", hotelWallet.address)],
    ["AGT-PAYMENT-001", record("AGT-PAYMENT-001", paymentWallet.address)],
  ]);

  async health() {
    return {
      connected: true,
      network: "localhost",
      chainId: 31337,
      expectedChainId: 31337,
      latestBlock: 12,
      registryAddress: REGISTRY_ADDRESS,
      contractReachable: true,
    };
  }

  async getAgent(agentId: string) { return this.records.get(agentId) ?? null; }
  async getAgentByWallet(wallet: string) {
    return [...this.records.values()].find((item) => item.owner.toLowerCase() === wallet.toLowerCase()) ?? null;
  }
  async listAgents() { return [...this.records.values()]; }
  async contractConfig() { return { network: "localhost", chainId: 31337, registryAddress: REGISTRY_ADDRESS, abi: [] }; }
  async getLifecycleEvents(agentId: string) {
    return this.records.has(agentId) ? [{ type: "Registered" as const, agentId, owner: this.records.get(agentId)!.owner, timestamp: "1", blockNumber: 1, transactionHash: `0x${"1".repeat(64)}` }] : [];
  }
}

let sequence = 0;
export function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  sequence += 1;
  return {
    requestId: `REQ-${sequence}`,
    senderAgentId: "AGT-TRAVEL-001",
    receiverAgentId: "AGT-HOTEL-001",
    action: "SEARCH_HOTELS",
    payload: { city: "Chennai", guests: 2, nights: 2 },
    timestamp: NOW,
    nonce: `nonce-${sequence}`,
    ...overrides,
  };
}

export async function signRequest(request: AgentRequest, signer: Signer = travelWallet): Promise<string> {
  return signer.signTypedData(
    buildDomain({ chainId: 31337, verifyingContract: REGISTRY_ADDRESS }),
    AGENT_REQUEST_TYPES,
    toTypedMessage(request),
  );
}
