import { config } from "./config.js";
import { createApp } from "./controlApi.js";
import { initSessionManager, resumeAllActiveSessions, shutdownAll } from "./sessionManager.js";
import { WhatsAppWebJsProvider } from "./providers/whatsAppWebJsProvider.js";

/**
 * The only line that would change to swap the underlying WhatsApp library
 * later (Baileys, Meta Cloud API, ...) — everything else in this worker
 * depends only on the `WhatsAppService` interface (whatsAppService.ts).
 */
initSessionManager(new WhatsAppWebJsProvider());

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

/**
 * Each session now owns a real Chromium process (whatsapp-web.js) — unlike
 * the previous Baileys-based worker, an abrupt process exit here would leave
 * orphaned browser processes behind and skip the next boot's clean resume.
 * stop() (not logout()) tears down Chromium without invalidating the
 * remote WhatsApp session.
 */
async function gracefulShutdown(signal: string) {
  console.log(`[whatsapp-connector] received ${signal}, shutting down sessions...`);
  try {
    await shutdownAll();
  } catch (err) {
    console.error("[whatsapp-connector] error during shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

/**
 * Real, observed failure mode (found during local verification, not
 * theoretical): whatsapp-web.js/Puppeteer can throw a raw, unhandled
 * protocol error (e.g. "Execution context was destroyed") from deep inside
 * a single session's Chromium instance, outside any promise this worker
 * awaits directly. Without these handlers, that ONE session's internal
 * hiccup crashes the entire Node process — taking down every other
 * workspace's connected session with it. Log loudly and keep running;
 * never let one session's library-level flakiness be a single point of
 * failure for the whole worker.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[whatsapp-connector] unhandled promise rejection (a session likely hit an internal error):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[whatsapp-connector] uncaught exception (a session likely hit an internal error):", err);
});
