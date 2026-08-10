import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { addContactNote } from "@/lib/contacts/actions";
import { findOrCreateContact } from "@/lib/contacts/match";
import { createTask } from "@/lib/tasks/actions";
import { createOpportunity } from "@/lib/crm/actions";
import { logActivity } from "@/lib/activity/log";
import { extractAsesoriaResponses } from "@/lib/asesorias/responseExtraction";

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
  const prospectName = (typeof prospect.fullName === "string" && prospect.fullName.trim()) || (typeof prospect.name === "string" && prospect.name.trim()) || "";

  const update: Record<string, unknown> = {
    state: project,
    status: newStatus,
    current_slide: currentSlide,
    template_name: templateName,
    updated_at: new Date().toISOString(),
  };
  // El nombre que el asesor tipea dentro de "Preparar reunión" (prospect.
  // fullName) recién existe una vez que arranca a llenar el Meeting OS — a
  // diferencia del fill-only hacia `contacts` de más abajo (que no pisa un
  // valor ya cargado), acá SÍ conviene reflejar siempre el último nombre
  // tipeado en el listado de Asesorías, para que deje de mostrar "Nueva
  // asesoría" apenas el asesor lo completa.
  if (prospectName) update.name = prospectName;
  if (newStatus === "finalizada" && previousStatus !== "finalizada") {
    update.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase.from("asesorias").update(update).eq("id", asesoriaId).eq("workspace_id", active.workspaceId);
  if (updateError) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  const memberId = await getCurrentMemberId(active.workspaceId);

  // Extrae las respuestas a filas normalizadas (asesoria_responses) —
  // best-effort, nunca bloquea el guardado del `state` ya confirmado arriba.
  // Ver responseExtraction.ts para el mapeo por tipo de diapositiva.
  try {
    const extracted = extractAsesoriaResponses(template, session);
    if (extracted.length > 0) {
      await supabase.from("asesoria_responses").upsert(
        extracted.map((r) => ({
          workspace_id: active.workspaceId,
          asesoria_id: asesoriaId,
          contact_id: existing.contact_id,
          advisor_id: memberId,
          question_key: r.questionKey,
          question: r.question,
          answer: r.answer,
          answer_type: r.answerType,
          slide_number: r.slideNumber,
          section: r.section,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "asesoria_id,question_key" },
      );
      const keptKeys = extracted.map((r) => r.questionKey);
      await supabase.from("asesoria_responses").delete().eq("asesoria_id", asesoriaId).not("question_key", "in", `(${keptKeys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",")})`);
    } else {
      await supabase.from("asesoria_responses").delete().eq("asesoria_id", asesoriaId);
    }

    // Materializa los referidos válidos (nombre + teléfono usable, mismo
    // criterio validPhone ≥8 dígitos que usa el archivo verbatim para
    // "Enviar regalo") en asesoria_referrals — ver
    // 0120_asesoria_referrals.sql. Resuelve/crea el contacto por teléfono
    // (findOrCreateContact, mismo helper que ya usa el prospecto principal
    // más abajo) para no duplicar contactos y poder detectar el mismo
    // teléfono referido más de una vez. El upsert NUNCA incluye `status` —
    // es el ciclo de vida CRM propio de la pantalla de Referidos, no debe
    // resetearse en cada autoguardado de esta misma asesoría.
    const rawReferrals = Array.isArray(session.referrals) ? session.referrals : [];
    const referralRows = rawReferrals
      .map((r) => asRecord(r))
      .map((r) => ({
        name: (typeof r.name === "string" ? r.name : "").trim(),
        phone: `${typeof r.cc === "string" ? r.cc : ""}${typeof r.phone === "string" ? r.phone : ""}`.replace(/\D/g, ""),
      }))
      .filter((r) => r.name && r.phone.length >= 8);

    if (referralRows.length > 0) {
      const resolvedRows = await Promise.all(
        referralRows.map(async (r) => {
          const referredContactId = await findOrCreateContact(supabase, active.workspaceId, { name: r.name, phone: r.phone }, "asesoria_referral").catch(() => null);
          return {
            workspace_id: active.workspaceId,
            asesoria_id: asesoriaId,
            advisor_id: memberId,
            referred_contact_id: referredContactId,
            name: r.name,
            phone: r.phone,
            updated_at: new Date().toISOString(),
          };
        }),
      );
      await supabase.from("asesoria_referrals").upsert(resolvedRows, { onConflict: "asesoria_id,phone" });
      const keptPhones = referralRows.map((r) => r.phone);
      await supabase.from("asesoria_referrals").delete().eq("asesoria_id", asesoriaId).not("phone", "in", `(${keptPhones.map((p) => `"${p}"`).join(",")})`);
    } else {
      await supabase.from("asesoria_referrals").delete().eq("asesoria_id", asesoriaId);
    }

    // Fill-only hacia contacts — mismo criterio que syncInsuranceProspect
    // (miniApps/ingest.ts): nunca pisa un dato ya cargado, solo completa lo
    // que está vacío. Así lo que el asesor tipeó en "Preparar reunión"
    // (dentro del propio Meeting OS) también queda en la ficha real del
    // contacto, no solo enterrado en el jsonb de la asesoría.
    if (existing.contact_id) {
      const { data: contactRow } = await supabase.from("contacts").select("name, phone, email, company").eq("id", existing.contact_id).maybeSingle();
      if (contactRow) {
        const fillOnly: Record<string, unknown> = {};
        const fullName = (typeof prospect.fullName === "string" && prospect.fullName.trim()) || (typeof prospect.name === "string" && prospect.name.trim()) || "";
        if (!contactRow.name && fullName) fillOnly.name = fullName;
        if (!contactRow.phone && typeof prospect.whatsapp === "string" && prospect.whatsapp.trim()) fillOnly.phone = prospect.whatsapp.trim();
        if (!contactRow.email && typeof prospect.email === "string" && prospect.email.trim()) fillOnly.email = prospect.email.trim();
        if (!contactRow.company && typeof prospect.company === "string" && prospect.company.trim()) fillOnly.company = prospect.company.trim();
        if (Object.keys(fillOnly).length > 0) {
          await supabase.from("contacts").update(fillOnly).eq("id", existing.contact_id);
        }
      }
    }
  } catch (err) {
    console.error("[asesorias] failed to sync normalized responses:", err);
  }

  // Efectos de cierre — solo la primera vez que se detecta la transición a
  // "Finalizada", y solo si la asesoría tiene un contacto vinculado. Mismo
  // mecanismo que ya prueba finalizeAdvisorySessionAction (advisorySessions/
  // actions.ts, módulo que este reemplaza), sumando la Oportunidad que esa
  // acción no creaba.
  if (newStatus === "finalizada" && previousStatus !== "finalizada" && existing.contact_id) {
    const contactId = existing.contact_id as string;
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
