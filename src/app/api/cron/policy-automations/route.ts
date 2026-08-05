import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notify } from "@/lib/notifications/service";
import { sendNotificationEmail } from "@/lib/email/resend";
import { logActivity } from "@/lib/activity/log";
import { POLICY_STAGES, ACTIVE_LIKE_STATUSES } from "@/lib/policies/constants";

export const maxDuration = 60;

interface PolicyCandidate {
  id: string;
  workspace_id: string;
  owner_id: string | null;
  pipeline_item_id: string | null;
  company: string;
  policy_number: string | null;
  end_date: string;
  contacts: { name: string; email: string | null; phone: string | null } | { name: string; email: string | null; phone: string | null }[] | null;
}

interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  trigger_days: number;
  create_task: boolean;
  notify_owner: boolean;
  suggest_whatsapp: boolean;
  send_email: boolean;
  move_to_status: string | null;
}

/**
 * Motor de recordatorios de renovación de pólizas (policy_automation_rules,
 * 0092) — evaluado por HTTP + pg_net (mismo patrón que flush-buffers/
 * sync-lead-sheets) en vez de una función plpgsql pura, porque acá sí hace
 * falta lógica de Node: notify() (fan-out a email según preferencias del
 * asesor) y sendNotificationEmail (Resend, para el email al cliente).
 *
 * No auto-envía WhatsApp al cliente — ver la nota en 0092_policy_automations.sql:
 * fuera de la ventana de 24hs, WhatsApp Business exige plantilla aprobada por
 * Meta, que no podemos confirmar que exista. En cambio crea una tarea con el
 * link wa.me ya armado para que el asesor lo mande con un clic.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: rules, error: rulesError } = await supabase.from("policy_automation_rules").select("*").eq("enabled", true);
  if (rulesError) {
    console.error("[cron/policy-automations] failed to load rules:", rulesError.message);
    return NextResponse.json({ error: "rules_failed" }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stageMapByWorkspace = new Map<string, Map<string, string>>();

  async function getStageId(workspaceId: string, statusKey: string): Promise<string | null> {
    let stageMap = stageMapByWorkspace.get(workspaceId);
    if (!stageMap) {
      stageMap = new Map();
      const { data: pipeline } = await supabase.from("pipelines").select("id").eq("workspace_id", workspaceId).eq("module_key", "policies").maybeSingle();
      if (pipeline) {
        const { data: stages } = await supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", pipeline.id as string);
        for (const s of stages ?? []) stageMap.set(s.name as string, s.id as string);
      }
      stageMapByWorkspace.set(workspaceId, stageMap);
    }
    const statusName = POLICY_STAGES.find((s) => s.key === statusKey)?.name;
    return statusName ? (stageMap.get(statusName) ?? null) : null;
  }

  let fired = 0;

  for (const rule of (rules ?? []) as AutomationRule[]) {
    const target = new Date(today);
    target.setDate(target.getDate() + rule.trigger_days);
    const targetDateStr = target.toISOString().slice(0, 10);

    const { data: candidates } = await supabase
      .from("policies")
      .select("id, workspace_id, owner_id, pipeline_item_id, company, policy_number, end_date, contacts(name, email, phone)")
      .eq("workspace_id", rule.workspace_id)
      .eq("end_date", targetDateStr)
      .in("status", ACTIVE_LIKE_STATUSES);

    for (const policy of (candidates ?? []) as PolicyCandidate[]) {
      // Dedupe vía el unique(policy_id, rule_id, policy_end_date) — si ya se
      // disparó para esta póliza+regla+fecha, el insert viola la constraint
      // y saltamos sin ejecutar ninguna acción de nuevo.
      const { error: dedupeError } = await supabase
        .from("policy_automation_log")
        .insert({ policy_id: policy.id, rule_id: rule.id, policy_end_date: policy.end_date });
      if (dedupeError) continue;

      try {
        fired++;
        const contact = Array.isArray(policy.contacts) ? policy.contacts[0] : policy.contacts;
        const clientName = contact?.name ?? "el cliente";
        const policyLabel = `${policy.policy_number ? `póliza ${policy.policy_number}` : "la póliza"} de ${clientName} (${policy.company})`;

        if (rule.create_task && policy.owner_id) {
          await supabase.from("tasks").insert({
            workspace_id: policy.workspace_id,
            title: `Renovación: ${policyLabel} vence el ${policy.end_date}`,
            related_type: "policy",
            related_id: policy.id,
            assigned_to: policy.owner_id,
            due_at: new Date().toISOString(),
          });
        }

        if (rule.suggest_whatsapp && policy.owner_id && contact?.phone) {
          const digits = contact.phone.replace(/\D/g, "");
          const message = `Hola ${clientName}, tu ${policy.policy_number ? `póliza ${policy.policy_number}` : "póliza"} de ${policy.company} vence el ${policy.end_date}. ¿Renovamos?`;
          const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
          await supabase.from("tasks").insert({
            workspace_id: policy.workspace_id,
            title: `Enviar WhatsApp de renovación a ${clientName}: ${waLink}`,
            related_type: "policy",
            related_id: policy.id,
            assigned_to: policy.owner_id,
            due_at: new Date().toISOString(),
          });
        }

        if (rule.notify_owner && policy.owner_id) {
          await notify({
            workspaceId: policy.workspace_id,
            memberId: policy.owner_id,
            eventType: "policy_renewal_reminder",
            title: "Renovación de póliza",
            message: `${policyLabel[0].toUpperCase()}${policyLabel.slice(1)} vence el ${policy.end_date}.`,
            actionUrl: `/polizas?policy=${policy.id}`,
          });
        }

        if (rule.send_email && contact?.email) {
          await sendNotificationEmail({
            to: contact.email,
            title: `Tu ${policy.policy_number ? `póliza ${policy.policy_number}` : "póliza"} está por vencer`,
            message: `Hola ${clientName}, te escribimos porque tu póliza de ${policy.company} vence el ${policy.end_date}. Contactanos para renovarla.`,
            actionUrl: null,
          });
        }

        if (rule.move_to_status && policy.pipeline_item_id) {
          const stageId = await getStageId(policy.workspace_id, rule.move_to_status);
          if (stageId) {
            await supabase.from("pipeline_items").update({ stage_id: stageId }).eq("id", policy.pipeline_item_id);
            await supabase.from("policies").update({ status: rule.move_to_status }).eq("id", policy.id);
          }
        }

        await logActivity(supabase, policy.workspace_id, null, "policy", policy.id, "policy_renewal_automation_fired", { rule: rule.name });
      } catch (err) {
        console.error(`[cron/policy-automations] rule "${rule.name}" failed for policy ${policy.id}:`, err);
      }
    }
  }

  return NextResponse.json({ fired }, { status: 200 });
}
