import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const BUCKET = "asesoria-template-images";
const MAX_BYTES = 8 * 1024 * 1024;
const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/** Destino del offload de imágenes que el shim de frame/route.ts hace ANTES
 * de mandar el payload de /sync o /save-master-template — ver el comentario
 * de la migración 0119_asesoria_template_images_storage.sql para el porqué
 * (el JSON con imágenes base64 embebidas supera el límite de tamaño de las
 * funciones serverless de Vercel). Recibe UN data: URI a la vez (así el
 * body de este endpoint nunca se acerca a ese límite), devuelve la URL
 * pública. Path = hash del contenido → subidas repetidas de la misma imagen
 * (autoguardado disparando de nuevo con el mismo base64 todavía en el
 * estado) son upserts idempotentes, no duplicados. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ asesoriaId: string }> }) {
  const { asesoriaId } = await params;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const dataUrl = (body as Record<string, unknown> | null)?.dataUrl;
  if (typeof dataUrl !== "string") return NextResponse.json({ error: "missing_data_url" }, { status: 400 });

  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "invalid_data_url" }, { status: 400 });
  const [, mimeType, base64] = match;
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) return NextResponse.json({ error: "unsupported_mime_type" }, { status: 400 });

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 400 });

  const service = createServiceRoleClient();

  const { data: asesoria } = await service.from("asesorias").select("id").eq("id", asesoriaId).eq("workspace_id", active.workspaceId).maybeSingle();
  if (!asesoria) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const hash = createHash("sha256").update(buffer).digest("hex");
  const path = `${active.workspaceId}/${asesoriaId}/${hash}.${ext}`;

  const { error } = await service.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });

  const { data: publicUrl } = service.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
}
