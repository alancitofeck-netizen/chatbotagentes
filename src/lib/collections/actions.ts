"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOpenRouterApiKey } from "@/lib/integrations/openrouter";
import {
  getCollectionsList,
  getCollectionById,
  getCollectionsKpis,
  getCollectionActivity,
  type CollectionItem,
  type CollectionsKpis,
  type CollectionActivityEntry,
} from "@/lib/collections/queries";
import { getPolicyList } from "@/lib/policies/queries";
import { COLLECTION_STATUSES, type CollectionStatus } from "@/lib/collections/constants";
import { ensureCollectionAutomationRules, updateCollectionAutomationRule, type CollectionAutomationRulePatch } from "@/lib/collections/automationRules";
import { rankCollectionsByPriority, type RankedCollectionItem } from "@/lib/collections/insights";
import { generateCollectionMessageWithAI } from "@/lib/collections/aiAnalysis";

export async function getCollectionAutomationRulesAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return ensureCollectionAutomationRules(workspaceId);
}

export async function updateCollectionAutomationRuleAction(ruleId: string, patch: CollectionAutomationRulePatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await updateCollectionAutomationRule(workspaceId, ruleId, patch);
  revalidateCollections();
}

function revalidateCollections() {
  revalidatePath("/cobranza");
  // policy_payments también se muestra en el tab Pagos de Pólizas — mismo
  // criterio "una sola tabla, dos vistas" documentado en collections/queries.ts.
  revalidatePath("/polizas");
}

export async function getCollectionsListAction(): Promise<CollectionItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getCollectionsList(workspaceId);
}

export async function getCollectionByIdAction(paymentId: string): Promise<CollectionItem | null> {
  const { workspaceId } = await requireActiveWorkspace();
  return getCollectionById(workspaceId, paymentId);
}

export async function getCollectionActivityAction(paymentId: string): Promise<CollectionActivityEntry[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return getCollectionActivity(workspaceId, paymentId);
}

export async function getCollectionsKpisAction(): Promise<CollectionsKpis> {
  const { workspaceId } = await requireActiveWorkspace();
  return getCollectionsKpis(workspaceId);
}

/** Ranking priorizado + señales de riesgo para el panel de IA — cálculo
 * 100% determinístico (insights.ts), no llama a ningún modelo. */
export async function getCollectionsPriorityRankingAction(): Promise<RankedCollectionItem[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const list = await getCollectionsList(workspaceId);
  return rankCollectionsByPriority(list);
}

/** Único punto de este módulo que sí llama a un LLM — genera el texto de un
 * recordatorio de pago bajo demanda, nunca lo envía. */
export async function generateCollectionMessageAction(paymentId: string, channel: "email" | "whatsapp"): Promise<string | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(service, workspaceId, "generar mensajes con IA");
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;

  const item = await getCollectionById(workspaceId, paymentId);
  if (!item) return { error: "Cobro no encontrado." };

  return generateCollectionMessageWithAI(apiKey, item, channel);
}

/** Picker de pólizas para "Nuevo cobro" — reusa el mismo listado de
 * Pólizas, sin duplicar una query nueva solo para nombres. */
export async function getPolicyOptionsForCollectionAction() {
  const { workspaceId } = await requireActiveWorkspace();
  const list = await getPolicyList(workspaceId);
  return list.map((p) => ({
    id: p.id,
    label: `${p.company}${p.policyNumber ? ` · ${p.policyNumber}` : ""} — ${p.contactName}`,
    currency: p.premiumCurrency,
  }));
}

async function assertPaymentInWorkspace(paymentId: string, workspaceId: string): Promise<string> {
  const supabase = await createClient();
  const { data: payment } = await supabase.from("policy_payments").select("id, policy_id").eq("id", paymentId).maybeSingle();
  if (!payment) throw new Error("Cobro no encontrado.");
  const { data: policy } = await supabase.from("policies").select("id").eq("id", payment.policy_id as string).eq("workspace_id", workspaceId).maybeSingle();
  if (!policy) throw new Error("Cobro no encontrado en este workspace.");
  return payment.policy_id as string;
}

export interface CreateCollectionInput {
  policyId: string;
  dueDate: string;
  amount: number;
  currency: string;
  notes?: string | null;
}

export async function createCollectionAction(input: CreateCollectionInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: policy } = await supabase.from("policies").select("id").eq("id", input.policyId).eq("workspace_id", workspaceId).maybeSingle();
  if (!policy) throw new Error("Póliza no encontrada.");

  const { error } = await supabase.from("policy_payments").insert({
    policy_id: input.policyId,
    due_date: input.dueDate,
    amount: input.amount,
    currency: input.currency,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error("No se pudo crear el cobro.");
  revalidateCollections();
}

export interface RegisterPaymentInput {
  paymentMethod: string | null;
  reference?: string | null;
  receiptNumber?: string | null;
}

/** Marca un cobro como pagado — registra método/referencia/recibo y la
 * fecha real de pago (paid_at = ahora, no la due_date). */
export async function registerPaymentAction(paymentId: string, input: RegisterPaymentInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const policyId = await assertPaymentInWorkspace(paymentId, workspaceId);

  const { error } = await supabase
    .from("policy_payments")
    .update({
      status: "pagado",
      paid_at: new Date().toISOString(),
      payment_method: input.paymentMethod,
      reference: input.reference?.trim() || null,
      receipt_number: input.receiptNumber?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (error) throw new Error("No se pudo registrar el pago.");

  await logActivity(supabase, workspaceId, memberId, "policy", policyId, "collection_payment_registered", { paymentId });
  revalidateCollections();
}

/** Cambio de estado desde el Kanban — solo los 4 estados realmente
 * persistidos (COLLECTION_STATUSES); "vencido"/"proximo" se derivan y nunca
 * son un destino válido de drag, ver collections/constants.ts. */
export async function updateCollectionStatusAction(paymentId: string, status: CollectionStatus): Promise<void> {
  if (!COLLECTION_STATUSES.includes(status)) throw new Error("Estado inválido.");
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await assertPaymentInWorkspace(paymentId, workspaceId);

  const { error } = await supabase
    .from("policy_payments")
    .update({ status, paid_at: status === "pagado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) throw new Error("No se pudo actualizar el estado del cobro.");
  revalidateCollections();
}

export async function rescheduleCollectionAction(paymentId: string, dueDate: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await assertPaymentInWorkspace(paymentId, workspaceId);

  const { error } = await supabase.from("policy_payments").update({ due_date: dueDate, updated_at: new Date().toISOString() }).eq("id", paymentId);
  if (error) throw new Error("No se pudo reprogramar el cobro.");
  revalidateCollections();
}

export interface UpdateCollectionInput {
  dueDate?: string;
  amount?: number;
  currency?: string;
  notes?: string | null;
  issueDate?: string | null;
}

export async function updateCollectionAction(paymentId: string, input: UpdateCollectionInput): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await assertPaymentInWorkspace(paymentId, workspaceId);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.issueDate !== undefined) patch.issue_date = input.issueDate;

  const { error } = await supabase.from("policy_payments").update(patch).eq("id", paymentId);
  if (error) throw new Error("No se pudo actualizar el cobro.");
  revalidateCollections();
}

export async function cancelCollectionAction(paymentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await assertPaymentInWorkspace(paymentId, workspaceId);

  const { error } = await supabase.from("policy_payments").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", paymentId);
  if (error) throw new Error("No se pudo cancelar el cobro.");
  revalidateCollections();
}

export async function deleteCollectionAction(paymentId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  await assertPaymentInWorkspace(paymentId, workspaceId);

  await supabase.from("policy_payments").delete().eq("id", paymentId);
  revalidateCollections();
}
