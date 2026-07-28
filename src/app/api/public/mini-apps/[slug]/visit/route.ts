import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Fire-and-forget page-view counter for a Growth-Link-hosted mini app
 * public page (src/app/apps/[slug]/) — called once on mount via
 * `fetch(..., {keepalive:true})`. No API key (nothing sensitive to
 * protect in counting a page view) and no rate limit dedicated to this
 * route (low risk/volume compared to the lead-ingestion endpoint). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  const { data: app } = await supabase.from("mini_apps").select("id, workspace_id, status").eq("slug", slug).maybeSingle();
  if (!app || app.status !== "active") return NextResponse.json({ error: "not_found" }, { status: 404 });

  await supabase.from("mini_app_visits").insert({ workspace_id: app.workspace_id, mini_app_id: app.id });
  return NextResponse.json({ ok: true });
}
