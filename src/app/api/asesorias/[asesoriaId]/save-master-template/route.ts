import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Destino del segundo `fetch` que dispara el shim inyectado en
 * frame/route.ts — solo cuando el propio Meeting OS escribe una key
 * `gl-template-*` en localStorage (su función interna `Store.saveTemplate()`,
 * que solo corre si el asesor aprieta "Guardar" en el editor, nunca en el
 * autoguardado silencioso de respuestas). Persiste `{template, theme, brand}`
 * como la plantilla base de ESE asesor (no compartida con el resto del
 * workspace) para las asesorías NUEVAS que él mismo cree después — ver
 * src/lib/asesorias/masterTemplate.ts (lectura) y createAsesoriaAction
 * (uso al sembrar). RLS de `asesoria_templates` ya exige que `advisor_id`
 * corresponda a una membership real del usuario autenticado — si por algún
 * motivo no la tiene, el insert/update falla silenciosamente (mismo
 * criterio "nunca bloquear al asesor" que /sync: el fetch del shim ya
 * ignora errores con `.catch()`). */
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
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const template = asRecord(payload.template);
  const theme = asRecord(payload.theme);
  const brand = asRecord(payload.brand);
  if (Object.keys(template).length === 0) {
    return NextResponse.json({ error: "invalid_template" }, { status: 400 });
  }

  const memberId = await getCurrentMemberId(active.workspaceId);
  if (!memberId) return NextResponse.json({ error: "no_member" }, { status: 403 });

  const supabase = await createClient();

  // Confirma que la asesoría realmente pertenece al workspace activo antes
  // de tocar la plantilla maestra — defensa en profundidad además de la RLS.
  const { data: existing } = await supabase.from("asesorias").select("id").eq("id", asesoriaId).eq("workspace_id", active.workspaceId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await supabase
    .from("asesoria_templates")
    .upsert(
      { workspace_id: active.workspaceId, advisor_id: memberId, template, theme, brand, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,advisor_id" },
    );
  if (error) return NextResponse.json({ error: "upsert_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
