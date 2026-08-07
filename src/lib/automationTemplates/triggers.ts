import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { interpolateAutomationTemplate } from "@/lib/automationTemplates/constants";

/** "Pago recibido" es la única automatización disparada por EVENTO en vez
 * de por cron — no tiene sentido esperar hasta la próxima corrida horaria
 * para avisar que un pago acaba de entrar. Llamado desde
 * updatePolicyPaymentStatusAction (policies/actions.ts) cuando el estado
 * pasa a "pagado". Nunca lanza — un fallo acá no debe romper la acción de
 * marcar el pago (mismo criterio que ensurePolicyPaymentSchedule). */
export async function firePaymentReceivedAutomation(paymentId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: payment } = await supabase
      .from("policy_payments")
      .select("id, policies!inner(id, workspace_id, owner_id, company, policy_number, contacts(name, phone, email))")
      .eq("id", paymentId)
      .maybeSingle();
    if (!payment) return;

    const policyRaw = payment.policies as unknown;
    const policy = Array.isArray(policyRaw) ? policyRaw[0] : policyRaw;
    if (!policy || !policy.owner_id) return;

    const { data: catalogEntry } = await supabase
      .from("automation_catalog")
      .select("default_enabled, default_message_template")
      .eq("key", "payment_received")
      .maybeSingle();
    if (!catalogEntry) return;

    const { data: override } = await supabase
      .from("automation_templates")
      .select("enabled, whatsapp_enabled, message_template")
      .eq("workspace_id", policy.workspace_id)
      .eq("type", "payment_received")
      .maybeSingle();

    const enabled = override ? (override.enabled as boolean) : (catalogEntry.default_enabled as boolean);
    if (!enabled) return;
    const whatsappEnabled = override ? (override.whatsapp_enabled as boolean) : true;
    if (!whatsappEnabled) return;
    const messageTemplate = override
      ? ((override.message_template as string | null) ?? (catalogEntry.default_message_template as string))
      : (catalogEntry.default_message_template as string);

    const contactRaw = policy.contacts as { name: string; phone: string | null; email: string | null } | { name: string; phone: string | null; email: string | null }[] | null;
    const contact = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw;

    const { error: dedupeError } = await supabase.from("automation_send_log").insert({
      workspace_id: policy.workspace_id,
      automation_type: "payment_received",
      entity_type: "policy_payment",
      entity_id: paymentId,
      entity_label: contact?.name ?? null,
      fired_for_date: new Date().toISOString().slice(0, 10),
    });
    if (dedupeError) return; // ya se disparó hoy para este pago

    const message = interpolateAutomationTemplate(messageTemplate, {
      nombre: contact?.name ?? "cliente",
      apellido: "",
      empresa: policy.company as string,
      telefono: contact?.phone ?? "",
      fecha: new Date().toISOString().slice(0, 10),
      agente: "",
    });
    const digits = contact?.phone?.replace(/\D/g, "");
    const title = digits
      ? `Enviar WhatsApp de pago recibido a ${contact?.name}: https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : `Pago recibido — ${contact?.name ?? "cliente"} (${policy.company})`;

    await supabase.from("tasks").insert({
      workspace_id: policy.workspace_id,
      title,
      related_type: "policy",
      related_id: policy.id,
      assigned_to: policy.owner_id,
      due_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[automationTemplates] firePaymentReceivedAutomation failed:", err);
  }
}
