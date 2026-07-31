import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseBundle, MAX_BUNDLE_BYTES } from "@/lib/miniApps/bundleParser";

export const runtime = "nodejs";

const BUCKET = "mini-app-bundles";

/** Storage's own `list()` only returns the immediate children of a prefix —
 * a nested file like "css/style.css" comes back as a bare "css" entry with
 * `id: null` (a synthetic folder marker, not a real object), so a naive
 * single-level list+remove leaves every nested file orphaned forever
 * (confirmed live: after replacing a v1 bundle that had css/js/img
 * subfolders with a v2 that had none, the old nested files were still
 * being served — only the top-level index.html actually got replaced).
 * Recurses into every folder-shaped entry to collect real object paths. */
async function listAllObjectPaths(
  service: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data: entries } = await service.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!entries || entries.length === 0) return [];

  const paths: string[] = [];
  for (const entry of entries) {
    const entryPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      paths.push(...(await listAllObjectPaths(service, bucket, entryPath)));
    } else {
      paths.push(entryPath);
    }
  }
  return paths;
}

/** "Vincular App" Fase 2 upload endpoint — proxies through the service-role
 * client instead of a direct browser-to-Storage upload, same reasoning as
 * /api/documents/upload/route.ts: Storage doesn't currently verify this
 * project's ES256 JWT signing key, so any RLS check depending on auth.uid()
 * rejects every write (see supabase/migrations/0070_task_group_covers_final.sql).
 * The 25MB cap mirrors that same route's own limit — a larger upload
 * passing through a Vercel serverless function isn't reliable on this plan.
 *
 * On a replace (an existing bundle already at this miniAppId's prefix), all
 * previous objects are deleted first so a stale asset from the old version
 * never lingers under a path the new index.html doesn't reference. */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const miniAppId = formData.get("miniAppId");
  if (!(file instanceof File) || typeof miniAppId !== "string") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (file.size > MAX_BUNDLE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const service = createServiceRoleClient();

  // The mini app must belong to the caller's active workspace — never trust
  // miniAppId alone (same posture as the path-prefix check in
  // /api/documents/upload/route.ts).
  const { data: miniApp } = await service
    .from("mini_apps")
    .select("id, workspace_id, slug, config")
    .eq("id", miniAppId)
    .eq("workspace_id", active.workspaceId)
    .maybeSingle();
  if (!miniApp) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseBundle(file.name, bytes);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const prefix = `${active.workspaceId}/${miniAppId}`;

  // Replace: clear out whatever's there from a previous version first —
  // recursively, since a nested file only ever shows up one level at a time.
  const existingPaths = await listAllObjectPaths(service, BUCKET, prefix);
  if (existingPaths.length > 0) {
    await service.storage.from(BUCKET).remove(existingPaths);
  }

  for (const f of parsed.bundle.files) {
    const { error } = await service.storage.from(BUCKET).upload(`${prefix}/${f.path}`, f.bytes, {
      contentType: f.mimeType,
      upsert: true,
    });
    if (error) {
      return NextResponse.json({ error: "upload_failed", detail: error.message }, { status: 500 });
    }
  }

  const previousVersion = typeof (miniApp.config as { bundleVersion?: number })?.bundleVersion === "number"
    ? (miniApp.config as { bundleVersion: number }).bundleVersion
    : 0;
  const bundleVersion = previousVersion + 1;

  const nextConfig = {
    ...(miniApp.config as Record<string, unknown>),
    hostingMode: "upload",
    indexPath: parsed.bundle.indexPath,
    bundleVersion,
  };
  await service.from("mini_apps").update({ config: nextConfig, updated_at: new Date().toISOString() }).eq("id", miniAppId);

  // Same proxy route the public /apps/{slug} page uses (see that route's own
  // comment) — Supabase Storage's public URL would serve index.html as
  // text/plain (confirmed server-side, not an SDK quirk) and would leak
  // workspaceId/miniAppId in the URL. The "Vista previa" button in the
  // wizard/Configuración loads this exact URL too, so preview and
  // production are the same render, not a separate mock.
  const publicUrl = `/api/public/mini-apps/${miniApp.slug}/bundle/${parsed.bundle.indexPath}?v=${bundleVersion}`;

  return NextResponse.json({
    ok: true,
    bundleVersion,
    indexPath: parsed.bundle.indexPath,
    counts: parsed.bundle.counts,
    totalBytes: parsed.bundle.totalBytes,
    publicUrl,
  });
}
