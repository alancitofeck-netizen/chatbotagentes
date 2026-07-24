import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PROVIDER = "google_account";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Base identity scope only — "Continuar con Google" must stay a fast,
// low-friction consent screen. Calendar/Drive/Sheets scopes are requested
// later, incrementally, only when the user actually tries to connect that
// specific integration (src/app/(protected)/profile/sections/IntegrationsSection.tsx),
// per Google's own incremental-authorization best practice (never ask for
// everything upfront at sign-in).
const SCOPE = "openid email profile";

export interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
  scope: string; // space-separated, exactly what Google's token response granted
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
}

/** `include_granted_scopes=true` is the one parameter the three pre-existing
 * Google integrations (Calendar/Sheets/Drive) never set — without it, every
 * new authorization request drops whatever scopes were granted before,
 * defeating incremental auth entirely. Always on here since this is the
 * base identity grant every later incremental request builds on. */
export function getGoogleAccountAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID no está configurado.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenBundle> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth no está configurado (faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google rechazó el intercambio de código: ${JSON.stringify(data)}`);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: (data.scope as string | undefined) ?? "",
  };
}

export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("No se pudo resolver la cuenta de Google.");
  return {
    googleId: data.id as string,
    email: data.email as string,
    name: (data.name as string | undefined) ?? (data.email as string),
    picture: (data.picture as string | undefined) ?? null,
  };
}

/** Bootstrap write — called right after provisionDefaultWorkspaceIfNeeded,
 * before the caller necessarily has a readable session in that same
 * request, so this goes through the service-role-only
 * store_google_account_grant RPC (0043_google_login_and_agent_integrations.sql)
 * rather than the owner/admin/agent-gated upsert_oauth_credentials. Records
 * `scope` inside the vaulted secret (for actually refreshing this token
 * later) AND mirrors the granted-scope list into the plain, non-secret
 * `metadata` column — src/lib/integrations/googleAccount.ts's
 * hasGrantedScope() reads that copy so the three existing integrations'
 * "Conectar" buttons can check reuse-eligibility without a service-role
 * Vault round trip on every page load. */
export async function storeGoogleAccountGrant(workspaceId: string, tokens: GoogleTokenBundle, profile: GoogleProfile): Promise<void> {
  const serviceClient = createServiceRoleClient();
  const metadata = {
    google_id: profile.googleId,
    name: profile.name,
    picture: profile.picture,
    granted_scopes: tokens.scope.split(" ").filter(Boolean),
    connected_at: new Date().toISOString(),
  };

  const { error } = await serviceClient.rpc("store_google_account_grant", {
    p_workspace_id: workspaceId,
    p_external_account_id: profile.email,
    p_secret_json: JSON.stringify(tokens),
    p_metadata: metadata,
  });
  if (error) throw new Error("No se pudo guardar la conexión con Google.");
}

/** Merges newly-granted scopes into the shared grant's tracked list — called
 * by each of googleCalendar.ts/googleSheets.ts/googleDrive.ts right after a
 * successful connect, so the "already authorized, reuse it" fast-path
 * (hasGrantedScope below) stays accurate regardless of which integration
 * was connected first. No-ops (does not throw) if there's no google_account
 * row yet — reachable if a user connects, say, Calendar directly without
 * ever having signed in via "Continuar con Google" (e.g. they registered
 * with email+password) — nothing to merge into in that case. */
export async function recordGrantedScopes(workspaceId: string, newScopes: string): Promise<void> {
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from("integration_connections")
    .select("id, metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!data) return;

  const existing = new Set<string>((data.metadata as { granted_scopes?: string[] } | null)?.granted_scopes ?? []);
  for (const s of newScopes.split(" ").filter(Boolean)) existing.add(s);

  await serviceClient
    .from("integration_connections")
    .update({ metadata: { ...(data.metadata as object), granted_scopes: [...existing] } })
    .eq("id", data.id as string);
}

/** Cheap, RLS-readable check (plain column, no Vault) — do we already hold
 * a Google grant that covers `scope` for this workspace? Used by each
 * integration's /connect route to decide: skip the redirect entirely and
 * reuse the existing token (see getValidGoogleAccountAccessToken), or fall
 * back to a normal (but still incremental) consent redirect. */
export async function hasGrantedScope(workspaceId: string, scope: string): Promise<boolean> {
  const serviceClient = createServiceRoleClient();
  const { data } = await serviceClient
    .from("integration_connections")
    .select("metadata")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .eq("status", "active")
    .maybeSingle();
  const granted = (data?.metadata as { granted_scopes?: string[] } | null)?.granted_scopes ?? [];
  return granted.includes(scope);
}

/** Refresh-on-demand for the shared grant's access token — same pattern as
 * googleCalendar.ts's getValidAccessToken, reused when a specific
 * integration's connect route finds hasGrantedScope() already true and
 * wants to reuse this token rather than redirect to Google again. */
export async function getValidGoogleAccountAccessToken(workspaceId: string): Promise<string | null> {
  const serviceClient = createServiceRoleClient();
  const { data: rpcData, error } = await serviceClient
    .rpc("get_oauth_credentials", { p_workspace_id: workspaceId, p_provider: PROVIDER })
    .maybeSingle();
  const data = rpcData as { external_account_id: string; secret_json: string } | null;
  if (error || !data?.secret_json) return null;

  let tokens = JSON.parse(data.secret_json) as GoogleTokenBundle;
  if (new Date(tokens.expiresAt) > new Date(Date.now() + 60_000)) return tokens.accessToken;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !tokens.refreshToken) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await res.json();
  if (!res.ok) {
    console.error(`[google-account] token refresh failed for workspace ${workspaceId}:`, refreshed);
    // invalid_grant means the refresh token itself is dead (revoked, or the
    // 7-day refresh-token expiry Google applies to OAuth clients still in
    // "Testing" publishing status) and will never succeed on retry — see
    // the identical fix/comment in googleSheets.ts's getValidGoogleSheetsAccessToken.
    if (refreshed?.error === "invalid_grant") {
      await serviceClient.from("integration_connections").update({ status: "inactive" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    }
    return null;
  }

  tokens = { ...tokens, accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() };
  await serviceClient.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: data.external_account_id,
    p_secret_json: JSON.stringify(tokens),
  });
  return tokens.accessToken;
}
