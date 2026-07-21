import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PROVIDER = "google_sheets";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
// Read-only on purpose (least privilege) — this module never writes to the
// user's sheet, it only ever reads. A token scoped to Calendar cannot read
// Sheets (Google OAuth tokens are scope-bound), so this is a separate
// connection/provider from google_calendar, not an added scope on it — that
// avoids forcing existing Calendar-only connections to re-consent.
//
// userinfo.email is included alongside spreadsheets.readonly — without it,
// the token can read Sheets but GOOGLE_USERINFO_URL below rejects it (a
// token scoped only to a resource API isn't sufficient to resolve the
// account's identity), which is a real bug this project hit live: the
// connect flow succeeded but resolving "which Google account" then failed
// with "No se pudo resolver la cuenta de Google conectada." userinfo.email
// is a non-sensitive scope — it doesn't require Google's verification
// review the way spreadsheets.readonly might.
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email";

interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

/**
 * Google Sheets OAuth2 + REST integration for the KPIs module
 * (docs: supabase/migrations/0033_kpi_module.sql). Mirrors
 * src/lib/integrations/googleCalendar.ts's shape exactly — same
 * upsert_oauth_credentials/get_oauth_credentials RPC pair
 * (0018_calendar_oauth_credentials.sql, generic across providers), same
 * plain-fetch REST calls (no googleapis SDK, consistent with the rest of
 * this codebase's adapters).
 */

export function getGoogleSheetsAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID no está configurado.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenBundle> {
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
  };
}

async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("No se pudo resolver la cuenta de Google conectada.");
  return data.email as string;
}

/** Called from the OAuth callback route. */
export async function connectGoogleSheets(workspaceId: string, code: string, redirectUri: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const email = await getGoogleAccountEmail(tokens.accessToken);

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: email,
    p_secret_json: JSON.stringify(tokens),
  });
  if (error) throw new Error("No se pudo guardar la conexión con Google Sheets.");
}

export async function disconnectGoogleSheets(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("disconnect_oauth_integration", { p_workspace_id: workspaceId, p_provider: PROVIDER });
}

export interface GoogleSheetsAccountStatus {
  connected: boolean;
  email: string | null;
}

export async function getGoogleSheetsAccountStatus(workspaceId: string): Promise<GoogleSheetsAccountStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("external_account_id, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", PROVIDER)
    .eq("status", "active")
    .maybeSingle();

  return { connected: Boolean(data), email: (data?.external_account_id as string | undefined) ?? null };
}

/** Refresh-on-demand, same pattern as googleCalendar.ts's getValidAccessToken
 * — no scheduled refresh job, this just runs inline before every Sheets
 * call (the cron sync and the manual "Sincronizar ahora" action both go
 * through here). Returns null if this workspace never connected Sheets. */
export async function getValidGoogleSheetsAccessToken(workspaceId: string): Promise<string | null> {
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
    console.error(`[google-sheets] token refresh failed for workspace ${workspaceId}:`, refreshed);
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

/** Extracts the spreadsheet id from either a bare id or a full Google Sheets
 * URL (https://docs.google.com/spreadsheets/d/<id>/edit#gid=0), so the
 * "conectar hoja" form can accept either without the user having to know
 * which part is the actual id. */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export interface SheetTab {
  sheetId: number;
  title: string;
}

/** GET /v4/spreadsheets/{id} — used to list tabs ("cantidad de hojas" in
 * Configuración, and the "Cambiar hoja" picker) and validate the
 * spreadsheet is actually reachable with this token before saving the
 * connection. */
export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
): Promise<{ title: string; sheets: SheetTab[] }> {
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}?fields=properties.title,sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer el archivo de Google Sheets.");

  return {
    title: data.properties?.title ?? "Sin título",
    sheets: (data.sheets ?? []).map((s: { properties: { sheetId: number; title: string } }) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    })),
  };
}

/** GET /v4/spreadsheets/{id}/values/{range} — returns raw rows (row 0 is
 * assumed to be the header row; src/lib/kpis/sync.ts maps columns by name
 * from it, never by fixed position). `range` is just the sheet/tab name
 * (reads the whole tab) since we don't know the row count ahead of time. */
export async function fetchSheetValues(accessToken: string, spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const range = encodeURIComponent(sheetName);
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer los valores de la hoja.");
  return (data.values ?? []) as string[][];
}
