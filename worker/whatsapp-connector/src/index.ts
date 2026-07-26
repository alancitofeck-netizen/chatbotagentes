import { config } from "./config.js";
import { createApp } from "./controlApi.js";
import { resumeAllActiveSessions } from "./sessionManager.js";

async function main() {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[whatsapp-connector] listening on port ${config.port}`);
  });

  // Load-bearing: without this, every worker restart/redeploy would force
  // every connected member to re-scan a QR code.
  await resumeAllActiveSessions();
}

main().catch((err) => {
  console.error("[whatsapp-connector] fatal error during boot:", err);
  process.exit(1);
});
