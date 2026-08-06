"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity/log";
import { resolveOpenRouterApiKey } from "@/lib/integrations/openrouter";
import { findOrCreateContact } from "@/lib/contacts/match";
import {
  getPolicyList,
  getPolicyById,
  getPolicyStageOptions,
  getPolicyCoverages,
  getPolicyDashboardKpis,
  getPoliciesForContact,
  getPolicyActivity,
  getPolicyPayments,
  getPolicyCommissionAnalytics,
  getPolicyEndorsements,
  ensurePolicyPipeline,
  ensurePolicyPaymentSchedule,
  buildPaymentScheduleRows,
  POLICY_STAGES,
  type PolicyStatus,
  type InsuranceType,
  type PolicyBeneficiary,
  type PolicyPaymentStatus,
  type PolicyPayment,
} from "@/lib/policies/queries";
import { extractTextFromPdf, extractPolicyDataWithAI, type ExtractedPolicyData } from "@/lib/policies/pdfExtraction";
import { ensurePolicyAutomationRules, updatePolicyAutomationRule, type PolicyAutomationRulePatch } from "@/lib/policies/automationRules";
import { isSupportedFileName, isXlsxFileName, listWorkbookSheets, parseExcelSheet, parseCsvFile, type SheetInfo } from "@/lib/advisors/import/parseFile";
import { detectPolicyColumnMapping, importPolicyRows, type PolicyImportResult } from "@/lib/policies/import";
import { analyzePolicyWithAI, generateRenewalMessageWithAI, type PolicyAnalysis } from "@/lib/policies/aiAnalysis";

function revalidatePolicies() {
  revalidatePath("/polizas");
}

export async function getPolicyAutomationRulesAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return ensurePolicyAutomationRules(workspaceId);
}

export async function updatePolicyAutomationRuleAction(ruleId: string, patch: PolicyAutomationRulePatch): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  await updatePolicyAutomationRule(workspaceId, ruleId, patch);
  revalidatePolicies();
}

export async function getPolicyListAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyList(workspaceId);
}

export async function getPolicyByIdAction(policyId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyById(workspaceId, policyId);
}

export async function getPolicyStageOptionsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyStageOptions(workspaceId);
}

export async function getPolicyCoveragesAction(policyId: string) {
  return getPolicyCoverages(policyId);
}

export async function getPolicyDashboardKpisAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyDashboardKpis(workspaceId);
}

export async function getPoliciesForContactAction(contactId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPoliciesForContact(workspaceId, contactId);
}

export interface PolicyBoard {
  stages: { id: string; name: string; position: number }[];
  cardsByStage: Record<string, Awaited<ReturnType<typeof getPolicyList>>>;
  kpis: Awaited<ReturnType<typeof getPolicyDashboardKpis>>;
}

/** Un solo round-trip para la página del tablero — mismo criterio que
 * getAdvisorsBoard (stages + cards agrupadas + KPIs juntos). */
export async function getPolicyBoardAction(): Promise<PolicyBoard> {
  const { workspaceId } = await requireActiveWorkspace();
  const [stages, list, kpis] = await Promise.all([
    getPolicyStageOptions(workspaceId),
    getPolicyList(workspaceId),
    getPolicyDashboardKpis(workspaceId),
  ]);

  const cardsByStage: PolicyBoard["cardsByStage"] = {};
  for (const stage of stages) cardsByStage[stage.id] = [];
  for (const card of list) {
    if (!cardsByStage[card.stageId]) cardsByStage[card.stageId] = [];
    cardsByStage[card.stageId].push(card);
  }

  return { stages, cardsByStage, kpis };
}

export interface PolicyFormInput {
  contactId?: string | null;
  // Si no hay contactId, se busca/crea por estos datos (mismo criterio que
  // el resto de la app: dedupe por teléfono).
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  policyNumber: string;
  company: string;
  product: string;
  insuranceType: InsuranceType;
  issueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  premium: number | null;
  premiumCurrency: string;
  paymentFrequency: string | null;
  commissionAmount: number | null;
  commissionStatus: string | null;
  sumInsured: number | null;
  deductible: string | null;
  beneficiaries: PolicyBeneficiary[];
  typeDetails: Record<string, unknown>;
  notes: string;
  ownerId: string | null;
}


/** Crea una póliza — manual (formulario completo) o como paso final del
 * flujo de confirmación de extracción por IA (mismo action, la pantalla de
 * revisión llega acá con los datos ya editados por el usuario). Crea
 * cliente/contacto si hace falta, la tarjeta en el pipeline de Pólizas, y
 * registra la actividad — "todo automáticamente" pedido explícitamente. */
export async function createPolicyAction(input: PolicyFormInput): Promise<{ id: string; contactId: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!input.company.trim()) throw new Error("La compañía es obligatoria.");
  const supabase = await createClient();

  const contactId = input.contactId ?? (await findOrCreateContact(supabase, workspaceId, { name: input.contactName, phone: input.contactPhone, email: input.contactEmail }, "policy"));

  const pipelineId = await ensurePolicyPipeline(workspaceId);
  const { data: firstStage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("position", { ascending: true }).limit(1).maybeSingle();

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      owner_id: input.ownerId ?? memberId,
      created_by: memberId,
      policy_number: input.policyNumber.trim() || null,
      company: input.company.trim(),
      product: input.product.trim() || null,
      insurance_type: input.insuranceType,
      status: "cotizacion",
      issue_date: input.issueDate,
      start_date: input.startDate,
      end_date: input.endDate,
      premium: input.premium,
      premium_currency: input.premiumCurrency || "USD",
      payment_frequency: input.paymentFrequency,
      commission_amount: input.commissionAmount,
      commission_status: input.commissionStatus,
      sum_insured: input.sumInsured,
      deductible: input.deductible,
      beneficiaries: input.beneficiaries,
      type_details: input.typeDetails,
      notes: input.notes.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (policyError || !policy) throw new Error(policyError?.message ?? "No se pudo crear la póliza.");

  if (firstStage) {
    const { data: item } = await supabase
      .from("pipeline_items")
      .insert({ pipeline_id: pipelineId, stage_id: firstStage.id, item_type: "policy", item_id: policy.id, position: 0 })
      .select("id")
      .single();
    if (item) await supabase.from("policies").update({ pipeline_item_id: item.id }).eq("id", policy.id);
  }

  await logActivity(supabase, workspaceId, memberId, "policy", policy.id as string, "policy_created", { source: "manual", company: input.company });
  await ensurePolicyPaymentSchedule(workspaceId, policy.id as string);

  revalidatePolicies();
  void role; // reservado para un futuro gate de permisos más fino
  return { id: policy.id as string, contactId };
}

export async function updatePolicyAction(policyId: string, input: Partial<PolicyFormInput>): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.policyNumber !== undefined) patch.policy_number = input.policyNumber.trim() || null;
  if (input.company !== undefined) patch.company = input.company.trim();
  if (input.product !== undefined) patch.product = input.product.trim() || null;
  if (input.insuranceType !== undefined) patch.insurance_type = input.insuranceType;
  if (input.issueDate !== undefined) patch.issue_date = input.issueDate;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.premium !== undefined) patch.premium = input.premium;
  if (input.premiumCurrency !== undefined) patch.premium_currency = input.premiumCurrency;
  if (input.paymentFrequency !== undefined) patch.payment_frequency = input.paymentFrequency;
  if (input.commissionAmount !== undefined) patch.commission_amount = input.commissionAmount;
  if (input.commissionStatus !== undefined) patch.commission_status = input.commissionStatus;
  if (input.sumInsured !== undefined) patch.sum_insured = input.sumInsured;
  if (input.deductible !== undefined) patch.deductible = input.deductible;
  if (input.beneficiaries !== undefined) patch.beneficiaries = input.beneficiaries;
  if (input.typeDetails !== undefined) patch.type_details = input.typeDetails;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.ownerId !== undefined) patch.owner_id = input.ownerId;

  const { error } = await supabase.from("policies").update(patch).eq("id", policyId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar la póliza.");
  revalidatePolicies();
}

/** Mueve la tarjeta de etapa y sincroniza policies.status — mismo criterio
 * que moveOpportunityCard (src/lib/crm/actions.ts): el espejo en la tabla
 * propia existe para no tener que joinear pipeline_stages en cada query. */
export async function movePolicyStageAction(pipelineItemId: string, stageId: string, position = 0): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: policy } = await supabase.from("policies").select("id, status").eq("pipeline_item_id", pipelineItemId).eq("workspace_id", workspaceId).maybeSingle();
  if (!policy) throw new Error("Póliza no encontrada en este workspace.");

  const { data: stage } = await supabase.from("pipeline_stages").select("name, position").eq("id", stageId).maybeSingle();
  if (!stage) throw new Error("Etapa no encontrada.");

  const stageKey = POLICY_STAGES.find((s) => s.name === stage.name)?.key as PolicyStatus | undefined;

  await supabase.from("pipeline_items").update({ stage_id: stageId, position }).eq("id", pipelineItemId);
  await supabase.from("policies").update({ status: stageKey ?? policy.status, updated_at: new Date().toISOString() }).eq("id", policy.id as string);

  await logActivity(supabase, workspaceId, memberId, "policy", policy.id as string, "policy_stage_changed", { stage: stage.name });
  revalidatePolicies();
}

export async function deletePolicyAction(policyId: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: policy } = await supabase.from("policies").select("pipeline_item_id").eq("id", policyId).eq("workspace_id", workspaceId).maybeSingle();
  await supabase.from("policies").delete().eq("id", policyId).eq("workspace_id", workspaceId);
  if (policy?.pipeline_item_id) await supabase.from("pipeline_items").delete().eq("id", policy.pipeline_item_id as string);
  revalidatePolicies();
}

const DUPLICATE_SELECT =
  "contact_id, company, product, insurance_type, owner_id, issue_date, start_date, end_date, premium, premium_currency, payment_frequency, commission_amount, commission_status, sum_insured, deductible, beneficiaries, type_details, notes";

/** Fila nueva a partir de una existente — mismo cliente/aseguradora/
 * coberturas, pero número de póliza en blanco y arranca en "Cotización"
 * (nunca duplica un número de póliza real, ya que en la práctica el
 * duplicado es el punto de partida de una cotización nueva, no una copia
 * 1:1 de la póliza vigente). Sin formulario intermedio — se crea de una y
 * se abre su detalle para que el asesor ajuste lo que corresponda. */
export async function duplicatePolicyAction(policyId: string): Promise<{ id: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: sourcePolicy } = await supabase.from("policies").select(DUPLICATE_SELECT).eq("id", policyId).eq("workspace_id", workspaceId).maybeSingle();
  if (!sourcePolicy) throw new Error("Póliza no encontrada.");

  const pipelineId = await ensurePolicyPipeline(workspaceId);
  const { data: firstStage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("position", { ascending: true }).limit(1).maybeSingle();

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({ ...sourcePolicy, workspace_id: workspaceId, created_by: memberId, policy_number: null, status: "cotizacion", source: "manual" })
    .select("id")
    .single();
  if (policyError || !policy) throw new Error(policyError?.message ?? "No se pudo duplicar la póliza.");

  if (firstStage) {
    const { data: item } = await supabase
      .from("pipeline_items")
      .insert({ pipeline_id: pipelineId, stage_id: firstStage.id, item_type: "policy", item_id: policy.id, position: 0 })
      .select("id")
      .single();
    if (item) await supabase.from("policies").update({ pipeline_item_id: item.id }).eq("id", policy.id);
  }

  await logActivity(supabase, workspaceId, memberId, "policy", policy.id as string, "policy_created", { source: "duplicate", company: sourcePolicy.company });

  revalidatePolicies();
  return { id: policy.id as string };
}

export async function addPolicyCoverageAction(
  policyId: string,
  input: { name: string; sumInsured: number | null; deductible: string | null; limitText: string | null; exclusions: string | null },
): Promise<void> {
  if (!input.name.trim()) throw new Error("El nombre de la cobertura es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase.from("policy_coverages").insert({
    policy_id: policyId,
    name: input.name.trim(),
    sum_insured: input.sumInsured,
    deductible: input.deductible,
    limit_text: input.limitText,
    exclusions: input.exclusions,
  });
  if (error) throw new Error("No se pudo agregar la cobertura.");
  revalidatePolicies();
}

export async function deletePolicyCoverageAction(coverageId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("policy_coverages").delete().eq("id", coverageId);
  revalidatePolicies();
}

export async function addPolicyNoteAction(policyId: string, body: string): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  if (!body.trim()) return;
  const supabase = await createClient();
  await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "policy", notable_id: policyId, body: body.trim() });
  revalidatePolicies();
}

export async function getPolicyActivityAction(policyId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyActivity(workspaceId, policyId);
}

export async function getPolicyNotesAction(policyId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, body, created_at")
    .eq("workspace_id", workspaceId)
    .eq("notable_type", "policy")
    .eq("notable_id", policyId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({ id: n.id as string, body: n.body as string, createdAt: n.created_at as string }));
}

/** Paso 1 del flujo estrella: el PDF ya se subió a Storage (mismo endpoint
 * /api/documents/upload que usa el resto de la app) — esto lee su texto y
 * llama a la IA para estructurarlo. Todavía no crea nada (cliente/póliza);
 * la pantalla de revisión llama a confirmPolicyFromExtractionAction una vez
 * que el usuario confirma/edita los datos.
 *
 * Devuelve el error como dato ({ error }) en vez de lanzar una excepción —
 * ver la nota en resolveOpenRouterApiKey (openrouter.ts): un throw acá no
 * llegaba de forma confiable al catch del cliente en producción, y todo
 * agente sin OpenRouter conectado en SU propio workspace (el caso normal
 * para cualquier cuenta nueva) terminaba viendo un crash genérico en vez
 * del mensaje real. */
export async function extractPolicyFromPdfAction(storagePath: string): Promise<ExtractedPolicyData | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();

  const credentials = await resolveOpenRouterApiKey(service, workspaceId, "leer pólizas con IA");
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;

  const { data: file, error: downloadError } = await service.storage.from("documents").download(storagePath);
  if (downloadError || !file) return { error: "No se pudo leer el PDF recién subido." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromPdf(buffer);
  if (!text.trim()) {
    return { error: "Este PDF no tiene texto legible (probablemente es una imagen escaneada) — cargá la póliza manualmente por ahora." };
  }

  return extractPolicyDataWithAI(apiKey, text);
}

/** Paso 2: el usuario ya revisó/editó los datos extraídos — crea cliente
 * (si no existe)/contacto/póliza/adjunta el PDF/deja el timeline inicial,
 * todo en un solo paso, como se pidió explícitamente. */
export async function confirmPolicyFromExtractionAction(
  extracted: ExtractedPolicyData,
  documentId: string,
): Promise<{ id: string; contactId: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const contactId = await findOrCreateContact(
    supabase,
    workspaceId,
    { name: extracted.clientName ?? undefined, phone: extracted.phone ?? undefined, email: extracted.email ?? undefined },
    "policy",
  );

  // custom_fields no tiene DNI/CUIT/dirección como columnas dedicadas — se
  // guardan ahí, mismo "columnas fijas + jsonb overflow" que el resto de la
  // app ya usa para datos variables del contacto.
  if (extracted.dni || extracted.cuit || extracted.address) {
    const { data: existingContact } = await supabase.from("contacts").select("custom_fields").eq("id", contactId).maybeSingle();
    const currentFields = (existingContact?.custom_fields as Record<string, unknown> | null) ?? {};
    await supabase
      .from("contacts")
      .update({
        custom_fields: {
          ...currentFields,
          ...(extracted.dni ? { dni: extracted.dni } : {}),
          ...(extracted.cuit ? { cuit: extracted.cuit } : {}),
          ...(extracted.address ? { address: extracted.address } : {}),
        },
      })
      .eq("id", contactId);
  }

  const typeDetails: Record<string, unknown> = extracted.insuranceType === "auto" ? (extracted.auto ?? {}) : extracted.insuranceType === "hogar" ? (extracted.hogar ?? {}) : {};

  const pipelineId = await ensurePolicyPipeline(workspaceId);
  const { data: firstStage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("position", { ascending: true }).limit(1).maybeSingle();

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
      owner_id: memberId,
      created_by: memberId,
      policy_number: extracted.policyNumber,
      company: extracted.company ?? "Sin especificar",
      product: extracted.product,
      insurance_type: extracted.insuranceType,
      status: "documentacion",
      issue_date: extracted.issueDate,
      start_date: extracted.startDate,
      end_date: extracted.endDate,
      premium: extracted.premium,
      premium_currency: extracted.premiumCurrency ?? "USD",
      payment_frequency: extracted.paymentFrequency,
      commission_amount: extracted.commissionAmount,
      sum_insured: extracted.sumInsured,
      deductible: extracted.deductible,
      beneficiaries: extracted.beneficiaries,
      type_details: typeDetails,
      source: "pdf_ai",
      pdf_document_id: documentId,
    })
    .select("id")
    .single();
  if (policyError || !policy) throw new Error(policyError?.message ?? "No se pudo crear la póliza.");
  const policyId = policy.id as string;

  if (firstStage) {
    const { data: item } = await supabase
      .from("pipeline_items")
      .insert({ pipeline_id: pipelineId, stage_id: firstStage.id, item_type: "policy", item_id: policyId, position: 0 })
      .select("id")
      .single();
    if (item) await supabase.from("policies").update({ pipeline_item_id: item.id }).eq("id", policyId);
  }

  for (const coverage of extracted.coverages) {
    await supabase.from("policy_coverages").insert({
      policy_id: policyId,
      name: coverage.name,
      sum_insured: coverage.sumInsured,
      deductible: coverage.deductible,
    });
  }

  await supabase.from("documents").update({ related_type: "policy", related_id: policyId }).eq("id", documentId);

  await logActivity(supabase, workspaceId, memberId, "policy", policyId, "policy_created_from_pdf", { company: extracted.company });

  revalidatePolicies();
  return { id: policyId, contactId };
}

// ---------------------------------------------------------------------------
// Importar Excel/CSV — versión reducida del wizard de 8 pasos de Asesores
// (src/app/(protected)/advisors/import): reusa sus mismos parsers/matching
// difuso puros, pero corre síncrono en 3 pasos (subir → mapear → confirmar),
// sin job persistente ni progreso en tiempo real — razonable para una carga
// puntual desde Pólizas, no para "migrar toda la cartera histórica" (ese
// caso, si hace falta, es su propio job igual que el de Asesores). Límite de
// 1000 filas por Server Action call para quedar cómodo dentro del tiempo de
// ejecución de una función de Vercel sin necesitar un job en background.
// ---------------------------------------------------------------------------

const MAX_IMPORT_ROWS = 1000;

export interface PolicyImportPreview {
  needsSheetSelection: boolean;
  sheets: SheetInfo[];
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
}

async function buildPreview(headers: string[], rows: Record<string, string>[], totalRows: number): Promise<PolicyImportPreview> {
  const suggestions = detectPolicyColumnMapping(headers);
  return {
    needsSheetSelection: false,
    sheets: [],
    headers,
    rows,
    totalRows,
    suggestedMapping: Object.fromEntries(suggestions.map((s) => [s.header, s.fieldKey])),
  };
}

export async function parsePolicyImportFileAction(formData: FormData): Promise<PolicyImportPreview> {
  await requireActiveWorkspace();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No se recibió ningún archivo.");
  if (!isSupportedFileName(file.name)) throw new Error("Formato no soportado — usá .xlsx o .csv.");

  const buffer = await file.arrayBuffer();

  if (isXlsxFileName(file.name)) {
    const sheets = await listWorkbookSheets(buffer);
    if (sheets.length > 1) {
      return { needsSheetSelection: true, sheets, headers: [], rows: [], totalRows: 0, suggestedMapping: {} };
    }
    const table = await parseExcelSheet(buffer, sheets[0]?.name ?? "", MAX_IMPORT_ROWS);
    return buildPreview(table.headers, table.rows, table.totalRows);
  }

  const text = await file.text();
  const table = parseCsvFile(text, MAX_IMPORT_ROWS);
  return buildPreview(table.headers, table.rows, table.totalRows);
}

export async function parsePolicyImportSheetAction(formData: FormData, sheetName: string): Promise<PolicyImportPreview> {
  await requireActiveWorkspace();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No se recibió ningún archivo.");
  const buffer = await file.arrayBuffer();
  const table = await parseExcelSheet(buffer, sheetName, MAX_IMPORT_ROWS);
  return buildPreview(table.headers, table.rows, table.totalRows);
}

export async function confirmPolicyImportAction(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
): Promise<PolicyImportResult> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  const result = await importPolicyRows(workspaceId, memberId, rows, mapping, memberId);
  revalidatePolicies();
  return result;
}

// ---------------------------------------------------------------------------
// IA avanzada — Analizar póliza + generar mensajes de renovación. Bajo
// demanda (el usuario aprieta un botón), nunca automático — un llamado a
// OpenRouter tiene costo real por token. Sin puntajes/probabilidades
// numéricas fabricadas, ver la nota en aiAnalysis.ts.
// ---------------------------------------------------------------------------

export async function analyzePolicyAction(policyId: string): Promise<PolicyAnalysis | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(service, workspaceId, "analizar pólizas con IA");
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;

  const policy = await getPolicyById(workspaceId, policyId);
  if (!policy) return { error: "Póliza no encontrada." };
  const [coverages, otherPolicies] = await Promise.all([
    getPolicyCoverages(policyId),
    getPoliciesForContact(workspaceId, policy.contactId),
  ]);

  return analyzePolicyWithAI(apiKey, policy, coverages, otherPolicies.filter((p) => p.id !== policyId));
}

export async function generateRenewalMessageAction(policyId: string, channel: "email" | "whatsapp"): Promise<string | { error: string }> {
  const { workspaceId } = await requireActiveWorkspace();
  const service = createServiceRoleClient();
  const credentials = await resolveOpenRouterApiKey(service, workspaceId, "generar mensajes con IA");
  if (!credentials.ok) return { error: credentials.error };
  const apiKey = credentials.apiKey;

  const policy = await getPolicyById(workspaceId, policyId);
  if (!policy) return { error: "Póliza no encontrada." };

  return generateRenewalMessageWithAI(apiKey, policy, channel);
}

// ---------------------------------------------------------------------------
// Pagos/cuotas — tracking simple de cobranza por póliza (policy_payments,
// 0097). "Generar cronograma" es un helper de conveniencia, no la única
// forma de cargar cuotas: el usuario también puede agregar/editar una a
// mano (pago parcial, cargo extra, etc.).
// ---------------------------------------------------------------------------

export async function getPolicyPaymentsAction(policyId: string) {
  return getPolicyPayments(policyId);
}

/** Reparte la prima en cuotas iguales entre inicio y vencimiento según la
 * frecuencia de pago de la póliza — no agrega si ya hay cuotas cargadas
 * (evita duplicar un cronograma generado dos veces por error). Desde que
 * createPolicyAction genera el cronograma automáticamente al crear la
 * póliza, este botón manual solo hace falta para el caso raro de una
 * póliza vieja sin cronograma (o una a la que se le borraron todas las
 * cuotas) — la lógica de fechas/montos vive en buildPaymentScheduleRows
 * (queries.ts), compartida con ensurePolicyPaymentSchedule. */
export async function generatePolicyPaymentScheduleAction(policyId: string): Promise<PolicyPayment[]> {
  const { workspaceId } = await requireActiveWorkspace();
  const supabase = await createClient();

  const policy = await getPolicyById(workspaceId, policyId);
  if (!policy) throw new Error("Póliza no encontrada.");
  if (!policy.startDate || !policy.endDate) throw new Error("La póliza necesita fecha de inicio y vencimiento para generar el cronograma.");

  const { data: existing } = await supabase.from("policy_payments").select("id").eq("policy_id", policyId).limit(1);
  if (existing && existing.length > 0) throw new Error("Esta póliza ya tiene cuotas cargadas.");

  const rows = buildPaymentScheduleRows(policy);
  const { error } = await supabase.from("policy_payments").insert(rows.map((r) => ({ ...r, policy_id: policyId })));
  if (error) throw new Error("No se pudo generar el cronograma.");

  return getPolicyPayments(policyId);
}

export async function addPolicyPaymentAction(policyId: string, input: { dueDate: string; amount: number; currency: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("policy_payments").insert({
    policy_id: policyId,
    due_date: input.dueDate,
    amount: input.amount,
    currency: input.currency,
  });
  if (error) throw new Error("No se pudo agregar la cuota.");
  revalidatePolicies();
}

export async function updatePolicyPaymentStatusAction(paymentId: string, status: PolicyPaymentStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("policy_payments")
    .update({ status, paid_at: status === "pagado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) throw new Error("No se pudo actualizar la cuota.");
  revalidatePolicies();
}

export async function deletePolicyPaymentAction(paymentId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("policy_payments").delete().eq("id", paymentId);
  revalidatePolicies();
}

export async function getPolicyCommissionAnalyticsAction() {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyCommissionAnalytics(workspaceId);
}

// ---------------------------------------------------------------------------
// Endosos — historial formal de cambios contractuales (policy_endorsements,
// 0098), distinto del Timeline genérico de auditoría.
// ---------------------------------------------------------------------------

export async function getPolicyEndorsementsAction(policyId: string) {
  const { workspaceId } = await requireActiveWorkspace();
  return getPolicyEndorsements(workspaceId, policyId);
}

export async function addPolicyEndorsementAction(policyId: string, input: { endorsementDate: string; type: string; description: string }): Promise<void> {
  const { workspaceId } = await requireActiveWorkspace();
  const memberId = await getCurrentMemberId(workspaceId);
  if (!input.description.trim()) throw new Error("La descripción es obligatoria.");
  const supabase = await createClient();
  const { error } = await supabase.from("policy_endorsements").insert({
    policy_id: policyId,
    endorsement_date: input.endorsementDate,
    type: input.type,
    description: input.description.trim(),
    created_by: memberId,
  });
  if (error) throw new Error("No se pudo agregar el endoso.");
  await logActivity(supabase, workspaceId, memberId, "policy", policyId, "policy_endorsement_added", { type: input.type });
  revalidatePolicies();
}

export async function deletePolicyEndorsementAction(endorsementId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("policy_endorsements").delete().eq("id", endorsementId);
  revalidatePolicies();
}
