"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { findOrCreateContact } from "@/lib/contacts/match";
import { getOrCreateDefaultGroup } from "@/lib/tasks/groups/actions";
import { logActivity } from "@/lib/activity/log";
import {
  getClientsList,
  getClientProfile,
  getClientContracts,
  getClientAppointments,
  getClientPolicies,
  getClientTasks,
  type ClientListItem,
  type ClientProfile,
  type ClientContract,
  type ClientAppointment,
  type ClientPolicy,
  type ClientTask,
  type ClientStatus,
} from "@/lib/clients/queries";

const CLIENT_CONTACT_SOURCE = "cliente";

function revalidateClients(clientId?: string) {
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function getClientsListAction(): Promise<ClientListItem[]> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientsList(workspaceId);
}

export async function getClientProfileAction(clientId: string): Promise<ClientProfile | null> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  return getClientProfile(workspaceId, clientId);
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

export interface CreateClientInput {
  contactId?: string | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
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

/** Crea (o reutiliza) el contacto ancla vía findOrCreateContact — mismo
 * helper que ya usan Pólizas/Asesorías — y en el mismo paso arma el primer
 * contrato (status "activo"), para que un cliente nuevo nunca quede sin
 * contrato asociado. `clients.contact_id` es unique: si el contacto elegido
 * ya es cliente, el insert falla con un mensaje claro en vez de un error
 * crudo de Postgres. */
export async function createClientAction(input: CreateClientInput): Promise<{ id: string }> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const memberId = await getCurrentMemberId(workspaceId);
  const supabase = await createClient();

  let contactId = input.contactId ?? null;
  if (!contactId && (input.contactName || input.contactPhone || input.contactEmail)) {
    contactId = await findOrCreateContact(
      supabase,
      workspaceId,
      { name: input.contactName, phone: input.contactPhone, email: input.contactEmail },
      CLIENT_CONTACT_SOURCE,
    );
  }
  if (!contactId) throw new Error("Elegí un contacto existente o completá nombre/teléfono/email para crear uno nuevo.");

  const { data: existing } = await supabase.from("clients").select("id").eq("workspace_id", workspaceId).eq("contact_id", contactId).maybeSingle();
  if (existing) throw new Error("Este contacto ya es un cliente.");

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: workspaceId,
      contact_id: contactId,
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
  if (error || !created) throw new Error("No se pudo crear el cliente.");

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

  await logActivity(supabase, workspaceId, memberId, "client", clientId, "client_created", { contactId });

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
  },
): Promise<void> {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from("client_contracts")
    .update({
      start_date: input.startDate,
      end_date: input.endDate,
      total_value: input.totalValue,
      monthly_value: input.monthlyValue,
      amount_paid: input.amountPaid,
      commission_model: input.commissionModel?.trim() || null,
      status: input.status,
      document_id: input.documentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .select("client_id")
    .single();
  if (error) throw new Error("No se pudo actualizar el contrato.");
  revalidateClients(contract?.client_id as string | undefined);
}

export interface CreateClientTaskInput {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  assignedTo: string;
  ownerSide: "client" | "growth_link";
}

/** Tareas del cliente — mismo `tasks`/`task_groups` de siempre (el grupo por
 * defecto del workspace, getOrCreateDefaultGroup, mismo que usa el módulo
 * Tareas general), solo que con client_id + owner_side seteados para que
 * ClientTasksBoard.tsx pueda separar "esperamos del cliente" vs "debemos
 * nosotros" sin depender de un estado nuevo en tasks.status. */
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
