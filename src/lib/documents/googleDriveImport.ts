"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import {
  getValidGoogleDriveAccessToken,
  listDriveFiles,
  downloadDriveFile,
  uploadFileToDrive,
  getDriveFileMetadata,
  type DriveFile,
} from "@/lib/integrations/googleDrive";

export interface DriveFileWithStatus extends DriveFile {
  documentId: string | null;
  isFavorite: boolean;
}

/** Lists a Drive folder and, in the same round trip, annotates each file
 * with whether it's already been imported into Documentos (and, if so,
 * favorited) — needed so the browser can render the right star/"Importado"
 * state instead of guessing, given imports are keyed by external_id with no
 * unique DB constraint (see importOrReuseDriveFile below). */
export async function listGoogleDriveFilesAction(input: {
  folderId: string | null;
  search?: string;
  foldersOnly?: boolean;
}): Promise<DriveFileWithStatus[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  const files = await listDriveFiles(accessToken, input);
  const fileIds = files.filter((f) => !f.isFolder).map((f) => f.id);
  if (fileIds.length === 0) return files.map((f) => ({ ...f, documentId: null, isFavorite: false }));

  const supabase = await createClient();
  const { data: existingDocs } = await supabase
    .from("documents")
    .select("id, external_id")
    .eq("workspace_id", workspaceId)
    .eq("source", "google_drive")
    .eq("is_trashed", false)
    .in("external_id", fileIds);

  const docIdByExternalId = new Map((existingDocs ?? []).map((d) => [d.external_id as string, d.id as string]));
  const documentIds = [...docIdByExternalId.values()];
  const { data: favoriteRows } = memberId && documentIds.length
    ? await supabase.from("document_favorites").select("document_id").eq("member_id", memberId).in("document_id", documentIds)
    : { data: [] as { document_id: string }[] };
  const favoriteDocIds = new Set((favoriteRows ?? []).map((f) => f.document_id));

  return files.map((f) => {
    const documentId = docIdByExternalId.get(f.id) ?? null;
    return { ...f, documentId, isFavorite: documentId ? favoriteDocIds.has(documentId) : false };
  });
}

// 25 MB per file — a serverless-function-friendly guard (memory + duration)
// for this ad-hoc "pick a few files" import flow, not a hard product limit.
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/** Shared by the bulk importer and the single-file "Importar"/"Favorito"
 * quick-actions in the Drive browser tab — checks for an existing,
 * non-trashed documents row for this exact Drive file first (there's no
 * unique DB constraint on (workspace_id, external_id), so without this a
 * revisitable, always-fresh browser — unlike the old one-shot modal it
 * replaced — would create a duplicate row every time someone re-imports or
 * re-favorites the same file). Returns the existing or newly-created
 * document id either way. */
async function importOrReuseDriveFile(
  workspaceId: string,
  memberId: string | null,
  accessToken: string,
  fileId: string,
  targetFolderId: string | null,
): Promise<{ documentId: string; reused: boolean }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("source", "google_drive")
    .eq("external_id", fileId)
    .eq("is_trashed", false)
    .maybeSingle();
  if (existing) return { documentId: existing.id as string, reused: true };

  const { name, mimeType, buffer } = await downloadDriveFile(accessToken, fileId);
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error(`«${name}» es demasiado grande (máx. 25 MB).`);

  const meta = await getDriveFileMetadata(accessToken, fileId).catch(() => null);

  const documentId = crypto.randomUUID();
  const storagePath = `${workspaceId}/${documentId}/${name}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, buffer, { contentType: mimeType });
  if (uploadError) throw new Error(`No se pudo subir «${name}» a Storage.`);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      folder_id: targetFolderId,
      name,
      mime_type: mimeType,
      size_bytes: buffer.byteLength,
      storage_path: storagePath,
      owner_id: memberId,
      last_modified_by: memberId,
      source: "google_drive",
      external_id: fileId,
      external_url: meta?.webViewLink ?? null,
      external_metadata: meta ? { parents: meta.parents, owners: meta.owners, sharedWith: meta.sharedWith } : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("documents").remove([storagePath]);
    throw new Error(`No se pudo registrar «${name}».`);
  }
  return { documentId: data.id as string, reused: false };
}

export interface ImportGoogleDriveFilesResult {
  imported: number;
  skipped: { name: string; reason: string }[];
}

/** Bulk "Importar (N)" from the Drive browser's multi-select. */
export async function importGoogleDriveFilesAction(
  fileIds: string[],
  targetFolderId: string | null,
): Promise<ImportGoogleDriveFilesResult> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  let imported = 0;
  const skipped: { name: string; reason: string }[] = [];

  for (const fileId of fileIds) {
    try {
      await importOrReuseDriveFile(workspaceId, memberId, accessToken, fileId, targetFolderId);
      imported += 1;
    } catch (err) {
      skipped.push({ name: fileId, reason: err instanceof Error ? err.message : "Error desconocido." });
    }
  }

  revalidatePath("/documents");
  return { imported, skipped };
}

/** Single-file "Importar" row action in the Drive browser. */
export async function importSingleDriveFileAction(fileId: string, targetFolderId: string | null): Promise<{ documentId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  const result = await importOrReuseDriveFile(workspaceId, memberId, accessToken, fileId, targetFolderId);
  revalidatePath("/documents");
  return { documentId: result.documentId };
}

/** "Favorito" on a live Drive row — the star always means "favorito dentro
 * del CRM" (reuses document_favorites exactly), never Drive's own separate
 * starring, which this app doesn't read or sync. Imports the file first if
 * it isn't already, so a single click on a never-seen-before file both
 * imports it and favorites it. */
export async function toggleDriveFileFavoriteAction(
  fileId: string,
  targetFolderId: string | null,
  nextIsFavorite: boolean,
): Promise<{ documentId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) throw new Error("No se pudo resolver tu usuario en este workspace.");
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  const { documentId } = await importOrReuseDriveFile(workspaceId, memberId, accessToken, fileId, targetFolderId);

  const supabase = await createClient();
  if (nextIsFavorite) {
    await supabase.from("document_favorites").insert({ member_id: memberId, document_id: documentId });
  } else {
    await supabase.from("document_favorites").delete().eq("member_id", memberId).eq("document_id", documentId);
  }

  revalidatePath("/documents");
  return { documentId };
}

/** "Actualizar desde Drive" — re-fetches the current name/location/sharing
 * from Drive for a document that was imported from it, and refreshes the
 * cached columns. On-demand only (button in the detail drawer), not a
 * scheduled job — see the migration comment on why (Hobby plan's 2-cron-job
 * budget is already spent on flush-buffers/sync-kpis). */
export async function refreshDocumentFromDriveAction(documentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("external_id, source")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .single();
  if (fetchError || !doc?.external_id || doc.source !== "google_drive") {
    throw new Error("Este documento no proviene de Google Drive.");
  }

  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  const meta = await getDriveFileMetadata(accessToken, doc.external_id);
  const { error } = await supabase
    .from("documents")
    .update({
      name: meta.name,
      external_url: meta.webViewLink,
      external_metadata: { parents: meta.parents, owners: meta.owners, sharedWith: meta.sharedWith },
      last_modified_by: memberId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el documento desde Google Drive.");

  revalidatePath("/documents");
}

/** "Exportar a Google Drive" — uploads a copy of a CRM document's current
 * bytes into a folder the user picked from their own Drive. Does not change
 * the CRM document's own row (it keeps whatever source/external_id it
 * already had) — exporting is one-directional and doesn't turn the CRM copy
 * into a Drive-tracked document. */
export async function exportDocumentToDriveAction(
  documentId: string,
  driveFolderId: string | null,
): Promise<{ webViewLink: string | null }> {
  const { workspaceId } = await requireActiveWorkspace();
  const accessToken = await getValidGoogleDriveAccessToken(workspaceId);
  if (!accessToken) throw new Error("Conectá Google Drive primero (Perfil > Integraciones).");

  const supabase = await createClient();
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("name, mime_type, storage_path")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .single();
  if (fetchError || !doc) throw new Error("Documento no encontrado.");

  const { data: blob, error: downloadError } = await supabase.storage.from("documents").download(doc.storage_path);
  if (downloadError || !blob) throw new Error("No se pudo leer el archivo del CRM.");

  const buffer = await blob.arrayBuffer();
  const result = await uploadFileToDrive(accessToken, {
    name: doc.name,
    mimeType: doc.mime_type ?? "application/octet-stream",
    buffer,
    parentFolderId: driveFolderId,
  });

  return { webViewLink: result.webViewLink };
}
