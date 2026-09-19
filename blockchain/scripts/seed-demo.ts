import { network } from "hardhat";
import { writeDeploymentManifest } from "./lib/write-deployment.js";

const DEMO_AGENTS = [
  {
    agentId: "AGT-TRAVEL-001",
    name: "TravelAI",
    organization: "Wander Labs",
    metadataURI: "ipfs://agentid-demo/travel-ai.json",
  },
  {
    agentId: "AGT-HOTEL-001",
    name: "HotelAI",
    organization: "StaySphere",
    metadataURI: "ipfs://agentid-demo/hotel-ai.json",
  },
  {
    agentId: "AGT-PAYMENT-001",
    name: "PaymentAI",
    organization: "PayFlow",
    metadataURI: "ipfs://agentid-demo/payment-ai.json",
  },
] as const;

async function main() {
  const connection = await network.create();
  const { ethers } = connection;
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const agentWallets = signers.slice(1, 4);
  const networkDetails = await ethers.provider.getNetwork();

  const registry: any = await ethers.deployContract("AgentRegistry", [], deployer);
  await registry.waitForDeployment();
  const deploymentReceipt = await registry.deploymentTransaction()?.wait();
  const address = await registry.getAddress();

  const rows = [];
  for (let index = 0; index < DEMO_AGENTS.length; index += 1) {
    const demo = DEMO_AGENTS[index];
    const wallet = agentWallets[index];
    const tx = await registry
      .connect(wallet)
      .registerAgent(demo.agentId, demo.name, demo.organization, demo.metadataURI);
    const receipt = await tx.wait();
    const record = await registry.getAgent(demo.agentId);

    rows.push({
      AgentID: record.agentId,
      Name: record.name,
      Organization: record.organization,
      Wallet: record.owner,
      Status: record.status === 1n ? "Active" : "Unexpected",
      Transaction: receipt?.hash ?? tx.hash,
      Block: receipt?.blockNumber ?? "pending",
    });
  }

  const manifestPath = await writeDeploymentManifest({
    network: connection.networkName,
    chainId: Number(networkDetails.chainId),
    address,
    deployedAtBlock: deploymentReceipt?.blockNumber ?? 0,
  });

  console.log("\nAgentID demo registry seeded");
  console.log("----------------------------");
  console.log(`Network:  ${connection.networkName}`);
  console.log(`Chain ID: ${networkDetails.chainId}`);
  console.log(`Contract: ${address}`);
  console.log(`Manifest: ${manifestPath}`);
  console.table(rows);
  console.log("Each demo identity is controlled by a different local Hardhat wallet.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
