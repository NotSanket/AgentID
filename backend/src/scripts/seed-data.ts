import { loadRuntimeConfig } from "../config/runtime.js";
import { seedDemoMetadata } from "../persistence/demo-metadata.js";
import { createPersistence } from "../persistence/factory.js";

async function main() {
  const config = loadRuntimeConfig();
  const persistence = await createPersistence(config);
  const seeded = await seedDemoMetadata(persistence.metadataStore);
  console.log(`Seeded ${seeded.length} demo agent metadata records in ${persistence.status.mode} mode:`);
  console.table(seeded.map((record) => ({ agentId: record.agentId, displayName: record.displayName })));
  if (persistence.status.mode === "IN_MEMORY") {
    console.log("In-memory seed data lasts only for this process. Configure Supabase to persist it.");
  }
}

main().catch(() => {
  console.error("Metadata seeding failed. Check the migration and server-side persistence configuration.");
  process.exitCode = 1;
});
