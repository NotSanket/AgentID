import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

async function gasUsed(transaction: { wait: () => Promise<{ gasUsed: bigint } | null> }) {
  const receipt = await transaction.wait();
  if (receipt === null) {
    throw new Error("Transaction was not mined; cannot record gas usage.");
  }
  return receipt.gasUsed.toString();
}

async function main() {
  const connection = await network.create();
  const { ethers } = connection;
  const [owner] = await ethers.getSigners();
  const networkDetails = await ethers.provider.getNetwork();
  const registry = await ethers.deployContract("AgentRegistry");
  await registry.waitForDeployment();

  const registrationGas = await gasUsed(
    await registry.registerAgent(
      "AGT-GAS-001",
      "GasObservationAI",
      "AgentID Lab",
      "ipfs://agentid/gas-observation.json",
    ),
  );
  const updateGas = await gasUsed(
    await registry.updateAgent(
      "AGT-GAS-001",
      "GasObservationAI V2",
      "AgentID Lab",
      "ipfs://agentid/gas-observation-v2.json",
    ),
  );
  const revokeGas = await gasUsed(await registry.revokeAgent("AGT-GAS-001"));
  const reactivateGas = await gasUsed(await registry.reactivateAgent("AGT-GAS-001"));

  const report = {
    generatedAt: new Date().toISOString(),
    source: "Actual Hardhat transaction receipts (not estimates)",
    network: connection.networkName,
    chainId: networkDetails.chainId.toString(),
    contract: await registry.getAddress(),
    caller: owner.address,
    compiler: "Solidity 0.8.34, optimizer enabled with 200 runs",
    gasUsed: {
      registerAgent: registrationGas,
      updateAgent: updateGas,
      revokeAgent: revokeGas,
      reactivateAgent: reactivateGas,
    },
    note: "Local gas can change when contract code, compiler settings, or input lengths change.",
  };

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const reportPath = resolve(scriptDirectory, "../../docs/local-gas-report.json");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\nMeasured local gas usage");
  console.log("------------------------");
  console.table(report.gasUsed);
  console.log(`Saved to: ${reportPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
