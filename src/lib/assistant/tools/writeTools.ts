import type { AssistantToolContext } from "@/lib/assistant/tools/shared";
import { findOrCreateContact } from "@/lib/contacts/match";

/** Herramientas de escritura — el Tool Router (runtime.ts) nunca las ejecuta
 * directo desde el turno del modelo: quedan "proposed" hasta que el usuario
 * confirma desde la tarjeta en el chat (mismo criterio de todo el resto de
 * la sesión: nunca una acción irreversible sin que la vea un humano antes). */

export async function createTask(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const title = String(args.title ?? "").trim();
  if (!title) throw new Error("title es obligatorio");
  const dueAt = typeof args.due_at === "string" && args.due_at ? args.due_at : null;

  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({ workspace_id: ctx.workspaceId, title, assigned_to: ctx.memberId, created_by: ctx.memberId, due_at: dueAt })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la tarea.");
  return { taskId: data.id, title };
}

export async function movePipelineItem(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const contactName = String(args.contact_name ?? "").trim();
  const stageName = String(args.stage_name ?? "").trim();
  if (!contactName || !stageName) throw new Error("contact_name y stage_name son obligatorios");

  const { data: contact } = await ctx.supabase.from("contacts").select("id").eq("workspace_id", ctx.workspaceId).ilike("name", `%${contactName}%`).limit(1).maybeSingle();
  if (!contact) throw new Error(`No encontré un contacto llamado "${contactName}".`);

  const { data: opportunity } = await ctx.supabase
    .from("opportunities")
    .select("id, pipeline_item_id, pipeline_items(pipeline_id)")
    .eq("workspace_id", ctx.workspaceId)
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!opportunity || !opportunity.pipeline_item_id) throw new Error(`No encontré una oportunidad abierta para ${contactName}.`);

  const pipelineItems = opportunity.pipeline_items as { pipeline_id: string } | { pipeline_id: string }[] | null;
  const pipelineId = Array.isArray(pipelineItems) ? pipelineItems[0]?.pipeline_id : pipelineItems?.pipeline_id;
  if (!pipelineId) throw new Error("No se pudo resolver el pipeline de esta oportunidad.");

  const { data: stage } = await ctx.supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", pipelineId).ilike("name", `%${stageName}%`).limit(1).maybeSingle();
  if (!stage) throw new Error(`No encontré la etapa "${stageName}".`);

  await ctx.supabase.from("pipeline_items").update({ stage_id: stage.id }).eq("id", opportunity.pipeline_item_id);
  return { contactName, stageName: stage.name };
}

export async function createMeeting(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const subject = String(args.subject ?? "").trim();
  const startTime = String(args.start_time ?? "");
  const endTime = String(args.end_time ?? "");
  const contactName = typeof args.contact_name === "string" ? args.contact_name.trim() : "";
  if (!subject || !startTime || !endTime) throw new Error("subject, start_time y end_time son obligatorios");
  if (!(new Date(endTime) > new Date(startTime))) throw new Error("end_time debe ser posterior a start_time");

  let contactId: string | null = null;
  if (contactName) {
    const { data: contact } = await ctx.supabase.from("contacts").select("id").eq("workspace_id", ctx.workspaceId).ilike("name", `%${contactName}%`).limit(1).maybeSingle();
    contactId = (contact?.id as string) ?? null;
  }

  const { data, error } = await ctx.supabase
    .from("bookings")
    .insert({ workspace_id: ctx.workspaceId, contact_id: contactId, created_by: ctx.memberId, owner_id: ctx.memberId, subject, event_type: "meeting", start_time: startTime, end_time: endTime })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la reunión.");
  return { bookingId: data.id, subject, startTime };
}

/** `register_payment` — el "cerré a Pedro" del spec: busca el próximo cobro
 * pendiente de este contacto y lo marca pagado (mismo shape que
 * registerPaymentAction en collections/actions.ts, reescrito acá porque esa
 * versión depende de requireActiveWorkspace()/sesión). El progreso de
 * Metas y Bonificaciones se recalcula solo en la próxima carga — no hace
 * falta "sumar al bono" a mano, es la misma tabla policy_payments. */
export async function registerPayment(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const contactName = String(args.contact_name ?? "").trim();
  if (!contactName) throw new Error("contact_name es obligatorio");

  const { data: contact } = await ctx.supabase.from("contacts").select("id, name").eq("workspace_id", ctx.workspaceId).ilike("name", `%${contactName}%`).limit(1).maybeSingle();
  if (!contact) throw new Error(`No encontré un contacto llamado "${contactName}".`);

  const { data: policyRows } = await ctx.supabase.from("policies").select("id, company").eq("workspace_id", ctx.workspaceId).eq("contact_id", contact.id);
  const policyIds = (policyRows ?? []).map((p) => p.id as string);
  if (policyIds.length === 0) throw new Error(`${contact.name} no tiene pólizas cargadas.`);

  const { data: payment } = await ctx.supabase
    .from("policy_payments")
    .select("id, amount, currency, due_date, policy_id")
    .in("policy_id", policyIds)
    .in("status", ["pendiente", "en_seguimiento"])
    .order("due_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!payment) throw new Error(`${contact.name} no tiene cobros pendientes.`);

  await ctx.supabase.from("policy_payments").update({ status: "pagado", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payment.id);

  const policy = (policyRows ?? []).find((p) => p.id === payment.policy_id);
  return { contactName: contact.name, amount: payment.amount, currency: payment.currency, company: policy?.company ?? null };
}

const INSURANCE_TYPES = ["auto", "hogar", "vida", "otro"] as const;

/** `create_policy_quote` — crea una póliza real en estado "Cotización"
 * (aclarado explícitamente por el usuario: "cotización" acá es una póliza
 * en esa etapa del pipeline existente, no un documento nuevo). Mismo
 * criterio de creación de contacto que confirmPolicyFromExtractionAction. */
export async function createPolicyQuote(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const contactName = String(args.contact_name ?? "").trim();
  const company = String(args.company ?? "").trim();
  const insuranceTypeRaw = String(args.insurance_type ?? "otro").toLowerCase();
  const insuranceType = (INSURANCE_TYPES as readonly string[]).includes(insuranceTypeRaw) ? insuranceTypeRaw : "otro";
  const premium = typeof args.premium === "number" ? args.premium : null;
  if (!contactName || !company) throw new Error("contact_name y company son obligatorios");

  const contactId = await findOrCreateContact(ctx.supabase, ctx.workspaceId, { name: contactName }, "ai_assistant");

  const { data: pipeline } = await ctx.supabase.from("pipelines").select("id").eq("workspace_id", ctx.workspaceId).eq("module_key", "policies").limit(1).maybeSingle();
  if (!pipeline) throw new Error("no_policy_pipeline");
  const { data: firstStage } = await ctx.supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipeline.id).order("position", { ascending: true }).limit(1).maybeSingle();
  if (!firstStage) throw new Error("no_pipeline_stages");

  const { data: policy, error: policyError } = await ctx.supabase
    .from("policies")
    .insert({
      workspace_id: ctx.workspaceId,
      contact_id: contactId,
      owner_id: ctx.memberId,
      created_by: ctx.memberId,
      company,
      insurance_type: insuranceType,
      status: "cotizacion",
      premium,
      source: "manual",
    })
    .select("id")
    .single();
  if (policyError || !policy) throw new Error("No se pudo crear la cotización.");

  const { data: item } = await ctx.supabase
    .from("pipeline_items")
    .insert({ pipeline_id: pipeline.id, stage_id: firstStage.id, item_type: "policy", item_id: policy.id, position: 0 })
    .select("id")
    .single();
  if (item) await ctx.supabase.from("policies").update({ pipeline_item_id: item.id }).eq("id", policy.id);

  return { policyId: policy.id, contactName, company };
}

/** `draft_message_reply` — redacta y guarda un BORRADOR en la conversación
 * real de WhatsApp/Email del contacto (status='draft', mismo mecanismo que
 * el modo "asistido" del Agente IA de WhatsApp) — nunca lo envía. El
 * usuario lo revisa y lo manda con un clic desde el Inbox. */
export async function draftMessageReply(args: Record<string, unknown>, ctx: AssistantToolContext): Promise<unknown> {
  const contactName = String(args.contact_name ?? "").trim();
  const messageBody = String(args.message ?? "").trim();
  if (!contactName || !messageBody) throw new Error("contact_name y message son obligatorios");

  const { data: contact } = await ctx.supabase.from("contacts").select("id, name").eq("workspace_id", ctx.workspaceId).ilike("name", `%${contactName}%`).limit(1).maybeSingle();
  if (!contact) throw new Error(`No encontré un contacto llamado "${contactName}".`);

  const { data: conversation } = await ctx.supabase
    .from("conversations")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("contact_id", contact.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) throw new Error(`${contact.name} todavía no tiene una conversación de WhatsApp/Email en el Inbox.`);

  const { data: draft, error } = await ctx.supabase
    .from("messages")
    .insert({
      workspace_id: ctx.workspaceId,
      conversation_id: conversation.id,
      direction: "outbound",
      sender_type: "ai",
      sender_id: null,
      type: "text",
      content: { body: messageBody },
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !draft) throw new Error("No se pudo guardar el borrador.");

  return { contactName: contact.name, conversationId: conversation.id, draftMessageId: draft.id };
}
