import "server-only";
import { cookies } from "next/headers";

const RESET_TOKEN_COOKIE = "gl_pwreset_token";

/** Read-only: safe to call from Server Components (reset-password/page.tsx
 * uses this to decide which of the two stages — code entry vs. new
 * password — to render). */
export async function getResetTokenCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(RESET_TOKEN_COOKIE)?.value ?? null;
}

/** Mutating: only callable from a Server Action. httpOnly so the token
 * (proof the code was verified) never touches client JS or the URL — only
 * the server action that reads it back (resetPassword) can see the value. */
export async function setResetTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(RESET_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // matches RESET_TOKEN_TTL_MINUTES in src/lib/email/otp.ts
  });
}

export async function clearResetTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(RESET_TOKEN_COOKIE);
}
