import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only, never import from a
 * Client Component. Used for privileged operations the signed-in user's own
 * RLS-scoped session isn't allowed to do directly, e.g. provisioning the
 * first workspace on sign-up (see src/lib/auth/provision-workspace.ts) or
 * sending/verifying the custom Resend OTP codes (src/lib/email/otp-service.ts)
 * — the same pattern already documented in CLAUDE.md for webhook handlers.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
