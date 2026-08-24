import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Service-role client — same credential model as the Next.js app's own
 * `createServiceRoleClient()` (src/lib/supabase/service-role.ts) and as
 * `worker/whatsapp-connector/src/supabase.ts`. Used only for: reading
 * portal credentials via `get_portal_credentials` (service_role-only RPC)
 * and checking `insurance_sync_jobs.cancel_requested` — everything else
 * (job status, extracted policies) goes through the webhook to Growth Link,
 * which does the actual writing.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
