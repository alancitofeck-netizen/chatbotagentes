import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { withMirrorTargets } from "@/lib/miniApps/mirrors";

/** Fire-and-forget page-view counter for a Growth-Link-hosted mini app
 * public page (src/app/apps/[slug]/) — called once on mount via
 * `fetch(..., {keepalive:true})`. No API key (nothing sensitive to
 * protect in counting a page view) and no rate limit dedicated to this
 * route (low risk/volume compared to the lead-ingestion endpoint). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  const { data: app } = await supabase.from("mini_apps").select("id, workspace_id, status").eq("slug", slug).is("mirror_of", null).maybeSingle();
  if (!app || app.status !== "active") return NextResponse.json({ error: "not_found" }, { status: 404 });

  // La visita cuenta también en los espejos de la Mini App (otros workspaces).
  await supabase.from("mini_app_visits").insert(await withMirrorTargets(supabase, app));
  return NextResponse.json({ ok: true });
}
