"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { registerPaymentAction, updateCollectionStatusAction, updateCollectionAction, cancelCollectionAction } from "@/lib/collections/actions";
import { getFinanceItems, getFinanceSettings } from "./queries";
import { FINANCE_CATEGORIES, nextRecurrenceDate, isoDate, type FinanceCategory, type FinanceItem, type FinanceRecurrence, type FinanceSettings, type FinanceType } from "./model";

/** Finanzas (ex Cobranza, module_key "collections"). Los movimientos "manual" viven en
 * finance_entries; los cobros de pólizas ("policy") se siguen escribiendo con las acciones de
 * Cobranza (collections/actions.ts), así la póliza y sus recordatorios automáticos quedan al día. */

async function requireFinanceWorkspace(): Promise<string> {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");
  return workspaceId;
}

function parseKey(key: string): { source: "manual" | "policy"; id: string } {
  const [source, id] = key.split(":");
  if ((source !== "manual" && source !== "policy") || !id) throw new Error("Movimiento inválido.");
  return { source, id };
}

export async function getFinanceDataAction(): Promise<{ items: FinanceItem[]; settings: FinanceSettings }> {
  const workspaceId = await requireFinanceWorkspace();
  const items = await getFinanceItems(workspaceId);
  return { items, settings: await getFinanceSettings(workspaceId, items) };
}

export interface FinanceEntryInput {
  type: FinanceType;
  cat: FinanceCategory;
  title: string;
  party: string;
  amount: number;
  cur: string;
  date: string;
  rec: FinanceRecurrence;
  method: string;
  methodDetail: string;
  paid: boolean;
  notes: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(input: FinanceEntryInput) {
  if (input.type !== "in" && input.type !== "out") throw new Error("Tipo inválido.");
  if (!FINANCE_CATEGORIES[input.cat] || FINANCE_CATEGORIES[input.cat].type !== input.type) throw new Error("Elegí una categoría.");
  if (!input.title.trim()) throw new Error("Poné una descripción.");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("El monto no es válido.");
  if (!DATE_RE.test(input.date)) throw new Error("La fecha no es válida.");
  if (input.type === "out" && !input.method) throw new Error("Elegí el medio de pago.");
  if (!/^[A-Z]{3}$/.test(input.cur)) throw new Error("Moneda inválida.");
}

/** Alta o edición de un gasto/cobro manual. Para un cobro de póliza (key "policy:…") solo se
 * pueden cambiar monto, moneda, vencimiento y notas — el resto sale de la póliza. */
export async function saveFinanceEntryAction(input: FinanceEntryInput, key?: string): Promise<void> {
  const workspaceId = await requireFinanceWorkspace();

  if (key) {
    const { source, id } = parseKey(key);
    if (source === "policy") {
      if (!Number.isFinite(input.amount) || input.amount < 0 || !DATE_RE.test(input.date)) throw new Error("Revisá el monto y la fecha.");
      await updateCollectionAction(id, { amount: input.amount, currency: input.cur, dueDate: input.date, notes: input.notes });
      revalidatePath("/finanzas");
      return;
    }
  }

  validate(input);
  const supabase = await createClient();
  const row = {
    type: input.type,
    category: input.cat,
    title: input.title.trim(),
    party: input.party.trim() || null,
    amount: input.amount,
    currency: input.cur,
    due_date: input.date,
    recurrence: input.rec || null,
    payment_method: input.method || null,
    method_detail: input.methodDetail.trim() || null,
    paid: input.paid,
    notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (key) {
    const { id } = parseKey(key);
    const { data: current } = await supabase.from("finance_entries").select("paid, paid_date").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
    if (!current) throw new Error("Ese movimiento ya no existe.");
    const paidDate = input.paid ? ((current.paid && current.paid_date) as string | null) || input.date : null;
    const { error } = await supabase.from("finance_entries").update({ ...row, paid_date: paidDate }).eq("id", id).eq("workspace_id", workspaceId);
    if (error) throw new Error("No se pudieron guardar los cambios.");
  } else {
    const memberId = await getCurrentMemberId(workspaceId);
    const { error } = await supabase.from("finance_entries").insert({ ...row, workspace_id: workspaceId, created_by: memberId, paid_date: input.paid ? input.date : null });
    if (error) throw new Error("No se pudo guardar el movimiento.");
  }
  revalidatePath("/finanzas");
}

/** Marcar pagado/cobrado (o volver a pendiente). Un movimiento recurrente marcado pagado genera
 * el siguiente vencimiento (si todavía no existe). */
export async function setFinancePaidAction(key: string, paid: boolean): Promise<void> {
  const workspaceId = await requireFinanceWorkspace();
  const { source, id } = parseKey(key);

  if (source === "policy") {
    if (paid) await registerPaymentAction(id, { paymentMethod: null });
    else await updateCollectionStatusAction(id, "pendiente");
    revalidatePath("/finanzas");
    return;
  }

  const supabase = await createClient();
  const { data: entry } = await supabase.from("finance_entries").select("*").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (!entry) throw new Error("Ese movimiento ya no existe.");

  const { error } = await supabase
    .from("finance_entries")
    .update({ paid, paid_date: paid ? isoDate(new Date()) : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el movimiento.");

  const next = paid ? nextRecurrenceDate(entry.due_date as string, (entry.recurrence as FinanceRecurrence | null) ?? "") : null;
  if (next) {
    const { data: existing } = await supabase
      .from("finance_entries")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("type", entry.type)
      .eq("title", entry.title)
      .eq("due_date", next)
      .limit(1);
    if (!existing?.length) {
      const copied = ["workspace_id", "type", "category", "title", "party", "amount", "currency", "recurrence", "payment_method", "method_detail", "notes", "created_by"] as const;
      await supabase.from("finance_entries").insert({ ...Object.fromEntries(copied.map((k) => [k, entry[k]])), due_date: next, paid: false, paid_date: null });
    }
  }
  revalidatePath("/finanzas");
}

/** Borrar un movimiento manual. Un cobro de póliza no se borra: se cancela (queda en el historial
 * de la póliza, igual que en Cobranza). */
export async function deleteFinanceItemAction(key: string): Promise<void> {
  const workspaceId = await requireFinanceWorkspace();
  const { source, id } = parseKey(key);
  if (source === "policy") {
    await cancelCollectionAction(id);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.from("finance_entries").delete().eq("id", id).eq("workspace_id", workspaceId);
    if (error) throw new Error("No se pudo borrar el movimiento.");
  }
  revalidatePath("/finanzas");
}

export async function saveFinanceSettingsAction(settings: FinanceSettings): Promise<void> {
  const workspaceId = await requireFinanceWorkspace();
  if (!/^[A-Z]{3}$/.test(settings.baseCurrency)) throw new Error("Moneda inválida.");
  const rates: Record<string, number> = { USD: 1 };
  for (const [cur, value] of Object.entries(settings.rates)) {
    if (!/^[A-Z]{3}$/.test(cur) || cur === "USD") continue;
    if (!Number.isFinite(value) || value <= 0) throw new Error(`El tipo de cambio de ${cur} no es válido.`);
    rates[cur] = value;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_settings")
    .upsert({ workspace_id: workspaceId, base_currency: settings.baseCurrency, rates, updated_at: new Date().toISOString() });
  if (error) throw new Error("No se pudo guardar. Solo el dueño o un admin de la cuenta pueden cambiarlo.");
  revalidatePath("/finanzas");
}
