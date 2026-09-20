import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import { existsSync } from "node:fs";
import { defineConfig } from "hardhat/config";

if (existsSync(".env")) process.loadEnvFile(".env");

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
const deploymentPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const normalizedDeploymentKey = deploymentPrivateKey
  ? deploymentPrivateKey.startsWith("0x") ? deploymentPrivateKey : `0x${deploymentPrivateKey}`
  : undefined;

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    ...(sepoliaRpcUrl && normalizedDeploymentKey ? {
      sepolia: {
        type: "http" as const,
        chainType: "l1" as const,
        url: sepoliaRpcUrl,
        chainId: 11155111,
        accounts: [normalizedDeploymentKey],
      },
    } : {}),
  },
});
