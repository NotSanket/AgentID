import { bootstrap } from "./bootstrap.js";

const { app, config } = await bootstrap();

app.listen(config.port, () => {
  console.log(`AgentID backend listening on http://127.0.0.1:${config.port}`);
  console.log(`Registry manifest: ${config.manifestPath}`);
});
