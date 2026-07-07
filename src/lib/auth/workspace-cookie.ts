import "server-only";
import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE = "gl_active_workspace";

/** Read-only: safe to call from Server Components. */
export async function getActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
}

/** Mutating: only callable from a Server Action or Route Handler. */
export async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Mutating: only callable from a Server Action or Route Handler (e.g. on sign out). */
export async function clearActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}
