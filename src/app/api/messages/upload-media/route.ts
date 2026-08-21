import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "whatsapp-media";

// Límites reales de YCloud para envío (docs.ycloud.com, "WhatsApp Message
// Sending Guide") — se aplican acá, no solo del lado de YCloud, para dar un
// error claro antes de gastar el upload.
const MAX_BYTES: Record<string, number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

/** Adjuntos salientes del composer del Inbox — mismo patrón proxy que
 * src/app/api/documents/upload/route.ts (el Storage de este proyecto no
 * valida bien RLS por auth.uid() directo, así que la aplicación real de
 * permisos pasa por acá: sesión + workspace validado + path prefijado). El
 * caller genera el `path`, se verifica que empiece con su propio
 * workspaceId antes de subir. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const mediaType = formData.get("mediaType");
  if (!(file instanceof File) || typeof mediaType !== "string" || !(mediaType in MAX_BYTES)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES[mediaType]) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const path = `${active.workspaceId}/${randomUUID()}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
  });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  return NextResponse.json({ storagePath: path, mimeType: file.type || "application/octet-stream", fileName: file.name });
}
