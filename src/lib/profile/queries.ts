import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser, requireActiveWorkspace } from "@/lib/auth/session";

export interface MyProfile {
  fullName: string;
  username: string;
  email: string;
  /** Stored in user_metadata.phone, never the native auth.users.phone column
   * — that column is reserved for Supabase's own OTP/SMS auth flow, and
   * writing it can trigger (or fail without) phone verification depending on
   * whether that provider is configured. This is just a contact field. */
  phone: string;
  role: string;
  workspaceName: string;
  workspaceSlug: string;
  createdAt: string;
}

/** Assembles the profile view from data Supabase already returns on
 * getUser() (email/created_at/user_metadata — no extra query) plus the
 * current workspace membership (role/name), already resolved by
 * requireActiveWorkspace(). No new table: full_name/username/phone live in
 * auth.users.user_metadata, same place full_name was already stored since
 * registration (src/app/(auth)/register/actions.ts). */
export async function getMyProfile(): Promise<MyProfile> {
  const user = await getUser();
  const { role, name: workspaceName, slug: workspaceSlug } = await requireActiveWorkspace();

  const metadata = (user?.user_metadata ?? {}) as { full_name?: string; username?: string; phone?: string };

  return {
    fullName: metadata.full_name ?? "",
    username: metadata.username ?? "",
    email: user?.email ?? "",
    phone: metadata.phone ?? "",
    role,
    workspaceName,
    workspaceSlug,
    createdAt: user?.created_at ?? "",
  };
}

export interface MySession {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
}

/** Reads from Supabase Auth's own auth.sessions table (updated on every
 * login/token refresh) via the get_my_sessions RPC (supabase/migrations/
 * 0015_get_my_sessions.sql) — real session data, no custom login-event
 * tracking of our own. */
export async function getMySessions(): Promise<MySession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_sessions");
  if (error) {
    console.error("[profile] failed to fetch sessions:", error);
    return [];
  }
  return ((data ?? []) as { id: string; created_at: string; updated_at: string | null; user_agent: string | null; ip: string | null }[]).map(
    (row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userAgent: row.user_agent,
      ip: row.ip,
    }),
  );
}
