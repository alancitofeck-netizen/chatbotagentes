import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;

/** Shared upload endpoint for every "Archivos" surface that writes to the
 * `documents` bucket (Documentos, CRM opportunity files, task files) —
 * proxies through the service-role client instead of the browser calling
 * Storage directly, because this project's Storage service doesn't verify
 * its own current JWT signing key and rejects every auth.uid()-based RLS
 * check (see supabase/migrations/0070_task_group_covers_final.sql). The
 * caller still generates the documentId/path client-side (needed for the
 * follow-up recordUploadedDocument call) — `path` is only trusted once
 * verified to start with the caller's own workspaceId, so a member can't
 * write into another workspace's folder. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const path = formData.get("path");
  if (!(file instanceof File) || typeof path !== "string") return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  if (!path.startsWith(`${active.workspaceId}/`)) return NextResponse.json({ error: "invalid_path" }, { status: 403 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
