"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { saveFinanceEntryAction, type FinanceEntryInput } from "@/lib/finance/actions";
import { FINANCE_CATEGORIES, FINANCE_CURRENCIES, FINANCE_METHODS, methodIcon, type FinanceCategory, type FinanceItem, type FinanceRecurrence, type FinanceType } from "@/lib/finance/model";

const INPUT = "w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent-500";
const LABEL = "mb-1.5 mt-3 block text-xs font-semibold text-neutral-500";

function Chips<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={cn("rounded-full border px-3 py-1.5 text-[13px] font-medium", v === value ? "border-accent-500 bg-accent-50 text-accent-600" : "border-border-default bg-surface-2")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** Alta / edición de un gasto o cobro. Se monta de nuevo en cada apertura (key en el padre), así
 * el estado inicial sale directo de las props. Un cobro de póliza solo deja cambiar monto,
 * moneda, vencimiento y notas. */
export function FinanceEntrySheet({ item, initialType, initialDate, onClose, onSaved }: { item: FinanceItem | null; initialType: FinanceType; initialDate: string; onClose: () => void; onSaved: (message: string) => void }) {
  const isPolicy = item?.source === "policy";
  const [type, setType] = useState<FinanceType>(item?.type ?? initialType);
  const [cat, setCat] = useState<FinanceCategory>(item?.cat ?? (initialType === "out" ? "herramienta" : "asesoria"));
  const [method, setMethod] = useState(item?.method ?? "");
  const [paid, setPaid] = useState(item ? item.paid : initialType === "out");
  const [amount, setAmount] = useState(item ? String(item.amount) : "");
  const [cur, setCur] = useState(item?.cur ?? "MXN");
  const [title, setTitle] = useState(item?.title ?? "");
  const [party, setParty] = useState(item?.party ?? "");
  const [methodDetail, setMethodDetail] = useState(item?.methodDetail ?? "");
  const [date, setDate] = useState(item?.date ?? initialDate);
  const [rec, setRec] = useState<FinanceRecurrence>(item?.rec ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function changeType(t: FinanceType) {
    setType(t);
    if (FINANCE_CATEGORIES[cat].type !== t) setCat(t === "out" ? "herramienta" : "asesoria");
    setPaid(t === "out");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (type === "out" && !method && !isPolicy) {
      toast.error("Elegí el medio de pago.");
      return;
    }
    const input: FinanceEntryInput = { type, cat, title, party, amount: parseFloat(amount), cur, date, rec, method, methodDetail, paid, notes };
    setSaving(true);
    try {
      await saveFinanceEntryAction(input, item?.key);
      onSaved(item ? "Cambios guardados" : "Guardado ✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  const cats = (Object.entries(FINANCE_CATEGORIES) as [FinanceCategory, (typeof FINANCE_CATEGORIES)[FinanceCategory]][]).filter(([, c]) => c.type === type);
  const accent = type === "out" ? "bg-[#c2410c] dark:bg-[#f08a4b]" : "bg-success";
  const currencies = FINANCE_CURRENCIES.includes(cur as (typeof FINANCE_CURRENCIES)[number]) ? FINANCE_CURRENCIES : [...FINANCE_CURRENCIES, cur];

  return (
    <Sheet open onClose={onClose} title={item ? (isPolicy ? "Editar cobro de póliza" : "Editar movimiento") : type === "out" ? "Nuevo gasto" : "Nuevo cobro"} className="max-w-[560px]">
      <form onSubmit={handleSubmit} className="px-5 pb-6 pt-4">
        {!isPolicy && (
          <div className="mb-3.5 grid grid-cols-2 gap-2">
            {(["out", "in"] as FinanceType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => changeType(t)}
                className={cn(
                  "rounded-[14px] border-2 p-2.5 text-sm font-semibold",
                  type !== t && "border-border-default bg-surface-2",
                  type === t && t === "out" && "border-[#c2410c] bg-[#fdeee6] text-[#c2410c] dark:border-[#f08a4b] dark:bg-[#33221a] dark:text-[#f08a4b]",
                  type === t && t === "in" && "border-success bg-success-bg text-success",
                )}
              >
                {t === "out" ? "↑ Gasto" : "↓ Cobro"}
              </button>
            ))}
          </div>
        )}
        {isPolicy && (
          <div className="mb-3.5 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <div className="font-semibold">{item.title}</div>
            <div className="text-xs text-neutral-500">
              {item.party || "—"}
              {item.methodDetail ? ` · ${item.methodDetail}` : ""}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-border-default bg-surface-2 px-3 py-2.5">
          <span className="font-mono text-[22px] text-neutral-500">$</span>
          <input
            aria-label="Monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            autoFocus
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-[28px] font-bold outline-none"
          />
          <select aria-label="Moneda" value={cur} onChange={(e) => setCur(e.target.value)} className="rounded-[10px] border border-border-default bg-surface-1 px-2 py-1.5 font-semibold">
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {!isPolicy && (
          <>
            <div className="grid grid-cols-1 gap-x-2.5 sm:grid-cols-2">
              <Field label="Descripción">
                <input required className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "out" ? "Ej: ManyChat Pro" : "Ej: Asesoría de retiro"} />
              </Field>
              <Field label={type === "out" ? "Proveedor" : "Cliente"}>
                <input className={INPUT} value={party} onChange={(e) => setParty(e.target.value)} placeholder="Nombre" />
              </Field>
            </div>
            <span className={LABEL}>Categoría</span>
            <Chips label="Categoría" options={cats.map(([k, c]) => [k, `${c.icon} ${c.label}`])} value={cat} onChange={setCat} />
            <span className={LABEL}>{type === "out" ? "Medio de pago" : "Medio de cobro (opcional)"}</span>
            <Chips label="Medio de pago" options={FINANCE_METHODS.map((m) => [m, `${methodIcon(m)} ${m}`])} value={method} onChange={(v) => setMethod((cur) => (cur === v && type === "in" ? "" : v))} />
            <input className={cn(INPUT, "mt-2")} value={methodDetail} onChange={(e) => setMethodDetail(e.target.value)} placeholder="Detalle (opcional): Visa terminada en 4417, cuenta BBVA…" />
            <span className={LABEL}>Estado</span>
            <Chips
              label="Estado"
              options={type === "out" ? [["1", "✓ Ya lo pagué"], ["0", "⏳ Pendiente"]] : [["0", "⏳ Pendiente"], ["1", "✓ Ya lo cobré"]]}
              value={paid ? "1" : "0"}
              onChange={(v) => setPaid(v === "1")}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-x-2.5">
          <Field label={isPolicy ? "Vencimiento" : "Fecha"}>
            <input required type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {!isPolicy && (
            <Field label="Se repite">
              <select className={INPUT} value={rec} onChange={(e) => setRec(e.target.value as FinanceRecurrence)}>
                <option value="">No</option>
                <option value="mensual">Mensual</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Notas">
          <textarea rows={2} className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </Field>

        <button type="submit" disabled={saving} className={cn("mt-5 w-full rounded-[14px] p-3.5 text-[15px] font-bold text-white disabled:opacity-60", accent)}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </Sheet>
  );
}
