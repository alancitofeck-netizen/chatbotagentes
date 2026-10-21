import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { applySharedStateOps, parseSharedStateOps, MAX_SHARED_STATE_BYTES } from "@/lib/miniApps/sharedStateOps";

export const runtime = "nodejs";

const ALLOWED_METHODS = "GET, PUT, OPTIONS";

/** Estado compartido de una mini app alojada (0200): lo que el equipo edita en el link público de
 * los calendarios de contenido (estado "Publicado", textos, resultados) queda guardado y lo ve
 * cualquiera que abra el link. Solo para mini apps con config.sharedState = true — el resto
 * responde 404. Cualquiera con el link puede editar (decisión del pedido: "que al poner publicado
 * se guarde" desde el link público).
 *
 * CORS: la página corre en un iframe sandbox con origen opaco ("null") — mismo patrón que
 * hosted-lead/route.ts (OPTIONS permisivo + eco del Origin). */
function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": ALLOWED_METHODS, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } : {};
}

async function resolveMiniApp(slug: string): Promise<string | null> {
  const service = createServiceRoleClient();
  const { data } = await service.from("mini_apps").select("id, status, template_key, config").eq("slug", slug).is("mirror_of", null).maybeSingle();
  const config = (data?.config as Record<string, unknown>) ?? {};
  if (!data || data.status !== "active" || data.template_key !== "app_vinculada" || config.sharedState !== true) return null;
  return data.id as string;
}

export async function OPTIONS(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await params;
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };
  const miniAppId = await resolveMiniApp(slug);
  if (!miniAppId) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  const { data } = await createServiceRoleClient().from("mini_app_shared_state").select("state, rev").eq("mini_app_id", miniAppId).maybeSingle();
  return NextResponse.json({ state: data?.state ?? null, rev: (data?.rev as number) ?? 0 }, { headers });
}

/** Body: { ops: SharedStateOp[], base?: object }. `base` solo hace falta la primera vez (todavía no
 * hay nada guardado): es el estado con el que viene la página. Los cambios se aplican sobre la
 * última versión con update condicional por rev; si otra persona guardó en el medio, se relee y
 * se reintenta. Responde el documento resultante para que la página incorpore lo de los demás. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const headers = { ...corsHeaders(request), "Cache-Control": "no-store" };
  const miniAppId = await resolveMiniApp(slug);
  if (!miniAppId) return NextResponse.json({ error: "not_found" }, { status: 404, headers });

  const text = await request.text();
  if (text.length > MAX_SHARED_STATE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413, headers });
  let body: { ops?: unknown; base?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers });
  }
  const ops = parseSharedStateOps(body?.ops);
  if (!ops) return NextResponse.json({ error: "invalid_ops" }, { status: 400, headers });

  const service = createServiceRoleClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: current } = await service.from("mini_app_shared_state").select("state, rev").eq("mini_app_id", miniAppId).maybeSingle();

    if (!current) {
      const base = body.base;
      if (typeof base !== "object" || base === null || Array.isArray(base)) return NextResponse.json({ error: "need_base" }, { status: 409, headers });
      const state = applySharedStateOps(base as Record<string, unknown>, ops);
      const { error } = await service.from("mini_app_shared_state").insert({ mini_app_id: miniAppId, state, rev: 1 });
      if (!error) return NextResponse.json({ state, rev: 1 }, { headers });
      continue; // otra persona hizo el primer guardado en el medio → aplicar sobre el suyo
    }

    const state = applySharedStateOps(current.state as Record<string, unknown>, ops);
    if (JSON.stringify(state).length > MAX_SHARED_STATE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413, headers });
    const rev = (current.rev as number) + 1;
    const { data: updated } = await service
      .from("mini_app_shared_state")
      .update({ state, rev, updated_at: new Date().toISOString() })
      .eq("mini_app_id", miniAppId)
      .eq("rev", current.rev as number)
      .select("rev");
    if (updated && updated.length > 0) return NextResponse.json({ state, rev }, { headers });
  }
  return NextResponse.json({ error: "busy" }, { status: 503, headers });
}
