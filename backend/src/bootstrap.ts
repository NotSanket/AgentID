import { AuthenticationService } from "./auth/authentication-service.js";
import { DemoAgentRouter } from "./agents/demo-agents.js";
import { BlockchainService } from "./blockchain/blockchain-service.js";
import { loadRuntimeConfig } from "./config/runtime.js";
import { CommunicationService } from "./services/communication-service.js";
import { AnalyticsService } from "./services/analytics-service.js";
import { MetadataService } from "./services/metadata-service.js";
import { createPersistence } from "./persistence/factory.js";
import { createApp } from "./app.js";

export async function bootstrap() {
  const config = loadRuntimeConfig();
  const blockchain = new BlockchainService(config);
  const persistence = await createPersistence(config);
  const authentication = new AuthenticationService(blockchain, persistence.replayStore, persistence.auditStore, {
    chainId: config.expectedChainId,
    verifyingContract: config.registryAddress,
    maxAgeSeconds: config.requestMaxAgeSeconds,
    clockSkewSeconds: config.clockSkewSeconds,
  });
  const router = new DemoAgentRouter();
  const communication = new CommunicationService(authentication, router, persistence.interactionStore);
  const analytics = new AnalyticsService(persistence.auditStore, persistence.interactionStore, blockchain);
  const metadata = new MetadataService(blockchain, persistence.metadataStore);
  const app = createApp({
    blockchain,
    authentication,
    communication,
    auditStore: persistence.auditStore,
    interactionStore: persistence.interactionStore,
    analytics,
    metadata,
    persistenceStatus: persistence.status,
    frontendOrigins: config.frontendOrigins,
  });
  return {
    app,
    config,
    blockchain,
    authentication,
    communication,
    analytics,
    metadata,
    ...persistence,
  };
}
