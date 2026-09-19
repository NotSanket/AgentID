import { AuthenticationService } from "./auth/authentication-service.js";
import { DemoAgentRouter } from "./agents/demo-agents.js";
import { BlockchainService } from "./blockchain/blockchain-service.js";
import { loadRuntimeConfig } from "./config/runtime.js";
import { CommunicationService } from "./services/communication-service.js";
import { AnalyticsService } from "./services/analytics-service.js";
import { MetadataService } from "./services/metadata-service.js";
import { createPersistence } from "./persistence/factory.js";
import { createApp } from "./app.js";
import { DemoIdentityWriteService } from "./services/identity-write-service.js";
import { CommunicationPreparationService } from "./services/communication-preparation-service.js";
import { DemoCommunicationService } from "./services/demo-communication-service.js";

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
  const communicationPreparation = new CommunicationPreparationService({ chainId: config.expectedChainId, verifyingContract: config.registryAddress });
  const analytics = new AnalyticsService(persistence.auditStore, persistence.interactionStore, blockchain);
  const metadata = new MetadataService(blockchain, persistence.metadataStore);
  const demoWrites = new DemoIdentityWriteService(blockchain, metadata, config);
  const demoCommunication = new DemoCommunicationService(blockchain, communication, config);
  const app = createApp({
    blockchain,
    authentication,
    communication,
    communicationPreparation,
    auditStore: persistence.auditStore,
    interactionStore: persistence.interactionStore,
    analytics,
    metadata,
    demoWrites,
    demoCommunication,
    persistenceStatus: persistence.status,
    frontendOrigins: config.frontendOrigins,
  });
  return {
    app,
    config,
    blockchain,
    authentication,
    communication,
    communicationPreparation,
    analytics,
    metadata,
    demoWrites,
    demoCommunication,
    ...persistence,
  };
}
