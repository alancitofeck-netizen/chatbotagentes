import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getPolicyList } from "@/lib/policies/queries";
import {
  importContactRows,
  importTaskRows,
  importEventRows,
  logImportJob,
  type ImportResult,
} from "@/lib/dataTransfer/importers";
import { importPolicyRows } from "@/lib/policies/import";

const BUCKET = "backups";

/** Todas las filas quedan ya en la MISMA forma "fila de CSV" (claves de los
 * diccionarios de dataTransfer/constants.ts, todo string) que consume el
 * motor de import — así "Restaurar" puede reusar exactamente los mismos
 * importContactRows/importTaskRows/importEventRows/importPolicyRows en vez
 * de un segundo camino de inserción. Nunca borra ni sobreescribe: restaurar
 * es un import más (dedupe por teléfono/N° de póliza), nunca una restauración
 * destructiva de la base — un backup mal restaurado no puede corromper un
 * workspace en producción. */
interface BackupSnapshot {
  createdAt: string;
  contacts: Record<string, string>[];
  policies: Record<string, string>[];
  tasks: Record<string, string>[];
  events: Record<string, string>[];
}

function toRow(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]));
}

const IDENTITY_MAPPING = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, k]));

async function buildSnapshot(workspaceId: string): Promise<BackupSnapshot> {
  const supabase = await createClient();

  const [{ data: contacts }, policies, { data: tasks }, { data: events }] = await Promise.all([
    supabase.from("contacts").select("name, phone, email, company, dni, cuit").eq("workspace_id", workspaceId),
    getPolicyList(workspaceId),
    supabase.from("tasks").select("title, description, due_at, priority, status").eq("workspace_id", workspaceId),
    supabase.from("bookings").select("subject, description, start_time, end_time, location").eq("workspace_id", workspaceId),
  ]);

  return {
    createdAt: new Date().toISOString(),
    contacts: (contacts ?? []).map((c) => toRow(c)),
    policies: policies.map((p) =>
      toRow({
        policyNumber: p.policyNumber,
        company: p.company,
        product: p.product,
        insuranceType: p.insuranceType,
        startDate: p.startDate,
        endDate: p.endDate,
        premium: p.premium,
        premiumCurrency: p.premiumCurrency,
        paymentFrequency: p.paymentFrequency,
        commissionAmount: p.commissionAmount,
        contactName: p.contactName,
        contactPhone: p.contactPhone,
        contactEmail: p.contactEmail,
        ownerName: p.ownerName,
      }),
    ),
    tasks: (tasks ?? []).map((t) =>
      toRow({ title: t.title, description: t.description, dueDate: (t.due_at as string | null)?.slice(0, 10) ?? "", priority: t.priority, status: t.status }),
    ),
    events: (events ?? []).map((e) =>
      toRow({
        subject: e.subject,
        description: e.description,
        startDate: (e.start_time as string).slice(0, 10),
        startTime: (e.start_time as string).slice(11, 16),
        endDate: (e.end_time as string).slice(0, 10),
        endTime: (e.end_time as string).slice(11, 16),
        location: e.location,
      }),
    ),
  };
}

export interface BackupSummary {
  id: string;
  storagePath: string;
  sizeBytes: number;
  entityCounts: Record<string, number>;
  createdByName: string | null;
  createdAt: string;
}

export async function createBackup(workspaceId: string, memberId: string | null): Promise<BackupSummary> {
  const snapshot = await buildSnapshot(workspaceId);
  const json = JSON.stringify(snapshot);
  const path = `${workspaceId}/backup-${Date.now()}.json`;

  const service = createServiceRoleClient();
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, json, { contentType: "application/json" });
  if (uploadError) throw new Error("No se pudo guardar el backup.");

  const entityCounts = { contacts: snapshot.contacts.length, policies: snapshot.policies.length, tasks: snapshot.tasks.length, events: snapshot.events.length };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_backups")
    .insert({ workspace_id: workspaceId, storage_path: path, size_bytes: Buffer.byteLength(json), entity_counts: entityCounts, created_by: memberId })
    .select("id, storage_path, size_bytes, entity_counts, created_at")
    .single();
  if (error || !data) throw new Error("No se pudo registrar el backup.");

  return {
    id: data.id as string,
    storagePath: data.storage_path as string,
    sizeBytes: data.size_bytes as number,
    entityCounts: data.entity_counts as Record<string, number>,
    createdByName: null,
    createdAt: data.created_at as string,
  };
}

export async function getBackups(workspaceId: string): Promise<BackupSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_backups")
    .select("id, storage_path, size_bytes, entity_counts, created_by, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  const actorIds = [...new Set(rows.map((r) => r.created_by).filter((id): id is string => Boolean(id)))];
  const { data: names } = actorIds.length ? await supabase.rpc("workspace_member_names", { ws_id: workspaceId }) : { data: [] as { member_id: string; full_name: string }[] };
  const nameByMember = new Map<string, string>(((names ?? []) as { member_id: string; full_name: string }[]).map((n) => [n.member_id, n.full_name]));

  return rows.map((r) => ({
    id: r.id as string,
    storagePath: r.storage_path as string,
    sizeBytes: r.size_bytes as number,
    entityCounts: (r.entity_counts as Record<string, number>) ?? {},
    createdByName: r.created_by ? (nameByMember.get(r.created_by as string) ?? null) : null,
    createdAt: r.created_at as string,
  }));
}

export async function getBackupDownloadUrl(workspaceId: string, backupId: string): Promise<string> {
  const supabase = await createClient();
  const { data: backup } = await supabase.from("data_backups").select("storage_path").eq("id", backupId).eq("workspace_id", workspaceId).maybeSingle();
  if (!backup) throw new Error("Backup no encontrado.");

  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(backup.storage_path as string, 60);
  if (error || !data) throw new Error("No se pudo generar el link de descarga.");
  return data.signedUrl;
}

export interface RestoreSummary {
  contacts: ImportResult;
  policies: ImportResult;
  tasks: ImportResult;
  events: ImportResult;
}

/** "Restaurar" reusa el motor de import — nunca un INSERT crudo — así queda
 * protegido por el mismo dedupe (teléfono para contactos, N° de póliza vía
 * findOrCreateContact) que cualquier importación manual. Nunca borra filas
 * existentes; en el peor caso, no agrega nada nuevo. */
export async function restoreBackup(workspaceId: string, memberId: string | null, backupId: string): Promise<RestoreSummary> {
  const supabase = await createClient();
  const { data: backup } = await supabase.from("data_backups").select("storage_path").eq("id", backupId).eq("workspace_id", workspaceId).maybeSingle();
  if (!backup) throw new Error("Backup no encontrado.");

  const service = createServiceRoleClient();
  const { data: file, error } = await service.storage.from(BUCKET).download(backup.storage_path as string);
  if (error || !file) throw new Error("No se pudo leer el backup.");
  const snapshot = JSON.parse(await file.text()) as BackupSnapshot;

  const contactsResult = await importContactRows(workspaceId, snapshot.contacts, IDENTITY_MAPPING(["name", "phone", "email", "company", "dni", "cuit"]));
  await logImportJob(workspaceId, memberId, "contacts", "restore-backup", snapshot.contacts.length, contactsResult);

  const policiesRaw = await importPolicyRows(
    workspaceId,
    memberId,
    snapshot.policies,
    IDENTITY_MAPPING(["policyNumber", "company", "product", "insuranceType", "startDate", "endDate", "premium", "premiumCurrency", "paymentFrequency", "commissionAmount", "contactName", "contactPhone", "contactEmail", "ownerName"]),
    memberId,
  );
  const policiesResult: ImportResult = { created: policiesRaw.created, errors: policiesRaw.errors };
  await logImportJob(workspaceId, memberId, "policies", "restore-backup", snapshot.policies.length, policiesResult);

  const tasksResult = await importTaskRows(workspaceId, memberId, snapshot.tasks, IDENTITY_MAPPING(["title", "description", "dueDate", "priority", "status"]));
  await logImportJob(workspaceId, memberId, "tasks", "restore-backup", snapshot.tasks.length, tasksResult);

  const eventsResult = await importEventRows(
    workspaceId,
    memberId,
    snapshot.events,
    IDENTITY_MAPPING(["subject", "description", "startDate", "startTime", "endDate", "endTime", "location"]),
  );
  await logImportJob(workspaceId, memberId, "events", "restore-backup", snapshot.events.length, eventsResult);

  return { contacts: contactsResult, policies: policiesResult, tasks: tasksResult, events: eventsResult };
}
