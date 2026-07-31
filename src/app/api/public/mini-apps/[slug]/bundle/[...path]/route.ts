import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mimeTypeFor, isSafeRelativePath } from "@/lib/miniApps/bundleParser";

export const runtime = "nodejs";

const BUCKET = "mini-app-bundles";

/** Serves an uploaded "Vincular App" bundle's files (index.html + its
 * relative assets) to anonymous visitors — proxied through our own route
 * instead of Storage's own public URL for two reasons:
 *
 * 1. Supabase Storage forcibly serves `text/html` (and likely other
 *    "executable" text types) as `Content-Type: text/plain` regardless of
 *    what content-type was set at upload time (confirmed directly against
 *    the Storage REST API with curl, independent of any client SDK) — a
 *    browser never renders that in a `<iframe src>`, it just shows the raw
 *    source. Re-serving the same bytes from our own route lets us set the
 *    correct header ourselves.
 * 2. The Storage object's own path is `{workspace_id}/{mini_app_id}/...` —
 *    using that URL directly as an iframe `src` would leak both ids in
 *    plain sight (page source / devtools), which getPublicMiniAppBySlug's
 *    own contract deliberately avoids for every other field. This route is
 *    keyed by `slug` instead, resolving workspace_id/mini_app_id server-side
 *    and never exposing them in the URL.
 *
 * Relative asset references inside the served HTML (css/js/img `src`/`href`)
 * resolve against this same route's URL, so `[...path]` transparently
 * serves every file in the bundle, not just index.html. */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path: pathSegments } = await context.params;
  if (!pathSegments.every((segment) => isSafeRelativePath(segment))) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: miniApp } = await service
    .from("mini_apps")
    .select("id, workspace_id, template_key, status, config")
    .eq("slug", slug)
    .maybeSingle();

  const config = (miniApp?.config as Record<string, unknown>) ?? {};
  const isHostedLinkedApp = miniApp?.template_key === "app_vinculada" && config.hostingMode === "upload";
  if (!miniApp || miniApp.status !== "active" || !isHostedLinkedApp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const relativePath = pathSegments.join("/");
  const objectPath = `${miniApp.workspace_id}/${miniApp.id}/${relativePath}`;
  const { data: file, error } = await service.storage.from(BUCKET).download(objectPath);
  if (error || !file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mimeTypeFor(relativePath),
      "Cache-Control": "public, max-age=60",
    },
  });
}
