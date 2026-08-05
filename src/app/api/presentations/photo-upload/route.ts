import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "presentation-assets";
const MAX_BYTES = 15 * 1024 * 1024;

/** Sube una foto (ya recortada/rotada client-side, react-easy-crop) para el
 * paso "Fotos" del wizard — mismo patrón exacto que
 * /api/documents/upload/route.ts: proxy vía service-role (Storage no valida
 * la clave de firma ES256 de este proyecto, ver ese route's comment), path
 * validado contra el workspace activo del caller. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const presentationId = formData.get("presentationId");
  if (!(file instanceof File) || typeof presentationId !== "string") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const service = createServiceRoleClient();

  const { data: presentation } = await service
    .from("presentations")
    .select("id")
    .eq("id", presentationId)
    .eq("workspace_id", active.workspaceId)
    .maybeSingle();
  if (!presentation) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const path = `${active.workspaceId}/${presentationId}/photos/${crypto.randomUUID()}.webp`;
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "image/webp",
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, path });
}
