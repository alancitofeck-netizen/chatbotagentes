import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateContact } from "@/lib/contacts/match";
import { extractAsesoriaResponses } from "@/lib/asesorias/responseExtraction";
import { autoStartReferralConversationIfEligible } from "@/lib/asesorias/autoStartConversation";
import { triggerReferralExport } from "@/lib/asesorias/referralExport/runner";

/**
 * Asesorías → "Sistema de Referidos" (0196_referral_system.sql): privado para las cuentas de
 * `referral_system_partners`, y compartido entre las cuentas del mismo grupo. Cada sesión existe
 * una vez por cuenta (la original + una copia `mirror_of` en cada otra cuenta del grupo), así cada
 * cuenta tiene sus propios referidos y contactos con su RLS normal; el servidor mantiene las copias
 * iguales. Todo lo que escribe en otra cuenta va por service-role, siempre después de verificar que
 * quien llama es miembro de una cuenta del grupo.
 */

export const REFERRAL_SESSION_KIND = "referidos";

export interface ReferralSystemGroup {
  groupId: string;
  workspaceIds: string[];
}

/** Grupo del Sistema de Referidos de una cuenta, o null si no lo tiene (es privado). */
export async function getReferralSystemGroup(workspaceId: string): Promise<ReferralSystemGroup | null> {
  const service = createServiceRoleClient();
  const { data: own } = await service.from("referral_system_partners").select("group_id").eq("workspace_id", workspaceId).maybeSingle();
  if (!own) return null;
  const { data: all } = await service.from("referral_system_partners").select("workspace_id").eq("group_id", own.group_id as string);
  return { groupId: own.group_id as string, workspaceIds: (all ?? []).map((r) => r.workspace_id as string) };
}

export interface SessionGroupRow {
  id: string;
  workspaceId: string;
  advisorId: string | null;
  mirrorOf: string | null;
}

/** La sesión original y todas sus copias, a partir de cualquiera de ellas. */
export async function getSessionGroupRows(service: SupabaseClient, asesoriaId: string): Promise<{ rootId: string; rows: SessionGroupRow[] }> {
  const { data: row } = await service.from("asesorias").select("id, mirror_of").eq("id", asesoriaId).maybeSingle();
  const rootId = ((row?.mirror_of as string | null) ?? (row?.id as string | undefined)) || asesoriaId;
  const { data } = await service
    .from("asesorias")
    .select("id, workspace_id, advisor_id, mirror_of")
    .or(`id.eq.${rootId},mirror_of.eq.${rootId}`);
  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    advisorId: (r.advisor_id as string | null) ?? null,
    mirrorOf: (r.mirror_of as string | null) ?? null,
  }));
  return { rootId, rows };
}

/** Proyecto inicial de una sesión nueva: la plantilla guardada del grupo, si alguien la guardó. Sin
 * plantilla devuelve {} y el HTML arranca con su plantilla por defecto. */
export async function getReferralSessionSeed(groupId: string): Promise<Record<string, unknown>> {
  const service = createServiceRoleClient();
  const { data } = await service.from("referral_system_templates").select("template, theme, brand").eq("group_id", groupId).maybeSingle();
  if (!data?.template) return {};
  return { schemaVersion: 2, template: data.template, theme: data.theme ?? {}, brand: data.brand ?? {} };
}

/** Crea una sesión en la cuenta de quien la abre y su copia en cada otra cuenta del grupo. */
export async function createReferralSessionRows(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  memberId: string | null;
  group: ReferralSystemGroup;
}): Promise<string> {
  const seed = await getReferralSessionSeed(input.group.groupId);
  const base = {
    kind: REFERRAL_SESSION_KIND,
    name: "Sesión de referidos",
    status: "no_iniciada",
    current_slide: 0,
    template_name: "Sistema de Referidos",
    state: seed,
  };
  const { data: created, error } = await input.supabase
    .from("asesorias")
    .insert({ ...base, workspace_id: input.workspaceId, advisor_id: input.memberId, created_by: input.memberId })
    .select("id")
    .single();
  if (error || !created) throw new Error("No se pudo crear la sesión.");

  const others = input.group.workspaceIds.filter((id) => id !== input.workspaceId);
  if (others.length > 0) {
    const service = createServiceRoleClient();
    const { error: mirrorError } = await service
      .from("asesorias")
      .insert(others.map((workspaceId) => ({ ...base, workspace_id: workspaceId, mirror_of: created.id as string })));
    if (mirrorError) console.error("[referral-system] no se pudo crear la copia de la sesión:", mirrorError);
  }
  return created.id as string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapStatus(raw: unknown): "no_iniciada" | "en_progreso" | "finalizada" {
  if (raw === "Finalizada") return "finalizada";
  if (raw === "En progreso") return "en_progreso";
  return "no_iniciada";
}

/** Guardado de una sesión del Sistema de Referidos (lo llama /sync con el proyecto completo del HTML). Deja
 * la sesión igual en todas las cuentas del grupo: mismo estado, mismas respuestas y los mismos referidos,
 * cada uno resuelto contra los contactos de su propia cuenta. El WhatsApp automático (si el agente de
 * referidos lo tiene prendido) sale solo desde la cuenta que creó la sesión: las copias nunca escriben
 * solas, así a nadie le llegan dos mensajes. */
export async function syncReferralSessionGroup(asesoriaId: string, project: Record<string, unknown>): Promise<void> {
  const service = createServiceRoleClient();
  const session = asRecord(project.session);
  const template = asRecord(project.template);
  const prospect = asRecord(session.prospect);
  const { rootId, rows } = await getSessionGroupRows(service, asesoriaId);
  if (rows.length === 0) return;

  const { data: root } = await service.from("asesorias").select("status").eq("id", rootId).maybeSingle();
  const newStatus = mapStatus(session.status);
  const prospectName = (typeof prospect.fullName === "string" && prospect.fullName.trim()) || (typeof prospect.name === "string" && prospect.name.trim()) || "";
  const update: Record<string, unknown> = {
    state: project,
    status: newStatus,
    current_slide: typeof session.progress === "number" ? session.progress : 0,
    template_name: typeof template.name === "string" ? template.name : "Sistema de Referidos",
    updated_at: new Date().toISOString(),
  };
  if (prospectName) update.name = prospectName;
  if (newStatus === "finalizada" && root?.status !== "finalizada") update.completed_at = new Date().toISOString();
  await service.from("asesorias").update(update).in("id", rows.map((r) => r.id));

  const referralRows = (Array.isArray(session.referrals) ? session.referrals : [])
    .map((r) => asRecord(r))
    .map((r) => ({
      name: (typeof r.name === "string" ? r.name : "").trim(),
      phone: `${typeof r.cc === "string" ? r.cc : ""}${typeof r.phone === "string" ? r.phone : ""}`.replace(/\D/g, ""),
    }))
    .filter((r) => r.name && r.phone.length >= 8);
  const extracted = (() => {
    try {
      return extractAsesoriaResponses(template, session);
    } catch {
      return [];
    }
  })();

  for (const row of rows) {
    try {
      if (extracted.length > 0) {
        await service.from("asesoria_responses").upsert(
          extracted.map((r) => ({
            workspace_id: row.workspaceId,
            asesoria_id: row.id,
            contact_id: null,
            advisor_id: row.advisorId,
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
        await service.from("asesoria_responses").delete().eq("asesoria_id", row.id).not("question_key", "in", `(${keptKeys.map((k) => `"${k.replace(/"/g, '""')}"`).join(",")})`);
      } else {
        await service.from("asesoria_responses").delete().eq("asesoria_id", row.id);
      }

      if (referralRows.length === 0) {
        await service.from("asesoria_referrals").delete().eq("asesoria_id", row.id);
        continue;
      }
      // Mismo upsert que el Meeting OS (sync/route.ts): nunca incluye `status`, que es el ciclo de vida
      // propio de la pantalla de Referidos.
      const resolved = await Promise.all(
        referralRows.map(async (r) => ({
          workspace_id: row.workspaceId,
          asesoria_id: row.id,
          advisor_id: row.advisorId,
          referred_contact_id: await findOrCreateContact(service, row.workspaceId, { name: r.name, phone: r.phone }, "asesoria_referral").catch(() => null),
          name: r.name,
          phone: r.phone,
          updated_at: new Date().toISOString(),
        })),
      );
      const { data: upserted } = await service.from("asesoria_referrals").upsert(resolved, { onConflict: "asesoria_id,phone" }).select("id");
      const keptPhones = referralRows.map((r) => r.phone);
      await service.from("asesoria_referrals").delete().eq("asesoria_id", row.id).not("phone", "in", `(${keptPhones.map((p) => `"${p}"`).join(",")})`);

      if (row.id === rootId) {
        for (const referral of upserted ?? []) {
          await autoStartReferralConversationIfEligible(service, row.workspaceId, referral.id as string);
        }
      }
      // Exportar a hoja (si esta cuenta del grupo tiene una conectada): best-effort, igual
      // criterio de no-op en re-sync que sync/route.ts.
      for (const referral of upserted ?? []) {
        triggerReferralExport(row.workspaceId, referral.id as string);
      }
    } catch (err) {
      console.error("[referral-system] no se pudo sincronizar la sesión en", row.workspaceId, err);
    }
  }
}

/** Copia el estado de un referido a sus gemelos de las otras cuentas (mismo teléfono, misma sesión del
 * grupo). No hace nada si el referido no viene de una sesión del Sistema de Referidos. */
export async function propagateReferralStatus(referralId: string): Promise<void> {
  try {
    const service = createServiceRoleClient();
    const { data: referral } = await service.from("asesoria_referrals").select("asesoria_id, phone, status").eq("id", referralId).maybeSingle();
    if (!referral?.asesoria_id) return;
    const { data: asesoria } = await service.from("asesorias").select("kind").eq("id", referral.asesoria_id as string).maybeSingle();
    if (asesoria?.kind !== REFERRAL_SESSION_KIND) return;
    const { rows } = await getSessionGroupRows(service, referral.asesoria_id as string);
    const siblingIds = rows.map((r) => r.id).filter((id) => id !== referral.asesoria_id);
    if (siblingIds.length === 0) return;
    const { data: updated } = await service
      .from("asesoria_referrals")
      .update({ status: referral.status, updated_at: new Date().toISOString() })
      .in("asesoria_id", siblingIds)
      .eq("phone", referral.phone as string)
      .select("id, workspace_id");
    // Exportar a hoja en cada cuenta gemela que tenga una conectada — best-effort.
    for (const sibling of updated ?? []) {
      triggerReferralExport(sibling.workspace_id as string, sibling.id as string);
    }
  } catch (err) {
    console.error("[referral-system] no se pudo copiar el estado del referido:", err);
  }
}

/** "Guardar" en el editor del HTML: la plantilla pasa a ser la del grupo (las dos cuentas arrancan sus
 * sesiones nuevas con ella). */
export async function saveReferralSystemTemplate(groupId: string, workspaceId: string, payload: Record<string, unknown>): Promise<boolean> {
  const template = asRecord(payload.template);
  if (!Array.isArray(template.slides)) return false;
  const service = createServiceRoleClient();
  const { error } = await service.from("referral_system_templates").upsert(
    {
      group_id: groupId,
      template,
      theme: asRecord(payload.theme),
      // Sin el nombre del asesor: cada asesor ve el suyo (lo completa /frame al abrir la sesión).
      brand: { ...asRecord(payload.brand), advisorName: "" },
      updated_by_workspace: workspaceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "group_id" },
  );
  return !error;
}

/** Borra una sesión en todas las cuentas del grupo (las copias caen en cascada con la original). */
export async function deleteReferralSessionGroup(asesoriaId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { rootId } = await getSessionGroupRows(service, asesoriaId);
  await service.from("asesorias").delete().eq("id", rootId);
}

export interface ReferralSessionItem {
  id: string;
  name: string;
  status: "no_iniciada" | "en_progreso" | "finalizada";
  /** Quién la hizo: el asesor que se cargó en la propia sesión del HTML. */
  advisor: string | null;
  referidos: number;
  updatedAt: string;
  completedAt: string | null;
}

/** Sesiones del Sistema de Referidos de esta cuenta (las propias y las copias de las otras cuentas del grupo:
 * todas son filas de esta cuenta), la más reciente primero. */
export async function getReferralSessions(workspaceId: string): Promise<ReferralSessionItem[]> {
  const supabase = await createClient();
  const [{ data: sessions }, { data: referrals }] = await Promise.all([
    supabase
      .from("asesorias")
      .select("id, name, status, state, updated_at, completed_at")
      .eq("workspace_id", workspaceId)
      .eq("kind", REFERRAL_SESSION_KIND)
      .order("updated_at", { ascending: false }),
    supabase.from("asesoria_referrals").select("asesoria_id").eq("workspace_id", workspaceId),
  ]);
  const counts = new Map<string, number>();
  for (const r of referrals ?? []) counts.set(r.asesoria_id as string, (counts.get(r.asesoria_id as string) ?? 0) + 1);
  return (sessions ?? []).map((s) => {
    const session = asRecord(asRecord(s.state).session);
    const advisor = typeof session.advisor === "string" && session.advisor.trim() ? session.advisor.trim() : null;
    return {
      id: s.id as string,
      name: s.name as string,
      status: s.status as ReferralSessionItem["status"],
      advisor,
      referidos: counts.get(s.id as string) ?? 0,
      updatedAt: s.updated_at as string,
      completedAt: (s.completed_at as string | null) ?? null,
    };
  });
}
