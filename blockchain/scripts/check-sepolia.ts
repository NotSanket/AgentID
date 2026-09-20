import { existsSync, readFileSync } from "node:fs";
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers";

const SEPOLIA_CHAIN_ID = 11155111;

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) throw new Error("Sepolia deployment credentials are not configured.");

  const provider = new JsonRpcProvider(rpcUrl, SEPOLIA_CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) throw new Error("Configured RPC is not Ethereum Sepolia.");

  const wallet = new Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  const artifact = JSON.parse(readFileSync("artifacts/contracts/AgentRegistry.sol/AgentRegistry.json", "utf8"));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const deployment = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas(deployment);
  const fees = await provider.getFeeData();
  const feePerGas = fees.maxFeePerGas ?? fees.gasPrice;
  if (!feePerGas) throw new Error("Sepolia fee data is unavailable.");
  const estimatedMaxCost = gasEstimate * feePerGas;

  console.log(JSON.stringify({
    network: "sepolia",
    chainId: Number(network.chainId),
    deployerAddress: wallet.address,
    balanceWei: balance.toString(),
    balanceSepoliaETH: formatEther(balance),
    estimatedGas: gasEstimate.toString(),
    estimatedMaxCostWei: estimatedMaxCost.toString(),
    estimatedMaxCostSepoliaETH: formatEther(estimatedMaxCost),
    sufficient: balance > estimatedMaxCost * 2n,
  }, null, 2));
}

main().catch(() => {
  console.error("Sepolia connection, credential, or balance verification failed without exposing secret details.");
  process.exitCode = 1;
});
