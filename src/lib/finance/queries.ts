import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCollectionsList } from "@/lib/collections/queries";
import { DEFAULT_FINANCE_RATES, type FinanceItem, type FinanceRecurrence, type FinanceSettings, type FinanceCategory, type FinanceType } from "./model";

interface FinanceEntryRow {
  id: string;
  type: FinanceType;
  category: FinanceCategory;
  title: string;
  party: string | null;
  amount: number | string;
  currency: string;
  due_date: string;
  recurrence: FinanceRecurrence | null;
  payment_method: string | null;
  method_detail: string | null;
  paid: boolean;
  paid_date: string | null;
  notes: string | null;
}

export function mapFinanceEntry(r: FinanceEntryRow): FinanceItem {
  return {
    key: `manual:${r.id}`,
    id: r.id,
    source: "manual",
    type: r.type,
    cat: r.category,
    title: r.title,
    party: r.party ?? "",
    amount: Number(r.amount),
    cur: r.currency,
    date: r.due_date,
    rec: r.recurrence ?? "",
    method: r.payment_method ?? "",
    methodDetail: r.method_detail ?? "",
    paid: r.paid,
    paidDate: r.paid_date,
    notes: r.notes ?? "",
    policyId: null,
    contactPhone: null,
  };
}

/** Gastos y cobros manuales + cobros de pólizas (sin los cancelados), en un solo listado. */
export async function getFinanceItems(workspaceId: string): Promise<FinanceItem[]> {
  const supabase = await createClient();
  const [{ data: entries }, collections] = await Promise.all([
    supabase.from("finance_entries").select("*").eq("workspace_id", workspaceId).order("due_date", { ascending: true }),
    getCollectionsList(workspaceId),
  ]);

  const policyItems: FinanceItem[] = collections
    .filter((c) => c.status !== "cancelado")
    .map((c) => ({
      key: `policy:${c.id}`,
      id: c.id,
      source: "policy",
      type: "in",
      cat: "poliza",
      title: `Póliza${c.product ? " " + c.product : ""} — ${c.company}`,
      party: c.contactName === "—" ? "" : c.contactName,
      amount: Number(c.amount),
      cur: c.currency,
      date: c.dueDate,
      rec: "",
      method: c.paymentMethod ?? "",
      methodDetail: c.policyNumber ? `Póliza ${c.policyNumber}` : "",
      paid: c.status === "pagado",
      paidDate: c.paidAt ? c.paidAt.slice(0, 10) : null,
      notes: c.notes ?? "",
      policyId: c.policyId,
      contactPhone: c.contactPhone,
    }));

  return [...((entries ?? []) as FinanceEntryRow[]).map(mapFinanceEntry), ...policyItems];
}

/** Sin configuración guardada: totales en la moneda que más usan los movimientos de la cuenta. */
export async function getFinanceSettings(workspaceId: string, items: FinanceItem[]): Promise<FinanceSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("finance_settings").select("base_currency, rates").eq("workspace_id", workspaceId).maybeSingle();
  if (data) return { baseCurrency: data.base_currency as string, rates: { ...DEFAULT_FINANCE_RATES, ...((data.rates as Record<string, number>) ?? {}) } };

  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.cur, (counts.get(i.cur) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { baseCurrency: top ?? "USD", rates: { ...DEFAULT_FINANCE_RATES } };
}
