"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole, requirePlatformAdmin } from "@/lib/auth/roles";
import { getOrCreateDefaultGroup } from "@/lib/tasks/groups/actions";
import { logActivity } from "@/lib/activity/log";
import {
  getClientsList,
  getClientProfile,
  getClientContracts,
  getClientAppointments,
  getClientPolicies,
  getClientTasks,
  getClientAccess,
  getClientContractPayments,
  getClientNotes,
  getClientUpcomingPolicyPayments,
  getClientAudienceFunnel,
  getClientSetterPerformance,
  getRealAdvisorWorkspaces,
  type ClientPolicyPayment,
  type ClientListItem,
  type ClientProfile,
  type ClientContract,
  type ClientAppointment,
  type ClientPolicy,
  type ClientTask,
  type ClientStatus,
  type ClientAccess,
  type ClientContractPayment,
  type ClientNote,
  type ClientAudienceFunnel,
  type ClientSetterPerformance,
  type RealAdvisorWorkspace,
  type BookingFuente,
  type BookingResultado,
} from "@/lib/clients/queries";

function revalidateClients(clientId?: string) {
  revalidatePath("/asesores");
  if (clientId) revalidatePath(`/asesores/${clientId}`);
}

/** `getRealAdvisorWorkspaces`/`resolveAdvisorIdentity` (queries.ts) resuelven
 * nombre/email real vía el service-role client (auth.admin.getUserById),
 * que ignora RLS por diseño — a diferencia del resto de las acciones de este
 * archivo (ya protegidas de cruce entre tenants porque siempre filtran por
 * el workspace_id de QUIEN llama), acá `requireManagerRole` solo no alcanza:
 * cualquier admin/owner de CUALQUIER workspace pasaría ese check. El gate
 * real es ser platform admin (vos) — mismo criterio que ya usa
 * PlatformWorkspacesTable/enterSupervisorMode (src/lib/platform/actions.ts). */
export async function getClientsListAction(): Promise<ClientListItem[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await requirePlatformAdmin();
  return getClientsList(workspaceId);
}

export async function getClientProfileAction(clientId: string): Promise<ClientProfile | null> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await requirePlatformAdmin();
  return getClientProfile(workspaceId, clientId);
}

/** Para el buscador de "+ Asesor" — solo los workspaces reales que TODAVÍA
 * no tienen ficha administrativa (`clients.linked_workspace_id`), para que
 * nunca se pueda elegir dos veces al mismo asesor. */
export async function getAvailableAdvisorWorkspacesAction(): Promise<RealAdvisorWorkspace[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await requirePlatformAdmin();
  const advisors = await getRealAdvisorWorkspaces();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("clients").select("linked_workspace_id").eq("workspace_id", workspaceId).not("linked_workspace_id", "is", null);
  const linkedIds = new Set((existing ?? []).map((r) => r.linked_workspace_id as string));
  return advisors.filter((a) => !linkedIds.has(a.workspaceId));
}

export async function getClientContractsAction(clientId: string): Promise<ClientContract[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientContracts(workspaceId, clientId);
}

export async function getClientAppointmentsAction(clientId: string): Promise<ClientAppointment[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientAppointments(workspaceId, clientId);
}

export async function getClientPoliciesAction(clientId: string): Promise<ClientPolicy[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientPolicies(workspaceId, clientId);
}

export async function getClientTasksAction(clientId: string): Promise<ClientTask[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientTasks(workspaceId, clientId);
}

export async function getClientUpcomingPolicyPaymentsAction(clientId: string): Promise<ClientPolicyPayment[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientUpcomingPolicyPayments(workspaceId, clientId);
}

export interface CreateClientInput {
  linkedWorkspaceId: string;
  profession?: string;
  insurer?: string;
  country?: string;
  city?: string;
  serviceType?: string;
  contract: {
    startDate: string;
    endDate: string;
    totalValue?: number | null;
    monthlyValue?: number | null;
    commissionModel?: string | null;
  };
}

/** Da de alta la ficha administrativa de un asesor REAL (linkedWorkspaceId
 * ya es un workspace real, elegido de getAvailableAdvisorWorkspacesAction —
 * ver ensureAdvisorRecordsExist en queries.ts para el alta automática sin
 * pasar por acá). Ya no fabrica ningún contacto — contact_id queda null. En
 * el mismo paso arma el primer contrato (status "activo") para que la ficha
 * nunca quede sin contrato asociado. `linked_workspace_id` es unique: si ese
 * asesor ya tiene ficha, el insert falla con un mensaje claro. */
export async function createClientAction(input: CreateClientInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  await requirePlatformAdmin();
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  const { data: existing } = await supabase.from("clients").select("id").eq("workspace_id", workspaceId).eq("linked_workspace_id", input.linkedWorkspaceId).maybeSingle();
  if (existing) throw new Error("Este asesor ya tiene una ficha administrativa.");

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: workspaceId,
      linked_workspace_id: input.linkedWorkspaceId,
      profession: input.profession?.trim() || null,
      insurer: input.insurer?.trim() || null,
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      service_type: input.serviceType ?? "linkedin_leadgen",
      status: "activo",
      account_manager_id: memberId,
      created_by: memberId,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("No se pudo crear la ficha del asesor.");

  const clientId = created.id as string;
  const { error: contractError } = await supabase.from("client_contracts").insert({
    workspace_id: workspaceId,
    client_id: clientId,
    status: "activo",
    start_date: input.contract.startDate,
    end_date: input.contract.endDate,
    total_value: input.contract.totalValue ?? null,
    monthly_value: input.contract.monthlyValue ?? null,
    commission_model: input.contract.commissionModel?.trim() || null,
    created_by: memberId,
  });
  if (contractError) throw new Error("El cliente se creó pero no se pudo guardar el contrato inicial.");

  await logActivity(supabase, workspaceId, memberId, "client", clientId, "client_created", { linkedWorkspaceId: input.linkedWorkspaceId });

  revalidateClients();
  return { id: clientId };
}

export interface UpdateClientInput {
  profession?: string;
  insurer?: string;
  country?: string;
  city?: string;
  serviceType?: string;
  linkedinProfileUrl?: string;
  linkedinSalesNavigatorUrl?: string;
  calendlyUrl?: string;
  setterId?: string | null;
  accountManagerId?: string | null;
  trafficManagerId?: string | null;
}

export async function updateClientAction(clientId: string, input: UpdateClientInput): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      profession: input.profession?.trim() || null,
      insurer: input.insurer?.trim() || null,
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      service_type: input.serviceType,
      linkedin_profile_url: input.linkedinProfileUrl?.trim() || null,
      linkedin_sales_navigator_url: input.linkedinSalesNavigatorUrl?.trim() || null,
      calendly_url: input.calendlyUrl?.trim() || null,
      setter_id: input.setterId ?? null,
      account_manager_id: input.accountManagerId ?? null,
      traffic_manager_id: input.trafficManagerId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el cliente.");
  revalidateClients(clientId);
}

async function setClientStatus(clientId: string, status: ClientStatus): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el estado del cliente.");
  await logActivity(supabase, workspaceId, memberId, "client", clientId, "client_status_changed", { status });
  revalidateClients(clientId);
}

export async function pauseClientAction(clientId: string): Promise<void> {
  await setClientStatus(clientId, "pausado");
}

export async function reactivateClientAction(clientId: string): Promise<void> {
  await setClientStatus(clientId, "activo");
}

export async function archiveClientAction(clientId: string): Promise<void> {
  await setClientStatus(clientId, "archivado");
}

export interface RenewContractInput {
  startDate: string;
  endDate: string;
  totalValue?: number | null;
  monthlyValue?: number | null;
  commissionModel?: string | null;
}

/** Una renovación crea una fila NUEVA en client_contracts (nunca muta la
 * anterior) — preserva historial, ver comentario en la migración 0124. La
 * fila previa 'activo' pasa a 'renovado' en el mismo paso para que solo
 * exista un contrato 'activo' por cliente a la vez (MRR se calcula sumando
 * esas filas en vivo). */
export async function renewContractAction(clientId: string, input: RenewContractInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  await supabase
    .from("client_contracts")
    .update({ status: "renovado", updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("workspace_id", workspaceId)
    .eq("status", "activo");

  const { data: created, error } = await supabase
    .from("client_contracts")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      status: "activo",
      start_date: input.startDate,
      end_date: input.endDate,
      total_value: input.totalValue ?? null,
      monthly_value: input.monthlyValue ?? null,
      commission_model: input.commissionModel?.trim() || null,
      created_by: memberId,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("No se pudo renovar el contrato.");

  await logActivity(supabase, workspaceId, memberId, "client", clientId, "contract_renewed", { contractId: created.id, startDate: input.startDate, endDate: input.endDate });

  revalidateClients(clientId);
  return { id: created.id as string };
}

export async function updateContractAction(
  contractId: string,
  input: {
    startDate?: string;
    endDate?: string;
    totalValue?: number | null;
    monthlyValue?: number | null;
    amountPaid?: number | null;
    commissionModel?: string | null;
    status?: string;
    documentId?: string | null;
    /** "Términos y condiciones" del Contrato — reusa la columna existente
     * client_contracts.notes (nunca usada hasta ahora en la UI) en vez de
     * una tabla nueva. No confundir con "Notas internas", que usa la tabla
     * polimórfica public.notes vía getClientNotes/addClientNoteAction. */
    notes?: string | null;
  },
): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  // Patch parcial de verdad (solo lo que vino en `input`) — antes esto
  // pisaba commission_model a null en cualquier llamada que no lo
  // incluyera (ej. handleUpload sólo manda `{ documentId }` al adjuntar el
  // PDF del contrato, y de paso borraba el modelo de comisión ya cargado).
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.totalValue !== undefined) patch.total_value = input.totalValue;
  if (input.monthlyValue !== undefined) patch.monthly_value = input.monthlyValue;
  if (input.amountPaid !== undefined) patch.amount_paid = input.amountPaid;
  if (input.commissionModel !== undefined) patch.commission_model = input.commissionModel?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.documentId !== undefined) patch.document_id = input.documentId;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const { data: contract, error } = await supabase
    .from("client_contracts")
    .update(patch)
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .select("client_id")
    .single();
  if (error) throw new Error("No se pudo actualizar el contrato.");
  const clientId = contract?.client_id as string | undefined;
  if (clientId) await logActivity(supabase, workspaceId, memberId, "client", clientId, "contract_updated", {});
  revalidateClients(clientId);
}

export interface CreateClientTaskInput {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  assignedTo: string;
  ownerSide: "client" | "growth_link";
  relatedArea?: string | null;
}

/** Tareas del cliente — mismo `tasks`/`task_groups` de siempre (el grupo por
 * defecto del workspace, getOrCreateDefaultGroup, mismo que usa el módulo
 * Tareas general), solo que con client_id + owner_side seteados ("qué
 * esperamos del cliente" vs "qué le debemos nosotros") y related_area
 * (0128) para la clasificación libre que usa TareasTable.tsx. */
export async function createClientTaskAction(clientId: string, input: CreateClientTaskInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  if (!memberId) throw new Error("No se pudo resolver tu usuario en este workspace.");
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const groupId = await getOrCreateDefaultGroup(workspaceId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      group_id: groupId,
      created_by: memberId,
      assigned_to: input.assignedTo || memberId,
      title,
      description: input.description?.trim() || null,
      priority: input.priority,
      status: "pending",
      due_at: input.dueAt,
      client_id: clientId,
      owner_side: input.ownerSide,
      related_area: input.relatedArea?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la tarea.");

  revalidateClients(clientId);
  revalidatePath("/tasks");
  return { id: data.id as string };
}

export async function updateClientTaskStatusAction(taskId: string, clientId: string, status: "pending" | "in_progress" | "completed"): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar la tarea.");
  revalidateClients(clientId);
  revalidatePath("/tasks");
}

export async function deleteClientTaskAction(taskId: string, clientId: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar la tarea.");
  revalidateClients(clientId);
  revalidatePath("/tasks");
}

// ---------------------------------------------------------------------------
// Accesos — metadata de plataformas/cuentas del cliente (sin credenciales,
// ver comentario en la migración 0126). "Por vencer"/"Vencido" se calculan
// en vivo en la UI a partir de expiresAt, nunca guardados acá.
// ---------------------------------------------------------------------------

export async function getClientAccessListAction(clientId: string): Promise<ClientAccess[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientAccess(workspaceId, clientId);
}

export interface ClientAccessInput {
  platform: string;
  accountLabel: string;
  permission?: string;
  expiresAt?: string | null;
  notes?: string;
}

export async function createClientAccessAction(clientId: string, input: ClientAccessInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  if (!input.platform.trim()) throw new Error("La plataforma es obligatoria.");
  if (!input.accountLabel.trim()) throw new Error("El usuario/cuenta es obligatorio.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_access")
    .insert({
      workspace_id: workspaceId,
      client_id: clientId,
      platform: input.platform.trim(),
      account_label: input.accountLabel.trim(),
      permission: input.permission?.trim() || null,
      expires_at: input.expiresAt || null,
      notes: input.notes?.trim() || null,
      created_by: memberId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo agregar el acceso.");
  revalidateClients(clientId);
  return { id: data.id as string };
}

export async function updateClientAccessAction(accessId: string, clientId: string, input: Partial<ClientAccessInput> & { status?: "active" | "inactive" }): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.platform !== undefined) patch.platform = input.platform.trim();
  if (input.accountLabel !== undefined) patch.account_label = input.accountLabel.trim();
  if (input.permission !== undefined) patch.permission = input.permission?.trim() || null;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  const { error } = await supabase.from("client_access").update(patch).eq("id", accessId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el acceso.");
  revalidateClients(clientId);
}

export async function deleteClientAccessAction(accessId: string, clientId: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("client_access").delete().eq("id", accessId).eq("workspace_id", workspaceId);
  revalidateClients(clientId);
}

// ---------------------------------------------------------------------------
// Pagos de contrato — mismo patrón que policy_payments/PolicyDetailSheet
// "Pagos" (src/lib/policies/actions.ts): generar cronograma / alta manual /
// togglear pagado / borrar, más adjuntar comprobante (documents).
// ---------------------------------------------------------------------------

export async function getClientContractPaymentsAction(contractId: string): Promise<ClientContractPayment[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientContractPayments(workspaceId, contractId);
}

/** Reparte total_value en cuotas mensuales iguales entre start_date y
 * end_date — client_contracts no tiene un campo de frecuencia de pago como
 * policies (siempre mensual, ver ContractPanel.tsx), mismo criterio de
 * cálculo que buildPaymentScheduleRows (policies/queries.ts) pero sin la
 * variable de frecuencia. No agrega si ya hay cuotas cargadas. */
export async function generateClientContractPaymentScheduleAction(contractId: string): Promise<ClientContractPayment[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("client_contracts")
    .select("id, client_id, start_date, end_date, total_value, monthly_value, currency")
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contract) throw new Error("Contrato no encontrado.");
  if (!contract.start_date || !contract.end_date) throw new Error("El contrato necesita fecha de inicio y fin para generar el cronograma.");

  const { data: existing } = await supabase.from("client_contract_payments").select("id").eq("contract_id", contractId).limit(1);
  if (existing && existing.length > 0) throw new Error("Este contrato ya tiene cuotas cargadas.");

  const dueDates: string[] = [];
  const cursor = new Date(contract.start_date as string);
  const end = new Date(contract.end_date as string);
  while (cursor <= end) {
    dueDates.push(cursor.toISOString().slice(0, 10));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (dueDates.length === 0) dueDates.push(contract.start_date as string);

  const totalValue = contract.total_value as number | null;
  const monthlyValue = contract.monthly_value as number | null;
  const amountPerInstallment = monthlyValue ?? (totalValue !== null ? Math.round((totalValue / dueDates.length) * 100) / 100 : 0);
  const currency = (contract.currency as string) ?? "USD";

  const { error } = await supabase
    .from("client_contract_payments")
    .insert(dueDates.map((dueDate) => ({ workspace_id: workspaceId, contract_id: contractId, due_date: dueDate, amount: amountPerInstallment, currency })));
  if (error) throw new Error("No se pudo generar el cronograma.");

  revalidateClients(contract.client_id as string | undefined);
  return getClientContractPayments(workspaceId, contractId);
}

export async function addClientContractPaymentAction(contractId: string, clientId: string, input: { dueDate: string; amount: number; currency: string }): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_contract_payments")
    .insert({ workspace_id: workspaceId, contract_id: contractId, due_date: input.dueDate, amount: input.amount, currency: input.currency });
  if (error) throw new Error("No se pudo agregar el pago.");
  revalidateClients(clientId);
}

export async function updateClientContractPaymentStatusAction(paymentId: string, clientId: string, status: "pendiente" | "pagado"): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_contract_payments")
    .update({ status, paid_at: status === "pagado" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el pago.");
  revalidateClients(clientId);
}

export async function attachClientContractPaymentDocumentAction(paymentId: string, clientId: string, documentId: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_contract_payments")
    .update({ document_id: documentId, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo adjuntar el comprobante.");
  revalidateClients(clientId);
}

export async function deleteClientContractPaymentAction(paymentId: string, clientId: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("client_contract_payments").delete().eq("id", paymentId).eq("workspace_id", workspaceId);
  revalidateClients(clientId);
}

// ---------------------------------------------------------------------------
// Notas internas — public.notes, notable_type='client' (sobreviven a
// renovaciones de contrato). Primer caller en todo el repo que usa
// notes_update (migración 0126) — hasta ahora ningún módulo ofrecía editar
// una nota, solo agregar/borrar.
// ---------------------------------------------------------------------------

export async function getClientNotesAction(clientId: string): Promise<ClientNote[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientNotes(workspaceId, clientId);
}

export async function addClientNoteAction(clientId: string, body: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!body.trim()) return;
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ workspace_id: workspaceId, notable_type: "client", notable_id: clientId, author_id: memberId, body: body.trim() });
  if (error) throw new Error("No se pudo agregar la nota.");
  revalidateClients(clientId);
}

export async function updateClientNoteAction(noteId: string, clientId: string, body: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  if (!body.trim()) throw new Error("La nota no puede quedar vacía.");
  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ body: body.trim() }).eq("id", noteId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo editar la nota.");
  revalidateClients(clientId);
}

export async function deleteClientNoteAction(noteId: string, clientId: string): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId).eq("workspace_id", workspaceId);
  revalidateClients(clientId);
}

// ---------------------------------------------------------------------------
// Agenda / Operación / KPIs — fuente/campaña/resultado (0127) se cargan a
// mano cita por cita desde la tabla de Agenda; funnel y rendimiento por
// setter son agregados en vivo sobre bookings/contacts/policies reales.
// ---------------------------------------------------------------------------

export async function getClientAudienceFunnelAction(clientId: string): Promise<ClientAudienceFunnel> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientAudienceFunnel(workspaceId, clientId);
}

export async function getClientSetterPerformanceAction(clientId: string): Promise<ClientSetterPerformance[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientSetterPerformance(workspaceId, clientId);
}

export interface BookingAttributionInput {
  fuente?: BookingFuente | null;
  campana?: string | null;
  resultado?: BookingResultado | null;
}

export async function updateBookingAttributionAction(bookingId: string, clientId: string, input: BookingAttributionInput): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.fuente !== undefined) patch.fuente = input.fuente;
  if (input.campana !== undefined) patch.campana = input.campana?.trim() || null;
  if (input.resultado !== undefined) patch.resultado = input.resultado;
  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId).eq("workspace_id", workspaceId).eq("client_id", clientId);
  if (error) throw new Error("No se pudo guardar.");
  revalidateClients(clientId);
}
