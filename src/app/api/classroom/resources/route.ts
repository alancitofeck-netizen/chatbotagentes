import { NextResponse } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "classroom-resources";
const MAX_BYTES = 50 * 1024 * 1024;

/** Lesson resource upload (PDFs/plantillas/checklists/etc.) — same
 * service-role proxy pattern as /api/classroom/covers, gated the same way
 * (role owner/admin). Larger MAX_BYTES than covers since these are real
 * documents, not just thumbnails. Path is `{lessonId}/{filename}` — a lesson
 * can have several resources, unlike the one-cover-per-entity convention. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active || (active.role !== "owner" && active.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const lessonId = formData.get("lessonId");
  if (!(file instanceof File) || typeof lessonId !== "string" || !lessonId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const path = `${lessonId}/${Date.now()}-${file.name}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, fileType: file.type || null, fileSizeBytes: file.size });
}
