import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSafeRelativePath } from "@/lib/miniApps/bundleParser";

export const runtime = "nodejs";

const BUCKET = "presentation-assets";

const MIME_BY_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

function mimeTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** Sirve fotos/PDF de una presentación pública — mismo patrón exacto que
 * /api/public/mini-apps/[slug]/bundle/[...path]/route.ts: resuelve slug →
 * workspace_id/presentation_id server-side (vía service-role, visitante
 * anónimo), nunca expone esos ids en la URL. */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path: pathSegments } = await context.params;
  if (!pathSegments.every((segment) => isSafeRelativePath(segment))) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: presentation } = await service
    .from("presentations")
    .select("id, workspace_id, status")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!presentation || presentation.status !== "lista") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const relativePath = pathSegments.join("/");
  const objectPath = `${presentation.workspace_id}/${presentation.id}/${relativePath}`;
  const { data: file, error } = await service.storage.from(BUCKET).download(objectPath);
  if (error || !file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  return new NextResponse(bytes, {
    headers: { "Content-Type": mimeTypeFor(relativePath), "Cache-Control": "public, max-age=60" },
  });
}
