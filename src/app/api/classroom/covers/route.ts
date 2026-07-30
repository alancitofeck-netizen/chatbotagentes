import { NextResponse } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "classroom-covers";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

/** Cover upload for both classroom_categories and classroom_courses (same
 * bucket, flat `{entityId}/cover.{ext}` path — ids are globally unique
 * uuids, no entity-type prefix needed). Proxied through the service-role
 * client instead of the browser calling Storage directly, same reason as
 * every other upload route in this app: this project's Storage service
 * doesn't verify its own current JWT signing key and rejects every
 * auth.uid()-based RLS check (see
 * supabase/migrations/0070_task_group_covers_final.sql). Gated by role
 * owner/admin — unlike task-group-covers, which only requires workspace
 * membership, since Classroom's catalog is global and only owner/admin can
 * write to it (0071_classroom_module.sql's core.is_owner_or_admin()). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active || (active.role !== "owner" && active.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const entityId = formData.get("entityId");
  if (!(file instanceof File) || typeof entityId !== "string" || !entityId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${entityId}/cover.${ext}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    upsert: true,
    contentType: file.type,
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
