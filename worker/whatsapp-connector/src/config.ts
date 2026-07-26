/**
 * Every setting is env-var driven, on purpose — this worker must deploy
 * later to Railway, Fly.io, or a plain VPS without any code change, per the
 * "host-agnostic" decision made with the user. Fails fast at boot if
 * anything's missing rather than surfacing a confusing error deep inside a
 * Baileys socket callback.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  /** Next.js → worker control calls (start/logout/send) must present this. */
  workerSecret: requireEnv("WHATSAPP_WEB_WORKER_SECRET"),
  /** This worker → Next.js inbound webhook presents this. */
  webhookSecret: requireEnv("WHATSAPP_WEB_WEBHOOK_SECRET"),
  /** Base URL of the Next.js app's webhook route, e.g. https://app.growthlink.uk */
  nextAppUrl: requireEnv("NEXT_APP_URL"),
} as const;
