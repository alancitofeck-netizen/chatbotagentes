import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { withMirrorTargets } from "@/lib/miniApps/mirrors";

const ALLOWED_EVENT_TYPES = new Set(["app_opened", "step_viewed", "simulation_completed", "lead_submitted"]);
const RATE_LIMIT_PER_MINUTE = 60;

/** Fire-and-forget funnel-step beacon for a Growth-Link-hosted mini app
 * public page (src/app/apps/[slug]/) — mismo criterio que .../visit/route.ts
 * (sin API key, service_role, sin sesión). A diferencia de /visit (un
 * contador simple), acá cada plantilla manda su propio `sessionId` (generado
 * en el navegador) + `eventType`/`step`/`meta` a medida que la instrumentan —
 * ver ahorroFiscalTemplate.ts's trackEvent() para el primer caso real.
 * `lead_submitted` NO se inserta desde acá — se registra server-side, de
 * forma autoritativa, dentro de processLeadSubmission (ingest.ts), para que
 * no dependa de que el beacon del cliente llegue. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 200) : "";
  const eventType = typeof body.eventType === "string" ? body.eventType : "";
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  if (!ALLOWED_EVENT_TYPES.has(eventType)) return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
  const step = typeof body.step === "number" && Number.isFinite(body.step) ? body.step : null;
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

  const supabase = createServiceRoleClient();
  const { data: app } = await supabase.from("mini_apps").select("id, workspace_id, status").eq("slug", slug).is("mirror_of", null).maybeSingle();
  if (!app || app.status !== "active") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { count: recentCount } = await supabase
    .from("mini_app_events")
    .select("id", { count: "exact", head: true })
    .eq("mini_app_id", app.id)
    .eq("session_id", sessionId)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // El evento cuenta también en los espejos de la Mini App (otros workspaces).
  const targets = await withMirrorTargets(supabase, app);
  await supabase.from("mini_app_events").insert(targets.map((t) => ({ ...t, session_id: sessionId, event_type: eventType, step, meta })));
  return NextResponse.json({ ok: true });
}
