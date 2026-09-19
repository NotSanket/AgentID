import { BrowserProvider, Contract, getAddress, type ContractTransactionReceipt, type Eip1193Provider } from "ethers";
import { apiClient } from "../lib/api-client";
import type { AgentMetadataInput, IdentityContractConfig, IdentityProfileInput, IdentityTransactionResult, IdentityWriteResponse } from "../types/api";

export type TransactionStage = "preparing" | "awaiting-signature" | "submitting" | "pending" | "confirmed";
export type StageReporter = (stage: TransactionStage) => void;

export interface IdentityWriter {
  register(input: IdentityProfileInput, report: StageReporter): Promise<IdentityWriteResponse>;
  update(input: IdentityProfileInput, report: StageReporter, onChain?: boolean): Promise<IdentityWriteResponse>;
  revoke(agentId: string, report: StageReporter): Promise<IdentityWriteResponse>;
  reactivate(agentId: string, report: StageReporter): Promise<IdentityWriteResponse>;
}

export class IdentityWriterError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "IdentityWriterError";
  }
}

export class BrowserWalletIdentityWriter implements IdentityWriter {
  private readonly provider: BrowserProvider;

  constructor(
    ethereum: Eip1193Provider,
    private readonly config: IdentityContractConfig,
  ) {
    this.provider = new BrowserProvider(ethereum);
  }

  async walletAddress() {
    await this.assertNetwork();
    return getAddress(await (await this.provider.getSigner()).getAddress());
  }

  async register(input: IdentityProfileInput, report: StageReporter) {
    report("preparing");
    const { signer, wallet, contract } = await this.context();
    if (wallet !== getAddress(input.wallet)) throw new IdentityWriterError("WALLET_CHANGED", "The connected wallet changed before submission.");
    report("awaiting-signature");
    try {
      const transaction = await contract.registerAgent(input.agentId, input.name, input.organization, input.metadataURI ?? `agentid://metadata/${input.agentId}`);
      report("submitting");
      report("pending");
      const receipt = await transaction.wait();
      report("confirmed");
      const result = this.mapReceipt(receipt, "REGISTER", input.agentId, wallet);
      return input.metadata ? this.syncMetadata(input.agentId, input.metadata, signer, result) : { transaction: result, metadataSynced: true };
    } catch (error) { throw mapWalletError(error); }
  }

  async update(input: IdentityProfileInput, report: StageReporter, onChain = true) {
    report("preparing");
    const { signer, wallet, contract } = await this.context();
    if (wallet !== getAddress(input.wallet)) throw new IdentityWriterError("WALLET_CHANGED", "The connected wallet changed before submission.");
    if (!onChain) {
      if (!input.metadata) return { transaction: null, metadataSynced: true };
      const result = await this.syncMetadata(input.agentId, input.metadata, signer, null, wallet);
      report("confirmed");
      return result;
    }
    report("awaiting-signature");
    try {
      const transaction = await contract.updateAgent(input.agentId, input.name, input.organization, input.metadataURI ?? `agentid://metadata/${input.agentId}`);
      report("submitting");
      report("pending");
      const receipt = await transaction.wait();
      report("confirmed");
      const result = this.mapReceipt(receipt, "UPDATE", input.agentId, wallet);
      return input.metadata ? this.syncMetadata(input.agentId, input.metadata, signer, result, wallet) : { transaction: result, metadataSynced: true };
    } catch (error) { throw mapWalletError(error); }
  }

  revoke(agentId: string, report: StageReporter) { return this.lifecycle(agentId, "REVOKE", "revokeAgent", report); }
  reactivate(agentId: string, report: StageReporter) { return this.lifecycle(agentId, "REACTIVATE", "reactivateAgent", report); }

  private async lifecycle(agentId: string, operation: "REVOKE" | "REACTIVATE", method: "revokeAgent" | "reactivateAgent", report: StageReporter): Promise<IdentityWriteResponse> {
    report("preparing");
    const { wallet, contract } = await this.context();
    report("awaiting-signature");
    try {
      const transaction = await contract[method](agentId);
      report("submitting");
      report("pending");
      const receipt = await transaction.wait();
      report("confirmed");
      return { transaction: this.mapReceipt(receipt, operation, agentId, wallet), metadataSynced: true };
    } catch (error) { throw mapWalletError(error); }
  }

  private async context() {
    await this.assertNetwork();
    const signer = await this.provider.getSigner();
    const wallet = getAddress(await signer.getAddress());
    return { signer, wallet, contract: new Contract(this.config.registryAddress, this.config.abi, signer) };
  }

  private async assertNetwork() {
    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== this.config.chainId) {
      throw new IdentityWriterError("WRONG_NETWORK", `Switch the browser wallet to chain ${this.config.chainId} before continuing.`);
    }
  }

  private mapReceipt(receipt: ContractTransactionReceipt | null, operation: IdentityTransactionResult["operation"], agentId: string, wallet: string): IdentityTransactionResult {
    if (!receipt || receipt.status !== 1) throw new IdentityWriterError("TRANSACTION_FAILED", "The transaction was not confirmed.");
    return { transactionHash: receipt.hash, blockNumber: receipt.blockNumber, status: "CONFIRMED", operation, agentId, ownerWallet: wallet, from: getAddress(receipt.from), to: getAddress(receipt.to ?? this.config.registryAddress), chainId: this.config.chainId };
  }

  private async syncMetadata(agentId: string, metadata: AgentMetadataInput, signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>, transaction: IdentityTransactionResult | null, wallet = transaction?.ownerWallet ?? ""): Promise<IdentityWriteResponse> {
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signer.signMessage(buildMetadataAuthorizationMessage(agentId, metadata, issuedAt));
      await apiClient.updateMetadata(agentId, metadata, { wallet, signature, issuedAt });
      return { transaction, metadataSynced: true };
    } catch {
      return { transaction, metadataSynced: false, metadataWarning: "Identity registered on-chain. Metadata sync requires attention." };
    }
  }
}

export class DemoLocalIdentityWriter implements IdentityWriter {
  constructor(private readonly wallet: string) {}
  register(input: IdentityProfileInput, report: StageReporter) { report("preparing"); report("submitting"); const pending = apiClient.demoRegister({ ...input, wallet: this.wallet }); report("pending"); return pending.then((result) => { report("confirmed"); return result; }); }
  update(input: IdentityProfileInput, report: StageReporter) { report("preparing"); report("submitting"); const pending = apiClient.demoUpdate({ ...input, wallet: this.wallet }); report("pending"); return pending.then((result) => { report("confirmed"); return result; }); }
  revoke(agentId: string, report: StageReporter) { return this.lifecycle(agentId, "revoke", report); }
  reactivate(agentId: string, report: StageReporter) { return this.lifecycle(agentId, "reactivate", report); }
  private lifecycle(agentId: string, action: "revoke" | "reactivate", report: StageReporter) { report("preparing"); report("submitting"); const pending = apiClient.demoLifecycle(agentId, this.wallet, action); report("pending"); return pending.then((result) => { report("confirmed"); return result; }); }
}

export function buildMetadataAuthorizationMessage(agentId: string, metadata: AgentMetadataInput, issuedAt: number): string {
  return ["AgentID Metadata Update", `AgentID: ${agentId}`, `Display Name: ${metadata.displayName ?? ""}`, `Description: ${metadata.description ?? ""}`, `Category: ${metadata.category ?? ""}`, `Capabilities: ${metadata.capabilities.join(",")}`, `Issued At: ${issuedAt}`].join("\n");
}

function mapWalletError(error: unknown) {
  if (error instanceof IdentityWriterError) return error;
  const value = error as { code?: number | string; shortMessage?: string; message?: string };
  if (value.code === 4001 || value.code === "ACTION_REJECTED") return new IdentityWriterError("TRANSACTION_REJECTED", "The wallet rejected the transaction.");
  const text = `${value.shortMessage ?? ""} ${value.message ?? ""}`;
  if (text.includes("AgentAlreadyExists")) return new IdentityWriterError("AGENT_ID_EXISTS", "That AgentID is already registered.");
  if (text.includes("WalletAlreadyRegistered")) return new IdentityWriterError("WALLET_ALREADY_REGISTERED", "That wallet already controls an AgentID.");
  if (text.includes("NotAgentOwner")) return new IdentityWriterError("NOT_IDENTITY_OWNER", "Only the controlling wallet can modify this identity.");
  if (text.includes("InvalidStatus")) return new IdentityWriterError("INVALID_STATE", "The identity is not in the required lifecycle state.");
  return new IdentityWriterError("TRANSACTION_FAILED", "The blockchain transaction failed. Expand technical details in your wallet for more information.");
}
