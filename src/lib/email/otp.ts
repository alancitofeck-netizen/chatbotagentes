import { randomInt, randomBytes, createHash } from "node:crypto";

export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;
export const RESET_TOKEN_TTL_MINUTES = 10;

/** Cryptographically secure 6-digit numeric code (crypto.randomInt, not
 * Math.random) — zero-padded so e.g. 42 renders as "000042". */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Never store the code itself — only this hash, keyed to (code, email,
 * purpose) so a leaked hash can't be replayed against a different email or
 * a different purpose (e.g. a signup code hash reused for password_reset). */
export function hashOtpCode(code: string, email: string, purpose: string): string {
  return createHash("sha256").update(`${code}:${email.toLowerCase()}:${purpose}`).digest("hex");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 256 bits of entropy, handed to the browser as an httpOnly cookie (never
 * the URL) once a password-reset code is verified — see
 * src/lib/email/otp-service.ts's issueResetToken. */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}
