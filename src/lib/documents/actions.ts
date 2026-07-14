"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import {
  getDocumentById,
  getDocuments,
  getDocumentsByRelated,
  getFolderTree,
  type DocumentView,
} from "@/lib/documents/queries";

function revalidateDocuments() {
  revalidatePath("/documents");
}

export async function getFolderTreeAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getFolderTree(workspaceId);
}

export async function getDocumentsAction(options: { view: DocumentView; folderId?: string | null; search?: string }) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  return getDocuments(workspaceId, memberId, options);
}

export async function getDocumentByIdAction(documentId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  return getDocumentById(workspaceId, documentId, memberId);
}

export async function getDocumentsByRelatedAction(relatedType: string, relatedId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  return getDocumentsByRelated(workspaceId, memberId, relatedType, relatedId);
}

export async function createFolder(name: string, parentFolderId: string | null): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!name.trim()) throw new Error("El nombre de la carpeta es obligatorio.");
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .insert({ workspace_id: workspaceId, name: name.trim(), parent_folder_id: parentFolderId, created_by: memberId })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la carpeta.");
  revalidateDocuments();
  return { id: data.id as string };
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error("El nombre no puede estar vacío.");
  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ name: name.trim(), updated_at: new Date().toISOString() }).eq("id", folderId);
  if (error) throw new Error("No se pudo renombrar la carpeta.");
  revalidateDocuments();
}

export async function moveFolder(folderId: string, newParentFolderId: string | null): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("folders")
    .update({ parent_folder_id: newParentFolderId, updated_at: new Date().toISOString() })
    .eq("id", folderId);
  if (error) throw new Error("No se pudo mover la carpeta.");
  revalidateDocuments();
}

/** Moves every document nested (at any depth) under this folder to the
 * papelera, then deletes the folder itself — its subfolders cascade-delete
 * via `parent_folder_id ... on delete cascade`, and any document rows
 * referencing them fall back to `folder_id = null` (still visible, still
 * trashed) rather than being lost. */
export async function deleteFolder(folderId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const allFolders = await getFolderTree(workspaceId);

  const descendantIds = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of allFolders) {
      if (f.parentFolderId && descendantIds.has(f.parentFolderId) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        grew = true;
      }
    }
  }

  await supabase
    .from("documents")
    .update({ is_trashed: true, trashed_at: new Date().toISOString() })
    .in("folder_id", [...descendantIds]);
  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) throw new Error("No se pudo eliminar la carpeta.");
  revalidateDocuments();
}

/** Called once the browser has already uploaded the file straight to
 * Supabase Storage (`supabase.storage.from('documents').upload(...)`,
 * protected by the RLS policies from 0019_documents_module.sql) — this just
 * records the row. */
export async function recordUploadedDocument(input: {
  name: string;
  folderId: string | null;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  relatedType?: string;
  relatedId?: string;
}): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      folder_id: input.folderId,
      name: input.name,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_path: input.storagePath,
      owner_id: memberId,
      last_modified_by: memberId,
      source: "upload",
      related_type: input.relatedType ?? null,
      related_id: input.relatedId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo registrar el archivo.");
  revalidateDocuments();
  return { id: data.id as string };
}

export async function renameDocument(documentId: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error("El nombre no puede estar vacío.");
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ name: name.trim(), last_modified_by: memberId, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo renombrar el documento.");
  revalidateDocuments();
}

export async function moveDocument(documentId: string, folderId: string | null): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ folder_id: folderId, last_modified_by: memberId, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo mover el documento.");
  revalidateDocuments();
}

export async function duplicateDocument(documentId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { data: original, error: fetchError } = await supabase
    .from("documents")
    .select("name, folder_id, mime_type, size_bytes, storage_path")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .single();
  if (fetchError || !original) throw new Error("Documento no encontrado.");

  const newStoragePath = `${workspaceId}/${crypto.randomUUID()}/${original.name}`;
  const { error: copyError } = await supabase.storage.from("documents").copy(original.storage_path, newStoragePath);
  if (copyError) throw new Error("No se pudo duplicar el archivo.");

  const nameParts = original.name.split(".");
  const ext = nameParts.length > 1 ? `.${nameParts.pop()}` : "";
  const base = nameParts.join(".");
  const copyName = `${base} (copia)${ext}`;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      folder_id: original.folder_id,
      name: copyName,
      mime_type: original.mime_type,
      size_bytes: original.size_bytes,
      storage_path: newStoragePath,
      owner_id: memberId,
      last_modified_by: memberId,
      source: "upload",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo duplicar el documento.");
  revalidateDocuments();
  return { id: data.id as string };
}

export async function trashDocument(documentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ is_trashed: true, trashed_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar el documento.");
  revalidateDocuments();
}

export async function restoreDocument(documentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ is_trashed: false, trashed_at: null })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo restaurar el documento.");
  revalidateDocuments();
}

export async function deleteDocumentPermanently(documentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("workspace_id", workspaceId).single();
  if (doc?.storage_path) await supabase.storage.from("documents").remove([doc.storage_path]);
  const { error } = await supabase.from("documents").delete().eq("id", documentId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar el documento definitivamente.");
  revalidateDocuments();
}

export async function toggleFavorite(documentId: string, isFavorite: boolean): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) return;
  const supabase = await createClient();
  if (isFavorite) {
    await supabase.from("document_favorites").insert({ member_id: memberId, document_id: documentId });
  } else {
    await supabase.from("document_favorites").delete().eq("member_id", memberId).eq("document_id", documentId);
  }
  revalidateDocuments();
}

export async function shareDocument(documentId: string, memberId: string, role: "viewer" | "editor"): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_permissions")
    .upsert({ document_id: documentId, member_id: memberId, role }, { onConflict: "document_id,member_id" });
  if (error) throw new Error("No se pudo compartir el documento.");
  revalidateDocuments();
}

export async function unshareDocument(documentId: string, memberId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("document_permissions").delete().eq("document_id", documentId).eq("member_id", memberId);
  revalidateDocuments();
}

/** Short-lived signed URL — the requesting client's own session (RLS on
 * storage.objects) already gates this to workspace members, same as any
 * other read path in this module; no service-role needed. */
export async function getDownloadUrl(documentId: string): Promise<string | null> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("workspace_id", workspaceId).single();
  if (!doc?.storage_path) return null;
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (error) return null;
  return data.signedUrl;
}
