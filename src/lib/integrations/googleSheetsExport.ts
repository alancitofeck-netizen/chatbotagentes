import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { recordGrantedScopes } from "@/lib/integrations/googleAccount";

const PROVIDER = "google_sheets_export";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
// Full read/write scope, not .readonly — this is the one Google integration
// in the project that actually writes to a user's sheet (exportar
// Referidos). Separate provider from the existing read-only 'google_sheets'
// (googleSheets.ts, used by KPIs/Hojas de asesores) — same reasoning as
// Calendar vs Sheets being separate connections: widening an existing
// provider's scope would silently affect every workspace already connected
// to it, forcing an unexpected re-consent. userinfo.email alongside
// spreadsheets, same reason as googleSheets.ts: without it, resolving which
// Google account this is fails even though the Sheets calls themselves work.
const SCOPE = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";

interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

/**
 * Google Sheets OAuth2 (write) + REST integration for "Exportar Referidos a
 * hoja" (Asesorías > Referidos). Mirrors src/lib/integrations/googleSheets.ts
 * exactly — same upsert_oauth_credentials/get_oauth_credentials RPC pair,
 * same plain-fetch REST calls (no googleapis SDK, consistent with the rest
 * of this codebase's adapters) — just a different provider/scope.
 */

export function getGoogleSheetsExportAuthUrl(redirectUri: string, state: string): string {
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

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenBundle & { scope: string }> {
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

async function getGoogleAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error("No se pudo resolver la cuenta de Google conectada.");
  return data.email as string;
}

/** Called from the OAuth callback route. */
export async function connectGoogleSheetsExport(workspaceId: string, code: string, redirectUri: string): Promise<void> {
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

  await recordGrantedScopes(workspaceId, tokens.scope).catch(() => {});
}

/** Generic disconnect (disconnect_oauth_integration, 0043) — unlike
 * disconnect_google_sheets (read-only provider), this provider has no
 * special-cased side effects to clean up (no setters point at it), so the
 * generic RPC is enough: deletes the Vault secret + flips status. */
export async function disconnectGoogleSheetsExport(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disconnect_oauth_integration", { p_workspace_id: workspaceId, p_provider: PROVIDER });
  if (error) throw new Error("No se pudo desconectar Google Sheets.");
}

export interface GoogleSheetsExportAccountStatus {
  connected: boolean;
  email: string | null;
}

export async function getGoogleSheetsExportAccountStatus(workspaceId: string): Promise<GoogleSheetsExportAccountStatus> {
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

/** Refresh-on-demand, same pattern as googleSheets.ts's
 * getValidGoogleSheetsAccessToken — runs inline before every write, no
 * scheduled refresh job. Returns null if this workspace never connected. */
export async function getValidGoogleSheetsExportAccessToken(workspaceId: string): Promise<string | null> {
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
    console.error(`[google-sheets-export] token refresh failed for workspace ${workspaceId}:`, refreshed);
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

export interface SheetTab {
  sheetId: number;
  title: string;
}

/** GET /v4/spreadsheets/{id} — same call as googleSheets.ts's
 * fetchSpreadsheetMetadata, duplicated here (not imported) because that
 * version lives in the read-only module and importing it would create a
 * cross-provider dependency that reads oddly; the HTTP call itself has
 * nothing provider-specific about it beyond the token passed in. */
export async function fetchSpreadsheetMetadata(accessToken: string, spreadsheetId: string): Promise<{ title: string; sheets: SheetTab[] }> {
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

/** Extracts the spreadsheet id from either a bare id or a full Google Sheets
 * URL — same helper as googleSheets.ts, duplicated for the same reason as
 * fetchSpreadsheetMetadata above (pure function, no provider dependency,
 * but kept local to this module rather than cross-imported). */
export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/** GET /v4/spreadsheets/{id}/values/{range} — one column, from `fromRow` to
 * the end (A1 notation open range, e.g. "Hoja1!C3:C"). UNFORMATTED_VALUE so
 * numbers in column A come back as numbers, not "1,00" locale strings. */
export async function fetchColumnValues(accessToken: string, spreadsheetId: string, sheetName: string, column: string, fromRow: number): Promise<string[]> {
  const range = encodeURIComponent(`${sheetName}!${column}${fromRow}:${column}`);
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer la columna de la hoja.");
  return ((data.values ?? []) as unknown[][]).map((row) => (row[0] === undefined || row[0] === null ? "" : String(row[0])));
}

/** PUT /v4/spreadsheets/{id}/values/{range} — writes one row's worth of
 * cells. valueInputOption=RAW on purpose (never USER_ENTERED): RAW stores
 * each value as the literal string sent, with no attempt to parse it as a
 * number/date/formula — exactly what a phone number like "52 5591909758"
 * needs so Sheets never reinterprets it, no leading-apostrophe trick
 * required. */
export async function writeRowValues(accessToken: string, spreadsheetId: string, sheetName: string, firstColumn: string, row: number, values: (string | number | null)[]): Promise<void> {
  const lastColumn = String.fromCharCode(firstColumn.charCodeAt(0) + values.length - 1);
  const range = encodeURIComponent(`${sheetName}!${firstColumn}${row}:${lastColumn}${row}`);
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: `${sheetName}!${firstColumn}${row}:${lastColumn}${row}`, values: [values.map((v) => (v === null ? "" : v))] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo escribir en la hoja.");
}

/** PUT a single cell — used to update just the "Agendó" column of an
 * already-exported row, without touching the rest of that row. */
export async function writeCellValue(accessToken: string, spreadsheetId: string, sheetName: string, column: string, row: number, value: string): Promise<void> {
  const range = encodeURIComponent(`${sheetName}!${column}${row}`);
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ range: `${sheetName}!${column}${row}`, values: [[value]] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo actualizar la celda.");
}

/** POST /v4/spreadsheets/{id}:batchUpdate — inserts one blank row at
 * `atRow` (1-indexed), pushing everything from there down. inheritFromBefore
 * copies the format (borders, font) of the row immediately above instead of
 * the default blank format, so a group inserted after existing data rows
 * looks the same as them, never like the header rows above. Only call this
 * when `atRow` is strictly after at least one real data row — inserting at
 * the very first data row of an empty sheet has nothing valid to inherit
 * from (see sheetId resolution in referralExport/runner.ts). */
export async function insertBlankRow(accessToken: string, spreadsheetId: string, sheetGid: number, atRow: number): Promise<void> {
  const res = await fetch(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: { sheetId: sheetGid, dimension: "ROWS", startIndex: atRow - 1, endIndex: atRow },
            inheritFromBefore: true,
          },
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo insertar la fila en la hoja.");
}
