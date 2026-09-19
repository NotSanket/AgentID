import type { AgentMetadataInput, AgentMetadataStore } from "./types.js";

export const DEMO_AGENT_METADATA: readonly AgentMetadataInput[] = [
  {
    agentId: "AGT-TRAVEL-001",
    displayName: "TravelAI",
    description: "Autonomous travel planning and coordination agent.",
    category: "Travel",
    capabilities: ["SEARCH_HOTELS", "PLAN_TRIP"],
    avatarKey: "travel",
    accentTheme: "ocean",
  },
  {
    agentId: "AGT-HOTEL-001",
    displayName: "HotelAI",
    description: "Deterministic hotel search and availability agent.",
    category: "Hospitality",
    capabilities: ["SEARCH_HOTELS", "CHECK_AVAILABILITY"],
    avatarKey: "hotel",
    accentTheme: "sunset",
  },
  {
    agentId: "AGT-PAYMENT-001",
    displayName: "PaymentAI",
    description: "Simulated payment authorization agent for local demonstrations.",
    category: "Payments",
    capabilities: ["MOCK_PAYMENT", "AUTHORIZE_PAYMENT"],
    avatarKey: "payment",
    accentTheme: "emerald",
  },
];

export async function seedDemoMetadata(store: AgentMetadataStore) {
  return Promise.all(DEMO_AGENT_METADATA.map((metadata) => store.upsert(metadata)));
}
