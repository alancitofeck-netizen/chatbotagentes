/**
 * Every setting is env-var driven, on purpose — this worker must deploy to
 * the same VPS as `worker/whatsapp-connector/` (or anywhere else) without
 * any code change. Fails fast at boot if anything's missing rather than
 * surfacing a confusing error deep inside a job. Mirrors
 * `worker/whatsapp-connector/src/config.ts` exactly.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const PINO_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function resolveLogLevel(): string {
  const raw = (process.env.LOG_LEVEL ?? "info").trim().toLowerCase();
  if (PINO_LEVELS.has(raw)) return raw;
  console.error(`[config] LOG_LEVEL="${process.env.LOG_LEVEL}" is not a recognized level — falling back to "info".`);
  return "info";
}

export const config = {
  // Default 8081 (not 8080, whatsapp-connector's default) so both workers
  // can run side by side on one bare-metal host without a port clash even
  // before either sets PORT explicitly — inside separate Docker containers
  // this doesn't matter (each maps its own host port), but it's a free
  // footgun to avoid for local/non-Docker dev.
  port: Number(process.env.PORT ?? 8081),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  /** Growth Link → worker control calls (start/cancel a job) must present this. */
  workerSecret: requireEnv("PORTFOLIO_WORKER_SECRET"),
  /** This worker → Growth Link inbound webhook presents this. */
  webhookSecret: requireEnv("PORTFOLIO_WORKER_WEBHOOK_SECRET"),
  /** Base URL of the Next.js app's webhook route, e.g. https://app.growthlink.uk */
  nextAppUrl: requireEnv("NEXT_APP_URL"),
  /** Each running job holds a real Chromium browser context — much heavier
   * than a WhatsApp Web session. Starts conservative (1) on purpose; raise
   * only after measuring actual VPS headroom (see README.md). */
  maxConcurrentJobs: Number(process.env.PORTFOLIO_WORKER_MAX_CONCURRENCY ?? 1),
  logLevel: resolveLogLevel(),
} as const;
