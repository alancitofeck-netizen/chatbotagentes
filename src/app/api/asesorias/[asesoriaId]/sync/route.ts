import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { addContactNote } from "@/lib/contacts/actions";
import { createTask } from "@/lib/tasks/actions";
import { createOpportunity } from "@/lib/crm/actions";
import { logActivity } from "@/lib/activity/log";

type AsesoriaStatus = "no_iniciada" | "en_progreso" | "finalizada";

function mapStatus(raw: unknown): AsesoriaStatus {
  if (raw === "Finalizada") return "finalizada";
  if (raw === "En progreso") return "en_progreso";
  return "no_iniciada";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function buildSummaryNote(name: string, session: Record<string, unknown>): string {
  const meetingData = asRecord(session.meetingData);
  const objective = asRecord(meetingData.objective);
  const feedback = asRecord(session.feedback);
  const nextStep = asRecord(session.nextStep);

  const lines = [`Asesoría finalizada con ${name}.`];
  if (typeof objective.primary === "string" && objective.primary.trim()) lines.push(`Objetivo: ${objective.primary.trim()}`);
  if (typeof feedback.perceivedValue === "string" && feedback.perceivedValue.trim()) lines.push(`Valor percibido: ${feedback.perceivedValue.trim()}`);
  if (typeof nextStep.date === "string" && nextStep.date.trim()) {
    const time = typeof nextStep.time === "string" ? nextStep.time.trim() : "";
    lines.push(`Próximo paso: ${nextStep.date.trim()}${time ? " · " + time : ""}`);
  }
  return lines.join("\n");
}

/** Destino del `fetch` que dispara el shim inyectado en /frame — cada vez
 * que el propio Meeting OS llama a `localStorage.setItem('gl-project-
 * current', ...)` (o sea, en cada autoguardado interno suyo, sin que el
 * asesor toque ningún botón "Guardar"). Persiste el `meetingProject`
 * completo tal cual, más las columnas derivadas para poder listar/buscar
 * sin tener que parsear el jsonb. Mismo posture "nunca confiar en el
 * cliente" que el resto del proyecto para los efectos de cierre: la
 * transición a "Finalizada" se detecta comparando contra el estado ya
 * guardado en la base, no contra nada que mande el propio request. */
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
  const project = body as Record<string, unknown>;
  const session = asRecord(project.session);
  const template = asRecord(project.template);
  const prospect = asRecord(session.prospect);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("asesorias")
    .select("id, contact_id, opportunity_id, status")
    .eq("id", asesoriaId)
    .eq("workspace_id", active.workspaceId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const newStatus = mapStatus(session.status);
  const previousStatus = existing.status as AsesoriaStatus;
  const currentSlide = typeof session.progress === "number" ? session.progress : 0;
  const templateName = typeof template.name === "string" ? template.name : null;

  const update: Record<string, unknown> = {
    state: project,
    status: newStatus,
    current_slide: currentSlide,
    template_name: templateName,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "finalizada" && previousStatus !== "finalizada") {
    update.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase.from("asesorias").update(update).eq("id", asesoriaId).eq("workspace_id", active.workspaceId);
  if (updateError) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  // Efectos de cierre — solo la primera vez que se detecta la transición a
  // "Finalizada", y solo si la asesoría tiene un contacto vinculado. Mismo
  // mecanismo que ya prueba finalizeAdvisorySessionAction (advisorySessions/
  // actions.ts, módulo que este reemplaza), sumando la Oportunidad que esa
  // acción no creaba.
  if (newStatus === "finalizada" && previousStatus !== "finalizada" && existing.contact_id) {
    const contactId = existing.contact_id as string;
    const memberId = await getCurrentMemberId(active.workspaceId);
    const name = (typeof prospect.fullName === "string" && prospect.fullName.trim()) || (typeof prospect.name === "string" && prospect.name) || "el prospecto";

    await addContactNote(contactId, buildSummaryNote(name, session)).catch(() => {});

    await createTask({
      title: `Seguimiento: asesoría con ${name}`,
      description: "Generada automáticamente al finalizar la Asesoría (Meeting OS).",
      priority: "medium",
      dueAt: null,
      assignedTo: memberId ?? "",
      relatedType: "contact",
      relatedId: contactId,
    }).catch(() => {});

    if (!existing.opportunity_id) {
      const { data: contact } = await supabase.from("contacts").select("name, phone, email, company").eq("id", contactId).maybeSingle();
      try {
        const { id: opportunityId } = await createOpportunity({
          name: (contact?.name as string | undefined) ?? name,
          phone: (contact?.phone as string | undefined) ?? "",
          email: (contact?.email as string | undefined) ?? "",
          company: (contact?.company as string | undefined) ?? "",
          jobTitle: "",
          source: "asesoria",
          title: `Asesoría — ${name}`,
          value: 0,
          currency: "MXN",
          priority: "medium",
          probability: null,
          expectedCloseDate: null,
          ownerId: memberId,
        });
        await supabase.from("asesorias").update({ opportunity_id: opportunityId }).eq("id", asesoriaId);
      } catch {
        // best-effort — la asesoría ya quedó guardada, no bloquear el cierre por esto
      }
    }

    await logActivity(supabase, active.workspaceId, memberId, "asesoria", asesoriaId, "asesoria_completed", { contactName: name });
  }

  return NextResponse.json({ ok: true });
}
