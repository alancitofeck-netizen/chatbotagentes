"use client";

/** Shared browser-side call to /api/documents/upload — every "Archivos" UI
 * (ArchivosTab, CardDetailSheet, DocumentsShell) uploads through this instead
 * of calling supabase.storage directly (see that route's own doc comment for
 * why). Returns true/false rather than throwing, matching how callers
 * already branched on the old { error } shape from supabase-js. */
export async function uploadDocumentFile(path: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.append("file", file);
  body.append("path", path);
  const res = await fetch("/api/documents/upload", { method: "POST", body });
  return res.ok;
}
