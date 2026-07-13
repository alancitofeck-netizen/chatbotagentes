import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DocumentView = "all" | "recent" | "shared" | "favorites" | "trash";

export interface FolderNode {
  id: string;
  name: string;
  parentFolderId: string | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string;
  source: "upload" | "google_drive" | "google_docs" | "google_sheets" | "export";
  externalId: string | null;
  isTrashed: boolean;
  isFavorite: boolean;
  owner: { memberId: string; fullName: string } | null;
  lastModifiedBy: { memberId: string; fullName: string } | null;
  sharedWith: { memberId: string; fullName: string; role: "viewer" | "editor" }[];
  createdAt: string;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  name: string;
  folder_id: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  source: string;
  external_id: string | null;
  is_trashed: boolean;
  owner_id: string | null;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_SELECT =
  "id, name, folder_id, mime_type, size_bytes, storage_path, source, external_id, is_trashed, owner_id, last_modified_by, created_at, updated_at";

async function mapDocumentRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  currentMemberId: string | null,
  rows: DocumentRow[],
): Promise<DocumentItem[]> {
  if (rows.length === 0) return [];
  const documentIds = rows.map((r) => r.id);
  const memberIds = [...new Set(rows.flatMap((r) => [r.owner_id, r.last_modified_by]).filter((id): id is string => Boolean(id)))];

  const [{ data: memberNames }, { data: permissionRows }, { data: favoriteRows }] = await Promise.all([
    memberIds.length
      ? supabase.rpc("workspace_member_names", { ws_id: workspaceId })
      : Promise.resolve({ data: [] as { member_id: string; full_name: string }[] }),
    supabase.from("document_permissions").select("document_id, member_id, role").in("document_id", documentIds),
    currentMemberId
      ? supabase.from("document_favorites").select("document_id").eq("member_id", currentMemberId).in("document_id", documentIds)
      : Promise.resolve({ data: [] as { document_id: string }[] }),
  ]);

  const nameByMember = new Map<string, string>(
    (memberNames ?? []).map((m: { member_id: string; full_name: string }) => [m.member_id, m.full_name]),
  );
  const favoriteIds = new Set((favoriteRows ?? []).map((f) => f.document_id));
  const permissionsByDocument = new Map<string, { memberId: string; fullName: string; role: "viewer" | "editor" }[]>();
  for (const p of permissionRows ?? []) {
    const list = permissionsByDocument.get(p.document_id) ?? [];
    list.push({ memberId: p.member_id, fullName: nameByMember.get(p.member_id) ?? "—", role: p.role as "viewer" | "editor" });
    permissionsByDocument.set(p.document_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    folderId: r.folder_id,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    storagePath: r.storage_path,
    source: r.source as DocumentItem["source"],
    externalId: r.external_id,
    isTrashed: r.is_trashed,
    isFavorite: favoriteIds.has(r.id),
    owner: r.owner_id ? { memberId: r.owner_id, fullName: nameByMember.get(r.owner_id) ?? "—" } : null,
    lastModifiedBy: r.last_modified_by ? { memberId: r.last_modified_by, fullName: nameByMember.get(r.last_modified_by) ?? "—" } : null,
    sharedWith: permissionsByDocument.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Recursive folder tree — small enough per workspace to fetch flat and
 * nest client-side rather than a recursive CTE. */
export async function getFolderTree(workspaceId: string): Promise<FolderNode[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("id, name, parent_folder_id")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []).map((f) => ({ id: f.id, name: f.name, parentFolderId: f.parent_folder_id }));
}

export async function getDocuments(
  workspaceId: string,
  currentMemberId: string | null,
  options: { view: DocumentView; folderId?: string | null; search?: string },
): Promise<DocumentItem[]> {
  const supabase = await createClient();
  let query = supabase.from("documents").select(DOCUMENT_SELECT).eq("workspace_id", workspaceId);

  if (options.view === "trash") {
    query = query.eq("is_trashed", true);
  } else {
    query = query.eq("is_trashed", false);
    if (options.view === "all" && options.folderId !== undefined) {
      query = options.folderId ? query.eq("folder_id", options.folderId) : query.is("folder_id", null);
    }
  }
  if (options.search?.trim()) query = query.ilike("name", `%${options.search.trim()}%`);

  const orderColumn = options.view === "recent" ? "updated_at" : "name";
  query = query.order(orderColumn, { ascending: orderColumn === "name" });
  if (options.view === "recent") query = query.limit(30);

  const { data } = await query;
  let items = await mapDocumentRows(supabase, workspaceId, currentMemberId, (data ?? []) as DocumentRow[]);

  if (options.view === "favorites") items = items.filter((d) => d.isFavorite);
  if (options.view === "shared") items = items.filter((d) => d.sharedWith.length > 0);

  return items;
}

export async function getDocumentById(workspaceId: string, documentId: string, currentMemberId: string | null): Promise<DocumentItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select(DOCUMENT_SELECT).eq("workspace_id", workspaceId).eq("id", documentId).maybeSingle();
  if (!data) return null;
  const [item] = await mapDocumentRows(supabase, workspaceId, currentMemberId, [data as DocumentRow]);
  return item;
}
