import { existsSync, readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, getAddress, isAddress, type InterfaceAbi } from "ethers";
import type { RuntimeConfig } from "../config/runtime.js";
import type { AgentRecord, IdentityContractConfig, IdentityLifecycleEvent, IdentityLifecycleEventType, RegistryReader } from "../domain/types.js";

export interface BlockchainHealth {
  connected: boolean;
  network: string;
  chainId: number | null;
  expectedChainId: number;
  latestBlock: number | null;
  registryAddress: string | null;
  contractReachable: boolean;
  error?: string;
}

interface Artifact { abi: InterfaceAbi }

export class BlockchainService implements RegistryReader {
  readonly provider: JsonRpcProvider;
  readonly address: string;
  readonly abi: InterfaceAbi;
  private readonly contract?: Contract;
  private readonly initializationError?: string;

  constructor(private readonly config: RuntimeConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.address = config.registryAddress;
    this.abi = [];

    try {
      if (!isAddress(this.address)) throw new Error("AgentRegistry address is missing or invalid.");
      if (!existsSync(config.artifactPath)) throw new Error(`Compiled ABI artifact not found: ${config.artifactPath}`);
      const artifact = JSON.parse(readFileSync(config.artifactPath, "utf8")) as Artifact;
      this.abi = artifact.abi;
      this.contract = new Contract(getAddress(this.address), artifact.abi, this.provider);
    } catch (error) {
      this.initializationError = error instanceof Error ? error.message : String(error);
    }
  }

  async health(): Promise<BlockchainHealth> {
    const base = {
      network: this.config.networkName,
      expectedChainId: this.config.expectedChainId,
      registryAddress: isAddress(this.address) ? getAddress(this.address) : null,
    };
    try {
      if (this.initializationError) throw new Error(this.initializationError);
      const [network, latestBlock, code] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getCode(this.address),
      ]);
      const chainId = Number(network.chainId);
      if (chainId !== this.config.expectedChainId) {
        throw new Error(`Incorrect chain ID: expected ${this.config.expectedChainId}, received ${chainId}.`);
      }
      if (code === "0x") throw new Error("No contract bytecode exists at the configured AgentRegistry address.");
      return { ...base, connected: true, chainId, latestBlock, contractReachable: true };
    } catch (error) {
      return {
        ...base,
        connected: false,
        chainId: null,
        latestBlock: null,
        contractReachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const contract = await this.requireOperationalContract();
    const verification = await contract.verifyAgent(agentId);
    if (!verification.exists) return null;
    return this.mapAgent(await contract.getAgent(agentId));
  }

  async getAgentByWallet(wallet: string): Promise<AgentRecord | null> {
    const contract = await this.requireOperationalContract();
    try {
      return this.mapAgent(await contract.getAgentByWallet(getAddress(wallet)));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "CALL_EXCEPTION") return null;
      throw error;
    }
  }

  async listAgents(): Promise<AgentRecord[]> {
    const contract = await this.requireOperationalContract();
    const events = await contract.queryFilter(contract.filters.AgentRegistered(), 0, "latest");
    const ids = new Set<string>();
    for (const event of events) {
      if ("args" in event && typeof event.args?.agentId === "string") ids.add(event.args.agentId);
    }
    const records = await Promise.all([...ids].map((id) => this.getAgent(id)));
    return records.filter((record): record is AgentRecord => record !== null);
  }

  async contractConfig(): Promise<IdentityContractConfig> {
    await this.requireOperationalContract();
    return {
      network: this.config.networkName,
      chainId: this.config.expectedChainId,
      registryAddress: getAddress(this.address),
      abi: this.abi as readonly unknown[],
    };
  }

  async getLifecycleEvents(agentId: string): Promise<IdentityLifecycleEvent[]> {
    const contract = await this.requireOperationalContract();
    const definitions: Array<[string, IdentityLifecycleEventType]> = [
      ["AgentRegistered", "Registered"],
      ["AgentUpdated", "Updated"],
      ["AgentRevoked", "Revoked"],
      ["AgentReactivated", "Reactivated"],
    ];
    const groups = await Promise.all(definitions.map(async ([eventName, type]) => {
      const filter = contract.filters[eventName]();
      const events = await contract.queryFilter(filter, 0, "latest");
      return events.flatMap((event): IdentityLifecycleEvent[] => {
        if (!("args" in event) || event.args?.agentId !== agentId) return [];
        return [{
          type,
          agentId,
          owner: getAddress(event.args.owner),
          timestamp: event.args.timestamp.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        }];
      });
    }));
    return groups.flat().sort((a, b) => a.blockNumber - b.blockNumber);
  }

  async getContract(): Promise<Contract> {
    return this.requireOperationalContract();
  }

  private async requireOperationalContract(): Promise<Contract> {
    if (!this.contract) throw new Error(this.initializationError ?? "AgentRegistry is unavailable.");
    const [network, code] = await Promise.all([
      this.provider.getNetwork(),
      this.provider.getCode(this.address),
    ]);
    if (Number(network.chainId) !== this.config.expectedChainId) {
      throw new Error(
        `Incorrect chain ID: expected ${this.config.expectedChainId}, received ${network.chainId}.`,
      );
    }
    if (code === "0x") {
      throw new Error("No contract bytecode exists at the configured AgentRegistry address.");
    }
    return this.contract;
  }

  private mapAgent(value: any): AgentRecord {
    return {
      agentId: value.agentId,
      name: value.name,
      organization: value.organization,
      owner: getAddress(value.owner),
      metadataURI: value.metadataURI,
      registeredAt: value.registeredAt.toString(),
      updatedAt: value.updatedAt.toString(),
      status: value.status === 1n ? "Active" : "Revoked",
    };
  }
}
