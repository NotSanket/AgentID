import { AuthenticationService } from "./auth/authentication-service.js";
import { DemoAgentRouter } from "./agents/demo-agents.js";
import { BlockchainService } from "./blockchain/blockchain-service.js";
import { loadRuntimeConfig } from "./config/runtime.js";
import { CommunicationService } from "./services/communication-service.js";
import { InMemoryAuditStore } from "./stores/audit-store.js";
import { InMemoryReplayStore } from "./stores/replay-store.js";
import { createApp } from "./app.js";

export function bootstrap() {
  const config = loadRuntimeConfig();
  const blockchain = new BlockchainService(config);
  const auditStore = new InMemoryAuditStore();
  const replayStore = new InMemoryReplayStore();
  const authentication = new AuthenticationService(blockchain, replayStore, auditStore, {
    chainId: config.expectedChainId,
    verifyingContract: config.registryAddress,
    maxAgeSeconds: config.requestMaxAgeSeconds,
    clockSkewSeconds: config.clockSkewSeconds,
  });
  const router = new DemoAgentRouter();
  const communication = new CommunicationService(authentication, router);
  const app = createApp({ blockchain, authentication, communication, auditStore });
  return { app, config, blockchain, authentication, communication, auditStore, replayStore };
}
