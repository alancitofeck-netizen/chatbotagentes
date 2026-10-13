"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { saveManychatSheetLink } from "@/lib/manychat/sheetLink";
import { extractSheetRef } from "@/lib/manychat/sheetSource";
import { isStageId } from "@/lib/manychat/leads";

export interface SheetLinkState {
  ok: boolean;
  error: string | null;
}

/** Guarda el link de la hoja de ManyChat. Owner, admin o agent (el asesor administra su propio
 * workspace, igual que sus integraciones de Google); nunca en modo supervisor. */
export async function saveSheetLinkAction(_prev: SheetLinkState, formData: FormData): Promise<SheetLinkState> {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (isSupervising) return { ok: false, error: "Modo supervisor: no podés modificar un workspace que no es el tuyo." };
  if (role !== "owner" && role !== "admin" && role !== "agent") return { ok: false, error: "No tenés permiso para cambiar la hoja." };

  const url = String(formData.get("sheetUrl") ?? "").trim();
  if (!extractSheetRef(url)) return { ok: false, error: "Pegá el link de una hoja de Google Sheets." };

  const saved = await saveManychatSheetLink(workspaceId, url);
  if (!saved) return { ok: false, error: "No se pudo guardar la hoja. Probá de nuevo." };

  revalidatePath("/manychat");
  return { ok: true, error: null };
}

export interface LeadEdit {
  nombre?: string;
  telefono?: string;
  email?: string;
  usuario?: string;
  nota?: string;
  etapa?: string;
  valor?: number | null;
}

const TEXT_FIELDS = ["nombre", "telefono", "email", "usuario", "nota"] as const;

/** Guarda la edición de un lead de ManyChat (solo los campos que cambiaron). La hoja no se toca: la edición
 * vive en manychat_lead_overrides y se aplica encima al leer. Mismos permisos que la hoja. */
export async function saveLeadEditAction(ref: string, changes: LeadEdit): Promise<{ ok: boolean; error: string | null }> {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (isSupervising) return { ok: false, error: "Modo supervisor: no podés modificar un workspace que no es el tuyo." };
  if (role !== "owner" && role !== "admin" && role !== "agent") return { ok: false, error: "No tenés permiso para editar leads." };
  if (!ref || ref.length > 300) return { ok: false, error: "No se encontró el lead." };

  const row: Record<string, string | number | null> = {};
  for (const field of TEXT_FIELDS) {
    const value = changes[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 2000) return { ok: false, error: "Hay un dato inválido." };
    row[field] = value.trim();
  }
  if (changes.etapa !== undefined) {
    if (!isStageId(changes.etapa)) return { ok: false, error: "Elegí un estado válido." };
    row.etapa = changes.etapa;
  }
  if (changes.valor !== undefined) {
    if (changes.valor !== null && (typeof changes.valor !== "number" || !Number.isFinite(changes.valor) || changes.valor < 0)) {
      return { ok: false, error: "El valor tiene que ser un número." };
    }
    row.valor = changes.valor;
  }
  if (Object.keys(row).length === 0) return { ok: true, error: null };

  const supabase = await createClient();
  const memberId = await getCurrentMemberId(workspaceId);
  const { error } = await supabase
    .from("manychat_lead_overrides")
    .upsert(
      { ...row, workspace_id: workspaceId, lead_ref: ref, updated_by: memberId, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,lead_ref" },
    );
  if (error) return { ok: false, error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/manychat");
  return { ok: true, error: null };
}

/** Devuelve el id de la fila del lead en manychat_lead_overrides (la crea vacía si no existe), para asociarle
 * PDFs en Documentos: los leads de la hoja no tienen un uuid propio. Una fila vacía no marca el lead como
 * editado. Mismos permisos que la edición. */
export async function ensureLeadRecordAction(ref: string): Promise<{ ok: true; recordId: string; workspaceId: string } | { ok: false; error: string }> {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (isSupervising) return { ok: false, error: "Modo supervisor: no podés modificar un workspace que no es el tuyo." };
  if (role !== "owner" && role !== "admin" && role !== "agent") return { ok: false, error: "No tenés permiso para subir archivos." };
  if (!ref || ref.length > 300) return { ok: false, error: "No se encontró el lead." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("manychat_lead_overrides")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("lead_ref", ref)
    .maybeSingle();
  if (existing) return { ok: true, recordId: existing.id as string, workspaceId };

  const memberId = await getCurrentMemberId(workspaceId);
  const { data, error } = await supabase
    .from("manychat_lead_overrides")
    .insert({ workspace_id: workspaceId, lead_ref: ref, updated_by: memberId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo preparar el lead para el archivo." };
  return { ok: true, recordId: data.id as string, workspaceId };
}
