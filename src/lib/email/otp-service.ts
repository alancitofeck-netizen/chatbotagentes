import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOtpEmail } from "./resend";
import {
  OTP_TTL_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_HOUR,
  RESET_TOKEN_TTL_MINUTES,
  generateOtpCode,
  hashOtpCode,
  generateResetToken,
  hashResetToken,
} from "./otp";

export type OtpPurpose = "signup" | "password_reset";

export interface CreateOtpResult {
  ok: boolean;
  error?: string;
}

/** Generates a fresh 6-digit code, invalidates any still-pending code for
 * this (email, purpose), stores only its hash (0041_email_otp_codes.sql),
 * and emails it via Resend. Rate-limited: a resend cooldown (avoids
 * spamming Resend/the user's inbox) and a per-hour cap (avoids runaway
 * abuse) — both scoped per (email, purpose), so a signup flood on one
 * email can't exhaust the password-reset budget for the same address. */
export async function createAndSendOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId?: string;
}): Promise<CreateOtpResult> {
  const email = params.email.trim().toLowerCase();
  const supabase = createServiceRoleClient();

  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("email_otp_codes")
    .select("created_at")
    .eq("email", email)
    .eq("purpose", params.purpose)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (recent && recent.length > 0) {
    const secondsSinceLast = (Date.now() - new Date(recent[0].created_at as string).getTime()) / 1000;
    if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast);
      return { ok: false, error: `Esperá ${wait} segundos antes de pedir un nuevo código.` };
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      return { ok: false, error: "Alcanzaste el límite de códigos por hora. Probá de nuevo más tarde." };
    }
  }

  // "Reenviar código" must invalidate whatever was pending before.
  await supabase
    .from("email_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email)
    .eq("purpose", params.purpose)
    .is("consumed_at", null);

  const code = generateOtpCode();
  const { error: insertError } = await supabase.from("email_otp_codes").insert({
    email,
    purpose: params.purpose,
    user_id: params.userId ?? null,
    code_hash: hashOtpCode(code, email, params.purpose),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (insertError) return { ok: false, error: "No pudimos generar el código. Intentá de nuevo." };

  const sendResult = await sendOtpEmail({ to: email, code, purpose: params.purpose });
  if (!sendResult.ok) return { ok: false, error: "No pudimos enviar el correo. Intentá de nuevo en un momento." };

  return { ok: true };
}

export interface VerifyOtpResult {
  success: boolean;
  error?: "no_code" | "expired" | "invalid" | "too_many_attempts";
  userId?: string;
  otpId?: string;
}

/** Checks the code against the latest non-consumed row for (email,
 * purpose). A wrong guess increments `attempts` (capped at
 * OTP_MAX_ATTEMPTS) rather than immediately invalidating the code, so a
 * mistyped digit doesn't force a resend — but repeated guessing does. */
export async function verifyOtp(params: { email: string; purpose: OtpPurpose; code: string }): Promise<VerifyOtpResult> {
  const email = params.email.trim().toLowerCase();
  const supabase = createServiceRoleClient();

  const { data: row } = await supabase
    .from("email_otp_codes")
    .select("id, code_hash, attempts, expires_at, user_id")
    .eq("email", email)
    .eq("purpose", params.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { success: false, error: "no_code" };
  if (new Date(row.expires_at as string).getTime() < Date.now()) return { success: false, error: "expired" };
  if ((row.attempts as number) >= OTP_MAX_ATTEMPTS) return { success: false, error: "too_many_attempts" };

  const expectedHash = hashOtpCode(params.code, email, params.purpose);
  if (expectedHash !== row.code_hash) {
    await supabase
      .from("email_otp_codes")
      .update({ attempts: (row.attempts as number) + 1 })
      .eq("id", row.id as string);
    return { success: false, error: "invalid" };
  }

  await supabase
    .from("email_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id as string);

  return { success: true, userId: row.user_id as string | undefined, otpId: row.id as string };
}

/** Password-reset only: mints a random, high-entropy token (never the code
 * itself) tied to the just-verified OTP row, so the "set new password" step
 * can be authorized via an httpOnly cookie instead of re-asking for the
 * code or requiring a real Supabase session. */
export async function issueResetToken(otpId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const token = generateResetToken();
  await supabase
    .from("email_otp_codes")
    .update({
      reset_token_hash: hashResetToken(token),
      reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString(),
    })
    .eq("id", otpId);
  return token;
}

export interface ConsumeResetTokenResult {
  success: boolean;
  userId?: string;
}

/** Single-use: the token is marked `reset_token_used_at` on success, so a
 * copy-pasted or replayed cookie value can't authorize a second password
 * change. */
export async function consumeResetToken(email: string, token: string): Promise<ConsumeResetTokenResult> {
  const supabase = createServiceRoleClient();

  const { data: row } = await supabase
    .from("email_otp_codes")
    .select("id, user_id, reset_token_expires_at")
    .eq("email", email.trim().toLowerCase())
    .eq("purpose", "password_reset")
    .eq("reset_token_hash", hashResetToken(token))
    .is("reset_token_used_at", null)
    .maybeSingle();

  if (!row) return { success: false };
  if (new Date(row.reset_token_expires_at as string).getTime() < Date.now()) return { success: false };

  await supabase
    .from("email_otp_codes")
    .update({ reset_token_used_at: new Date().toISOString() })
    .eq("id", row.id as string);

  return { success: true, userId: row.user_id as string };
}

/** Resolves an existing account by email via public.get_user_id_by_email
 * (0041) — auth.users isn't exposed to PostgREST at all, so this needs the
 * SECURITY DEFINER RPC rather than a plain `.from("users")` query. Used by
 * forgot-password's anti-enumeration check: always report success to the
 * caller either way, but only actually create+send a code when an account
 * really exists. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.rpc("get_user_id_by_email", { p_email: email.trim().toLowerCase() });
  return (data as string | null) ?? null;
}
