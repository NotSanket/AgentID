import { getAddress, type Contract, type ContractTransactionReceipt } from "ethers";
import type { BlockchainService } from "../blockchain/blockchain-service.js";
import type { RuntimeConfig } from "../config/runtime.js";
import type { AgentMetadataInput } from "../persistence/types.js";
import type { IdentityOperation, IdentityTransactionResult } from "../domain/types.js";
import type { MetadataService } from "./metadata-service.js";

export interface DemoWalletSummary {
  label: string;
  address: string;
  available: boolean;
  assignedAgentId: string | null;
}

export interface IdentityProfileInput {
  agentId: string;
  name: string;
  organization: string;
  metadataURI?: string;
  metadata?: Omit<AgentMetadataInput, "agentId">;
}

export interface IdentityWriteResponse {
  transaction: IdentityTransactionResult | null;
  metadataSynced: boolean;
  metadataWarning?: string;
}

export class IdentityWriteError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = "IdentityWriteError";
  }
}

export class DemoIdentityWriteService {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly metadata: MetadataService,
    private readonly config: RuntimeConfig,
  ) {}

  isEnabled() {
    return this.config.nodeEnv === "development"
      && this.config.enableDemoSigning
      && this.config.expectedChainId === 31337
      && this.isLocalRpc();
  }

  async listWallets(): Promise<DemoWalletSummary[]> {
    await this.assertSafeRuntime();
    const addresses = await this.demoAddresses();
    return Promise.all(addresses.map(async (address, index) => {
      const assigned = await this.blockchain.getAgentByWallet(address);
      return {
        label: `Demo Wallet ${index + 4}`,
        address,
        available: !assigned,
        assignedAgentId: assigned?.agentId ?? null,
      };
    }));
  }

  async register(wallet: string, input: IdentityProfileInput): Promise<IdentityWriteResponse> {
    const signer = await this.requireDemoSigner(wallet, true);
    const contract = (await this.blockchain.getContract()).connect(signer) as Contract;
    const metadataURI = input.metadataURI ?? `agentid://metadata/${input.agentId}`;
    try {
      const transaction = await contract.registerAgent(input.agentId, input.name, input.organization, metadataURI);
      const receipt = await transaction.wait();
      return this.withMetadata(await this.mapReceipt(receipt, "REGISTER", input.agentId, wallet), input);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(wallet: string, input: IdentityProfileInput): Promise<IdentityWriteResponse> {
    const signer = await this.requireDemoSigner(wallet, false, input.agentId);
    const current = await this.blockchain.getAgent(input.agentId);
    if (!current) throw new IdentityWriteError("AGENT_NOT_FOUND", "The requested AgentID does not exist.", 404);
    const metadataURI = input.metadataURI ?? current.metadataURI;
    const needsTransaction = current.name !== input.name
      || current.organization !== input.organization
      || current.metadataURI !== metadataURI;
    try {
      const mapped = needsTransaction
        ? await this.mapReceipt(
          await (await ((await this.blockchain.getContract()).connect(signer) as Contract)
            .updateAgent(input.agentId, input.name, input.organization, metadataURI)).wait(),
          "UPDATE",
          input.agentId,
          wallet,
        )
        : null;
      return this.withMetadata(mapped, input);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async revoke(wallet: string, agentId: string): Promise<IdentityWriteResponse> {
    return this.lifecycle(wallet, agentId, "REVOKE", "revokeAgent");
  }

  async reactivate(wallet: string, agentId: string): Promise<IdentityWriteResponse> {
    return this.lifecycle(wallet, agentId, "REACTIVATE", "reactivateAgent");
  }

  private async lifecycle(wallet: string, agentId: string, operation: IdentityOperation, method: "revokeAgent" | "reactivateAgent"): Promise<IdentityWriteResponse> {
    const signer = await this.requireDemoSigner(wallet, false, agentId);
    try {
      const contract = (await this.blockchain.getContract()).connect(signer) as Contract;
      const transaction = await contract[method](agentId);
      return { transaction: await this.mapReceipt(await transaction.wait(), operation, agentId, wallet), metadataSynced: true };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private async withMetadata(transaction: IdentityTransactionResult | null, input: IdentityProfileInput): Promise<IdentityWriteResponse> {
    if (!input.metadata) return { transaction, metadataSynced: true };
    try {
      await this.metadata.upsert({ agentId: input.agentId, ...input.metadata });
      return { transaction, metadataSynced: true };
    } catch {
      return {
        transaction,
        metadataSynced: false,
        metadataWarning: "Identity registered on-chain. Metadata sync requires attention.",
      };
    }
  }

  private async requireDemoSigner(wallet: string, requireAvailable: boolean, agentId?: string) {
    await this.assertSafeRuntime();
    let normalized: string;
    try { normalized = getAddress(wallet); } catch { throw new IdentityWriteError("INVALID_ADDRESS", "A valid demo wallet address is required."); }
    const pool = await this.demoAddresses();
    if (!pool.some((address) => address === normalized)) {
      throw new IdentityWriteError("DEMO_WALLET_NOT_ALLOWED", "Only the predefined local demo wallets may sign identity operations.", 403);
    }
    const assigned = await this.blockchain.getAgentByWallet(normalized);
    if (requireAvailable && assigned) {
      throw new IdentityWriteError("WALLET_ALREADY_REGISTERED", `This demo wallet already controls ${assigned.agentId}.`, 409);
    }
    if (!requireAvailable && (!assigned || assigned.agentId !== agentId)) {
      throw new IdentityWriteError("NOT_IDENTITY_OWNER", "Only the controlling wallet can modify this identity.", 403);
    }
    return this.blockchain.provider.getSigner(normalized);
  }

  private async assertSafeRuntime() {
    if (this.config.nodeEnv !== "development") {
      throw new IdentityWriteError("DEMO_SIGNING_PRODUCTION_DISABLED", "Local demo signing is disabled outside development.", 403);
    }
    if (!this.config.enableDemoSigning) {
      throw new IdentityWriteError("DEMO_SIGNING_DISABLED", "Local demo signing is not enabled.", 403);
    }
    if (!this.isLocalRpc()) {
      throw new IdentityWriteError("DEMO_SIGNING_NON_LOCAL_RPC", "Local demo signing requires a loopback RPC endpoint.", 403);
    }
    const network = await this.blockchain.provider.getNetwork();
    if (Number(network.chainId) !== 31337 || this.config.expectedChainId !== 31337) {
      throw new IdentityWriteError("WRONG_NETWORK", "Local demo signing is restricted to Hardhat chain 31337.", 409);
    }
    const health = await this.blockchain.health();
    if (!health.connected) throw new IdentityWriteError("BLOCKCHAIN_OFFLINE", "The local blockchain or AgentRegistry is unavailable.", 503);
  }

  private async demoAddresses(): Promise<string[]> {
    const accounts = await this.blockchain.provider.send("eth_accounts", []) as string[];
    return accounts.slice(3, 10).map((address) => getAddress(address));
  }

  private isLocalRpc() {
    try {
      const hostname = new URL(this.config.rpcUrl).hostname;
      return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    } catch { return false; }
  }

  private async mapReceipt(receipt: ContractTransactionReceipt | null, operation: IdentityOperation, agentId: string, wallet: string): Promise<IdentityTransactionResult> {
    if (!receipt || receipt.status !== 1) throw new IdentityWriteError("TRANSACTION_FAILED", "The blockchain transaction did not confirm.", 502);
    const network = await this.blockchain.provider.getNetwork();
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: "CONFIRMED",
      operation,
      agentId,
      ownerWallet: getAddress(wallet),
      from: getAddress(receipt.from),
      to: getAddress(receipt.to ?? this.blockchain.address),
      chainId: Number(network.chainId),
    };
  }

  private mapError(error: unknown): IdentityWriteError {
    if (error instanceof IdentityWriteError) return error;
    const text = `${(error as { shortMessage?: string }).shortMessage ?? ""} ${error instanceof Error ? error.message : String(error)}`;
    if (text.includes("AgentAlreadyExists")) return new IdentityWriteError("AGENT_ID_EXISTS", "That AgentID is already registered.", 409);
    if (text.includes("WalletAlreadyRegistered")) return new IdentityWriteError("WALLET_ALREADY_REGISTERED", "That wallet already controls an AgentID.", 409);
    if (text.includes("NotAgentOwner")) return new IdentityWriteError("NOT_IDENTITY_OWNER", "Only the controlling wallet can modify this identity.", 403);
    if (text.includes("AgentNotFound")) return new IdentityWriteError("AGENT_NOT_FOUND", "The requested AgentID does not exist.", 404);
    if (text.includes("InvalidStatus")) return new IdentityWriteError("INVALID_STATE", "The identity is not in the required lifecycle state.", 409);
    return new IdentityWriteError("TRANSACTION_FAILED", "The identity transaction failed. Technical details are available in the server log.", 502);
  }
}
