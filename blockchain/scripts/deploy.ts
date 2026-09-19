import { network } from "hardhat";
import { writeDeploymentManifest } from "./lib/write-deployment.js";

async function main() {
  const connection = await network.create();
  const { ethers } = connection;
  const [deployer] = await ethers.getSigners();
  const networkDetails = await ethers.provider.getNetwork();

  const registry = await ethers.deployContract("AgentRegistry", [], deployer);
  await registry.waitForDeployment();
  const deploymentTransaction = registry.deploymentTransaction();
  const receipt = deploymentTransaction ? await deploymentTransaction.wait() : null;
  const address = await registry.getAddress();
  const manifestPath = await writeDeploymentManifest({
    network: connection.networkName,
    chainId: Number(networkDetails.chainId),
    address,
    deployedAtBlock: receipt?.blockNumber ?? 0,
  });

  console.log("\nAgentID deployment complete");
  console.log("---------------------------");
  console.log(`Network:  ${connection.networkName}`);
  console.log(`Chain ID: ${networkDetails.chainId}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Contract: ${address}`);
  console.log(`Manifest: ${manifestPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
