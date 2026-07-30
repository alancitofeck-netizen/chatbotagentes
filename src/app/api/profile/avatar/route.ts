import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "avatars";
const MAX_BYTES = 8 * 1024 * 1024;

/** Proxies the already-cropped webp blob to Storage via the service-role
 * client instead of the browser calling supabase.storage directly — this
 * project's Storage service doesn't verify its own current JWT signing key
 * and rejects every auth.uid()-based RLS check (see
 * supabase/migrations/0070_task_group_covers_final.sql). One fixed object
 * per user (`{userId}/avatar.webp`, upsert), same convention as before. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const path = `${user.id}/avatar.webp`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "3600",
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
