import { config } from "./config.js";
import { createApp } from "./controlApi.js";
import { shutdownBrowser } from "./browserManager.js";

async function main() {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[portfolio-agent] listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error("[portfolio-agent] fatal error during boot:", err);
  process.exit(1);
});

/** A diferencia de whatsapp-connector, acá no hay sesiones para "resumir"
 * al reiniciar — un job de sync que se cae con el proceso simplemente queda
 * en su último estado reportado (nunca 'completed'), visible como
 * incompleto/fallido en el historial; el usuario lo vuelve a disparar a
 * mano. Al apagar, solo hace falta cerrar el browser compartido. */
async function gracefulShutdown(signal: string) {
  console.log(`[portfolio-agent] received ${signal}, shutting down...`);
  try {
    await shutdownBrowser();
  } catch (err) {
    console.error("[portfolio-agent] error during shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

/** Mismo criterio que whatsapp-connector: un error no manejado dentro de UN
 * job (Playwright/protocolo del navegador) nunca debe tirar abajo todo el
 * proceso y con él cualquier otro job corriendo para otro workspace. */
process.on("unhandledRejection", (reason) => {
  console.error("[portfolio-agent] unhandled promise rejection (a job likely hit an internal error):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[portfolio-agent] uncaught exception (a job likely hit an internal error):", err);
});
