import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/**
 * Service-role client — same credential model as the Next.js app's own
 * `createServiceRoleClient()` (src/lib/supabase/service-role.ts), reused
 * here rather than inventing a second DB-access pattern. This worker's
 * entire write pattern is single-row upserts/deletes by primary or unique
 * key, so `@supabase/supabase-js` is sufficient — no raw `pg` driver needed.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
