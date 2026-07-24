import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { recordGrantedScopes } from "@/lib/integrations/googleAccount";

const PROVIDER = "google_drive";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
// Full read/write `drive` scope, NOT the narrower `drive.readonly` this
// started with — "Exportar a Google Drive" needs to upload into a folder the
// user already had in their Drive before ever touching this app, which
// `drive.file` (write access restricted to app-created files) can't do
// either. userinfo.email is included alongside it for the same reason it was
// added to googleCalendar.ts/googleSheets.ts: a token scoped only to a
// resource API can't resolve "which Google account" via GOOGLE_USERINFO_URL.
// Accounts that connected before this scope widened only hold the old
// read-only grant — uploadFileToDrive below will get a 403 from Google until
// they reconnect (forced re-consent via prompt=consent on next /connect).
const SCOPE = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email";

const GOOGLE_DOC_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  "application/vnd.google-apps.document": {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
  },
  "application/vnd.google-apps.spreadsheet": {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  },
  "application/vnd.google-apps.presentation": {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extension: "pptx",
  },
};
// Fallback for other native Google types (drawings, forms, sites, etc.) that
// have no direct Office-format export — PDF is always a valid export target
// for anything Google Docs Editors can render.
const GOOGLE_DOC_FALLBACK_EXPORT = { mimeType: "application/pdf", extension: "pdf" };

interface GoogleTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

/**
 * Google Drive OAuth2 + REST integration for the Documentos module — lets a
 * workspace connect a Google account once and then browse/import individual
 * files from it into Documentos (source='google_drive', matching the
 * provider/source values already anticipated by 0019_documents_module.sql).
 * Mirrors googleSheets.ts's shape exactly (same upsert_oauth_credentials/
 * get_oauth_credentials RPC pair, plain fetch, no googleapis SDK).
 */

export function getGoogleDriveAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID no está configurado.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    // Merges with whatever this Google account already granted elsewhere
    // (e.g. "Continuar con Google" login) instead of narrowing the consent
    // screen to only this scope — real incremental authorization.
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
export async function connectGoogleDrive(workspaceId: string, code: string, redirectUri: string): Promise<void> {
  const tokens = await exchangeCodeForTokens(code, redirectUri);
  const email = await getGoogleAccountEmail(tokens.accessToken);

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_oauth_credentials", {
    p_workspace_id: workspaceId,
    p_provider: PROVIDER,
    p_external_account_id: email,
    p_secret_json: JSON.stringify(tokens),
  });
  if (error) throw new Error("No se pudo guardar la conexión con Google Drive.");

  await recordGrantedScopes(workspaceId, tokens.scope).catch(() => {});
}

export async function disconnectGoogleDrive(workspaceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("disconnect_oauth_integration", { p_workspace_id: workspaceId, p_provider: PROVIDER });
}

export interface GoogleDriveStatus {
  connected: boolean;
  email: string | null;
}

export async function getGoogleDriveStatus(workspaceId: string): Promise<GoogleDriveStatus> {
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

/** Refresh-on-demand, same pattern as googleSheets.ts's/googleCalendar.ts's —
 * runs inline before every Drive call, no scheduled refresh job. Returns
 * null if this workspace never connected Drive. */
export async function getValidGoogleDriveAccessToken(workspaceId: string): Promise<string | null> {
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
    console.error(`[google-drive] token refresh failed for workspace ${workspaceId}:`, refreshed);
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

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  iconLink: string | null;
  webViewLink: string | null;
  modifiedTime: string | null;
  sizeBytes: number | null;
}

interface RawDriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

function mapDriveFile(f: RawDriveFile): DriveFile {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    iconLink: f.iconLink ?? null,
    webViewLink: f.webViewLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    sizeBytes: f.size ? Number(f.size) : null,
  };
}

const LIST_FIELDS = "files(id,name,mimeType,iconLink,webViewLink,modifiedTime,size)";

/** GET /v3/files — lists the contents of a single Drive folder (or a
 * name-search across the whole Drive when `search` is given, ignoring
 * `folderId`). Folders navigation only, never recursive — the Documentos
 * import flow lets a user pick individual files, not "import this whole
 * folder tree" (a separate, bigger feature not in scope here). */
export async function listDriveFiles(
  accessToken: string,
  options: { folderId: string | null; search?: string; foldersOnly?: boolean },
): Promise<DriveFile[]> {
  const baseQ = options.search?.trim()
    ? `name contains '${options.search.trim().replace(/'/g, "\\'")}' and trashed = false`
    : `'${options.folderId ?? "root"}' in parents and trashed = false`;
  const q = options.foldersOnly ? `${baseQ} and mimeType = 'application/vnd.google-apps.folder'` : baseQ;

  const params = new URLSearchParams({
    q,
    fields: LIST_FIELDS,
    orderBy: "folder,name",
    pageSize: "100",
    spaces: "drive",
  });

  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo listar los archivos de Google Drive.");
  return ((data.files ?? []) as RawDriveFile[]).map(mapDriveFile);
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  iconLink: string | null;
  modifiedTime: string | null;
  sizeBytes: number | null;
  parents: string[];
  owners: string[];
  sharedWith: string[];
}

/** GET /v3/files/{id} with the richer field set — used by "Actualizar desde
 * Drive" (refreshDocumentFromDriveAction) to refresh a CRM-imported
 * document's cached name/location/permissions, and by the Drive browser's
 * file-info panel. Kept separate from the lean `listDriveFiles` fields (a
 * folder listing of 100 files doesn't need permissions for each one). */
export async function getDriveFileMetadata(accessToken: string, fileId: string): Promise<DriveFileMetadata> {
  const fields = "id,name,mimeType,webViewLink,iconLink,modifiedTime,size,parents,owners(displayName,emailAddress),permissions(emailAddress,role,type)";
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer el archivo de Google Drive.");

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    webViewLink: data.webViewLink ?? null,
    iconLink: data.iconLink ?? null,
    modifiedTime: data.modifiedTime ?? null,
    sizeBytes: data.size ? Number(data.size) : null,
    parents: data.parents ?? [],
    owners: (data.owners ?? []).map((o: { displayName?: string; emailAddress?: string }) => o.displayName ?? o.emailAddress ?? "—"),
    sharedWith: (data.permissions ?? [])
      .filter((p: { type: string }) => p.type === "user")
      .map((p: { emailAddress?: string; role: string }) => `${p.emailAddress ?? "—"} (${p.role})`),
  };
}

export interface DownloadedDriveFile {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

/** Downloads a single file's bytes — native Google formats (Docs/Sheets/
 * Slides have no binary content of their own) go through the `/export`
 * endpoint into an Office-compatible format; everything else (PDF, images,
 * regular uploads already in Drive) is fetched directly via `alt=media`. */
export async function downloadDriveFile(accessToken: string, fileId: string): Promise<DownloadedDriveFile> {
  const metaRes = await fetch(`${DRIVE_FILES_URL}/${fileId}?fields=id,name,mimeType`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(meta?.error?.message ?? "No se pudo leer el archivo de Google Drive.");

  const nativeExport = GOOGLE_DOC_EXPORTS[meta.mimeType as string];
  const isGoogleNative = (meta.mimeType as string).startsWith("application/vnd.google-apps.");

  if (isGoogleNative) {
    const target = nativeExport ?? GOOGLE_DOC_FALLBACK_EXPORT;
    const exportRes = await fetch(
      `${DRIVE_FILES_URL}/${fileId}/export?mimeType=${encodeURIComponent(target.mimeType)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!exportRes.ok) throw new Error(`No se pudo exportar «${meta.name}» desde Google Drive.`);
    const buffer = await exportRes.arrayBuffer();
    const baseName = meta.name.includes(".") ? meta.name : `${meta.name}.${target.extension}`;
    return { name: baseName, mimeType: target.mimeType, buffer };
  }

  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo descargar «${meta.name}» desde Google Drive.`);
  const buffer = await res.arrayBuffer();
  return { name: meta.name as string, mimeType: (meta.mimeType as string) || "application/octet-stream", buffer };
}

/** POST /upload/drive/v3/files (multipart) — "Exportar a Google Drive" on a
 * CRM document. Uploads into an existing folder the user picked from their
 * own Drive (not a folder our app created), which is exactly why the
 * broader `drive` scope is required instead of `drive.file` — see the SCOPE
 * comment above. A 403 here almost always means the connected account still
 * only holds the old drive.readonly grant and needs to reconnect. */
export async function uploadFileToDrive(
  accessToken: string,
  input: { name: string; mimeType: string; buffer: ArrayBuffer; parentFolderId: string | null },
): Promise<{ id: string; webViewLink: string | null }> {
  const boundary = `growthlink-${crypto.randomUUID()}`;
  const metadata = { name: input.name, parents: input.parentFolderId ? [input.parentFolderId] : undefined };

  // Built as a plain concatenated Buffer rather than a `Blob` — Blob's
  // BlobPart typing rejects the Uint8Array<ArrayBufferLike> that
  // TextEncoder.encode()/Node's Buffer return under this project's
  // TypeScript version, since it can't statically rule out a
  // SharedArrayBuffer-backed view. Buffer is a valid fetch() body directly
  // in the Node runtime these server actions/route handlers run in.
  const metadataPart = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, "utf-8");
  const fileHeaderPart = Buffer.from(`--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`, "utf-8");
  const filePart = Buffer.from(input.buffer);
  const closingPart = Buffer.from(`\r\n--${boundary}--`, "utf-8");
  const body = Buffer.concat([metadataPart, fileHeaderPart, filePart, closingPart]);

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403) throw new Error("Google Drive rechazó la subida — reconectá Google Drive (Perfil > Integraciones) para otorgar permiso de escritura.");
    throw new Error(data?.error?.message ?? "No se pudo subir el archivo a Google Drive.");
  }
  return { id: data.id, webViewLink: data.webViewLink ?? null };
}
