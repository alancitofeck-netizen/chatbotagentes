import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notify } from "@/lib/notifications/service";
import { interpolateAutomationTemplate } from "@/lib/automationTemplates/constants";
import { ACTIVE_LIKE_STATUSES } from "@/lib/policies/constants";

export const maxDuration = 60;

// Cobranza no tiene un umbral configurable en automation_catalog (a
// diferencia de las 7 reglas de collection_automation_rules) — "Recordatorio
// de cobranza"/"Pago vencido" acá son UNA automatización simple cada una,
// no un motor de reglas por días.
const COLLECTION_REMINDER_DAYS_BEFORE = 3;
const PAYMENT_OVERDUE_DAYS_AFTER = 1;
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

interface WorkspaceAutomationConfig {
  workspaceId: string;
  messageTemplate: string;
  whatsappEnabled: boolean;
}

/** Catálogo GLOBAL (automation_catalog, 0110) + override opcional por
 * workspace (automation_templates) — un workspace sin fila de override usa
 * el default del catálogo tal cual, así que una automatización con
 * default_enabled=true (ej. aniversario de póliza) ya dispara para TODO
 * workspace desde el día uno, sin que nadie haya tocado un switch. */
async function getEnabledWorkspaceConfigs(supabase: ReturnType<typeof createServiceRoleClient>, type: string): Promise<WorkspaceAutomationConfig[]> {
  const { data: catalogEntry } = await supabase.from("automation_catalog").select("default_enabled, default_message_template").eq("key", type).maybeSingle();
  if (!catalogEntry) return [];

  const [{ data: workspaces }, { data: overrides }] = await Promise.all([
    supabase.from("workspaces").select("id"),
    supabase.from("automation_templates").select("workspace_id, enabled, whatsapp_enabled, message_template").eq("type", type),
  ]);
  const overrideByWorkspace = new Map(((overrides ?? []) as Record<string, unknown>[]).map((r) => [r.workspace_id as string, r]));

  const configs: WorkspaceAutomationConfig[] = [];
  for (const w of workspaces ?? []) {
    const workspaceId = w.id as string;
    const override = overrideByWorkspace.get(workspaceId);
    const enabled = override ? (override.enabled as boolean) : (catalogEntry.default_enabled as boolean);
    if (!enabled) continue;
    configs.push({
      workspaceId,
      whatsappEnabled: override ? (override.whatsapp_enabled as boolean) : true,
      messageTemplate: override ? ((override.message_template as string | null) ?? (catalogEntry.default_message_template as string)) : (catalogEntry.default_message_template as string),
    });
  }
  return configs;
}

/** Reserva el disparo de hoy (dedupe vía unique(workspace,type,entity,fecha))
 * y deja un registro en el Historial con status='completed' por default —
 * si la acción posterior falla, el catch de cada bloque lo corrige a
 * 'failed' vía markLogFailed. Devuelve el id del log, o null si ya se había
 * disparado hoy para esta entidad (dedupe). */
async function claimFire(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: { workspaceId: string; automationType: string; entityType: string; entityId: string; entityLabel: string | null },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("automation_send_log")
    .insert({
      workspace_id: input.workspaceId,
      automation_type: input.automationType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_label: input.entityLabel,
      fired_for_date: todayDateStr(),
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

async function markLogFailed(supabase: ReturnType<typeof createServiceRoleClient>, logId: string, error: unknown) {
  await supabase
    .from("automation_send_log")
    .update({ status: "failed", error: error instanceof Error ? error.message : "Error desconocido." })
    .eq("id", logId);
}

async function createSuggestTask(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: { workspaceId: string; title: string; relatedId: string; relatedType: string; assignedTo: string | null },
) {
  await supabase.from("tasks").insert({
    workspace_id: input.workspaceId,
    title: input.title,
    related_type: input.relatedType,
    related_id: input.relatedId,
    assigned_to: input.assignedTo,
    due_at: new Date().toISOString(),
  });
}

/**
 * Cron del módulo "Automatizaciones" (automation_catalog +
 * automation_templates, 0108/0110) — un único endpoint para los tipos con
 * disparador real evaluado por umbral de fecha (aniversario de póliza,
 * recordatorio de cobranza, pago vencido, bienvenida), mismo espíritu que
 * /api/cron/policy-automations y /api/cron/collection-automations: nunca
 * auto-envía WhatsApp (fuera de la ventana de 24hs, Meta exige plantilla
 * aprobada que este proyecto no tiene) — crea una tarea con el mensaje +
 * link wa.me ya armado para que el asesor lo mande con un clic.
 *
 * "Pago recibido" NO vive acá — se dispara al toque desde
 * updatePolicyPaymentStatusAction (evento, no cron: no tiene sentido
 * esperar hasta la próxima corrida horaria para avisar que un pago entró).
 * "Renovación de póliza" tampoco — su switch controla
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

  // --- Aniversario de póliza ---------------------------------------------
  for (const cfg of await getEnabledWorkspaceConfigs(supabase, "policy_anniversary")) {
    if (!cfg.whatsappEnabled) continue;
    const { data: policies } = await supabase
      .from("policies")
      .select("id, workspace_id, owner_id, company, policy_number, start_date, status, contacts(name, phone, email)")
      .eq("workspace_id", cfg.workspaceId)
      .in("status", ACTIVE_LIKE_STATUSES)
      .not("start_date", "is", null);

    const today = new Date();
    for (const policy of policies ?? []) {
      const start = new Date(policy.start_date as string);
      if (start.getMonth() !== today.getMonth() || start.getDate() !== today.getDate()) continue;
      if (start.getFullYear() === today.getFullYear()) continue; // recién emitida hoy, no es un aniversario todavía
      if (!policy.owner_id) continue;

      const contact = firstContact(policy.contacts as ContactRow | ContactRow[] | null);
      const logId = await claimFire(supabase, {
        workspaceId: cfg.workspaceId,
        automationType: "policy_anniversary",
        entityType: "policy",
        entityId: policy.id as string,
        entityLabel: contact?.name ?? null,
      });
      if (!logId) continue;

      try {
        fired++;
        const message = interpolateAutomationTemplate(cfg.messageTemplate, {
          nombre: contact?.name ?? "cliente",
          apellido: "",
          empresa: policy.company as string,
          telefono: contact?.phone ?? "",
          fecha: todayDateStr(),
          agente: await getMemberName(supabase, cfg.workspaceId, policy.owner_id as string),
        });
        const title = contact?.phone
          ? `Enviar WhatsApp de aniversario a ${contact.name}: ${buildWaLink(contact.phone, message)}`
          : `Aniversario de póliza — ${contact?.name ?? "cliente"} (${policy.company})`;
        await createSuggestTask(supabase, { workspaceId: cfg.workspaceId, title, relatedId: policy.id as string, relatedType: "policy", assignedTo: policy.owner_id as string });
        await notify({
          workspaceId: cfg.workspaceId,
          memberId: policy.owner_id as string,
          eventType: "automation_executed",
          title: "Aniversario de póliza",
          message: `${contact?.name ?? "Un cliente"} cumple un año con su póliza de ${policy.company} hoy.`,
          actionUrl: `/polizas?policy=${policy.id}`,
        });
      } catch (err) {
        console.error(`[cron/run-automations] policy_anniversary failed for policy ${policy.id}:`, err);
        await markLogFailed(supabase, logId, err);
      }
    }
  }

  // --- Recordatorio de cobranza / Pago vencido ----------------------------
  async function runPaymentDateAutomation(type: "collection_reminder" | "payment_overdue", offsetDays: number, isOverdue: boolean) {
    for (const cfg of await getEnabledWorkspaceConfigs(supabase, type)) {
      if (!cfg.whatsappEnabled) continue;
      const targetDate = todayDateStr(offsetDays);
      const { data: payments } = await supabase
        .from("policy_payments")
        .select("id, policy_id, due_date, amount, currency, status, policies!inner(id, workspace_id, owner_id, company, policy_number, contacts(name, phone, email))")
        .eq("policies.workspace_id", cfg.workspaceId)
        .eq("due_date", targetDate)
        .in("status", ["pendiente", "en_seguimiento"]);

      for (const payment of payments ?? []) {
        const policyRaw = payment.policies as unknown;
        const policy = Array.isArray(policyRaw) ? policyRaw[0] : policyRaw;
        if (!policy || !policy.owner_id) continue;
        const contact = firstContact(policy.contacts as ContactRow | ContactRow[] | null);

        const logId = await claimFire(supabase, {
          workspaceId: cfg.workspaceId,
          automationType: type,
          entityType: "policy_payment",
          entityId: payment.id as string,
          entityLabel: contact?.name ?? null,
        });
        if (!logId) continue;

        try {
          fired++;
          const message = interpolateAutomationTemplate(cfg.messageTemplate, {
            nombre: contact?.name ?? "cliente",
            apellido: "",
            empresa: policy.company as string,
            telefono: contact?.phone ?? "",
            fecha: payment.due_date as string,
            agente: await getMemberName(supabase, cfg.workspaceId, policy.owner_id as string),
          });
          const verb = isOverdue ? "vencido" : "cobranza";
          const title = contact?.phone
            ? `Enviar WhatsApp de ${verb} a ${contact.name}: ${buildWaLink(contact.phone, message)}`
            : `${isOverdue ? "Pago vencido" : "Recordatorio de cobranza"} — ${contact?.name ?? "cliente"} (${policy.company})`;
          await createSuggestTask(supabase, { workspaceId: cfg.workspaceId, title, relatedId: policy.id as string, relatedType: "policy", assignedTo: policy.owner_id as string });
          await notify({
            workspaceId: cfg.workspaceId,
            memberId: policy.owner_id as string,
            eventType: "automation_executed",
            title: isOverdue ? "Pago vencido" : "Recordatorio de cobranza",
            message: `El pago de ${contact?.name ?? "un cliente"} ${isOverdue ? "venció" : "vence"} el ${payment.due_date}.`,
            actionUrl: `/cobranza?payment=${payment.id}`,
          });
        } catch (err) {
          console.error(`[cron/run-automations] ${type} failed for payment ${payment.id}:`, err);
          await markLogFailed(supabase, logId, err);
        }
      }
    }
  }
  await runPaymentDateAutomation("collection_reminder", COLLECTION_REMINDER_DAYS_BEFORE, false);
  await runPaymentDateAutomation("payment_overdue", -PAYMENT_OVERDUE_DAYS_AFTER, true);

  // --- Bienvenida -----------------------------------------------------------
  for (const cfg of await getEnabledWorkspaceConfigs(supabase, "welcome")) {
    if (!cfg.whatsappEnabled) continue;
    const since = new Date(Date.now() - WELCOME_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, workspace_id, name, phone, email, source, created_at")
      .eq("workspace_id", cfg.workspaceId)
      .gte("created_at", since)
      // Un import/sync masivo no es "un cliente nuevo entrando" en el
      // sentido de esta automatización — evita saludar a 500 contactos de
      // una cartera migrada de una sola vez.
      .not("source", "in", "(import,lead_sheet_sync)");

    if (!contacts || contacts.length === 0) continue;

    const { data: firstMember } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", cfg.workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const assignedTo = (firstMember?.id as string | undefined) ?? null;

    for (const contact of contacts) {
      const logId = await claimFire(supabase, {
        workspaceId: cfg.workspaceId,
        automationType: "welcome",
        entityType: "contact",
        entityId: contact.id as string,
        entityLabel: contact.name as string,
      });
      if (!logId) continue;

      try {
        fired++;
        const message = interpolateAutomationTemplate(cfg.messageTemplate, {
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
        await createSuggestTask(supabase, { workspaceId: cfg.workspaceId, title, relatedId: contact.id as string, relatedType: "contact", assignedTo });
      } catch (err) {
        console.error(`[cron/run-automations] welcome failed for contact ${contact.id}:`, err);
        await markLogFailed(supabase, logId, err);
      }
    }
  }

  return NextResponse.json({ fired }, { status: 200 });
}
