import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notify } from "@/lib/notifications/service";
import { interpolateAutomationTemplate } from "@/lib/automationTemplates/constants";
import { ACTIVE_LIKE_STATUSES } from "@/lib/policies/constants";

export const maxDuration = 60;

// Cobranza no tiene un umbral configurable en automation_templates (a
// diferencia de las 7 reglas de collection_automation_rules) — "Recordatorio
// de cobranza" acá es UNA automatización simple, no un motor de reglas por
// días. 3 días antes es el mismo default razonable que la app ya usa como
// primer aviso en otros lados.
const COLLECTION_REMINDER_DAYS_BEFORE = 3;
// Ventana de lookback del disparador de Bienvenida — el cron corre cada
// hora, 2hs de margen cubre que dos corridas consecutivas no se salteen un
// contacto creado justo en el borde.
const WELCOME_LOOKBACK_HOURS = 2;

function todayDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface ContactRow {
  name: string;
  phone: string | null;
  email: string | null;
}

function firstContact(c: ContactRow | ContactRow[] | null): ContactRow | null {
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

async function alreadyFired(
  supabase: ReturnType<typeof createServiceRoleClient>,
  workspaceId: string,
  automationType: string,
  entityId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("automation_send_log")
    .insert({ workspace_id: workspaceId, automation_type: automationType, entity_type: "policy", entity_id: entityId, fired_for_date: todayDateStr() });
  return Boolean(error);
}

async function createSuggestTask(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: { workspaceId: string; title: string; relatedId: string; assignedTo: string | null },
) {
  await supabase.from("tasks").insert({
    workspace_id: input.workspaceId,
    title: input.title,
    related_type: "policy",
    related_id: input.relatedId,
    assigned_to: input.assignedTo,
    due_at: new Date().toISOString(),
  });
}

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

const memberNameCache = new Map<string, Map<string, string>>();
async function getMemberName(supabase: ReturnType<typeof createServiceRoleClient>, workspaceId: string, memberId: string | null): Promise<string> {
  if (!memberId) return "";
  let cache = memberNameCache.get(workspaceId);
  if (!cache) {
    const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
    cache = new Map(((data ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.member_id, m.full_name]));
    memberNameCache.set(workspaceId, cache);
  }
  return cache.get(memberId) ?? "";
}

/**
 * Cron del módulo "Automatizaciones" (automation_templates, 0108) — un
 * único endpoint para los 3 tipos con disparador real (aniversario de
 * póliza, recordatorio de cobranza, bienvenida), mismo espíritu que
 * /api/cron/policy-automations y /api/cron/collection-automations: nunca
 * auto-envía WhatsApp (fuera de la ventana de 24hs, Meta exige plantilla
 * aprobada que este proyecto no tiene) — crea una tarea con el mensaje +
 * link wa.me ya armado para que el asesor lo mande con un clic.
 *
 * "Renovación próxima" NO vive acá — su switch controla
 * policy_automation_rules.suggest_whatsapp directamente (ver
 * updateAutomationAction), reusando el motor de Pólizas en vez de correr un
 * segundo motor que podría duplicar la tarea de una misma póliza.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  let fired = 0;

  const { data: templates } = await supabase
    .from("automation_templates")
    .select("workspace_id, type, message_template, whatsapp_enabled")
    .eq("enabled", true)
    .in("type", ["policy_anniversary", "collection_reminder", "welcome"]);

  const byType = new Map<string, { workspace_id: string; message_template: string; whatsapp_enabled: boolean }[]>();
  for (const t of templates ?? []) {
    const list = byType.get(t.type as string) ?? [];
    list.push(t as { workspace_id: string; message_template: string; whatsapp_enabled: boolean });
    byType.set(t.type as string, list);
  }

  // --- Aniversario de póliza ---------------------------------------------
  for (const tpl of byType.get("policy_anniversary") ?? []) {
    if (!tpl.whatsapp_enabled) continue;
    const { data: policies } = await supabase
      .from("policies")
      .select("id, workspace_id, owner_id, company, policy_number, start_date, status, contacts(name, phone, email)")
      .eq("workspace_id", tpl.workspace_id)
      .in("status", ACTIVE_LIKE_STATUSES)
      .not("start_date", "is", null);

    const today = new Date();
    for (const policy of policies ?? []) {
      const start = new Date(policy.start_date as string);
      if (start.getMonth() !== today.getMonth() || start.getDate() !== today.getDate()) continue;
      if (start.getFullYear() === today.getFullYear()) continue; // recién emitida hoy, no es un aniversario todavía
      if (!policy.owner_id) continue;

      const contact = firstContact(policy.contacts as ContactRow | ContactRow[] | null);
      if (await alreadyFired(supabase, tpl.workspace_id, "policy_anniversary", policy.id as string)) continue;

      try {
        fired++;
        const message = interpolateAutomationTemplate(tpl.message_template, {
          nombre: contact?.name ?? "cliente",
          apellido: "",
          empresa: policy.company as string,
          telefono: contact?.phone ?? "",
          fecha: todayDateStr(),
          agente: await getMemberName(supabase, tpl.workspace_id, policy.owner_id as string),
        });
        const title = contact?.phone
          ? `Enviar WhatsApp de aniversario a ${contact.name}: ${buildWaLink(contact.phone, message)}`
          : `Aniversario de póliza — ${contact?.name ?? "cliente"} (${policy.company})`;
        await createSuggestTask(supabase, { workspaceId: tpl.workspace_id, title, relatedId: policy.id as string, assignedTo: policy.owner_id as string });
        await notify({
          workspaceId: tpl.workspace_id,
          memberId: policy.owner_id as string,
          eventType: "automation_executed",
          title: "Aniversario de póliza",
          message: `${contact?.name ?? "Un cliente"} cumple un año con su póliza de ${policy.company} hoy.`,
          actionUrl: `/polizas?policy=${policy.id}`,
        });
      } catch (err) {
        console.error(`[cron/run-automations] policy_anniversary failed for policy ${policy.id}:`, err);
      }
    }
  }

  // --- Recordatorio de cobranza -------------------------------------------
  for (const tpl of byType.get("collection_reminder") ?? []) {
    if (!tpl.whatsapp_enabled) continue;
    const targetDate = todayDateStr(COLLECTION_REMINDER_DAYS_BEFORE);
    const { data: payments } = await supabase
      .from("policy_payments")
      .select("id, policy_id, due_date, amount, currency, status, policies!inner(id, workspace_id, owner_id, company, policy_number, contacts(name, phone, email))")
      .eq("policies.workspace_id", tpl.workspace_id)
      .eq("due_date", targetDate)
      .in("status", ["pendiente", "en_seguimiento"]);

    for (const payment of payments ?? []) {
      const policyRaw = payment.policies as unknown;
      const policy = Array.isArray(policyRaw) ? policyRaw[0] : policyRaw;
      if (!policy || !policy.owner_id) continue;
      const contact = firstContact(policy.contacts as ContactRow | ContactRow[] | null);

      const { error: dedupeError } = await supabase
        .from("automation_send_log")
        .insert({ workspace_id: tpl.workspace_id, automation_type: "collection_reminder", entity_type: "policy_payment", entity_id: payment.id as string, fired_for_date: todayDateStr() });
      if (dedupeError) continue;

      try {
        fired++;
        const message = interpolateAutomationTemplate(tpl.message_template, {
          nombre: contact?.name ?? "cliente",
          apellido: "",
          empresa: policy.company as string,
          telefono: contact?.phone ?? "",
          fecha: payment.due_date as string,
          agente: await getMemberName(supabase, tpl.workspace_id, policy.owner_id as string),
        });
        const title = contact?.phone
          ? `Enviar WhatsApp de cobranza a ${contact.name}: ${buildWaLink(contact.phone, message)}`
          : `Recordatorio de cobranza — ${contact?.name ?? "cliente"} (${policy.company})`;
        await createSuggestTask(supabase, { workspaceId: tpl.workspace_id, title, relatedId: policy.id as string, assignedTo: policy.owner_id as string });
        await notify({
          workspaceId: tpl.workspace_id,
          memberId: policy.owner_id as string,
          eventType: "automation_executed",
          title: "Recordatorio de cobranza",
          message: `El pago de ${contact?.name ?? "un cliente"} vence el ${payment.due_date}.`,
          actionUrl: `/cobranza?payment=${payment.id}`,
        });
      } catch (err) {
        console.error(`[cron/run-automations] collection_reminder failed for payment ${payment.id}:`, err);
      }
    }
  }

  // --- Bienvenida -----------------------------------------------------------
  for (const tpl of byType.get("welcome") ?? []) {
    if (!tpl.whatsapp_enabled) continue;
    const since = new Date(Date.now() - WELCOME_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, workspace_id, name, phone, email, source, created_at")
      .eq("workspace_id", tpl.workspace_id)
      .gte("created_at", since)
      // Un import/sync masivo no es "un cliente nuevo entrando" en el
      // sentido de esta automatización — evita saludar a 500 contactos de
      // una cartera migrada de una sola vez.
      .not("source", "in", "(import,lead_sheet_sync)");

    if (!contacts || contacts.length === 0) continue;

    const { data: firstMember } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", tpl.workspace_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const assignedTo = (firstMember?.id as string | undefined) ?? null;

    for (const contact of contacts) {
      const { error: dedupeError } = await supabase
        .from("automation_send_log")
        .insert({ workspace_id: tpl.workspace_id, automation_type: "welcome", entity_type: "contact", entity_id: contact.id as string, fired_for_date: todayDateStr() });
      if (dedupeError) continue;

      try {
        fired++;
        const message = interpolateAutomationTemplate(tpl.message_template, {
          nombre: contact.name as string,
          apellido: "",
          empresa: "",
          telefono: (contact.phone as string | null) ?? "",
          fecha: todayDateStr(),
          agente: "",
        });
        const title = contact.phone
          ? `Enviar WhatsApp de bienvenida a ${contact.name}: ${buildWaLink(contact.phone as string, message)}`
          : `Bienvenida — ${contact.name}`;
        await createSuggestTask(supabase, { workspaceId: tpl.workspace_id, title, relatedId: contact.id as string, assignedTo });
      } catch (err) {
        console.error(`[cron/run-automations] welcome failed for contact ${contact.id}:`, err);
      }
    }
  }

  return NextResponse.json({ fired }, { status: 200 });
}
