import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { notify } from "@/lib/notifications/service";
import { sendNotificationEmail } from "@/lib/email/resend";
import { logActivity } from "@/lib/activity/log";
import { COLLECTION_STATUSES } from "@/lib/collections/constants";

export const maxDuration = 60;

interface PaymentCandidate {
  id: string;
  policy_id: string;
  due_date: string;
  amount: number;
  currency: string;
  status: string;
  policies: PolicyRow | PolicyRow[] | null;
}

interface PolicyRow {
  id: string;
  workspace_id: string;
  owner_id: string | null;
  company: string;
  policy_number: string | null;
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

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Motor de recordatorios de cobro (collection_automation_rules, 0100) —
 * calco de /api/cron/policy-automations pero disparando sobre policy_payments
 * en vez de policies.end_date. trigger_days negativo (ver DEFAULT_RULES en
 * collections/automationRules.ts) evalúa vencimientos ya pasados (mora),
 * positivo evalúa vencimientos futuros — mismo `target date = hoy +
 * trigger_days` en ambos casos.
 *
 * No auto-envía WhatsApp al cliente, mismo motivo que Pólizas (ventana de
 * 24hs de Meta) — crea una tarea con el link wa.me ya armado.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: rules, error: rulesError } = await supabase.from("collection_automation_rules").select("*").eq("enabled", true);
  if (rulesError) {
    console.error("[cron/collection-automations] failed to load rules:", rulesError.message);
    return NextResponse.json({ error: "rules_failed" }, { status: 500 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let fired = 0;

  for (const rule of (rules ?? []) as AutomationRule[]) {
    const target = new Date(today);
    target.setDate(target.getDate() + rule.trigger_days);
    const targetDateStr = target.toISOString().slice(0, 10);

    const { data: candidates } = await supabase
      .from("policy_payments")
      .select("id, policy_id, due_date, amount, currency, status, policies!inner(id, workspace_id, owner_id, company, policy_number, contacts(name, email, phone))")
      .eq("policies.workspace_id", rule.workspace_id)
      .eq("due_date", targetDateStr)
      .in("status", ["pendiente", "en_seguimiento"]);

    for (const payment of (candidates ?? []) as PaymentCandidate[]) {
      const policy = Array.isArray(payment.policies) ? payment.policies[0] : payment.policies;
      if (!policy) continue;

      // Dedupe vía unique(payment_id, rule_id, payment_due_date).
      const { error: dedupeError } = await supabase
        .from("collection_automation_log")
        .insert({ payment_id: payment.id, rule_id: rule.id, payment_due_date: payment.due_date });
      if (dedupeError) continue;

      try {
        fired++;
        const contact = Array.isArray(policy.contacts) ? policy.contacts[0] : policy.contacts;
        const clientName = contact?.name ?? "el cliente";
        const amountLabel = formatCurrency(payment.amount, payment.currency);
        const policyLabel = `${policy.policy_number ? `póliza ${policy.policy_number}` : "la póliza"} de ${clientName} (${policy.company})`;
        const isOverdue = rule.trigger_days < 0;
        const verb = isOverdue ? "venció" : "vence";

        if (rule.create_task && policy.owner_id) {
          await supabase.from("tasks").insert({
            workspace_id: policy.workspace_id,
            title: `Cobro: ${amountLabel} de ${policyLabel} ${verb} el ${payment.due_date}`,
            related_type: "policy",
            related_id: policy.id,
            assigned_to: policy.owner_id,
            due_at: new Date().toISOString(),
          });
        }

        if (rule.suggest_whatsapp && policy.owner_id && contact?.phone) {
          const digits = contact.phone.replace(/\D/g, "");
          const message = `Hola ${clientName}, te recordamos que el pago de ${amountLabel} de tu ${policy.policy_number ? `póliza ${policy.policy_number}` : "póliza"} de ${policy.company} ${verb} el ${payment.due_date}. ¿Coordinamos el pago?`;
          const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
          await supabase.from("tasks").insert({
            workspace_id: policy.workspace_id,
            title: `Enviar WhatsApp de cobro a ${clientName}: ${waLink}`,
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
            eventType: "collection_payment_reminder",
            title: isOverdue ? "Cobro vencido" : "Recordatorio de cobro",
            message: `El pago de ${amountLabel} de ${policyLabel} ${verb} el ${payment.due_date}.`,
            actionUrl: `/cobranza?payment=${payment.id}`,
          });
        }

        if (rule.send_email && contact?.email) {
          await sendNotificationEmail({
            to: contact.email,
            title: isOverdue ? "Tenés un pago pendiente" : "Tu próximo pago está por vencer",
            message: `Hola ${clientName}, te escribimos porque el pago de ${amountLabel} de tu póliza de ${policy.company} ${verb} el ${payment.due_date}. Contactanos para coordinarlo.`,
            actionUrl: null,
          });
        }

        if (rule.move_to_status && COLLECTION_STATUSES.includes(rule.move_to_status as (typeof COLLECTION_STATUSES)[number])) {
          await supabase.from("policy_payments").update({ status: rule.move_to_status }).eq("id", payment.id);
        }

        await logActivity(supabase, policy.workspace_id, null, "policy", policy.id, "collection_reminder_automation_fired", { rule: rule.name, paymentId: payment.id });
      } catch (err) {
        console.error(`[cron/collection-automations] rule "${rule.name}" failed for payment ${payment.id}:`, err);
      }
    }
  }

  return NextResponse.json({ fired }, { status: 200 });
}
