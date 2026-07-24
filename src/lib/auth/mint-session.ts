import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

/**
 * Establishes a real Supabase session for `email` on the current request's
 * cookies, without needing the user's password again — used right after our
 * own OTP code confirms a brand-new signup (src/app/(auth)/confirm-email/
 * actions.ts). Mechanism: `admin.generateLink({type:'magiclink'})` returns a
 * one-time `email_otp` that was never emailed anywhere (generateLink alone
 * sends nothing); redeeming it via `verifyOtp` yields real access/refresh
 * tokens, which `setSession` then persists through the cookie-bound
 * `@supabase/ssr` client exactly like any other sign-in. Same technique
 * verified working during this session's own manual testing (login-via-otp
 * scratch script), now the production path for this one case.
 */
export async function establishSessionForUser(email: string): Promise<boolean> {
  const serviceClient = createServiceRoleClient();
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.email_otp) return false;

  const anonClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError || !verifyData.session) return false;

  const cookieClient = await createClient();
  const { error: setSessionError } = await cookieClient.auth.setSession({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });

  return !setSessionError;
}
