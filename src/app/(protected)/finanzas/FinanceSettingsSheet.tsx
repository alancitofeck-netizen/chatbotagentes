"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import { saveFinanceSettingsAction } from "@/lib/finance/actions";
import { FINANCE_CURRENCIES, type FinanceSettings } from "@/lib/finance/model";

/** Moneda en la que se muestran los totales y tipo de cambio de cada cuenta. */
export function FinanceSettingsSheet({ settings, onClose, onSaved }: { settings: FinanceSettings; onClose: () => void; onSaved: (s: FinanceSettings) => void }) {
  const [base, setBase] = useState(settings.baseCurrency);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(FINANCE_CURRENCIES.filter((c) => c !== "USD").map((c) => [c, String(settings.rates[c] ?? "")])));
  const [saving, setSaving] = useState(false);

  async function save() {
    const next: FinanceSettings = { baseCurrency: base, rates: { USD: 1, ...Object.fromEntries(Object.entries(rates).map(([c, v]) => [c, parseFloat(v)])) } };
    setSaving(true);
    try {
      await saveFinanceSettingsAction(next);
      onSaved(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Moneda y tipo de cambio" className="max-w-[420px]">
      <div className="px-5 pb-6 pt-4">
        <p className="text-sm text-neutral-500">Los totales se muestran en una sola moneda. Cada movimiento conserva su moneda original.</p>
        <span className="mb-1.5 mt-4 block text-xs font-semibold text-neutral-500">Mostrar totales en</span>
        <div className="flex gap-1.5">
          {FINANCE_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={base === c}
              onClick={() => setBase(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${base === c ? "border-accent-500 bg-accent-50 text-accent-600" : "border-border-default bg-surface-2"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="mb-1.5 mt-4 block text-xs font-semibold text-neutral-500">Tipo de cambio (1 USD =)</span>
        <div className="grid gap-2">
          {Object.keys(rates).map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-2 px-3 py-2">
              <span className="w-12 font-mono text-sm font-semibold">{c}</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rates[c]}
                onChange={(e) => setRates((r) => ({ ...r, [c]: e.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-right font-mono outline-none"
              />
            </label>
          ))}
        </div>
        <button type="button" onClick={save} disabled={saving} className="mt-5 w-full rounded-[14px] bg-accent-600 p-3.5 font-bold text-white disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Sheet>
  );
}
