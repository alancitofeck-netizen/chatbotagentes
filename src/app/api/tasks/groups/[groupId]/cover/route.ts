import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "task-group-covers";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

/** Uploads the group cover through the service-role client instead of the
 * browser calling Storage directly. Storage's own JWT verification doesn't
 * accept this project's current (ES256) signing key — every direct-from-browser
 * Storage write silently authenticates as Postgres role `anon` and gets
 * rejected by any RLS check that depends on auth.uid() (see
 * supabase/migrations/0070_task_group_covers_final.sql for how this was
 * diagnosed). Proxying through a Route Handler sidesteps Storage's own auth
 * path entirely: we do the workspace-membership check ourselves (same
 * getUser()/getActiveWorkspaceForUser() pattern as the mini-app leads export
 * route, redirect-free since this isn't a page) and write with a client that
 * bypasses RLS, same posture as src/lib/advisors/import/storage.ts. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (!ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${active.workspaceId}/${groupId}/cover.${ext}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    upsert: true,
    contentType: file.type,
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
