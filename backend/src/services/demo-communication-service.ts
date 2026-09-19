import { getAddress } from "ethers";
import { AGENT_REQUEST_TYPES, buildDomain, toTypedMessage } from "../auth/eip712.js";
import { agentRequestSchema } from "../auth/request-schema.js";
import type { BlockchainService } from "../blockchain/blockchain-service.js";
import type { RuntimeConfig } from "../config/runtime.js";
import type { AgentRequest } from "../domain/types.js";
import type { CommunicationService } from "./communication-service.js";
import { IdentityWriteError } from "./identity-write-service.js";

export const DEMO_RECEIVER_ACTIONS: Readonly<Record<string, readonly string[]>> = {
  "AGT-TRAVEL-001": ["PLAN_TRIP", "BUILD_ITINERARY"],
  "AGT-HOTEL-001": ["SEARCH_HOTELS", "CHECK_AVAILABILITY"],
  "AGT-PAYMENT-001": ["AUTHORIZE_PAYMENT", "MOCK_PAYMENT"],
};

export class DemoCommunicationService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly communication: CommunicationService,
    private readonly config: RuntimeConfig,
  ) {}

  isEnabled() {
    return this.config.nodeEnv === "development"
      && this.config.enableDemoSigning
      && this.config.expectedChainId === 31337
      && this.isLocalRpc();
  }

  async listAgents() {
    await this.assertSafeRuntime();
    const allowed = await this.allowedAddresses();
    const records = await Promise.all(Object.entries(DEMO_RECEIVER_ACTIONS).map(async ([agentId, supportedActions]) => {
      const agent = await this.blockchain.getAgent(agentId);
      if (!agent || !allowed.includes(getAddress(agent.owner))) return null;
      return {
        label: `${agent.name} local signer`,
        agentId: agent.agentId,
        name: agent.name,
        organization: agent.organization,
        address: getAddress(agent.owner),
        status: agent.status,
        supportedActions,
      };
    }));
    return records.filter((record): record is NonNullable<typeof record> => record !== null);
  }

  async signAndSend(wallet: string, input: AgentRequest) {
    await this.assertSafeRuntime();
    const parsed = agentRequestSchema.parse(input);
    let normalized: string;
    try { normalized = getAddress(wallet); } catch { throw new IdentityWriteError("INVALID_ADDRESS", "A valid local demo wallet is required."); }
    if (!(await this.allowedAddresses()).includes(normalized)) {
      throw new IdentityWriteError("DEMO_WALLET_NOT_ALLOWED", "Only the predefined local communication wallets may sign demo requests.", 403);
    }
    const assigned = await this.blockchain.getAgentByWallet(normalized);
    if (!assigned || !DEMO_RECEIVER_ACTIONS[assigned.agentId]) {
      throw new IdentityWriteError("UNKNOWN_DEMO_AGENT", "The selected wallet does not control a supported demo agent.", 403);
    }
    if (assigned.agentId !== parsed.senderAgentId) {
      throw new IdentityWriteError("NOT_IDENTITY_OWNER", "The selected local wallet does not control the claimed sender AgentID.", 403);
    }
    const signer = await this.blockchain.provider.getSigner(normalized);
    const signature = await signer.signTypedData(
      buildDomain({ chainId: this.config.expectedChainId, verifyingContract: this.config.registryAddress }),
      AGENT_REQUEST_TYPES,
      toTypedMessage(parsed),
    );
    return { request: parsed, signature, ...await this.communication.send(parsed, signature) };
  }

  private async assertSafeRuntime() {
    if (this.config.nodeEnv !== "development") throw new IdentityWriteError("DEMO_SIGNING_PRODUCTION_DISABLED", "Local demo signing is disabled outside development.", 403);
    if (!this.config.enableDemoSigning) throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not enabled.", 403);
    if (!this.isLocalRpc()) throw new IdentityWriteError("DEMO_SIGNING_NON_LOCAL_RPC", "Local demo signing requires a loopback RPC endpoint.", 403);
    const network = await this.blockchain.provider.getNetwork();
    if (Number(network.chainId) !== 31337 || this.config.expectedChainId !== 31337) throw new IdentityWriteError("WRONG_NETWORK", "Local demo signing is restricted to Hardhat chain 31337.", 409);
    if (!(await this.blockchain.health()).connected) throw new IdentityWriteError("BLOCKCHAIN_OFFLINE", "Verification service unavailable. The receiver was not executed.", 503);
  }

  private async allowedAddresses() {
    const accounts = await this.blockchain.provider.send("eth_accounts", []) as string[];
    return accounts.slice(1, 4).map((address) => getAddress(address));
  }

  private isLocalRpc() {
    try {
      const hostname = new URL(this.config.rpcUrl).hostname;
      return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    } catch { return false; }
  }
}
