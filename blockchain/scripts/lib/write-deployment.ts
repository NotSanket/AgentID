import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DeploymentManifest {
  network: string;
  chainId: number;
  contractName: "AgentRegistry";
  address: string;
  deployedAtBlock: number;
  abiArtifact: string;
}

export async function writeDeploymentManifest(
  manifest: Omit<DeploymentManifest, "contractName" | "abiArtifact">,
): Promise<string> {
  const deploymentsDirectory = path.resolve(process.cwd(), "deployments");
  const outputPath = path.join(deploymentsDirectory, `${manifest.network}.json`);
  const contents: DeploymentManifest = {
    ...manifest,
    contractName: "AgentRegistry",
    abiArtifact: "../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json",
  };

  await mkdir(deploymentsDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  return outputPath;
}
